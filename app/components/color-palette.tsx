"use client";

import { useRef } from "react";
import { Check, Palette } from "lucide-react";

type ColorPaletteProps = Readonly<{
  presets: readonly string[];
  value: string | null;
  onChange: (color: string | null) => void;
  disabled?: boolean;
  defaultColor: string;
}>;

export function ColorPalette({
  presets,
  value,
  onChange,
  disabled = false,
  defaultColor,
}: ColorPaletteProps) {
  const colorInputRef = useRef<HTMLInputElement>(null);

  const displayColor = value ?? defaultColor;
  const isCustom = value !== null && !presets.includes(value);

  function handleSwatchClick(color: string) {
    if (disabled) return;
    onChange(color);
  }

  function handleCustomClick() {
    if (disabled) return;
    colorInputRef.current?.click();
  }

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (disabled) return;
    onChange(e.target.value);
  }

  function handleReset() {
    if (disabled) return;
    onChange(null);
  }

  return (
    <div className={disabled ? "opacity-60 cursor-not-allowed" : ""}>
      <div className="flex flex-wrap gap-2">
        {presets.map((color) => {
          const isSelected = displayColor === color;
          return (
            <button
              key={color}
              type="button"
              disabled={disabled}
              onClick={() => handleSwatchClick(color)}
              className={`
                h-8 w-8 rounded-full border-2 transition-all duration-150
                flex items-center justify-center shrink-0
                ${
                  isSelected
                    ? "border-stone-400 dark:border-zinc-500 scale-110"
                    : "border-transparent hover:border-stone-300 dark:hover:border-zinc-600"
                }
                ${disabled ? "cursor-not-allowed" : "cursor-pointer"}
              `}
              style={{ backgroundColor: color }}
              title={color}
            >
              {isSelected && (
                <Check className="h-3.5 w-3.5 text-white drop-shadow-sm" />
              )}
            </button>
          );
        })}

        {/* Custom color swatch */}
        <button
          type="button"
          disabled={disabled}
          onClick={handleCustomClick}
          className={`
            h-8 w-8 rounded-full border-2 border-dashed transition-all duration-150
            flex items-center justify-center shrink-0
            ${
              isCustom
                ? "border-stone-400 dark:border-zinc-500 scale-110"
                : "border-stone-300 dark:border-zinc-600 hover:border-stone-400 dark:hover:border-zinc-500"
            }
            ${disabled ? "cursor-not-allowed" : "cursor-pointer"}
          `}
          style={isCustom ? { backgroundColor: value } : undefined}
          title="Custom color"
        >
          {isCustom ? (
            <Check className="h-3.5 w-3.5 text-white drop-shadow-sm" />
          ) : (
            <Palette className="h-3.5 w-3.5 text-stone-500 dark:text-zinc-400" />
          )}
        </button>

        <input
          ref={colorInputRef}
          type="color"
          value={displayColor}
          onChange={handleCustomChange}
          disabled={disabled}
          className="sr-only"
          tabIndex={-1}
          aria-label="Pick a custom color"
        />
      </div>

      {/* Reset button */}
      <button
        type="button"
        disabled={disabled || value === null}
        onClick={handleReset}
        className={`
          mt-2 text-xs font-medium transition-colors
          ${
            value === null || disabled
              ? "text-stone-400 dark:text-zinc-600 cursor-not-allowed"
              : "text-stone-500 dark:text-zinc-400 hover:text-[var(--color-brand-primary)] cursor-pointer"
          }
        `}
      >
        Reset
      </button>
    </div>
  );
}

export default ColorPalette;
