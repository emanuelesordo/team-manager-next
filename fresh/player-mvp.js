/** Awards are derived from individual non-SV votes, never stored as mutable counters. */
export function matchMvpAwards(matches=[],ratings=[]){
 const finished=new Set(matches.filter(m=>m.status==='finished'&&!m.is_test).map(m=>String(m.id)));
 const perMatch=new Map();
 for(const vote of ratings){
  const matchId=String(vote.match_id||''),playerId=String(vote.player_id||'');
  if(!finished.has(matchId)||!playerId||vote.rating==null||vote.rating==='')continue;
  const score=Number(vote.rating);
  if(!Number.isFinite(score)||score<1||score>10)continue;
  if(!perMatch.has(matchId))perMatch.set(matchId,new Map());
  const group=perMatch.get(matchId),agg=group.get(playerId)||{total:0,count:0};
  agg.total+=score;agg.count++;group.set(playerId,agg);
 }
 const awards=[],counts=new Map();
 for(const [matchId,groups] of perMatch){
  const ranked=[...groups].map(([player_id,a])=>({player_id,average:a.total/a.count,votes:a.count}));
  const max=Math.max(...ranked.map(x=>x.average));
  // A tie is shared: floating-point tolerance avoids rounding away real distinctions.
  for(const player of ranked.filter(x=>Math.abs(x.average-max)<1e-9)){
   awards.push({match_id:matchId,...player});
   counts.set(player.player_id,(counts.get(player.player_id)||0)+1);
  }
 }
 return {awards,counts};
}
export function describePlayerSeason(stats={},mvpCount=0){
 const n=k=>stats[k]==null?null:Number(stats[k]);
 const appearances=n('appearances'),minutes=n('minutes'),starts=n('starts'),goals=n('goals'),assists=n('assists'),rating=n('avg_rating');
 if(!appearances)return 'Non ci sono ancora presenze ufficiali sufficienti per descrivere il rendimento stagionale.';
 const parts=[];
 const involvement=starts!=null&&appearances>0?starts/appearances:null;
 if(involvement!=null&&involvement>=.75)parts.push('Impiegato prevalentemente da titolare');
 else if(involvement!=null&&involvement<=.25)parts.push('Utilizzato soprattutto a gara in corso');
 else parts.push('Presente con continuità variabile nelle rotazioni');
 parts.push('ha disputato '+appearances+' '+(appearances===1?'partita':'partite')+(minutes!=null?', per '+minutes+' minuti complessivi':''));
 const attack=[];
 if(goals>0)attack.push(goals+' '+(goals===1?'gol':'gol'));
 if(assists>0)attack.push(assists+' '+(assists===1?'assist':'assist'));
 if(attack.length)parts.push('contribuendo direttamente con '+attack.join(' e '));
 else if(goals===0&&assists===0)parts.push('senza ancora gol o assist registrati');
 if(rating!=null&&Number.isFinite(rating)&&rating>=1&&rating<=10)parts.push('La media voto stagionale è '+rating.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2}));
 if(mvpCount>0)parts.push('Ha ottenuto '+mvpCount+' '+(mvpCount===1?'riconoscimento MVP':'riconoscimenti MVP'));
 return parts.map((p,i)=>i===0?p+'.':p.charAt(0).toUpperCase()+p.slice(1)+'.').join(' ');
}
