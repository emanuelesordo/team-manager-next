/* Scenario-only match timeline. Every event is a sampled narrative, never persisted. */
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const hash=v=>{let x=2166136261;for(const c of String(v)){x^=c.charCodeAt(0);x=Math.imul(x,16777619)}return x>>>0};
const random=seed=>{let x=hash(seed)||1;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296}};
const pick=(entries,weight,rng)=>{if(!entries.length)return null;const weighted=entries.map(x=>Math.max(.00001,weight(x))),total=weighted.reduce((a,b)=>a+b,0);let r=rng()*total;for(let i=0;i<entries.length;i++){r-=weighted[i];if(r<=0)return entries[i]}return entries.at(-1)};
const fullName=p=>[p?.first_name,p?.last_name].filter(Boolean).join(' ')||p?.name||'Giocatore';
const group=p=>String(p?.targetRole||p?.generic_role_manual||p?.role||'').toUpperCase();
const offensive=p=>group(p)==='A'?3.2:group(p)==='C'?1.25:group(p)==='D'?.42:.025;
const recentMinutes=(p,byStats)=>{const s=byStats.get(String(p.player_id))||{};return num(s.minutes)??0};
const matchGoalMinutes=(profile,duration,rng)=>{
 const text=profile?.strongestFor?.label||'';
 const m=String(text).match(/(\d+)\D+(\d+)/);
 if(!m)return Math.round(7+(duration-13)*rng());
 const low=clamp(Number(m[1]),1,duration-1),high=clamp(Number(m[2]),low,duration-1);
 return Math.round(low+(high-low)*rng());
};
function goalMethod(scorer,assistant,rng){
 const role=group(scorer),assistRole=group(assistant);
 const methods=[
  {type:'Azione manovrata',description:'Taglio interno e conclusione rasoterra',weight:role==='A'?2:1.1,needsAssist:true},
  {type:'Cross',description:'Cross basso e tap-in',weight:assistant&&assistRole==='C'?2:1,needsAssist:true},
  {type:'Imbucata',description:'Inserimento alle spalle della difesa',weight:role==='A'?1.8:1,needsAssist:true},
  {type:'Contropiede',description:'Ripartenza e conclusione in area',weight:1.2,needsAssist:false},
  {type:'Tiro da fuori',description:'Conclusione dalla distanza',weight:role==='C'?1.8:.7,needsAssist:false},
  {type:'Calcio d’angolo',description:'Colpo di testa su corner',weight:role==='D'?2.4:.8,needsAssist:true},
  {type:'Palla inattiva',description:'Punizione diretta',weight:.45,needsAssist:false},
  {type:'Azione personale',description:'Dribbling e conclusione',weight:.85,needsAssist:false}
 ];
 return pick(methods,m=>m.weight,rng);
}
export function simulatePrematchTimeline({fixture,prediction,lineup,roster=[],players=[],stats=[],competition}={}){
 if(!fixture||!prediction)return {events:[],label:'Dati insufficienti'};
 const duration=clamp(Number(competition?.minutes_per_period||40)*Number(competition?.periods||2),40,120);
 const seed=fixture.id+'|'+(lineup?.formation||'')+'|'+(lineup?.players||[]).map(x=>x.player_id).join('|');
 const rng=random(seed),ownSide=lineup?.teamSide||'home';
 const scoreline=prediction.probabilities?.mostLikely||{};
 const goals={home:clamp(Math.round(num(scoreline.home)??num(prediction.expectedGoals?.home)??1),0,5),
  away:clamp(Math.round(num(scoreline.away)??num(prediction.expectedGoals?.away)??1),0,5)};
 const byPlayer=new Map(players.map(p=>[String(p.id),p])),byStats=new Map(stats.map(s=>[String(s.player_id),s]));
 const starter=(lineup?.players||[]).map(p=>({...byPlayer.get(String(p.player_id)),...p}));
 const active=new Map(starter.map(p=>[String(p.player_id),p]));
 const starterIds=new Set(active.keys());
 const bench=roster.filter(p=>p.active!==false&&!starterIds.has(String(p.player_id))&&
  p.selection_status!=='absent'&&p.availability_status!=='absent')
  .map(p=>({...byPlayer.get(String(p.player_id)),...p}));
 const usedBench=new Set(),usedOut=new Set(),scored=new Map();
 const schedule=[];
 for(const side of ['home','away'])for(let i=0;i<goals[side];i++)
  schedule.push({type:'goal',side,minute:matchGoalMinutes(prediction.situational?.[side],duration,rng),seq:i});
 schedule.sort((a,b)=>a.minute-b.minute||a.side.localeCompare(b.side));
 const events=[{minute:0,type:'phase',label:'Calcio d’inizio',basis:'Assetto iniziale della formazione'},
  {minute:Math.round(duration/2),type:'phase',label:'Intervallo',basis:'Valutazione del parziale'}];
 const changes=starter.length&&bench.length?[.64,.77,.88].slice(0,Math.min(3,bench.length)).map((ratio,i)=>({
  minute:Math.max(1,Math.min(duration-1,Math.round(duration*ratio))),type:'changeCandidate',seq:i
 })):[];
 const happenings=[...schedule,...changes].sort((a,b)=>a.minute-b.minute||(a.type==='goal'?-1:1));
 const partial={home:0,away:0};
 for(const item of happenings){
  if(item.type==='changeCandidate'){
   const margin=partial[ownSide]-partial[ownSide==='home'?'away':'home'];
   if(margin<0&&item.seq===2)continue;
   const rotation=margin>=2?1:margin===1?.7:margin===0?.4:.15;
   const outgoing=pick([...active.values()].filter(p=>p.slot!==1&&!usedOut.has(String(p.player_id))),
    p=>.5+(recentMinutes(p,byStats)/Math.max(1,num(byStats.get(String(p.player_id))?.appearances)??1)/duration)*.6+
    (8-(num(p.expectedRating)??6))*.16,rng);
   if(!outgoing)continue;
   const incoming=pick(bench.filter(p=>!usedBench.has(String(p.player_id))),
    p=>{const g=group(p),fit=g===group(outgoing)?2.5:.3;
     const m=recentMinutes(p,byStats),apps=num(byStats.get(String(p.player_id))?.appearances)??0;
     const usage=apps?m/apps:0;
     return .3+fit+rotation*2.4/(1+usage/duration)+(num(p.avg_rating)??6)*.07},rng);
   if(!incoming)continue;
   const outId=String(outgoing.player_id),inId=String(incoming.player_id);
   active.delete(outId);active.set(inId,{...incoming,targetRole:outgoing.targetRole,slot:outgoing.slot});
   usedOut.add(outId);usedBench.add(inId);
   events.push({minute:item.minute,type:'substitution',side:ownSide,player_id:incoming.player_id,off_id:outgoing.player_id,
    label:fullName(incoming)+' per '+fullName(outgoing),
    basis:margin>=2?'Gestione vantaggio e minutaggio':margin<0?'Ricerca della rimonta':'Ricambio e gestione delle energie'});
   continue;
  }
  const {side,minute}=item,ourGoal=side===ownSide;
  const field=ourGoal?[...active.values()]:[];
  const scorer=pick(field, p=>{
   const st=byStats.get(String(p.player_id))||{};
   const goalsSeen=num(st.goals)??0,apps=num(st.appearances)??0;
   const historical=apps>0?goalsSeen/apps:0;
   const prior=.14+offensive(p)*.30;
   const rating=clamp((num(p.expectedRating)??num(st.avg_rating)??6.2)/6.2,.7,1.35);
   const repetition=Math.pow(.32,scored.get(String(p.player_id))||0);
   return (prior+Math.min(2,historical*2))*rating*repetition;
  },rng);
  if(scorer)scored.set(String(scorer.player_id),(scored.get(String(scorer.player_id))||0)+1);
  const assistPool=field.filter(p=>p.player_id!==scorer?.player_id&&p.slot!==1);
  const assisted=scorer&&assistPool.length&&rng()<.74;
  const assistant=assisted?pick(assistPool,p=>{
   const st=byStats.get(String(p.player_id))||{},apps=num(st.appearances)??0;
   const history=apps?(num(st.assists)??0)/apps:0;
   return .18+(group(p)==='C'?1.2:group(p)==='A'?1.15:.5)+Math.min(2,history*2)+(num(p.expectedRating)??6)*.08;
  },rng):null;
  const method=goalMethod(scorer,assistant,rng);
 const creditedAssist=method.needsAssist?assistant:null;
  partial[side]++;
  events.push({minute,type:'goal',side,player_id:scorer?.player_id||null,assist_id:creditedAssist?.player_id||null,
   scorer:scorer?fullName(scorer):null,assistman:creditedAssist?fullName(creditedAssist):null,
   method:method.type,dynamics:method.description,
   label:ourGoal?(scorer?'GOL '+fullName(scorer):'GOL squadra'):'GOL avversario',
   basis:method.description,partial:partial.home+'–'+partial.away});
 }
 events.push({minute:duration,type:'phase',label:'Fine gara',basis:'Risultato '+goals.home+'–'+goals.away});
 events.sort((a,b)=>a.minute-b.minute||(a.type==='phase'?-1:1));
 return {events,duration,score:goals.home+'–'+goals.away,coverage:num(prediction.coverage)??0,
  formation:lineup?.formation||null,feasibility:lineup?.feasibility??null,
  homeName:prediction.home?.name||fixture.home_team||'Casa',awayName:prediction.away?.name||fixture.away_team||'Trasferta',
  label:'Timeline elaborata con dati pre-gara'};
}
export function renderSimulatedTimeline(model,escape=x=>String(x??'')){
 if(!model)return '<p>Simulazione non disponibile.</p>';
 const head='<div class="prematch-simulation-head"><div><strong>'+escape(model.homeName)+' '+escape(model.score)+' '+escape(model.awayName)+'</strong>'+
  '<small>'+escape(model.label)+'</small></div><button type="button" data-simulation-export class="prematch-export-btn">Genera immagine 9:16</button></div>';
 const rows=model.events.map(e=>'<li class="prematch-simulation-event">'+
  '<span class="prematch-simulation-minute">'+e.minute+'′</span>'+
  '<span class="prematch-simulation-type">'+(e.type==='goal'?'GOL':e.type==='substitution'?'CAMBIO':'FASE')+'</span>'+
  '<div><strong>'+escape(e.label)+'</strong>'+
  (e.type==='goal'&&e.assistman?'<small>Assist: '+escape(e.assistman)+'</small>':'')+
  (e.type==='goal'?'<small>'+escape(e.method)+' · '+escape(e.dynamics)+'</small>':'<small>'+escape(e.basis)+'</small>')+
  '</div>'+(e.partial?'<b class="prematch-simulation-partial">'+escape(e.partial)+'</b>':'')+'</li>').join('');
 return head+'<ol class="prematch-simulation-events">'+rows+'</ol>'+
  '<p class="prematch-simulation-disclaimer">SIMULAZIONE · Timeline generata da dati disponibili prima della gara. Non modifica i tabellini.</p>';
}
