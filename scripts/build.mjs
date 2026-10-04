import {rm,mkdir,cp,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=new URL('../',import.meta.url),out=new URL('../dist/',import.meta.url);
await rm(out,{force:true,recursive:true});await mkdir(out,{recursive:true});
for(const file of ['index.html','.nojekyll'])await cp(new URL(file,base),new URL(file,out));
for(const dir of ['fresh','assets'])await cp(new URL(dir+'/',base),new URL(dir+'/',out),{recursive:true});
async function files(url){
 const entries=await readdir(url,{withFileTypes:true});
 const result=[];
 for(const item of entries){const file=new URL(item.name+(item.isDirectory()?'/':''),url);if(item.isDirectory())result.push(...await files(file));else result.push(file)}
 return result.sort((a,b)=>a.href.localeCompare(b.href));
}
const assets=await files(new URL('fresh/',out));
const hashBuilder=createHash('sha256');
for(const file of assets){hashBuilder.update(file.pathname);hashBuilder.update(await readFile(file))}
const hash=hashBuilder.digest('hex').slice(0,12);
let html=await readFile(new URL('index.html',out),'utf8');
html=html.replace(/(\.\/fresh\/[\w-]+\.(?:css|js))(?:\?[^"']*)?/g,(_,path)=>path+'?v='+hash);
await writeFile(new URL('index.html',out),html);
// Every module has its own URL/cache key: changing the entry point alone does not invalidate imports.
for(const file of assets.filter(file=>file.pathname.endsWith('.js'))){
 const source=await readFile(file,'utf8');
 const patched=source.replace(/(\b(?:from\s*|import\s*\(|import\s*)['"])(\.\.?\/[^'"\n]+?\.js)(?:\?[^'"]*)?(['"])/g,(_,before,path,after)=>before+path+'?v='+hash+after);
 if(source!==patched)await writeFile(file,patched);
}
console.log('Fresh frontend build:',hash,'assets:',assets.length);
