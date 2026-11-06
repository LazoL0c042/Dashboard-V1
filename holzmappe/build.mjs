// Baut die eigenständige Datei dist/holzmappe.html (three.js, Code und Fotos eingebettet).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';

// Fotos (Baum/Holz/Frucht je Art, z. B. kiefer-baum.jpg) liegen nur lokal in fotos/ – ohne sie fehlen nur die Bilder in der Mappe.
const fotos = existsSync('fotos') ? readdirSync('fotos').filter(f => f.endsWith('.jpg')).sort() : [];
const entries = fotos.map(f => `  ${JSON.stringify(f.replace('.jpg', ''))}: "data:image/jpeg;base64,${readFileSync('fotos/' + f).toString('base64')}"`);
writeFileSync('src/photos.js', `// automatisch erzeugt von build.mjs\nexport const PHOTOS = {\n${entries.join(',\n')}\n};\n`);

const res = await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: true, target: 'es2020', write: false, legalComments: 'none' });
let js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const html = readFileSync('src/index.html', 'utf8').replace('/*@@SCRIPT@@*/', () => js);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/holzmappe.html', html);
console.log('dist/holzmappe.html', (html.length / 1024 / 1024).toFixed(2), 'MB');
// Artefakt-Variante: ohne eigenes Dokumentgerüst (wird beim Veröffentlichen umhüllt)
const art = html.replace(/<!doctype html>\s*<html[^>]*>\s*<head>/i, '').replace(/<meta charset="utf-8">\s*<meta name="viewport"[^>]*>/i, '').replace(/<\/head>\s*<body>/i, '').replace(/<\/body>\s*<\/html>\s*$/i, '');
writeFileSync('dist/holzmappe-artefakt.html', art);
console.log('dist/holzmappe-artefakt.html', (art.length / 1024 / 1024).toFixed(2), 'MB');
