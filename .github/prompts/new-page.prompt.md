---
description: "Scaffold a new App Router page for the Curator app with correct layout, styling, and component structure"
agent: "agent"
argument-hint: "Page name and purpose, e.g. 'pricing page with tier cards'"
---
Create a new Next.js App Router page in the `jade/app/` directory.

## Requirements

- Follow the project's design system defined in [style-maintainer.md](../instructions/../../.github/style-maintainer.md)
- Read [copilot-instructions.md](../../.github/copilot-instructions.md) for project conventions

## Page Structure

1. Add `"use client"` if the page needs interactivity (state, effects, event handlers)
2. Import required icons individually from `lucide-react`
3. Import `motion` from `framer-motion` for animations
4. Use the standard page wrapper:

```tsx
<div className="min-h-screen bg-stone-50 dark:bg-zinc-950 font-sans selection:bg-stone-200 dark:selection:bg-zinc-800">
  {/* Navbar */}
  {/* Page sections */}
  {/* Footer */}
</div>
```

5. Wrap section content in `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
6. Use `py-24` for standard section padding
7. Include section title blocks:

```tsx
<div className="text-center mb-16">
  <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 dark:text-white mb-4">...</h2>
  <p className="text-lg text-stone-600 dark:text-zinc-400 max-w-2xl mx-auto">...</p>
</div>
```

8. Add Framer Motion fade-in animations for below-fold content
9. Every light color must have a `dark:` counterpart
10. Use the `@/` path alias for imports
