/* Match-day availability defaults. Suggestions never overwrite saved choices. */
export const unavailabilityReasons=[['injury','Infortunio'],['suspension','Squalifica'],['personal','Assenza giocatore'],['technical_choice','Scelta tecnica']];
export function availabilityDefault({saved,injuries=[],suspensions=[],playerId,fixtureDate,priorSelections=[],matches=[],matchId}){
 if(saved)return {status:saved.started?'starter':saved.selection_status||'available',reason:saved.unavailability_reason||'',source:'saved'};
 const date=fixtureDate?String(fixtureDate).slice(0,10):null;
 const suspension=suspensions.some(s=>s.player_id===playerId&&s.status==='active'&&Number(s.matches_count)>Number(s.matches_served??0)
  &&(!s.start_date||!date||s.start_date<=date)&&(!s.end_date||!date||s.end_date>=date));
 if(suspension)return {status:'absent',reason:'suspension',source:'suspension'};
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
