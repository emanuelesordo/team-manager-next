/** Domain calculations: fixture is authoritative for scores; missing values remain missing. */
export const normalizeName = s => String(s || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const isFinished = f => ['finished','finalized','completed'].includes(f?.status);
export const isLive = f => ['live','in_progress','playing'].includes(f?.status);
export const scoreText = f => Number.isFinite(f?.home_score) && Number.isFinite(f?.away_score)
  ? `${f.home_score} : ${f.away_score}` : 'VS';
export function matchResult(f, isOurTeam) {
  if (!isFinished(f) || !Number.isFinite(f?.home_score) || !Number.isFinite(f?.away_score)) return null;
  if (!isOurTeam(f.home_team) && !isOurTeam(f.away_team)) return null;
  const difference = isOurTeam(f.home_team) ? f.home_score-f.away_score : f.away_score-f.home_score;
  return difference>0?'w':difference<0?'l':'d';
}
export function computeTeamSummary(fixtures, isOurTeam) {
  const completed = fixtures.filter(f => (isOurTeam(f.home_team)||isOurTeam(f.away_team))&&isFinished(f))
    .sort((a,b)=>new Date(b.kickoff_at)-new Date(a.kickoff_at));
  const summary={w:0,d:0,l:0,played:0,gf:0,ga:0,done:completed};
  for (const f of completed) {
    const result=matchResult(f,isOurTeam);
    if (!result) continue; // score unknown, cannot derive a result
    summary[result]++;
    summary.played++;
    summary.gf += isOurTeam(f.home_team)?f.home_score:f.away_score;
    summary.ga += isOurTeam(f.home_team)?f.away_score:f.home_score;
  }
  return summary;
}
