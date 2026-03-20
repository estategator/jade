import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_DATABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Browser client – used on the client side (has user session via cookies). */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
