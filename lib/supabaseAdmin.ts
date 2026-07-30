import 'server-only';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Bypasses RLS. Only ever import this from server-only code (route handlers,
// server components) -- `server-only` above throws a build error if this
// module is pulled into client bundle.
export function getSupabaseAdmin() {
    if (!url || !serviceRoleKey) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.');
    }
    return createClient(url, serviceRoleKey, {
        auth: { persistSession: false },
    });
}
