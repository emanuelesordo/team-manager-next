import {readFile} from 'node:fs/promises';
const files=['index.html','src/app.js','src/data.js','src/styles.css'];
for(const f of files){const s=await readFile(new URL('../'+f,import.meta.url),'utf8');if(!s.trim())throw new Error(f+' vuoto')}
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
if(!app.includes("loadData"))throw new Error('gateway dati mancante');
console.log('check ok');