"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Loader2, X } from "lucide-react";

/**
 * Structured address parts returned when the user picks a suggestion.
 * All fields may be empty strings if the API doesn't return that component.
 */
export type AddressParts = {
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip_code: string;
};

export const US_STATES = [
  { value: "", label: "Select state" },
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" }, { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" }, { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" }, { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" }, { value: "HI", label: "Hawaii" }, { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" }, { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" }, { value: "KY", label: "Kentucky" }, { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" }, { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" }, { value: "MN", label: "Minnesota" }, { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" }, { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" }, { value: "NH", label: "New Hampshire" }, { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" }, { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" }, { value: "OH", label: "Ohio" }, { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" }, { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" }, { value: "SD", label: "South Dakota" }, { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" }, { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" }, { value: "WA", label: "Washington" }, { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" }, { value: "DC", label: "District of Columbia" },
] as const;

/**
 * Map from full state name → abbreviation for parsing Google Places results.
 */
const STATE_NAME_TO_ABBR: Record<string, string> = {};
for (const s of US_STATES) {
  if (s.value) STATE_NAME_TO_ABBR[s.label.toLowerCase()] = s.value;
}

type Suggestion = {
  placeId: string;
  description: string;
};

type AddressAutocompleteProps = Readonly<{
  /** Current street address value (controlled) */
  value: string;
  /** Called on every keystroke in the street field */
  onChange: (value: string) => void;
  /** Called when the user picks a suggestion — fills all address parts */
  onSelect: (parts: AddressParts) => void;
  /** Input HTML id */
  id?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Disable the input */
  disabled?: boolean;
  /** Additional CSS class for the outer wrapper */
  className?: string;
}>;

/* ------------------------------------------------------------------ */
/* Google Maps script loader — loads via <script> tag, no npm package */
/* ------------------------------------------------------------------ */

let googleLoaded = false;
let googleLoadFailed = false;
let loadPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (googleLoaded) return Promise.resolve();
  if (googleLoadFailed) return Promise.reject(new Error("Google Maps failed to load"));
  if (loadPromise) return loadPromise;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    googleLoadFailed = true;
    return Promise.reject(new Error("No API key"));
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    // If google.maps.places already exists (loaded elsewhere), skip
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (win.google?.maps?.places) {
      googleLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      googleLoaded = true;
      resolve();
    };
    script.onerror = () => {
      googleLoadFailed = true;
      loadPromise = null;
      reject(new Error("Failed to load Google Maps script"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

/** Helpers to access the google.maps namespace at runtime without TS types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function gm(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).google.maps;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  id,
  placeholder = "Start typing an address…",
  disabled = false,
  className,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autocompleteServiceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const placesServiceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionTokenRef = useRef<any>(null);

  // Try loading Google Maps on mount
  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        const places = gm().places;
        autocompleteServiceRef.current = new places.AutocompleteService();
        const div = document.createElement("div");
        placesServiceRef.current = new places.PlacesService(div);
        sessionTokenRef.current = new places.AutocompleteSessionToken();
        setApiAvailable(true);
      })
      .catch(() => {
        setApiAvailable(false);
      });
  }, []);

  const fetchSuggestions = useCallback(
    (input: string) => {
      if (!autocompleteServiceRef.current || !input.trim()) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      autocompleteServiceRef.current.getPlacePredictions(
        {
          input,
          componentRestrictions: { country: "us" },
          types: ["address"],
          sessionToken: sessionTokenRef.current ?? undefined,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (predictions: any[] | null, status: string) => {
          setIsLoading(false);
          if (status === "OK" && predictions) {
            setSuggestions(
              predictions.map((p) => ({
                placeId: p.place_id,
                description: p.description,
              })),
            );
            setIsOpen(true);
            setActiveIndex(-1);
          } else {
            setSuggestions([]);
            setIsOpen(false);
          }
        },
      );
    },
    [],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (apiAvailable) {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(val);
      }, 300);
    }
  };

  const selectPlace = useCallback(
    (placeId: string) => {
      if (!placesServiceRef.current) return;

      placesServiceRef.current.getDetails(
        {
          placeId,
          fields: ["address_components"],
          sessionToken: sessionTokenRef.current ?? undefined,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (place: any, status: string) => {
          // Reset session token after getDetails (per Google billing best practice)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sessionTokenRef.current = new (gm().places.AutocompleteSessionToken as any)();

          if (status !== "OK" || !place?.address_components) {
            return;
          }

          let streetNumber = "";
          let route = "";
          let city = "";
          let state = "";
          let zipCode = "";

          for (const component of place.address_components) {
            const types: string[] = component.types;
            if (types.includes("street_number")) {
              streetNumber = component.long_name;
            } else if (types.includes("route")) {
              route = component.long_name;
            } else if (types.includes("locality")) {
              city = component.long_name;
            } else if (types.includes("sublocality_level_1") && !city) {
              city = component.long_name;
            } else if (types.includes("administrative_area_level_1")) {
              state =
                component.short_name ||
                STATE_NAME_TO_ABBR[component.long_name.toLowerCase()] ||
                component.long_name;
            } else if (types.includes("postal_code")) {
              zipCode = component.long_name;
            }
          }

          const line1 = [streetNumber, route].filter(Boolean).join(" ");

          onChange(line1);
          onSelect({
            address_line1: line1,
            address_line2: "",
            city,
            state,
            zip_code: zipCode,
          });
        },
      );

      setSuggestions([]);
      setIsOpen(false);
    },
    [onChange, onSelect],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          selectPlace(suggestions[activeIndex].placeId);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target as Node) &&
        listRef.current &&
        !listRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const handleClear = () => {
    onChange("");
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400 dark:text-zinc-500" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={isOpen ? `${id ?? "address"}-listbox` : undefined}
          aria-activedescendant={
            activeIndex >= 0 ? `${id ?? "address"}-option-${activeIndex}` : undefined
          }
          className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-9 pr-8 text-sm text-stone-900 outline-none ring-0 transition focus:border-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-stone-400 dark:text-zinc-500" />
        )}
        {!isLoading && value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 transition hover:text-stone-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            aria-label="Clear address"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul
          ref={listRef}
          id={`${id ?? "address"}-listbox`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-stone-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.placeId}
              id={`${id ?? "address"}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                selectPlace(suggestion.placeId);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition ${
                index === activeIndex
                  ? "bg-[var(--color-brand-subtle)] text-[var(--color-brand-primary)]"
                  : "text-stone-700 hover:bg-stone-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-stone-400 dark:text-zinc-500" />
              <span className="truncate">{suggestion.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
