import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Bypasses RLS. Only ever import this from server-only code (route handlers,
// server components) -- `server-only` above throws a build error if this
// module is pulled into client bundle.
//
// Both reads have to happen per-call, not at module scope: on Cloudflare
// Workers the environment is bound per-request, so anything read while the
// module is first evaluated (isolate startup) sees `undefined`.
// NEXT_PUBLIC_SUPABASE_URL would survive that -- Next inlines NEXT_PUBLIC_*
// at build time -- but SUPABASE_SERVICE_ROLE_KEY is a runtime-only secret and
// would not, so it is read here alongside it.
export function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.');
    }
    return createClient(url, serviceRoleKey, {
        auth: { persistSession: false },
    });
}
