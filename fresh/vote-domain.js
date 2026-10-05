export function votablePlayerIds(entries=[],events=[]){
 const ids=new Set(entries.filter(row=>row.started===true).map(row=>row.player_id));
 for(const event of events)if(event.event_type==='substitution'&&['official','community_confirmed'].includes(event.validation_status)&&event.secondary_player_id)
  ids.add(event.secondary_player_id);
 return ids;
}
export function ratingSummary(rows=[]){
 const scores=rows.map(row=>row.rating).filter(n=>n!==null&&n!==undefined).map(Number).filter(Number.isFinite);
 return {average:scores.length?scores.reduce((sum,n)=>sum+n,0)/scores.length:null,count:scores.length,sv:rows.filter(row=>row.rating===null).length};
}
export function parseVote(value){
 if(value==null)return null;
 let raw=String(value).trim().toUpperCase();
 if(raw===''||raw==='SV')return null;
 raw=raw.replace(',','.');
 // Fast entry without decimal separator: 65 -> 6.5, 75 -> 7.5.
 if(/^\d{2}$/.test(raw)&&raw!=='10'){
  const compact=Number(raw)/10;
  if(compact>=1&&compact<=10)raw=String(compact);
 }
 const n=Number(raw);
 if(!Number.isFinite(n)||n<1||n>10)throw Error('Inserisci un voto da 1 a 10 oppure lascia vuoto per SV');
 const rounded=Math.round(n*2)/2;
 if(rounded<1||rounded>10)throw Error('Voto non valido');
 return rounded;
}
