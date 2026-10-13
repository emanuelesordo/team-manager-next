import {matchPlayerIntervals,confirmedMatchEvent} from './player-participation.js';

const K=x=>String(x??'');
const whole=x=>x!=null&&x!==''&&Number.isInteger(Number(x))&&Number(x)>=0;

/** Authoritative seasonal facts are constructed once after data acquisition.
 * SQL's app_player_season_stats is authoritative for appearances, starts,
 * goals, assists, cards and rating. Actual played minutes and explicit
 * substitution entrances are verified from the common match timeline.
 *
 * Missing information is null, never an invented zero or partial sum.
 */
export function reconcilePlayerSeasonFacts({
 playerStats=[],matches=[],matchPlayers=[],events=[],competitions=[],
 eventsLoaded=true,playersLoaded=true
}={}){
 const finished=(matches||[]).filter(m=>m.status==='finished'&&!m.is_test);
 const matchIds=new Set(finished.map(m=>K(m.id)));
 const playerRows=new Map(),eventRows=new Map();
 for(const p of matchPlayers||[]){
  const mid=K(p.match_id);if(!matchIds.has(mid))continue;
  const a=playerRows.get(mid)||[];a.push(p);playerRows.set(mid,a);
 }
 for(const e of events||[]){
  const mid=K(e.match_id);if(!matchIds.has(mid))continue;
  const a=eventRows.get(mid)||[];a.push(e);eventRows.set(mid,a);
 }
 const playerMatches=new Map(),perMatch=new Map();
 for(const m of finished){
  const selections=playerRows.get(K(m.id))||[];
  const comp=competitions.find(x=>K(x.id)===K(m.competition_id))||{};
  const timeline=matchPlayerIntervals(m,selections,eventRows.get(K(m.id))||[],comp);
  perMatch.set(K(m.id),timeline);
  for(const selection of selections){
   const id=K(selection.player_id),p=timeline.players.get(id);
   if(!p)continue;
   const list=playerMatches.get(id)||[];
   list.push({match_id:K(m.id),...p});playerMatches.set(id,list);
  }
 }
 const derivedByPlayer=new Map(),discrepancies=[];
 const stats=(playerStats||[]).map(row=>{
  const id=K(row.player_id),participations=playerMatches.get(id)||[];
  const officialApps=whole(row.appearances)?Number(row.appearances):null;
  const officialStarts=whole(row.starts)?Number(row.starts):null;
  const played=participations.filter(p=>p.started||p.entered);
  const entryCount=participations.filter(p=>!p.started&&p.entered).length;
  const startsRebuilt=participations.filter(p=>p.started).length;
  const complete=eventsLoaded&&playersLoaded&&officialApps!==null&&officialStarts!==null
    &&played.length===officialApps&&startsRebuilt===officialStarts&&
    played.every(p=>p.valid&&p.minutes!==null);
  const serverCoverage=['complete','unavailable','not_applicable'].includes(row.minutes_coverage)
   ?row.minutes_coverage:null;
  const localMinutes=complete?played.reduce((n,p)=>n+p.minutes,0):officialApps===0&&eventsLoaded&&playersLoaded?0:null;
  const localSubentries=eventsLoaded&&playersLoaded&&officialApps!==null&&officialStarts!==null
    &&played.length===officialApps&&startsRebuilt===officialStarts?entryCount:null;
  // The final SQL view is authoritative. Client intervals are a cross-check and
  // are never allowed to replace official persisted/database-calculated facts.
  const minutes=serverCoverage?(row.minutes==null?null:Number(row.minutes)):localMinutes;
  const subentries=serverCoverage?(row.subentries==null?null:Number(row.subentries)):localSubentries;
  if(serverCoverage&&eventsLoaded&&playersLoaded&&complete&&
     (minutes!==localMinutes||subentries!==localSubentries))
   discrepancies.push({player_id:id,kind:'sql_frontend_mismatch',sql_minutes:minutes,local_minutes:localMinutes,
     sql_subentries:subentries,local_subentries:localSubentries});
  const detail={minutes,subentries,complete:serverCoverage?serverCoverage==='complete':complete,
   checked:played.length,expected:officialApps,perMatch:participations,
   source:serverCoverage?'app_player_season_stats':'confirmed_match_timeline'};
  derivedByPlayer.set(id,detail);
  if(officialApps!==null&&(officialApps!==played.length||officialStarts!==startsRebuilt)){
   discrepancies.push({player_id:id,kind:'appearances',official:officialApps,detected:played.length});
  }else if(officialApps>0&&!complete){
   discrepancies.push({player_id:id,kind:'minutes_incomplete',official:officialApps,checked:played.filter(p=>p.valid).length});
  }
  return {...row,minutes,subentries,minutesCoverage:serverCoverage||(complete?'complete':officialApps===0?'not_applicable':'unavailable')};
 });
 return {stats,derivedByPlayer,perMatch,discrepancies,complete:eventsLoaded&&playersLoaded};
}
