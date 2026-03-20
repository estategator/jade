---
description: "Use when writing Supabase queries, server actions, database operations, or adding new tables. Covers client usage, error handling, and insert/query patterns."
applyTo: ["lib/**", "app/actions.ts"]
---
# Supabase Patterns

## Client

Always use the shared client from `@/lib/supabase` — never create new `createClient()` calls.

```ts
import { supabase } from '@/lib/supabase';
```

## Server Actions

All database writes go through server actions in `app/actions.ts`:

```ts
'use server';

import { supabase } from '@/lib/supabase';

export async function myAction(formData: FormData) {
  const field = formData.get('field') as string;

  if (!field) {
    return { error: 'Field is required' };
  }

  try {
    const { error } = await supabase
      .from('table_name')
      .insert({ /* columns */ });

    if (error) {
      console.error('Supabase error:', error);
      if (error.code === '23505') {
        return { error: 'Duplicate entry' };
      }
      return { error: 'Something went wrong. Please try again.' };
    }

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}
```

## Return Shape

Always return `{ success: true }` or `{ error: string }` — never throw from server actions.

## Error Codes

| Postgres Code | Meaning | User Message |
|---------------|---------|-------------|
| `23505` | Unique violation | Contextual duplicate message |
| `23503` | Foreign key violation | Related record not found |
| `42501` | Insufficient privilege | Permission denied |

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_DATABASE_URL` — project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anonymous key (browser-safe)
- Never use or commit the service role key in frontend code

## Existing Tables

- `curator_interest_signups` — waitlist emails (`user_email` unique, `interest_type`, `source`, `subscribed`, `processed`)
