// One-off copy: maplibre-gl's dist worker bundle -> public/, served as a
// plain static file. maplibre-gl computes its worker URL at runtime via
// `new URL('./maplibre-gl-worker.mjs', import.meta.url)` relative to its
// OWN chunk -- under Turbopack that chunk gets a content-hashed filename,
// so the literal "maplibre-gl-worker.mjs" the library asks for 404s and
// the map silently never loads tiles (worker construction "succeeds" but
// then errors with an opaque, unhelpful message). QuakeMap.tsx points
// maplibre at this static copy via `setWorkerUrl()` to sidestep that
// resolution entirely. Re-run with `node scripts/copy-maplibre-worker.mjs`
// after bumping the maplibre-gl version; the copied files are committed
// so this isn't a build-time dependency.
// Pass --check to verify the committed copies are current instead of rewriting
// them; that is what CI runs. Without it, bumping maplibre-gl without re-running
// this script leaves stale worker bytes in public/ and every map silently fails
// to load tiles -- the exact failure this file exists to prevent.
import { copyFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, '..', 'node_modules', 'maplibre-gl', 'dist');
const dest = join(__dirname, '..', 'public');
const FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];
const checkOnly = process.argv.includes('--check');

// Compared with line endings normalized: `* text=auto` in .gitattributes checks
// these out with CRLF on Windows, which is a byte difference but not a
// behavioural one. Only real content drift should fail the check.
const normalized = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

let drifted = false;
for (const file of FILES) {
    if (checkOnly) {
        if (normalized(join(src, file)) !== normalized(join(dest, file))) {
            console.error(`drift: public/${file} does not match node_modules/maplibre-gl/dist/${file}`);
            drifted = true;
        }
    } else {
        copyFileSync(join(src, file), join(dest, file));
        console.log('copied', file);
    }
}

if (checkOnly) {
    if (drifted) {
        console.error('\nRun `npm run sync:maplibre` and commit the result.');
        process.exit(1);
    }
    console.log(`maplibre assets in public/ match the installed version (${FILES.length} files checked)`);
}
