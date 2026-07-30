import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.');
}

// Browser client, safe to use in client components: scoped by RLS to the
// `anon` role (see the felt_reports policies in the init_schema migration).
export const supabase = createClient(url, anonKey);
