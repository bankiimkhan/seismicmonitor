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
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, '..', 'node_modules', 'maplibre-gl', 'dist');
const dest = join(__dirname, '..', 'public');

for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
    copyFileSync(join(src, file), join(dest, file));
    console.log('copied', file);
}
