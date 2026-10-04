import {displayEventMinute} from './match-minutes.js';
export const normalized=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const isFinished=f=>['finished','completed','finalized','final','ft'].includes(String(f?.status??'').toLowerCase());
export const isLive=f=>['live','in_progress','playing'].includes(String(f?.status??'').toLowerCase());
export const hasScore=f=>Number.isFinite(f?.home_score)&&Number.isFinite(f?.away_score);
export const scoreOf=f=>hasScore(f)?String(f.home_score)+' : '+String(f.away_score):'– : –';
export const isOurs=(teamId,team)=>Boolean(team?.id&&teamId===team.id);
export const involvesTeam=(f,team)=>Boolean(team?.id&&(f?.home_team_id===team.id||f?.away_team_id===team.id));
export function summary(fixtures,team){
 const result={played:0,wins:0,draws:0,losses:0,gf:0,ga:0,form:[]};
 for(const f of [...fixtures].filter(f=>involvesTeam(f,team)&&isFinished(f)&&hasScore(f)).sort((a,b)=>new Date(a.kickoff_at)-new Date(b.kickoff_at))){
   const home=f.home_team_id===team.id,goals=home?f.home_score:f.away_score,against=home?f.away_score:f.home_score;
   const value=goals>against?'V':goals<against?'S':'P'; result.played++;result.gf+=goals;result.ga+=against;
   if(value==='V')result.wins++;else if(value==='S')result.losses++;else result.draws++;
   result.form.push(value);
 }
 return {...result,form:result.form.slice(-5)};
}
export const TIEBREAK_DEFAULT=['gd','h2h','gf','gs'];
export function tieBreakOrder(comp){
 const input=comp?.discipline_rules?.standings_tiebreakers;
 return Array.isArray(input)&&input.length===4&&new Set(input).size===4&&TIEBREAK_DEFAULT.every(k=>input.includes(k))?input:TIEBREAK_DEFAULT;
}
const rowId=r=>r.team_id?'team:'+r.team_id:r.opponent_id?'opponent:'+r.opponent_id:null;
const gameId=(f,side)=>f[side+'_team_id']?'team:'+f[side+'_team_id']:f[side+'_opponent_id']?'opponent:'+f[side+'_opponent_id']:null;
export function rankRows(rows,comp=null,fixtures=[]){
 const criteria=tieBreakOrder(comp);
 const played=fixtures.filter(f=>f.competition_id===comp?.id&&f.status==='finished'&&Number.isInteger(f.home_score)&&Number.isInteger(f.away_score));
 const mini=(tied)=>{
  const keys=new Set(tied.map(rowId)),out=new Map([...keys].map(id=>[id,{pt:0,gd:0,gf:0,gs:0,games:0}]));
  for(const f of played){const home=gameId(f,'home'),away=gameId(f,'away');if(!keys.has(home)||!keys.has(away))continue;
   for(const [id,g,a] of [[home,f.home_score,f.away_score],[away,f.away_score,f.home_score]]){
    const v=out.get(id);v.games++;v.gf+=g;v.gs+=a;v.gd+=g-a;v.pt+=g>a?Number(comp?.win_points??3):g===a?Number(comp?.draw_points??1):Number(comp?.loss_points??0);
   }
  }
  return out;
 };
 const list=[...rows].sort((a,b)=>Number(b.points??0)-Number(a.points??0));
 for(let start=0;start<list.length;){
  let end=start+1;while(end<list.length&&Number(list[end].points??0)===Number(list[start].points??0))end++;
  if(end-start>1){
   const group=list.slice(start,end),h2h=mini(group);
   group.sort((a,b)=>{
    for(const rule of criteria){let delta=0;
     if(rule==='h2h'){const x=h2h.get(rowId(a)),y=h2h.get(rowId(b));if(x?.games&&y?.games)delta=y.pt-x.pt||y.gd-x.gd||y.gf-x.gf}
     if(rule==='gd')delta=Number(b.goal_difference??0)-Number(a.goal_difference??0);
     if(rule==='gf')delta=Number(b.goals_for??0)-Number(a.goals_for??0);
     if(rule==='gs')delta=Number(a.goals_against??0)-Number(b.goals_against??0);
     if(delta)return delta;
    }
    return 0;
   });list.splice(start,end-start,...group);
  }start=end;
 }
 return list;
}
export function fixtureToMatch(f,matches,opponents,team){
 const home=f.home_team_id===team?.id;
 if(!home&&f.away_team_id!==team?.id)return null;
 const opponentId=home?f.away_opponent_id:f.home_opponent_id;
 if(!opponentId)return null;
 const candidates=matches.filter(m=>m.competition_id===f.competition_id&&m.opponent_id===opponentId&&(m.home_away=== (home?'home':'away'))&&Math.abs(new Date(m.kickoff_at)-new Date(f.kickoff_at))<=36*3600000);
 return candidates.length===1?candidates[0]:null;
}
export const roleName=x=>{const s=String(x??'').toLowerCase();return s==='p'||s.includes('port')?'P':s==='d'||s.includes('dif')?'D':s==='c'||s.includes('centr')?'C':s==='a'||s.includes('att')?'A':'—'};
export const matchMinutes=(ev,competition=null)=>displayEventMinute(ev,competition,'Senza minuto').replace('′','’');
