export const normalized=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const isFinished=f=>['finished','completed','finalized','final','ft'].includes(String(f?.status??'').toLowerCase());
export const isLive=f=>['live','in_progress','playing'].includes(String(f?.status??'').toLowerCase());
export const hasScore=f=>Number.isFinite(f?.home_score)&&Number.isFinite(f?.away_score);
export const scoreOf=f=>hasScore(f)?String(f.home_score)+' : '+String(f.away_score):'– : –';
export const isOurs=(name,team)=>normalized(name)===normalized(team?.name)||Boolean(team?.short_name&&normalized(name)===normalized(team.short_name));
export const involvesTeam=(f,team)=>isOurs(f.home_team,team)||isOurs(f.away_team,team);
export function summary(fixtures,team){
 const result={played:0,wins:0,draws:0,losses:0,gf:0,ga:0,form:[]};
 for(const f of [...fixtures].filter(f=>involvesTeam(f,team)&&isFinished(f)&&hasScore(f)).sort((a,b)=>new Date(a.kickoff_at)-new Date(b.kickoff_at))){
   const home=isOurs(f.home_team,team),goals=home?f.home_score:f.away_score,against=home?f.away_score:f.home_score;
   const value=goals>against?'V':goals<against?'S':'P'; result.played++;result.gf+=goals;result.ga+=against;
   if(value==='V')result.wins++;else if(value==='S')result.losses++;else result.draws++;
   result.form.push(value);
 }
 return {...result,form:result.form.slice(-5)};
}
export function rankRows(rows){/* Gli spareggi dipendono dal regolamento: negli ex aequo mantenere l'ordine originale. */return [...rows].sort((a,b)=>(b.points??-999)-(a.points??-999));}
export function fixtureToMatch(f,matches,opponents,team){
 const opponentName=isOurs(f.home_team,team)?f.away_team:f.home_team;
 const home=isOurs(f.home_team,team);
 const ids=opponents.filter(o=>normalized(o.name)===normalized(opponentName)||normalized(o.short_name)===normalized(opponentName)).map(o=>o.id);
 const candidates=matches.filter(m=>m.competition_id===f.competition_id&&ids.includes(m.opponent_id)&&(m.home_away=== (home?'home':'away'))&&Math.abs(new Date(m.kickoff_at)-new Date(f.kickoff_at))<=36*3600000);
 return candidates.length===1?candidates[0]:null;
}
export const roleName=x=>{const s=String(x??'').toLowerCase();return s==='p'||s.includes('port')?'P':s==='d'||s.includes('dif')?'D':s==='c'||s.includes('centr')?'C':s==='a'||s.includes('att')?'A':'—'};
export const matchMinutes=ev=>ev.minute==null?'Senza minuto':String(ev.minute)+(ev.stoppage_minute?'+'+ev.stoppage_minute:'')+"’";
