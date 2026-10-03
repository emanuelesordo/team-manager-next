/** Phase 2.0 pairing preview. Identity is always the canonical UUID, never a name.
 * This creates NO official fixture, result or inherited points.
 */
export function clubKey(row){
 const t=row?.team_id,o=row?.opponent_id;
 if(Boolean(t)===Boolean(o))throw Error('A participant must reference one registered club');
 return (t?'team:':'opponent:')+(t||o);
}
export function roundRobinDraft(entries,history=[],sourceIds=[]){
 if(entries.length<2)throw Error('At least two clubs must qualify');
 const list=entries.map(item=>({...item,key:clubKey(item)})).sort((a,b)=>
  String(a.source_competition_id||'').localeCompare(String(b.source_competition_id||''))||
  Number(a.source_rank||0)-Number(b.source_rank||0)||a.key.localeCompare(b.key));
 if(new Set(list.map(p=>p.key)).size!==list.length)throw Error('Repeated club ID in qualifiers');
 const pairs=new Map();
 const sources=new Set(sourceIds);
 const participantKeys=new Set(list.map(item=>item.key));
 for(const fixture of history){
  if(!sources.has(fixture.competition_id)||fixture.status!=='finished')continue;
  let h,a;
  try{
   h=clubKey({team_id:fixture.home_team_id,opponent_id:fixture.home_opponent_id});
   a=clubKey({team_id:fixture.away_team_id,opponent_id:fixture.away_opponent_id});
  }catch{continue}
  if(!participantKeys.has(h)||!participantKeys.has(a))continue;
  const key=[h,a].sort().join('|');
  if(pairs.has(key))throw Error('Ambiguous prior fixtures for '+key);
  pairs.set(key,{home:h,away:a,id:fixture.id});
 }
 let seats=[...list];
 if(seats.length%2)seats.push(null);
 const rounds=seats.length-1,prepared=[];
 for(let round=1;round<=rounds;round++){
  for(let i=0;i<seats.length/2;i++){
   const a=seats[i],b=seats[seats.length-1-i];
   if(!a||!b)continue;
   const key=[a.key,b.key].sort().join('|');
   prepared.push({a,b,round,key,previous:pairs.get(key)||null});
  }
  seats=[seats[0],seats[seats.length-1],...seats.slice(1,seats.length-1)];
 }
 const balance=new Map(list.map(x=>[x.key,0]));
 const oriented=new Map();
 // Reserve reversed historical venues first; balance new D-v-E fixtures afterward.
 for(const pair of prepared.filter(x=>x.previous)){
  const {a,b,previous}=pair;
  const home=previous.away===a.key?a:b,away=home===a?b:a;
  oriented.set(pair.key,{home,away,previous_fixture_id:previous.id});
  balance.set(home.key,balance.get(home.key)+1);
  balance.set(away.key,balance.get(away.key)-1);
 }
 for(const pair of prepared.filter(x=>!x.previous)){
  const {a,b}=pair;
  const da=balance.get(a.key),db=balance.get(b.key);
  const home=da<db?a:db<da?b:(pair.round+prepared.indexOf(pair))%2===0?a:b;
  const away=home===a?b:a;
  oriented.set(pair.key,{home,away,previous_fixture_id:null});
  balance.set(home.key,balance.get(home.key)+1);
  balance.set(away.key,balance.get(away.key)-1);
 }
 return prepared.map(({round,key})=>{
  const {home,away,previous_fixture_id}=oriented.get(key);
  return {round_no:round,home_team_id:home.team_id||null,
   home_opponent_id:home.opponent_id||null,
   away_team_id:away.team_id||null,away_opponent_id:away.opponent_id||null,
   previous_fixture_id,kickoff_at:null,status:'draft'};
 });
}
