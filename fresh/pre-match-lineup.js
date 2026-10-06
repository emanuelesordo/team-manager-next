import {pitchPositions,formationModules} from './lineup-pitch.js';
import {shirtSvg} from './kit-editor.js';
import {availabilityDefault} from './availability.js';
import {matchPlayerLabel} from './match-player-label.js';

const key=v=>String(v??'');
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const roleOf=p=>String(p?.generic_role_manual||p?.role||'').toUpperCase();
const dateOnly=v=>String(v||'').slice(0,10);

function eligibleRoster(data,fixtureDate){
 const day=dateOnly(fixtureDate);
 const periods=data.contracts||[];
 return (data.roster||[]).filter(r=>r.active!==false).filter(r=>{
  const own=periods.filter(p=>p.player_id===r.player_id);
  if(!own.length)return true;
  return own.some(p=>(!p.start_date||p.start_date<=day)&&(!p.end_date||p.end_date>=day));
 });
}
function modalFormation(matches){
 const weights=new Map();
 matches.slice().sort((a,b)=>Date.parse(a.kickoff_at)-Date.parse(b.kickoff_at)).forEach((m,i)=>{
  const f=formationModules.includes(m.formation)?m.formation:null;if(!f)return;
  weights.set(f,(weights.get(f)||0)+i+1);
 });
 return [...weights].sort((a,b)=>b[1]-a[1])[0]?.[0]||'4-4-2';
}
function roleTargets(formation){
 const nums=String(formation||'4-4-2').split('-').map(Number);
 const out=['P'];
 nums.forEach((count,index)=>{
  const role=index===0?'D':index===nums.length-1?'A':'C';
  for(let i=0;i<count;i++)out.push(role);
 });
 return out;
}
function availabilityFor(playerId,{targetMatch,data,matchData,competition}){
 const saved=(matchData?.players||[]).find(p=>p.player_id===playerId)||
  (data.priorSelections||[]).find(p=>p.match_id===targetMatch?.id&&p.player_id===playerId);
 return availabilityDefault({
  saved,injuries:data.injuries||[],suspensions:data.suspensions||[],playerId,
  fixtureDate:targetMatch?.kickoff_at,priorSelections:data.priorSelections||[],matches:data.matches||[],
  matchId:targetMatch?.id,disciplinaryEvents:data.disciplinaryEvents||[],competitionId:targetMatch?.competition_id,
  competitionRules:competition?.discipline_rules||{},competitionLinks:data.competitionLinks||[]
 });
}
function playerScores(players,allPriorMatches,sampleMatches,selections,formation){
 const allIds=new Set(allPriorMatches.map(m=>key(m.id))),sampleIds=new Set(sampleMatches.map(m=>key(m.id)));
 const formIds=new Set(sampleMatches.filter(m=>m.formation===formation).map(m=>key(m.id)));
 const score=new Map(),slotScore=new Map(),shirts=new Map();
 const ordered=allPriorMatches.slice().sort((a,b)=>Date.parse(a.kickoff_at)-Date.parse(b.kickoff_at));
 const recencyWeight=new Map(ordered.map((m,i)=>[key(m.id),1+i/Math.max(1,ordered.length-1)]));
 for(const s of selections){
  if(!allIds.has(key(s.match_id))||!(s.started||s.selection_status==='starter'))continue;
  const w=recencyWeight.get(key(s.match_id))||1;
  score.set(s.player_id,(score.get(s.player_id)||0)+.35*w+(sampleIds.has(key(s.match_id))?1.4*w:0));
  if(formIds.has(key(s.match_id))&&Number.isInteger(Number(s.tactical_slot))){
   const k=s.player_id+'|'+Number(s.tactical_slot);
   slotScore.set(k,(slotScore.get(k)||0)+2*w);
  }
  if(s.shirt_number)shirts.set(s.player_id,s.shirt_number);
 }
 return {score,slotScore,shirts};
}
function bestForSlot(candidates,used,slot,targetRole,scores){
 let best=null,bestScore=-Infinity;
 for(const c of candidates){
  if(used.has(c.player_id))continue;
  const role=roleOf(c.person),roleFit=role===targetRole?3:(targetRole==='C'&&['D','A'].includes(role)?.25:0);
  const slotFit=scores.slotScore.get(c.player_id+'|'+slot)||0;
  const general=scores.score.get(c.player_id)||0;
  const value=slotFit+general+roleFit+(slot===1&&role==='P'?8:0)-(slot===1&&role!=='P'?8:0);
  if(value>bestScore){best=c;bestScore=value}
 }
 return best;
}
export function buildHypotheticalLineup({fixture,targetMatch,data,matchData,team,competition,prediction,kit}={}){
 if(!fixture||!team?.id||!targetMatch||!data)return null;
 const teamSide=fixture.home_team_id===team.id?'home':fixture.away_team_id===team.id?'away':null;
 if(!teamSide)return null;
 const kickoff=Date.parse(fixture.kickoff_at||'');
 const ownPrior=(data.matches||[]).filter(m=>m.fixture_id&&m.status==='finished'&&Date.parse(m.kickoff_at)<kickoff);
 const comparableIds=new Set((prediction?.comparableFixtureIds?.[teamSide]||[]).map(key));
 let sample=ownPrior.filter(m=>comparableIds.has(key(m.fixture_id)));
 if(!sample.length)sample=ownPrior.slice(-4);
 const formation=modalFormation(sample.length?sample:ownPrior);
 const roster=eligibleRoster(data,fixture.kickoff_at).map(r=>({...r,person:(data.players||[]).find(p=>p.id===r.player_id)})).filter(x=>x.person);
 const available=roster.filter(x=>availabilityFor(x.player_id,{targetMatch,data,matchData,competition}).status!=='absent');
 const scores=playerScores(available,ownPrior,sample,data.priorSelections||[],formation);
 const targets=roleTargets(formation),positions=pitchPositions(formation),used=new Set(),players=[];
 for(let i=0;i<positions.length;i++){
  const slot=positions[i].slot,targetRole=targets[i]||'C';
  const picked=bestForSlot(available,used,slot,targetRole,scores);if(!picked)continue;
  used.add(picked.player_id);
  const habitual=(data.habitual||[]).find(h=>h.player_id===picked.player_id)?.shirt_number;
  players.push({
   player_id:picked.player_id,slot,role:roleOf(picked.person)||targetRole,
   name:matchPlayerLabel(picked.person),shirt_number:scores.shirts.get(picked.player_id)||habitual||'',
   x:positions[i].x,y:positions[i].y
  });
 }
 return {
  formation,players,availableCount:available.length,sampleSize:sample.length,
  comparableUsed:Boolean(comparableIds.size&&sample.some(m=>comparableIds.has(key(m.fixture_id)))),
  kit:kit||{},confidence:clamp((sample.length/3)*.65+(players.length/11)*.35)
 };
}

export function renderHypotheticalLineup(model,escape=value=>String(value??'')){
 if(!model)return '<div class="prematch-lineup-empty">Formazione ipotetica non disponibile.</div>';
 const nodes=model.players.map((p,i)=>
  '<div class="prematch-lineup-player" style="left:'+p.x+'%;top:'+p.y+'%" title="'+escape(p.name)+'">'+
   '<span class="prematch-lineup-shirt">'+shirtSvg(model.kit,'prematch-'+i,false,p.shirt_number||null)+'</span>'+
   '<strong>'+escape(p.name)+'</strong></div>').join('');
 return '<div class="prematch-lineup-head"><div><span class="eyebrow">FORMAZIONE IPOTETICA</span><h3>'+escape(model.formation)+'</h3></div>'+
  '<span class="prematch-lineup-confidence">'+Math.round(model.confidence*100)+'% base dati</span></div>'+
  '<div class="prematch-lineup-field visual-field"><span class="field-circle"></span><span class="field-midline"></span>'+nodes+'</div>'+
  '<p class="prematch-lineup-note">'+
   (model.comparableUsed?'Media di '+model.sampleSize+' formazion'+(model.sampleSize===1?'e':'i')+' contro avversarie di potenziale simile.':'Campione comparabile ridotto: integrate le formazioni recenti.')+
   ' Considerati solo i '+model.availableCount+' giocatori attualmente disponibili.</p>';
}
