// One-off icon rasterizer: public/icons/icon.svg -> 192/512 PNGs (+ apple
// touch icon). Run manually with `node scripts/gen-icons.mjs` whenever the
// source SVG changes; the generated PNGs are committed so this isn't a
// build-time dependency.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, '..', 'public', 'icons', 'icon.svg');
const svg = readFileSync(svgPath);

const targets = [
    { size: 192, file: 'icon-192.png' },
    { size: 512, file: 'icon-512.png' },
    { size: 180, file: 'apple-touch-icon.png' },
];

for (const { size, file } of targets) {
    const out = join(__dirname, '..', 'public', 'icons', file);
    await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out);
    console.log('wrote', out);
}
