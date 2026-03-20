# Curator — Project Guidelines

## Overview

Curator is an AI-powered estate sales management SaaS. The `jade/` directory contains the Next.js frontend — currently a pre-launch landing page collecting waitlist signups via Supabase.

## Tech Stack

- **Framework**: Next.js 16 (App Router) with TypeScript 5
- **Styling**: Tailwind CSS v4 (utility-first, `@tailwindcss/postcss`), Framer Motion for animation
- **Icons**: `lucide-react` (import individual icons, never the full library)
- **Utilities**: `clsx` + `tailwind-merge` via `cn()` helper
- **Backend**: Next.js Server Actions (no API routes for simple writes)
- **Database**: Supabase (PostgreSQL) — client in `lib/supabase.ts`
- **Fonts**: Geist Sans + Geist Mono via `next/font/google`

## Build & Test

```bash
cd jade
npm install        # install dependencies
npm run dev        # start dev server (localhost:3000)
npm run build      # production build
npm run lint       # ESLint (next core-web-vitals + typescript)
```

## Architecture

```
jade/
├── app/
│   ├── page.tsx       # Landing page (all sections as inline components)
│   ├── layout.tsx     # Root layout (fonts, metadata)
│   ├── actions.ts     # Server actions (form submissions → Supabase)
│   └── globals.css    # Tailwind imports, CSS variables
├── lib/
│   └── supabase.ts    # Supabase client (uses NEXT_PUBLIC_* env vars)
└── public/            # Static assets (SVGs)
```

- Components are currently inline in `page.tsx`. When extracting, place in `components/` with PascalCase filenames.
- Server actions live in `app/actions.ts`. Add `'use server'` directive. Accept `FormData` for form inputs.
- Path alias `@/*` maps to `jade/*` (configured in `tsconfig.json`).

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_DATABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key (safe for browser)

Never commit service role keys or admin secrets.

## Conventions

### Components
- `"use client"` at top of files with state, effects, or event handlers
- Functional components with hooks (`useState`, `useEffect`)
- PascalCase component names, camelCase for variables/handlers
- `handle` prefix for event handlers (e.g., `handleSubmit`)

### Styling
- **Color palette is strict** — see `.github/style-maintainer.md` for the full design system
  - Light base: `stone-*` / Dark base: `zinc-*`
  - Brand: `indigo-*` / Success: `emerald-*` / Error: `red-*`
  - **Never** use `gray-*`, `slate-*`, `neutral-*`, or `blue-*`
- Every light color **must** have a `dark:` counterpart
- Complex animations → Framer Motion, not Tailwind `animate-*` utilities
- No CSS modules or styled-components — Tailwind utilities only

### TypeScript
- Strict mode enabled. Annotate function parameters and return types where non-obvious.
- Use `Readonly<>` for component props.

### Imports
- Named imports for React hooks and components
- Path alias `@/` for project imports (e.g., `@/lib/supabase`, `@/app/actions`)

## Database

Table: `curator_interest_signups`
| Column | Type | Notes |
|--------|------|-------|
| `user_email` | string | Unique constraint |
| `interest_type` | string | e.g., `"waitlist"` |
| `source` | string | e.g., `"hero_section"` |
| `subscribed` | boolean | |
| `processed` | boolean | |

Handle Postgres error code `23505` for duplicate email detection.
