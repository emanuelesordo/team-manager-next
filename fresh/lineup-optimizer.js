/**
 * Exact maximum-weight global player-to-slot assignment.
 * Dynamic programming on the 11-slot bitmask considers all feasible unique
 * player/slot combinations without enumerating n! lineups.
 * Pair chemistry can then be used as a bounded, separate refinement.
 */
export function optimizeLineupAssignments(players,slots,score,{pairScore=()=>0}={}){
 const n=slots.length;
 if(n>11)throw new Error('Il simulatore supporta fino a 11 posizioni');
 if(!n||!players.length)return {assignments:[],score:0,explored:0};
 const states=1<<n,values=new Float64Array(states).fill(-Infinity);
 const paths=Array(states).fill(null);
 values[0]=0;paths[0]=[];
 let explored=0;
 for(let pi=0;pi<players.length;pi++){
  // Reverse mask order prevents the same player being selected twice.
  for(let mask=states-1;mask>=0;mask--){
   if(!Number.isFinite(values[mask]))continue;
   for(let si=0;si<n;si++){
    if(mask&(1<<si))continue;
    const weight=score(players[pi],slots[si]);
    if(!Number.isFinite(weight))continue;
    explored++;
    const next=mask|(1<<si),candidate=values[mask]+weight;
    if(candidate>values[next]+1e-8){
     values[next]=candidate;
     paths[next]=[...paths[mask],{playerIndex:pi,slotIndex:si}];
    }
   }
  }
 }
 const count=mask=>{let n=0;while(mask){mask&=mask-1;n++}return n};
 let best=0;
 for(let mask=1;mask<states;mask++){
  if(!Number.isFinite(values[mask]))continue;
  if(count(mask)>count(best)||(count(mask)===count(best)&&values[mask]>values[best]))best=mask;
 }
 let chosen=paths[best]||[];
 // Refine both slot exchanges and replacing a starter with a bench player.
 // A move is adopted only when it improves the complete objective, preserving
 // unique players/positions. Iterations are bounded for responsive mobile UI.
 const objective=list=>{
  let value=0;
  for(let i=0;i<list.length;i++){
   const a=list[i];value+=score(players[a.playerIndex],slots[a.slotIndex]);
   for(let j=0;j<i;j++)value+=pairScore(players[a.playerIndex],players[list[j].playerIndex]);
  }
  return value;
 };
 let actual=objective(chosen);
 for(let round=0;round<4;round++){
  let next=chosen,bestValue=actual;
  const used=new Set(chosen.map(p=>p.playerIndex));
  for(let i=0;i<chosen.length;i++){
   for(let j=i+1;j<chosen.length;j++){
    const proposed=chosen.map((item,k)=>k===i?{...item,slotIndex:chosen[j].slotIndex}:k===j?{...item,slotIndex:chosen[i].slotIndex}:item);
    const value=objective(proposed);
    if(value>bestValue+1e-7){bestValue=value;next=proposed}
   }
   for(let p=0;p<players.length;p++){
    if(used.has(p))continue;
    const proposed=chosen.map((item,k)=>k===i?{...item,playerIndex:p}:item);
    const value=objective(proposed);
    if(value>bestValue+1e-7){bestValue=value;next=proposed}
   }
  }
  if(next===chosen)break;
  chosen=next;actual=bestValue;
 }
 return {assignments:chosen.sort((a,b)=>a.slotIndex-b.slotIndex).map(p=>({player:players[p.playerIndex],slot:slots[p.slotIndex],weight:score(players[p.playerIndex],slots[p.slotIndex])})),score:actual,explored};
}
