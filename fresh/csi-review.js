import {cumulativeEventMinute} from './match-minutes.js';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={goal:'Gol',yellow_card:'Ammonizione',blue_card:'Cartellino blu',red_card:'Espulsione',substitution:'Cambio',unknown:'Evento CSI'};
const norm=v=>String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
function playerLabel(p){return [p?.last_name,p?.first_name].filter(Boolean).join(' ')||p?.display_name||p?.name||'Giocatore'}
function csiSide(ev,match){
 if(!ev?.source_team_side)return null;
 const oursHome=match?.home_away==='home';
 return ev.source_team_side==='home'?(oursHome?'team':'opponent'):(oursHome?'opponent':'team');
}
function minuteLabel(ev){
 if(ev?.minute==null)return '—';
 return ev.stoppage_minute?ev.minute+"+"+ev.stoppage_minute+"'":ev.minute+"'";
}
function csiWho(ev){
 if(ev.event_type==='substitution')return [ev.player_out_name,ev.player_in_name].filter(Boolean).join(' → ')||'Giocatori non pubblicati';
 if(ev.player_name)return ev.player_name+(ev.shirt_number!=null?' #'+ev.shirt_number:'');
 if(ev.event_type==='goal')return 'Marcatore non pubblicato dal CSI';
 return 'Giocatore non indicato';
}
function tmWho(ev,players){
 const map=new Map(players.map(p=>[p.id,playerLabel(p)]));
 if(ev.event_type==='substitution')return [map.get(ev.player_id),map.get(ev.secondary_player_id)].filter(Boolean).join(' → ')||'Giocatori non indicati';
 return map.get(ev.player_id)||ev.payload?.opponent_player_name||(ev.payload?.opponent_shirt_number?'#'+ev.payload.opponent_shirt_number:'Giocatore non indicato');
}
function candidateScore(source,target,match,players,competition){
 if(source.event_type!==target.event_type)return -1;
 const side=csiSide(source,match);
 if(side&&target.team_side!==side)return -1;
 const sm=Number(source.minute),tm=cumulativeEventMinute(target,competition);
 let score=45;
 if(Number.isFinite(sm)&&Number.isFinite(tm)){
  const diff=Math.abs(sm-tm);
  if(diff>3)return -1;
  score+=diff===0?35:diff===1?27:diff===2?18:8;
 }
 if(source.shirt_number!=null&&Number(target.payload?.opponent_shirt_number)===Number(source.shirt_number))score+=15;
 if(source.player_name&&target.player_id){
  const p=players.find(x=>x.id===target.player_id);
  const a=norm(source.player_name),b=norm(playerLabel(p));
  if(a&&b&&(a.includes(b.split(' ')[0])||b.includes(a.split(' ')[0])))score+=15;
 }
 return score;
}
export function compareCsiEvents(sourceEvents=[],tmEvents=[],match,players=[],competition=null){
 const usable=tmEvents.filter(e=>e.validation_status!=='rejected'&&e.event_type!=='period_end');
 const used=new Set();
 const rows=sourceEvents.map(source=>{
  let best=null,bestScore=-1;
  for(const target of usable){
   if(used.has(target.id))continue;
   const score=candidateScore(source,target,match,players,competition);
   if(score>bestScore){best=target;bestScore=score}
  }
  if(best&&bestScore>=60)used.add(best.id);
  const state=!best||bestScore<45?'csi_only':bestScore>=90?'exact':bestScore>=60?'probable':'conflict';
  return {source,target:state==='csi_only'?null:best,state,confidence:Math.max(0,Math.min(100,bestScore))};
 });
 const tmOnly=usable.filter(e=>!used.has(e.id)).map(target=>({source:null,target,state:'tm_only',confidence:0}));
 return [...rows,...tmOnly];
}
function stateLabel(state){
 return {exact:'Coincide',probable:'Probabile corrispondenza',conflict:'Da controllare',csi_only:'Solo CSI',tm_only:'Solo Team Manager'}[state]||state;
}
export function csiFixtureDifferences(fixture,payload){
 const differences=[];
 const add=(label,current,source)=>{if(source!=null&&source!==''&&norm(current)!==norm(source))differences.push({label,current:current??'Non disponibile',source})};
 const kickoff=fixture?.kickoff_at?new Date(fixture.kickoff_at):null;
 const parts=kickoff&&!Number.isNaN(kickoff.getTime())?Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(kickoff).map(p=>[p.type,p.value])):null;
 add('Data',parts?`${parts.year}-${parts.month}-${parts.day}`:null,payload?.date);
 add('Ora',parts?`${parts.hour}:${parts.minute}`:null,payload?.time?.padStart(5,'0'));
 add('Campo',fixture?.venue_name||fixture?.venue,payload?.venue?.name);
 // Null means unpublished, not 0–0: still show when CSI withdraws a published score.
 const tmScore=fixture?.home_score!=null&&fixture?.away_score!=null?`${fixture.home_score}–${fixture.away_score}`:'Non disponibile';
 const csiScore=payload?.home?.score!=null&&payload?.away?.score!=null?`${payload.home.score}–${payload.away.score}`:'Non disponibile';
 if(tmScore!==csiScore)differences.push({label:'Risultato',current:tmScore,source:csiScore});
 return differences;
}
export function csiReviewPanel({fixture,match,snapshot,check,sourceEvents=[],tmEvents=[],players=[],competition=null}={}){
 const hasSource=Boolean(fixture?.source_url);
 if(!hasSource)return '<section class="staff-subpanel"><div class="staff-panel-heading"><div><span class="eyebrow">VERIFICA / RETTIFICA</span><h2>Controllo CSI</h2></div></div><p class="staff-help">Questa partita non ha un URL CSI associato.</p></section>';
 const head='<div class="staff-panel-heading"><div><span class="eyebrow">VERIFICA / RETTIFICA</span><h2>Confronto con CSI Live</h2></div><button type="button" class="staff-soft" data-staff-action="csi-import">Importa JSON CSI</button></div>';
 const checkedAt=check?.last_attempt_at?new Date(check.last_attempt_at).toLocaleString('it-IT',{timeZone:'Europe/Rome'}):null;
 const status='<p class="staff-help">Controllo giornaliero alle 07:00 (ora italiana), eseguito dal Mac con Codex disponibile. '+(checkedAt?'Ultimo tentativo: '+E(checkedAt)+'. ':'')+(check?.check_status==='checking'?'Controllo in corso.':check?.check_status==='error'?'Controllo non riuscito: '+E(check.last_error||'Errore CSI')+'. I dati precedenti restano disponibili.':check?.check_status==='ok'?'Ultimo controllo riuscito.':'')+'</p>';
 if(!snapshot)return '<section class="staff-subpanel">'+head+status+'<p class="staff-help">Nessun dato CSI salvato. Attendi il controllo giornaliero oppure importa il JSON generato dallo scraper. I dati ufficiali cambiano solo dopo la tua verifica.</p></section>';
 const differences=csiFixtureDifferences(fixture,snapshot.raw_payload);
 const metadata='<div class="staff-event-list">'+differences.map(d=>'<div class="staff-event-row"><div><strong>'+E(d.label)+' · proposta CSI</strong><span>Team Manager: '+E(d.current)+'</span><span>CSI: '+E(d.source)+'</span></div></div>').join('')+'</div>';
 const comparisons=compareCsiEvents(sourceEvents,tmEvents,match,players,competition);
 const counts=comparisons.reduce((a,x)=>(a[x.state]=(a[x.state]||0)+1,a),{});
 const score=snapshot.home_score!=null&&snapshot.away_score!=null?snapshot.home_score+'–'+snapshot.away_score:'—';
 const rows=comparisons.map(row=>{
  const source=row.source,target=row.target;
  const sourceText=source?minuteLabel(source)+' · '+(labels[source.event_type]||source.event_type)+' · '+csiWho(source):'—';
  const targetText=target?minuteLabel(target)+' · '+(labels[target.event_type]||target.event_type)+' · '+tmWho(target,players):'—';
  return '<div class="staff-event-row csi-compare-row csi-'+E(row.state)+'"><div><strong>'+E(stateLabel(row.state))+(row.confidence?' · '+E(row.confidence)+'%':'')+'</strong><span>CSI: '+E(sourceText)+'</span><small>Team Manager: '+E(targetText)+'</small></div></div>';
 }).join('');
 return '<section class="staff-subpanel">'+head+status+
  '<p class="staff-help">Snapshot '+E(new Date(snapshot.fetched_at).toLocaleString('it-IT',{timeZone:'Europe/Rome'}))+' · risultato CSI '+E(score)+' · stato '+E(snapshot.review_status)+'. I dati restano provvisori fino alla conferma admin.</p>'+
  (snapshot.raw_payload?.status?'<p class="staff-help">Stato pubblicato dal CSI: '+E(snapshot.raw_payload.status)+'</p>':'')+metadata+
  (differences.length?'<p class="staff-help">Valuta le proposte e usa i controlli di modifica della partita o di rettifica del risultato per confermarle.</p>':'')+
  '<div class="staff-review-summary"><div><b>'+E(counts.exact||0)+'</b><small>Coincidono</small></div><div><b>'+E(counts.probable||0)+'</b><small>Probabili</small></div><div><b>'+E((counts.conflict||0)+(counts.csi_only||0)+(counts.tm_only||0))+'</b><small>Da controllare</small></div></div>'+
  '<div class="staff-event-list">'+(rows||'<p class="empty">Il CSI non pubblica eventi per questa gara.</p>')+'</div></section>';
}
