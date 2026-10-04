/** Canonical events are stored only in app_match_events; fixture scores live on app_competition_fixtures. */
export function fixtureOnlyEvent(event){
 const score=event?.payload?.legacy_fixture_score||{};
 const payload={...(event?.payload||{})};
 if(!payload.period&&['first_half','second_half'].includes(event?.source_raw?.period))payload.period=event.source_raw.period;
 return {...event,payload,side:event?.team_side,
  home_score:Number.isInteger(score.home)?score.home:null,
  away_score:Number.isInteger(score.away)?score.away:null};
}
export function fixtureResult(fixture){
 return {home_score:Number.isInteger(fixture?.home_score)?fixture.home_score:null,
 away_score:Number.isInteger(fixture?.away_score)?fixture.away_score:null};
}
