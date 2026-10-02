import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Zero-dependency deterministic production build. No secret environment values are interpolated.
const root = new URL('../', import.meta.url);
const output = new URL('../dist/', import.meta.url);
await rm(output, { recursive:true, force:true });
await mkdir(output, { recursive:true });
for (const name of ['index.html','manifest.webmanifest','sw.js','.nojekyll']) {
  await cp(new URL(name,root), new URL(name,output));
}
for (const directory of ['src','assets']) {
  await cp(new URL(directory+'/',root), new URL(directory+'/',output), {recursive:true});
}
// The mockups are a design reference, not a runtime asset.
await rm(new URL('assets/reference-design.webp',output),{force:true});
const files=['index.html','src/app.js','src/data.js','src/domain.js','src/config.js','src/visuals.js','src/styles.css','src/layout-compact.css'];
let total=0;
for(const file of files){ const bytes=await readFile(new URL(file,output)); total+=bytes.byteLength; }
const htmlPath = new URL('index.html',output);
let html = await readFile(htmlPath,'utf8');
// Fingerprint both CSS layers to avoid stale styles after deploy.
for (const stylesheet of ['src/styles.css','src/layout-compact.css']) {
  const css = await readFile(new URL(stylesheet,output));
  const hash = createHash('sha256').update(css).digest('hex').slice(0,10);
  html=html.replace('./'+stylesheet,'./'+stylesheet+'?v='+hash);
}
await writeFile(htmlPath,html);
console.log(`Built dist/: ${files.length} core assets; ${total.toLocaleString('it-IT')} B of core code; stylesheet revisions embedded`);
