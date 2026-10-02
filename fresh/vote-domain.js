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
 if(value==='SV')return null;
 if(value==null||value==='')throw Error('Seleziona un voto o SV');
 const n=Number(value);
 if(!Number.isFinite(n)||n<1||n>10||n*2!==Math.trunc(n*2))throw Error('Voto non valido');
 return n;
}
