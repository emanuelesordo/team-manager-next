/** Parse Italian call-up messages. Fail closed on ambiguity. No DB side effects. */
export const normalizeCallupName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
export function parseCallupMessage(message,players){
 const lines=String(message||'').replace(/\r/g,'').split('\n').map(x=>x.trim());
 const chunks=[];let current=[];
 for(const line of lines){if(!line){if(current.length){chunks.push(current);current=[]}}else current.push(line)}
 if(current.length)chunks.push(current);
 const roster=(players||[]).map(p=>({id:p.id,first:normalizeCallupName(p.first_name),last:normalizeCallupName(p.last_name),label:[p.last_name,p.first_name].filter(Boolean).join(' ')}));
 const candidate=line=>{
   const name=normalizeCallupName(line);
   if(!name||line.length>65||name.split(' ').length>6)return [];
   const joined=(...parts)=>parts.filter(Boolean).join(' ').trim();
   return roster.filter(p=>[
      p.last,
      joined(p.first,p.last),
      joined(p.first[0],p.last),
      joined(p.last,p.first),
      joined(p.last,p.first[0])
   ].includes(name));
 };
 const groups=chunks.map((chunk,i)=>({i,items:chunk.map(line=>({line,matches:candidate(line)}))}));
 const sorted=groups.map(g=>({...g,found:g.items.filter(x=>x.matches.length).length,ambiguous:g.items.filter(x=>x.matches.length>1).length}))
  .sort((a,b)=>b.found-a.found||a.ambiguous-b.ambiguous||a.i-b.i);
 const best=sorted[0];
 if(!best||best.found<2)return {error:'Nessuna lista di convocati riconosciuta.',matched:[],unknown:[],ambiguous:[]};
 const matched=[],unknown=[],ambiguous=[],seen=new Set();
 for(const item of best.items){
  if(item.matches.length===1){const p=item.matches[0];if(seen.has(p.id))ambiguous.push(item.line+' (duplicato)');else{matched.push(p);seen.add(p.id)}}
  else if(item.matches.length>1)ambiguous.push(item.line);
  else unknown.push(item.line);
 }
 return {matched,unknown,ambiguous,error:null};
}
