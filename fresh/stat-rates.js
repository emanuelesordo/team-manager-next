// Shared rate definitions. Ratios are derived only from observable denominators.
const num=value=>value===null||value===undefined||value===''?null:(Number.isFinite(Number(value))?Number(value):null);
const rate=(a,b,multiplier=1)=>{
 const x=num(a),d=num(b);
 return x===null||d===null||d<=0?null:x/d*multiplier;
};
export const ratePer80=(count,minutes,coverage)=>coverage==='complete'?rate(count,minutes,80):null;
export const ratePerGame=(count,games)=>rate(count,games);
export const percent=(count,total)=>rate(count,total,100);
const toMap=rows=>new Map((rows||[]).map(row=>[String(row.player_id),row]));
/** One player row contains authoritative SQL metrics + additional derived rates.
 * All 80-minute figures use the entire *verified* minutes sample, never the
 * average of single-game rates. An absent denominator produces N/D (null).
 */
export function enrichPlayerNumbers(players=[],comparisons=[],impacts=[],ratings=[],mvpCounts=new Map(),stints=new Map()){
 const statsById=toMap(players),impactsById=toMap(impacts),ratingsById=toMap(ratings);
 const input=(comparisons||[]).length?comparisons:players;
 const output=input.map(primary=>{
  const id=String(primary.player_id),stat=statsById.get(id)||{};
  const impact=impactsById.get(id)||{},rating=ratingsById.get(id)||{};
  const stint=stints.get(id)||{};
  const r={...stat,...primary,...impact,...rating,...stint,mvp_awards:mvpCounts.get(id)||0};
  // SQL's per-80 figures are retained; these extras never replace canonical totals.
  const mins=num(r.minutes),complete=r.minutes_coverage==='complete'||
   (!('minutes_coverage' in r)&&mins!==null&&mins>0&&primary.minutes_coverage==='complete');
  const validMinutes=complete&&mins>0?mins:null;
  const per80=value=>ratePer80(value,validMinutes,complete?'complete':'unavailable');
  const verified=Number(stint.stint_minutes)>0?Number(stint.stint_minutes):null;
  const stintRate=value=>verified?rate(value,verified,80):null;
  const fields={
   goals_assists:Number(r.goals||0)+Number(r.assists||0),
   starts_per_game:percent(r.starts,r.appearances),
   subentries_per_game:percent(r.subentries,r.appearances),
   goals_assists_per_game:rate(Number(r.goals||0)+Number(r.assists||0),r.appearances),
   goals_assists_per_80:per80(Number(r.goals||0)+Number(r.assists||0)),
   yellows_per_80:per80(r.yellow_cards),
   reds_per_80:per80(r.red_cards),
   blues_per_80:per80(r.blue_cards),
   cards_per_80:per80(r.disciplinary_cards),
   yellows_per_game:rate(r.yellow_cards,r.appearances),
   assists_per_game:rate(r.assists,r.appearances),
   goals_per_game:rate(r.goals,r.appearances),
   mvp_per_game:rate(r.mvp_awards,r.appearances),
   votes_per_rated_game:rate(r.votes_received,r.rated_matches),
   high_rating_pct:percent(r.high_rating_games,r.rated_matches),
   low_rating_pct:percent(r.low_rating_games,r.rated_matches),
   gf_on_per_game: r.impact_coverage==='complete'?rate(r.goals_for_on,r.appearances):null,
   ga_on_per_game: r.impact_coverage==='complete'?rate(r.goals_against_on,r.appearances):null,
   plus_minus_per_game: r.impact_coverage==='complete'?rate(r.plus_minus_on,r.appearances):null,
   stint_gf_per_80:stintRate(stint.stint_gf),
   stint_ga_per_80:stintRate(stint.stint_ga),
   stint_points_per_80:stintRate(stint.stint_points),
   stint_points_delta_per_80:stintRate(stint.stint_points_delta)
  };
  // Goal-context counts belong to a documented sample; normalized rates
  // describe recorded context only (they are not expected-goal probabilities).
  for(const key of [
   'equalizers','go_ahead_goals','deficit_reducers','trailing_goals',
   'comeback_equalizers','comeback_go_ahead_goals','lead_extenders',
   'goals_to_plus_1','goals_to_plus_2','goals_to_plus_3','goals_to_minus_1','goals_to_minus_2','goals_to_draw'
  ])fields[key+'_per_80']=per80(r[key]);
  return {...r,...fields};
 });
 return output;
}
