/**
 * Deterministic pre-match scenario, NOT a recorded or guaranteed event list.
 * Inputs must be snapshots known before kickoff.
 */
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const numeric=v=>Number.isFinite(Number(v))?Number(v):null;
const hash=v=>{let x=2166136261;for(const c of String(v)){x^=c.charCodeAt(0);x=Math.imul(x,16777619)}return x>>>0};
const generator=seed=>{let x=hash(seed)||1;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296}};
const nameOf=p=>[p.first_name,p.last_name].filter(Boolean).join(' ')||p.name||'Giocatore';
const midpoint=(min,max,rng)=>Math.round(min+(max-min)*rng());
function timeWindow(side,profile,minutes,rng){
 const strongest=profile?.strongestFor?.label||'';
 const match=String(strongest).match(/(\d+)\D+(\d+)/);
 const lo=match?Number(match[1]):1,hi=match?Number(match[2]):minutes;
 return midpoint(clamp(lo,1,minutes),clamp(hi,1,minutes),rng);
}
function expectedMinutes(p,stats){const r=stats.find(x=>String(x.player_id)===String(p.player_id));return r&&numeric(r.minutes)!=null?Number(r.minutes):null}
function selectBench(bench,used,preferredRole,stats,opportunity,rng){
 const candidates=bench.filter(x=>!used.has(String(x.player_id)));
 if(!candidates.length)return null;
 const score=p=>{
  const role=String(p.generic_role_manual||p.role||'').toUpperCase();
  const m=expectedMinutes(p,stats);
  return (role===preferredRole?3:0)+(m===null?0:2/(1+m/80)*opportunity)+(numeric(p.avg_rating)||6)/10+rng()*.15;
 };
 return candidates.sort((a,b)=>score(b)-score(a))[0];
}
export function simulatePrematchTimeline({fixture,prediction,lineup,roster=[],players=[],stats=[],competition}={}){
 if(!fixture||!prediction)return {events:[],label:'Simulazione non disponibile'};
 const duration=Math.max(40,Math.min(120,Number(competition?.minutes_per_period||40)*Number(competition?.periods||2)));
 const rng=generator(fixture.id+'|'+(lineup?.formation||'')+'|'+(lineup?.players||[]).map(x=>x.player_id).join('|'));
 const homeTeamId=fixture.home_team_id,ownHome=homeTeamId&&homeTeamId===fixture.home_team_id&&
  (lineup?.teamSide==='home'||lineup?.teamSide==null&&fixture.home_team_id===lineup?.teamId);
 const homeScoreline=prediction.probabilities?.mostLikely;
 const scoreHome=Math.max(0,Math.min(5,Math.round(numeric(homeScoreline?.home)??numeric(prediction.expectedGoals?.home)??1)));
 const scoreAway=Math.max(0,Math.min(5,Math.round(numeric(homeScoreline?.away)??numeric(prediction.expectedGoals?.away)??1)));
 const ownSide=lineup?.teamSide||'home';
 const byId=new Map(players.map(x=>[String(x.id),x]));
 const initial=(lineup?.players||[]);
 const initialIds=new Set(initial.map(x=>String(x.player_id)));
 const eligible=roster.filter(x=>x.active!==false&&!initialIds.has(String(x.player_id)));
 const fallbackPlayers=eligible.map(x=>({...byId.get(String(x.player_id)),...x}));
 const bench=fallbackPlayers.filter(p=>p.selection_status!=='absent'&&p.availability_status!=='absent');
 const events=[];
 const target=(side)=>side==='home'?scoreHome:scoreAway;
 for(const side of ['home','away'])for(let i=0;i<target(side);i++){
  const profile=prediction.situational?.[side];
  const minute=timeWindow(side,profile,duration,rng);
  const scorers=side===ownSide?initial.filter(p=>p.slot>1):[];
  const scorer=scorers.length?scorers
   .map(p=>({...p,weight:(String(p.role).toUpperCase().startsWith('A')?2.4:1)+(numeric(p.expectedRating)||6)/8}))
   .sort((a,b)=>b.weight-a.weight)[Math.floor(rng()*Math.min(4,scorers.length))]:null;
  events.push({minute,type:'goal',side,player_id:scorer?.player_id||null,
   label:side===ownSide&&scorer?'Possibile gol di '+scorer.name:'Possibile gol '+(side==='home'?'squadra di casa':'squadra ospite'),
   basis:'Fasce gol storiche, xG e risultato esatto modale'});
 }
 events.sort((a,b)=>a.minute-b.minute);
 let ownGoals=0,oppGoals=0;
 for(const e of events){if(e.side===ownSide)ownGoals++;else oppGoals++;e.partial=ownSide==='home'?
  (events.filter(x=>x.minute<=e.minute&&x.side==='home').length+'–'+events.filter(x=>x.minute<=e.minute&&x.side==='away').length):
  (events.filter(x=>x.minute<=e.minute&&x.side==='away').length+'–'+events.filter(x=>x.minute<=e.minute&&x.side==='home').length)}
 // Changes are tactical scenarios only, based on score and recent usage;
 // do not claim unavailable personnel will play.
 if(initial.length&&bench.length){
  const used=new Set(),usedOff=new Set();
  const windows=[.64,.76,.87];
  for(let i=0;i<Math.min(windows.length,bench.length);i++){
   const minute=Math.min(duration-1,Math.round(duration*windows[i]));
   let gf=0,ga=0;
   events.filter(e=>e.type==='goal'&&e.minute<=minute).forEach(e=>{if(e.side===ownSide)gf++;else ga++});
   const lead=gf-ga,opportunity=lead>=2?1:lead===1?.65:lead===0?.4:.15;
   const candidate=initial.filter(p=>p.slot>1&&!usedOff.has(String(p.player_id)))
    .map(p=>({...p,load:expectedMinutes(p,stats),rank:(numeric(p.expectedRating)||6)}))
    .sort((a,b)=>((b.load??0)-(a.load??0))*.005+(b.rank-a.rank)*.1);
   const outgoing=candidate[i%Math.max(1,candidate.length)];
   if(!outgoing)break;
   const substitute=selectBench(bench,used,outgoing.targetRole,stats,opportunity,rng);
   if(!substitute)break;
   used.add(String(substitute.player_id));usedOff.add(String(outgoing.player_id));
   events.push({minute,type:'substitution',side:ownSide,player_id:substitute.player_id,off_id:outgoing.player_id,
    label:nameOf(substitute)+' ↔ '+outgoing.name,
    basis:lead>=2?'Vantaggio: possibile turnover e minutaggio ai meno impiegati':lead<0?'Svantaggio: possibile cambio per cercare la rimonta':'Gestione delle energie e compatibilità dei ruoli'});
  }
 }
 events.sort((a,b)=>a.minute-b.minute||(a.type==='goal'?-1:1));
 return {events,duration,score:scoreHome+'–'+scoreAway,coverage:prediction.coverage||0,
  label:'Uno scenario plausibile, non una previsione di eventi certi'};
}
export function renderSimulatedTimeline(model,escape=x=>String(x??'')){
 if(!model)return '<p>Simulazione non disponibile.</p>';
 return '<div class="prematch-simulation-head"><strong>Scenario '+escape(model.score||'—')+'</strong><small>'+escape(model.label)+'</small></div>'+
  '<ol class="prematch-simulation-events">'+
  (model.events.length?model.events.map(e=>'<li class="prematch-simulation-event">'+
   '<span class="prematch-simulation-minute">'+e.minute+'′</span>'+
   '<span class="prematch-simulation-type">'+(e.type==='goal'?'Gol ipotetico':'Cambio ipotetico')+'</span>'+
   '<div><strong>'+escape(e.label)+'</strong><small>'+escape(e.basis)+'</small></div>'+
   '</li>').join(''):'<li>Nessun gol o cambio simulabile con i dati disponibili.</li>')+'</ol>'+
  '<p class="prematch-simulation-disclaimer">SIMULAZIONE · Eventi non reali. Nessun evento viene scritto nel database.</p>';
}
