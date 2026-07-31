// Generates supabase/functions/_shared/ from lib/.
//
// The ingest jobs moved off Cloudflare Workers onto Supabase Edge Functions
// (Workers Free caps subrequests at 50/invocation and cron CPU at 10ms; the
// ingest run needs several hundred Supabase calls). Those functions run on
// Deno, which differs from the Next build in two ways that matter here:
//
//   1. Deno requires explicit file extensions on relative imports.
//   2. There is no `process.env`; env vars come from Deno.env.get().
//
// Rather than fork the adapters -- regions.ts in particular has to agree
// between what ingest writes and what the read routes query, so two drifting
// copies would be a real correctness bug -- lib/ stays the single source of
// truth and this script mechanically rewrites those two things on copy.
// The output is committed so deploys are reproducible; `--check` verifies it
// is current (used by CI).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'lib');
const OUT = join(root, 'supabase', 'functions', '_shared');

// Only what the two ingest entrypoints actually reach. Deliberately not the
// whole of lib/: supabaseAdmin.ts imports `server-only`, and the UI-facing
// modules pull in React.
const MODULES = [
    'logger.ts',
    'regions.ts',
    'earthquakes.ts',
    'gdacs.ts',
    'firms.ts',
    'eonet.ts',
    'noaaCyclones.ts',
    'nwsTsunami.ts',
    'ibtracs.ts',
    'mergeEngine.ts',
    'sourcePriority.ts',
];

const BANNER = `// GENERATED FILE -- DO NOT EDIT.
// Copied from lib/%s by scripts/sync-edge-shared.mjs. Edit the original.
`;

function transform(source, name) {
    let out = source;

    // Deno needs the extension on relative imports/exports.
    out = out.replace(/(from\s+')(\.\/[A-Za-z0-9_-]+)(')/g, '$1$2.ts$3');

    // No process.env in Deno. Both remaining uses are optional API keys read
    // inside functions, so a direct swap is safe.
    out = out.replace(/process\.env\.([A-Z0-9_]+)/g, "Deno.env.get('$1')");

    // `next: { revalidate }` is a Next fetch extension. Harmless at runtime in
    // Deno but not in its RequestInit type, and the caching it asks for does
    // not exist here -- strip it so the function typechecks. Take the property
    // *and* its trailing comma, then tidy the two shapes that leaves behind:
    // a dangling comma when it was the last property, and an init object that
    // held nothing else.
    out = out.replace(/next:\s*\{[^}]*\}\s*,?\s*/g, '');
    out = out.replace(/,(\s*\})/g, '$1');
    out = out.replace(/,\s*\{\s*\}\s*\)/g, ')');

    return BANNER.replace('%s', name) + out;
}

const check = process.argv.includes('--check');

mkdirSync(OUT, { recursive: true });

// Drop stale files so a removed module doesn't linger in the deployed bundle.
if (!check) {
    for (const f of readdirSync(OUT).filter((f) => f.endsWith('.ts'))) {
        if (!MODULES.includes(f)) rmSync(join(OUT, f));
    }
}

let stale = [];
for (const name of MODULES) {
    const generated = transform(readFileSync(join(SRC, name), 'utf8'), name);
    const target = join(OUT, name);
    let current = null;
    try {
        current = readFileSync(target, 'utf8');
    } catch {
        // not generated yet
    }
    if (current === generated) continue;
    if (check) stale.push(name);
    else writeFileSync(target, generated);
}

if (check) {
    if (stale.length) {
        console.error(`supabase/functions/_shared is out of date: ${stale.join(', ')}`);
        console.error('Run `npm run sync:edge` and commit the result.');
        process.exit(1);
    }
    console.log('supabase/functions/_shared is up to date.');
} else {
    console.log(`Synced ${MODULES.length} modules into supabase/functions/_shared/`);
}
