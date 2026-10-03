/** Resolve fixture names against the canonical roster of club identities.
 * Calendar imports often add generic soccer suffixes (e.g. "Voltesea Calcio").
 * Exact matches always take priority; shortened aliases must be unambiguous.
 */
export const canonicalClubName=value=>{
 const words=String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);
 const generic=new Set(['asd','a','s','d','calcio','football','club','fc','ac','societa','sportiva','dilettantistica']);
 while(words.length>1&&generic.has(words[words.length-1]))words.pop();
 return words.join(' ');
};
export function findClubIdentity(name,team,opponents=[]){
 const records=[team,...opponents].filter(Boolean);
 const normalized=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const exact=records.filter(o=>[o.name,o.short_name].some(x=>x&&normalized(x)===normalized(name)));
 if(exact.length===1)return exact[0];
 if(exact.length>1)return null;
 const alias=canonicalClubName(name);
 if(!alias)return null;
 const matches=records.filter(o=>canonicalClubName(o.name)===alias);
 return matches.length===1?matches[0]:null;
}
