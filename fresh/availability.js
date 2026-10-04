/* Match-day availability defaults. Suggestions never overwrite saved choices. */
export const unavailabilityReasons=[['injury','Infortunio'],['suspension','Squalifica'],['personal','Assenza giocatore'],['technical_choice','Scelta tecnica']];
export function availabilityDefault({saved,injuries=[],suspensions=[],playerId,fixtureDate,priorSelections=[],matches=[],matchId,disciplinaryEvents=[],competitionId,competitionRules={}}){
 if(saved)return {status:saved.started?'starter':saved.selection_status||'available',reason:saved.unavailability_reason||'',source:'saved'};
 const date=fixtureDate?String(fixtureDate).slice(0,10):null;
 const suspensionFromCards=disciplinarySuggestion({playerId,matchId,fixtureDate,competitionId,matches,disciplinaryEvents,competitionRules});
 const suspension=suspensions.some(s=>s.player_id===playerId&&s.status==='active'&&Number(s.matches_count)>Number(s.matches_served??0)
  &&(!s.start_date||!date||s.start_date<=date)&&(!s.end_date||!date||s.end_date>=date));
 if(suspension||suspensionFromCards)return {status:'absent',reason:'suspension',source:suspension?'suspension':'cards'};
 const kickoff=Date.parse(fixtureDate||'');
 const prior=matches.filter(m=>m.id!==matchId&&m.status==='finished'&&Date.parse(m.kickoff_at)<kickoff)
  .sort((a,b)=>Date.parse(b.kickoff_at)-Date.parse(a.kickoff_at))[0];
 const priorInjury=prior&&priorSelections.some(p=>p.match_id===prior.id&&p.player_id===playerId&&p.selection_status==='absent'&&p.unavailability_reason==='injury');
 const injury=injuries.some(i=>i.player_id===playerId&&['active','recovering'].includes(i.status)
  &&(!i.injury_date||!date||i.injury_date<=date)&&(!i.actual_return||!date||i.actual_return>date));
 if(injury||priorInjury)return {status:'absent',reason:'injury',source:injury?'injury':'previous_match'};
 return {status:'available',reason:'',source:'default'};
}
export function normalizedReason(status,reason){
 if(status!=='absent')return null;
 return ['injury','suspension','personal','technical_choice'].includes(reason)?reason:'technical_choice';
}

/* In the absence of a registered sanction, derive a PREVIEW from recorded cards.
   It applies only to the immediately following match in the same competition;
   the server still decides whether a player is legally eligible. */
export function disciplinarySuggestion({playerId,matchId,fixtureDate,competitionId,matches=[],disciplinaryEvents=[],competitionRules={}}){
 if(!playerId||!competitionId||!fixtureDate)return false;
 const prior=matches.filter(m=>m.id!==matchId&&m.competition_id===competitionId&&m.status==='finished'&&Date.parse(m.kickoff_at)<Date.parse(fixtureDate))
  .sort((a,b)=>Date.parse(a.kickoff_at)-Date.parse(b.kickoff_at));
 if(!prior.length)return false;
 const ids=new Map(prior.map((m,index)=>[m.id,index]));
 const fixtures=new Map(prior.filter(m=>m.fixture_id).map(m=>[m.fixture_id,m.id]));
 const cards=disciplinaryEvents.filter(e=>e.player_id===playerId&&e.team_side!=='opponent')
  .map(e=>({...e,index:ids.get(e.match_id||fixtures.get(e.fixture_id))}))
  .filter(e=>e.index!==undefined).sort((a,b)=>a.index-b.index);
 const last=prior.length-1;
 if(cards.some(e=>e.index===last&&e.event_type==='red_card'))return true;
 const thresholds=Array.isArray(competitionRules.yellow_thresholds)?competitionRules.yellow_thresholds.map(Number).filter(x=>Number.isInteger(x)&&x>0):[];
 if(!thresholds.length)return false;
 const grouped=new Map();
 for(const c of cards)if(c.event_type==='yellow_card')grouped.set(c.index,(grouped.get(c.index)||0)+1);
 const count=[...grouped.values()].reduce((a,b)=>a+b,0);
 const before=count-(grouped.get(last)||0);
 let threshold=0;
 for(const n of thresholds){threshold+=n;if(before<threshold&&count>=threshold)return true}
 return false;
}
