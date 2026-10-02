import {get,rpc,adminWrite,reviewPasswordRequest} from './api.js';
import {importPanel} from './calendar-import.js';
import {pitchMarkup} from './lineup-pitch.js';
import {staffTacticsPanel,tacticalPayload} from './tactics.js';
import {parseKickoff} from './import-domain.js';
import {reviewPanel} from './postmatch-review.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const attrs=(rows,key,label)=>rows.map(row=>'<option value="'+esc(row[key])+'">'+esc(row[label])+'</option>').join('');
const option=(value,label,selected)=>'<option value="'+esc(value)+'"'+(String(value)===String(selected)?' selected':'')+'>'+esc(label)+'</option>';
const input=(name,label,value='',type='text',extra='')=>'<label class="staff-field"><span>'+esc(label)+'</span><input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>';
const selection=(name,label,choices,current)=>'<label class="staff-field"><span>'+esc(label)+'</span><select name="'+name+'">'+choices.map(x=>option(x[0],x[1],current)).join('')+'</select></label>';
const help=text=>'<p class="staff-help">'+esc(text)+'</p>';
const title=(name,text)=>'<div class="staff-panel-heading"><div><span class="eyebrow">'+esc(name)+'</span><h2>'+esc(text)+'</h2></div></div>';
const btn=(action,label)=>'<button type="button" class="staff-soft" data-staff-action="'+esc(action)+'">'+esc(label)+'</button>';
const submit=label=>'<button type="submit" class="staff-submit">'+esc(label)+'</button>';
const initial={area:'team',selected:{seasons:'',competitions:'',opponents:'',players:'',fixtures:'',injuries:'',suspensions:''},matchTab:'lineup',busy:false};
const memory=initial;
let reviewEditEvent=null,reviewHistoryEvent=null,reviewHistoryEntries=[];
let scoreAuditRows=[],scoreAuditOpen=false;
let integrityData=null,integrityError='';
function integrityPanel(){
 const count=Number(integrityData?.issue_count||0);
 const entries=(integrityData?.issues||[]).map(x=>'<div class="staff-event-row"><div><strong>'+esc(x.kind)+'</strong><span>'+esc(x.message)+'</span><small>Match: '+esc(x.match_id||'—')+' / Fixture: '+esc(x.fixture_id||'—')+'</small></div></div>').join('');
 return '<section class="glass panel staff-editor">'+title('DIAGNOSTICA','Integrità dei dati')+help('Controlla collegamenti, risultati discordanti, giocatori ed eventi orfani. Non modifica, elimina o approva nulla.')+btn('audit-integrity','Esegui controllo')+(integrityError?'<p class="data-warning">'+esc(integrityError)+'</p>':'')+(integrityData?'<p class="staff-help">Segnalazioni: '+count+' · '+esc(new Date(integrityData.checked_at).toLocaleString('it-IT'))+'</p>'+ (entries||help('Nessuna incongruenza rilevata.')):help('Controllo non ancora eseguito.'))+'<div class="staff-event-list">'+entries+'</div></section>';
}

const areas=[['team','Squadra'],['seasons','Stagioni'],['competitions','Competizioni'],['opponents','Avversarie'],['players','Rosa'],['fixtures','Calendario'],['import','Importa CSV'],['integrity','Integrità'],['availability','Disponibilità'],['users','Utenti']];
const types=[['starter','Titolare'],['bench','Panchina'],['available','Da definire'],['absent','Non convocato']];
const reasons=[['','Nessuno'],['injury','Infortunio'],['suspension','Squalifica'],['work','Lavoro'],['personal','Personale'],['illness','Malattia'],['travel','Viaggio'],['technical_choice','Scelta tecnica'],['physical','Condizione fisica'],['other','Altro']];
const events=[['goal','Gol'],['own_goal','Autogol'],['penalty_scored','Rigore segnato'],['penalty_missed','Rigore sbagliato'],['yellow_card','Ammonizione'],['blue_card','Cartellino blu'],['blue_return','Rientro blu'],['red_card','Espulsione'],['substitution','Sostituzione / Uscita'],['period_end','Fine periodo'],['other','Altro']];
const statuses=[['scheduled','Programmata'],['live','In corso'],['finished','Terminata'],['postponed','Rinviata'],['cancelled','Annullata']];
const idOf=(list,id)=>list.find(x=>x.id===id)||null;
function findGeneralSeason(available,app,teamId){
 if(!app)return null;
 const options=(available||[]).filter(g=>g.team_id===teamId &&
  String(g.name||'').trim().toLowerCase()===String(app.name||'').trim().toLowerCase() &&
  (Math.min(Date.parse(g.end_date),Date.parse(app.end_date))-Math.max(Date.parse(g.start_date),Date.parse(app.start_date)))>=180*86400000);
 return options.length===1?options[0]:null;
}
const roleOf=ctx=>ctx.state.identity?.profile?.is_active===false?null:ctx.state.identity?.role?.role;
export const isStaff=ctx=>['admin','manager'].includes(roleOf(ctx));
function selectExisting(kind,records,text){return '<label class="staff-field"><span>Modifica esistente o crea nuovo</span><select data-staff-select="'+kind+'">'+option('','+ Nuovo',memory.selected[kind])+records.map(x=>option(x.id,x[text]||x.name||x.id,memory.selected[kind])).join('')+'</select></label>'}
function wrapForm(id,heading,form,description){return '<section class="glass panel staff-editor">'+title('CONFIGURAZIONE',heading)+(description?help(description):'')+'<form data-staff-form="'+id+'" class="staff-form">'+form+submit('Salva')+'</form></section>'}
export function adminPage(ctx){
 if(!isStaff(ctx))return '<div class="empty">Gestione riservata allo staff autorizzato.</div>';
 const data=ctx.state.data||{},base=ctx.state.base||{},t=base.team||{};
 const S=memory.selected,seasons=base.seasons||[],comps=data.competitions||[],opps=base.opponents||[],players=data.players||[],fixtures=data.fixtures||[];
 const unlinked=(data.matches||[]).filter(m=>!m.fixture_id);
 let form='';
 if(memory.area==='team'){
  form=wrapForm('team','Identità squadra',
   '<div class="staff-form-grid">'+input('name','Nome completo',t.name,'text','required maxlength="100"')+
   input('short_name','Sigla',t.short_name,'text','required maxlength="12"')+
   input('logo_url','URL stemma',t.logo_url||'','url')+
   input('primary_color','Colore principale',t.primary_color||'#225e88','color')+
   input('secondary_color','Colore secondario',t.secondary_color||'#f0f9ff','color')+
   input('accent_color','Colore accento',t.accent_color||'#baeeb4','color')+
   input('home_venue_name','Campo principale',t.home_venue_name||'')+'</div>',
   'La modifica dei dati ufficiali è soggetta ai permessi di squadra presenti in Supabase.');
 }
 if(memory.area==='seasons'){
  const selected=idOf(seasons,S.seasons);const fields=selectExisting('seasons',seasons,'name');
   form=wrapForm('seasons','Stagioni',fields+
   '<div class="staff-form-grid">'+input('name','Nome stagione',selected?.name||'','text','required')+
   input('start_date','Inizio',selected?.start_date||'','date','required')+
   input('end_date','Fine',selected?.end_date||'','date','required')+
   selection('status','Stato',[['future','Futura'],['archived','Archiviata']],selected?.status==='active'?'future':selected?.status||'future')+'</div>',
   'La stagione attiva non può essere disattivata da questo modulo. Usa «Imposta come attiva» per il passaggio atomico.')+
   (selected&&selected.status!=='active'?'<div class="staff-after">'+btn('activate-season','Imposta come stagione attiva')+'</div>':'');
 }
 if(memory.area==='competitions'){
  const c=idOf(comps,S.competitions);let settings=c?.discipline_rules||{};
  const appSeason=seasons.find(x=>x.id===ctx.state.season);
  const generalSeason=findGeneralSeason(data.generalSeasons,appSeason,t.id);
  const generalCandidates=(data.generalCompetitions||[]).filter(x=>x.season_id===generalSeason?.id);
  const chosenBridge=(data.competitionLinks||[]).find(x=>x.app_competition_id===c?.id);
  form=wrapForm('competitions','Regolamenti delle competizioni',selectExisting('competitions',comps,'name')+
   '<div class="staff-form-grid">'+input('name','Denominazione',c?.name||'','text','required')+
   selection('kind','Categoria',[['league','Campionato'],['cup','Coppa'],['friendly','Amichevole'],['tournament','Torneo'],['other','Altro']],c?.kind||'league')+
   input('format','Formato',c?.format||'round_robin','text','required maxlength="80"')+
   input('periods','Numero tempi',c?.periods??2,'number','min="1" max="6" required')+
   input('minutes_per_period','Minuti per tempo',c?.minutes_per_period??40,'number','min="1" max="120" required')+
   input('win_points','Punti vittoria',c?.win_points??3,'number','min="0" max="20" required')+
   input('draw_points','Punti pareggio',c?.draw_points??1,'number','min="0" max="20" required')+
   input('loss_points','Punti sconfitta',c?.loss_points??0,'number','min="0" max="20" required')+
   input('blue_duration','Blu: sospensione in minuti',settings.blue_duration_minutes||'','number','min="1" max="30"')+
   input('yellow_thresholds','Soglie diffida (es. 5,4,3,2)',Array.isArray(settings.yellow_thresholds)?settings.yellow_thresholds.join(','):'','text','maxlength="80"')+
   selection('knockout_two_legged','Eliminazione diretta',[['false','Gara secca'],['true','Andata e ritorno']],String(c?.knockout_two_legged??false))+
   selection('extra_time_enabled','Tempi supplementari',[['false','Disabilitati'],['true','Abilitati']],String(c?.extra_time_enabled??false))+
   input('extra_time_periods','Tempi supplementari: numero',c?.extra_time_periods??2,'number','min="1" max="4" required')+
   input('extra_time_minutes','Durata supplementare (minuti)',c?.extra_time_minutes??15,'number','min="1" max="45" required')+
   selection('penalties_enabled','Rigori dopo i supplementari',[['false','Disabilitati'],['true','Abilitati']],String(c?.penalties_enabled??false))+
   selection('playoff_playout_enabled','Playoff e playout',[['false','No'],['true','Sì']],String(c?.playoff_playout_enabled??false))+
   selection('general_competition_id','Competizione gestionale collegata',
    [['','Nessuna (blocco conservativo delle squalifiche attive)'],...generalCandidates.map(x=>[x.id,x.name])],
    chosenBridge?.general_competition_id||'')+'</div>',
   'Le competizioni conservano la propria durata e regole. Non vengono cancellati calendario o partite.');
  if(c){
   const linked=new Set((data.competitionOpponents||[]).filter(x=>x.competition_id===c.id).map(x=>x.opponent_id));
   const choices=opps.map(o=>'<label class="staff-check staff-participant">'+
    '<input type="checkbox" name="opponent_ids" value="'+esc(o.id)+'" '+(linked.has(o.id)?'checked disabled':'')+'>'+
    '<span>'+esc(o.name)+(linked.has(o.id)?' · già associata':'')+'</span></label>').join('');
   form+=wrapForm('participants','Squadre partecipanti', 
    '<p class="staff-help">Le associazioni esistenti restano nello storico. Seleziona nuove avversarie da aggiungere senza rimuovere quelle già collegate.</p>'+
    '<div class="participant-grid">'+choices+'</div>',
    'L’aggiunta è transazionale. I risultati e le giornate esistenti non vengono alterati.');
  }
 }
 if(memory.area==='opponents'){
  const o=idOf(opps,S.opponents);
  form=wrapForm('opponents','Anagrafiche avversarie',selectExisting('opponents',opps,'name')+
   '<div class="staff-form-grid">'+input('name','Nome',o?.name||'','text','required')+
   input('short_name','Sigla',o?.short_name||'','text','maxlength="15"')+
   input('logo_url','Stemma (URL)',o?.logo_url||'','url')+
   input('primary_color','Colore principale',o?.primary_color||'#567aa3','color')+
   input('secondary_color','Colore secondario',o?.secondary_color||'#ffffff','color')+
   input('home_venue_name','Campo',o?.home_venue_name||'')+
   input('home_venue_address','Indirizzo campo',o?.home_venue_address||'')+'</div>',
   'Ogni avversaria mantiene la sua identità tra stagioni e competizioni.');
 }
 if(memory.area==='players'){
  const list=[...players].sort((a,b)=>String(a.last_name).localeCompare(String(b.last_name),'it'));
  const p=idOf(players,S.players);const r=data.roster?.find(x=>x.player_id===p?.id);
  form=wrapForm('players','Gestione anagrafica e rosa',
   selectExisting('players',list,'last_name')+
   '<div class="staff-form-grid">'+input('first_name','Nome',p?.first_name||'','text','required')+
   input('last_name','Cognome',p?.last_name||'','text','required')+
   selection('generic_role_manual','Ruolo',[['','Non specificato'],['P','Portiere'],['D','Difensore'],['C','Centrocampista'],['A','Attaccante']],p?.generic_role_manual||'')+
   selection('preferred_foot','Piede',[['','Non indicato'],['right','Destro'],['left','Sinistro'],['both','Ambidestro']],p?.preferred_foot||'')+
   input('height_cm','Altezza (cm)',p?.height_cm??'','number','min="100" max="245"')+
   selection('active','Nella rosa della stagione',[['true','Sì'],['false','No']],r?.active===false?'false':'true')+'</div>',
   'L’identità del giocatore resta invariata fra stagioni. La rimozione dalla rosa non elimina lo storico.');
 }
 if(memory.area==='users'){
  if(roleOf(ctx)!=='admin'){
   form='<section class="glass panel staff-editor">'+help('Gestione account riservata agli amministratori.')+'</section>';
  }else{
   const profiles=(data.profiles||[]).slice().sort((a,b)=>String(a.display_name||'').localeCompare(String(b.display_name||''),'it'));
   const requests=(data.passwordRequests||[]).filter(x=>x.status==='pending');
   form='<section class="glass panel staff-editor">'+title('ACCOUNT','Utenti registrati')+
    help('Identità gestite da Supabase Auth: password e token non sono consultabili.')+

    '<div class="staff-account-list">'+profiles.map(p=>{
      const record=(data.userRoles||[]).find(r=>r.user_id===p.id);
      if(!record)return '';
      const taken=new Set((data.userRoles||[]).filter(r=>r.user_id!==p.id&&r.player_id).map(r=>r.player_id));
      const options=(data.players||[]).filter(x=>!taken.has(x.id)).sort((a,b)=>String(a.last_name||'').localeCompare(String(b.last_name||''),'it')).map(x=>[x.id,(x.last_name||'')+' '+(x.first_name||'')]);
      return '<form class="account-admin-row" data-staff-form="account" data-user-id="'+esc(p.id)+'">'+
       '<div class="account-admin-title"><strong>'+esc(p.display_name||p.username||'Account')+'</strong>'+
       '<small>@'+esc(p.username||'—')+'</small></div><div class="staff-form-grid">'+
       selection('role','Ruolo',[['fan','Fan'],['player','Giocatore'],['coach','Allenatore'],['manager','Manager'],['admin','Admin']],record.role)+
       selection('player_id','Giocatore collegato',[['','Nessuno'],...options],record.player_id||'')+
       selection('active','Accesso',[['true','Attivo'],['false','Disattivato']],String(p.is_active))+
       '</div>'+submit('Salva account')+'</form>';
    }).join('')+
    (!profiles.length?'<p class="empty">Elenco non disponibile.</p>':'')+'</div></section>'+
    '<section class="glass panel staff-editor staff-requests">'+title('RECUPERO','Richieste di ripristino password')+
    help('La password temporanea viene generata sul server e mostrata una sola volta. Il profilo sarà obbligato a cambiarla.')+
    requests.map(r=>'<div class="staff-request"><div><b>'+esc(profiles.find(p=>p.id===r.user_id)?.display_name||'Utente')+'</b><small>'+
      esc(r.requested_at?new Date(r.requested_at).toLocaleDateString('it-IT'):'')+'</small></div><div class="staff-event-buttons">'+
      '<button type="button" class="staff-soft" data-staff-action="password-resolve" data-request-id="'+esc(r.id)+'">Approva</button>'+
      '<button type="button" class="staff-danger" data-staff-action="password-reject" data-request-id="'+esc(r.id)+'">Rifiuta</button></div></div>').join('')+
    (!requests.length?'<p class="staff-help">Nessuna richiesta in sospeso.</p>':'')+'</section>';
  }
 }
 if(memory.area==='import')form=importPanel(ctx);
 if(memory.area==='integrity')form=integrityPanel();
 if(memory.area==='availability'){
  const s=base.seasons.find(x=>x.id===ctx.state.season),general=findGeneralSeason(data.generalSeasons,s,t.id);
  if(!general){
   form='<section class="glass panel staff-editor"><h2>Stagione gestionale non associata</h2>'+
    help('Infortuni e squalifiche usano la tabella seasons, diversa da app_seasons. Occorrono squadra e denominazione stagione uguali e almeno 180 giorni sovrapposti; associazioni ambigue sono bloccate.')+'</section>';
  }else{
   const personChoices=players.map(x=>[x.id,(x.last_name||'')+' '+(x.first_name||'')])
    .sort((a,b)=>a[1].localeCompare(b[1],'it'));
   const inj=(data.injuries||[]).filter(x=>x.team_id===t.id),susp=(data.suspensions||[]).filter(x=>x.team_id===t.id);
   const oldIn=idOf(inj,S.injuries),oldSusp=idOf(susp,S.suspensions);
   const iLabel=inj.map(x=>({...x,label:(players.find(p=>p.id===x.player_id)?.last_name||'Giocatore')+' · '+x.injury_date+' · '+x.status}));
   const sLabel=susp.map(x=>({...x,label:(players.find(p=>p.id===x.player_id)?.last_name||'Giocatore')+' · '+x.issued_date+' · '+x.status}));
   form=wrapForm('injuries','Infortuni',selectExisting('injuries',iLabel,'label')+
    '<div class="staff-form-grid">'+selection('player_id','Giocatore',personChoices,oldIn?.player_id||'')+
    input('injury_date','Data infortunio',oldIn?.injury_date||'','date','required')+
    selection('status','Condizione',[['active','Infortunato'],['recovering','Recupero'],['fit','Disponibile'],['closed','Archiviato']],oldIn?.status||'active')+
    input('expected_return','Rientro stimato',oldIn?.expected_return||'','date')+
    input('actual_return','Rientro effettivo',oldIn?.actual_return||'','date')+
    input('public_summary','Descrizione pubblica',oldIn?.public_summary||'','text','maxlength="500"')+'</div>',
    'L’infortunio resta nello storico. La sua segnalazione non impedisce automaticamente la convocazione.')+
   wrapForm('suspensions','Squalifiche',selectExisting('suspensions',sLabel,'label')+
    '<div class="staff-form-grid">'+selection('player_id','Giocatore',personChoices,oldSusp?.player_id||'')+
    selection('suspension_type','Tipologia',[['red_card','Espulsione'],['yellow_accumulation','Diffida'],['disciplinary','Provvedimento'],['club','Club'],['other','Altro']],oldSusp?.suspension_type||'disciplinary')+
    input('issued_date','Data provvedimento',oldSusp?.issued_date||new Date().toISOString().slice(0,10),'date','required')+
    input('matches_count','Turni assegnati',oldSusp?.matches_count??1,'number','min="0" max="99" required')+
    input('matches_served','Turni scontati',oldSusp?.matches_served??0,'number','min="0" max="99" required')+
    selection('status','Stato',[['active','Attiva'],['served','Scontata'],['cancelled','Revocata']],oldSusp?.status||'active')+
    input('reason','Motivazione',oldSusp?.reason||'','text','maxlength="500"')+
    input('start_date','Dal',oldSusp?.start_date||'','date')+
    input('end_date','Al',oldSusp?.end_date||'','date')+'</div>',
    'Squalifica inserita nel modello gestionale esistente. Senza competizione associata vale per tutte quelle applicabili.');
  }
 }
 if(memory.area==='fixtures'){
  const own=fixtures.filter(x=>ctx.involvesTeam(x,base.team));
  const f=idOf(own,S.fixtures);
  const local=f?.kickoff_at?new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(f.kickoff_at)).replace(' ','T'):'';
  form=wrapForm('fixtures','Calendario e risultati',
   selectExisting('fixtures',own.map(f=>({...f,name:f.home_team+' – '+f.away_team+' · '+(f.round_no??'')})),'name')+
   (!f?'<p class="staff-help">Nuova partita: scegli giornata, competizione, squadre, data e campo. Per molti incontri usa Importa CSV.</p>'+
   '<div class="staff-form-grid">'+
    selection('competition_id','Competizione',comps.map(c=>[c.id,c.name]),comps[0]?.id)+
    input('round_no','Giornata',1,'number','min="1" max="250" required')+
    selection('home_team','Squadra di casa',[[t.name,t.name],...opps.map(o=>[o.name,o.name])],t.name)+
    selection('away_team','Ospite',[[t.name,t.name],...opps.map(o=>[o.name,o.name])],opps[0]?.name)+
    input('kickoff_at','Data e ora (Italia)','', 'datetime-local','required')+
    input('venue_name','Campo','')+input('venue_address','Indirizzo','')+'</div>':
   '<div class="staff-form-grid">'+input('kickoff_at','Data e ora',local,'datetime-local','required')+
   input('venue_name','Campo',f.venue_name||'')+
   input('venue_address','Indirizzo',f.venue_address||'')+
   input('home_score','Gol casa',f.home_score??'','number','min="0" max="99"')+
   input('away_score','Gol ospite',f.away_score??'','number','min="0" max="99"')+
   selection('status','Stato',statuses,f.status)+'</div>'),
   'La fixture è la fonte ufficiale di calendario e risultati. Per modifiche durante il live usa il Match Center.');
 }
 const tabs='<div class="staff-switch" role="tablist">'+areas.filter(x=>x[0]!=='users'||roleOf(ctx)==='admin').map(([key,label])=>
 '<button type="button" role="tab" aria-selected="'+(key===memory.area)+'" data-staff-area="'+key+'" class="'+(key===memory.area?'selected':'')+'">'+label+'</button>').join('')+'</div>';
 return ctx.heading('CENTRO DI CONTROLLO','Amministrazione','Gestione della squadra, delle competizioni e dei dati sportivi senza eliminare lo storico.')+
 '<div class="staff-intro glass"><span class="staff-orb">✦</span><div><span class="eyebrow">PERSONALE AUTORIZZATO</span><h2>Gestione sportiva</h2><p>Le modifiche vengono validate dal database. Operazioni distruttive disabilitate per proteggere i riferimenti storici.</p></div></div>'+
 tabs+(unlinked.length?'<div class="staff-link-warning" role="status"><strong>'+unlinked.length+' tabellino/i senza fixture collegata</strong><p>Le partite programmate vengono associate solo se dati e avversaria sono univoci. Quelle concluse con risultati discordanti richiedono revisione prima del collegamento.</p>'+unlinked.map(m=>'<div>'+esc(m.round_label||'Giornata non indicata')+' · '+esc(m.status)+' · '+esc(m.kickoff_at?.slice(0,10)||'Data assente')+'</div>').join('')+'</div>':'')+form+'<p class="staff-footnote">Moduli operativi di partita e convocazioni: apri un incontro dal calendario e scegli «Gestione».</p>';
}
const playerText=p=>p?String(p.last_name||'')+' '+String(p.first_name||''):'Giocatore';
function picker(name,label,choices,value){return selection(name,label,choices,value)}
const statusOf=m=>String(m?.status||'scheduled');
function displayClock(m,competition){
 if(!m)return '';
 return '<div class="clockline"><span class="status '+(m.status==='live'?'live':'end')+'">'+esc(m.status==='live'?'LIVE':m.status==='finished'?'FINALE':'PREPARTITA')+'</span><strong data-staff-clock data-seconds="'+Number(m.live_clock_seconds||0)+'" data-anchor="'+esc(m.live_clock_anchor||'')+'" data-running="'+Boolean(m.live_clock_running)+'" data-match="'+esc(m.id)+'" data-blue-min="'+Number(competition?.discipline_rules?.blue_duration_minutes||0)+'">00:00</strong><span>'+esc(m.live_period||'pre')+'</span></div>';
}
function matchLineup(ctx,m){
 const players=ctx.state.data?.players||[],roster=(ctx.state.data?.roster||[]).filter(r=>r.active!==false),
  current=ctx.state.matchData?.players||[];
 const rostered=roster.map(x=>({...x,person:players.find(p=>p.id===x.player_id)})).filter(x=>x.person)
   .sort((a,b)=>String(a.person.last_name).localeCompare(String(b.person.last_name),'it'));
 const allowed=m.status==='scheduled';
 const fields=rostered.map(row=>{
  const old=current.find(x=>x.player_id===row.player_id);
  const status=old?.started?'starter':old?.selection_status||'available';
  const cap=Boolean(old?.is_captain);
  const code=esc(row.player_id);
  const alerts=[];
  if((ctx.state.data?.injuries||[]).some(i=>i.player_id===row.player_id&&['active','recovering'].includes(i.status)&&!i.actual_return))
   alerts.push('Infortunio segnalato');
  if((ctx.state.data?.suspensions||[]).some(s=>s.player_id===row.player_id&&s.status==='active'&&Number(s.matches_served)<Number(s.matches_count)))
   alerts.push('Squalifica attiva');
  const columns=[
   '<div class="lineup-name" draggable="true" role="button" tabindex="0" aria-label="Seleziona per il campo"><strong>'+esc(playerText(row.person))+'</strong><small>'+esc(row.person.generic_role_manual||'—')+'</small>'+alerts.map(a=>'<em class="lineup-alert">'+esc(a)+'</em>').join('')+'</div>',
   '<select name="status" aria-label="Disponibilità '+esc(playerText(row.person))+'" '+(allowed?'':'disabled')+'>'+types.map(v=>option(v[0],v[1],status)).join('')+'</select>',
   '<input type="number" name="shirt" aria-label="Maglia" placeholder="N°" min="1" max="99" value="'+esc(old?.shirt_number??row.shirt_number??'')+'" '+(allowed?'':'disabled')+'>',
   '<input type="number" name="slot" aria-label="Posizione" placeholder="1–11" min="1" max="11" value="'+esc(old?.tactical_slot??'')+'" '+(allowed?'':'disabled')+'>',
   '<label class="captain-check"><input type="radio" name="captain" value="'+code+'" '+(cap?'checked':'')+' '+(allowed?'':'disabled')+'> C</label>',
   '<select name="reason" aria-label="Motivo indisponibilità" '+(allowed?'':'disabled')+'>'+reasons.map(x=>option(x[0],x[1],old?.unavailability_reason||'')).join('')+'</select>',
  ];
  return '<div class="lineup-row" data-lineup-player="'+code+'">'+columns.join('')+'</div>';
 }).join('');
 return '<section class="staff-subpanel">'+title('PREPARTITA','Convocazioni e undici iniziale')+
 help('Stati disponibili, maglia storica, slot tattico da 1 a 11, capitano e indisponibilità. Squalifica attiva: blocco server; infortunio: segnalazione.')+
 '<form data-staff-form="lineup"><div class="staff-top-fields">'+input('formation','Modulo',m.formation||'4-4-2','text','maxlength="32" '+(allowed?'':'disabled'))+'</div>'+
 pitchMarkup()+'<div class="lineup-header"><span>Giocatore</span><span>Disponibilità</span><span>N°</span><span>Slot</span><span>Cap.</span><span>Motivo</span></div>'+
 '<div class="lineup-rows">'+fields+'</div>'+(!allowed?help('La formazione iniziale è bloccata dopo il fischio. Usa gli eventi live per le sostituzioni.'):submit('Salva convocazioni e formazione'))+'</form></section>';
}
function scoreForm(m){
 return '<form data-staff-form="score" class="live-score-editor"><label>Casa<input name="home_score" type="number" min="0" max="99" required value="'+esc(m.home_score??0)+'"></label><strong>:</strong><label>Ospite<input name="away_score" type="number" min="0" max="99" required value="'+esc(m.away_score??0)+'"></label>'+submit('Aggiorna risultato')+'</form>';
}
function liveControls(m){
 let controls='';
 if(m.status==='scheduled')controls=btn('start','Avvia partita');
 else if(m.status==='live')controls=btn(m.live_clock_running?'pause':'resume',m.live_clock_running?'Pausa cronometro':'Riprendi cronometro')+
  btn('halftime','Intervallo')+btn('second_half','Secondo tempo')+btn('extra','Supplementari')+btn('penalties','Rigori')+btn('finish','Termina partita');
 else if(m.status==='finished')controls=btn('reopen','Riapri per correzioni');
 return '<div class="live-action-row">'+controls+'</div>';
}
function matchLive(ctx,m,competition){
 const people=ctx.state.data?.players||[],rows=ctx.state.matchData?.players||[],present=rows.filter(r=>['starter','bench'].includes(r.selection_status)||r.started);
 const playerOpts=[['','Non indicato']].concat(present.map(x=>[x.player_id,playerText(people.find(p=>p.id===x.player_id))]));
 const active=m.status==='live',mins=competition?.minutes_per_period||45;
 const eventForm=active?'<form data-staff-form="event" class="staff-form live-event-form"><div class="staff-form-grid">'+
 picker('event_type','Evento',events,'goal')+picker('team_side','Squadra',[['team','Nostra squadra'],['opponent','Avversaria']],'team')+
 picker('player_id','Giocatore principale / uscente',playerOpts,'')+
 picker('secondary_player_id','Assist / subentrante',playerOpts,'')+
 input('minute','Minuto nella frazione', '','number','min="0" max="150" placeholder="Sconosciuto"')+
 input('stoppage_minute','Recupero', '','number','min="0" max="30" placeholder="—"')+
 picker('substitution_reason','Motivo del cambio',[['tactical','Tattico'],['injury','Infortunio'],['technical','Tecnico'],['other','Altro']],'tactical')+
 input('notes','Note (facoltative)','','text','maxlength="400"')+'</div>'+
 '<label class="staff-check"><input type="checkbox" name="count_score" checked> Aggiorna anche il tabellone per gol, autogol e rigori segnati</label>'+
 help('Il minuto è riferito alla frazione selezionata ('+mins+' minuti regolamentari). Lascia vuoto se sconosciuto; il recupero resta separato.')+
 submit('Registra evento')+'</form>':help('Gli eventi si registrano a match avviato. Una partita finalizzata richiede riapertura esplicita.');
 return '<section class="staff-subpanel">'+title('DIRETTA','Console di gara')+displayClock(m,competition)+liveControls(m)+(Number(competition?.discipline_rules?.blue_duration_minutes)>0?'<div class="staff-blue-action">'+btn('sync-blue','Verifica rientri blu')+'</div>':'')+
 '<div class="staff-live-grid"><div class="staff-live-panel"><h3>Risultato della partita</h3>'+ (m.status==='finished'?help('Partita finalizzata. Riapri per rettificare.'):scoreForm(ctx.resolveMatch().fixture||m))+
 '</div><div class="staff-live-panel"><h3>Nuovo evento</h3>'+eventForm+'</div></div></section>';
}
function matchEvents(ctx,m){return reviewPanel({match:m,fixture:ctx.resolveMatch().fixture,events:ctx.state.matchData?.events||[],players:ctx.state.data?.players||[],editingEventId:reviewEditEvent,historyEventId:reviewHistoryEvent,historyEntries:reviewHistoryEntries,resultHistoryEntries:scoreAuditOpen?scoreAuditRows:null});}

export function staffMatchPanel(ctx,f,m){
 if(!isStaff(ctx))return '';
 if((!m||!m.fixture_id)&&['finished','live'].includes(f?.status))return '<section class="glass panel staff-root"><h2>Verifica collegamento partita</h2><p class="data-warning">Questa gara è già in corso o conclusa ma non ha un tabellino operativo collegato con certezza. Per evitare duplicazioni è necessario riconciliare manualmente risultati e provenienza dei dati.</p></section>';
 if(!m||!m.fixture_id)return '<section class="glass panel staff-root"><div class="staff-panel-heading"><div><span class="eyebrow">OPERAZIONI</span><h2>Prepara il Match Center</h2></div></div>'+
 help('Associa la partita ufficiale a un unico tabellino operativo, riutilizzando le registrazioni già esistenti quando la corrispondenza è univoca. Nessun dato storico viene duplicato.')+
 btn('ensure','Apri gestione di questa partita')+'</section>';
 const competition=(ctx.state.data?.competitions||[]).find(c=>c.id===f.competition_id);
 const tabs=[['lineup','Convocazioni'],['live','Live'],['events','Eventi'],['tactics','Tattica']];
 const tabNav='<div class="staff-switch small-tabs" role="tablist">'+tabs.map(([k,v])=>
  '<button type="button" role="tab" aria-selected="'+(k===memory.matchTab)+'" class="'+(k===memory.matchTab?'selected':'')+'" data-staff-match-tab="'+k+'">'+v+'</button>').join('')+'</div>';
 const page=memory.matchTab==='lineup'?matchLineup(ctx,m):memory.matchTab==='live'?matchLive(ctx,m,competition):memory.matchTab==='tactics'?staffTacticsPanel(ctx,m):matchEvents(ctx,m);
 return '<section class="glass panel staff-root">'+tabNav+page+'<div class="staff-bottom-actions">'+btn('refresh-match','Aggiorna tabellino')+'</div></section>';
}
function dataForm(form){return Object.fromEntries(new FormData(form))}
function cleaned(o,fields){return Object.fromEntries(fields.map(k=>[k,o[k]===''?null:o[k]]))}
function numberOrNull(n){return n===''||n==null?null:Number(n)}
function adminPayload(form){
 const data=dataForm(form),kind=form.dataset.staffForm,blank=memory.selected;
 if(kind==='team')return {table:'teams',id:null,payload:cleaned(data,['name','short_name','logo_url','primary_color','secondary_color','accent_color','home_venue_name'])};
 if(kind==='seasons')return {table:'app_seasons',id:blank.seasons||null,payload:cleaned(data,['name','start_date','end_date','status'])};
 if(kind==='competitions'){
  const rules={};
  if(data.blue_duration)rules.blue_duration_minutes=Number(data.blue_duration);
  if(String(data.yellow_thresholds||'').trim()){
   if(!/^\d{1,2}(\s*,\s*\d{1,2}){0,9}$/.test(String(data.yellow_thresholds).trim()))
    throw Error('Soglie diffida: usa numeri separati da virgole');
   rules.yellow_thresholds=String(data.yellow_thresholds).split(',').map(x=>Number(x.trim()));
   if(rules.yellow_thresholds.some(x=>x<1||x>30))throw Error('Soglie diffida non valide');
  }
  return {table:'app_competitions',id:blank.competitions||null,payload:{
    ...cleaned(data,['name','kind','format']),periods:Number(data.periods),minutes_per_period:Number(data.minutes_per_period),
    win_points:Number(data.win_points),draw_points:Number(data.draw_points),loss_points:Number(data.loss_points),
    knockout_two_legged:data.knockout_two_legged==='true',
    extra_time_enabled:data.extra_time_enabled==='true',
    extra_time_periods:Number(data.extra_time_periods),extra_time_minutes:Number(data.extra_time_minutes),
    penalties_enabled:data.penalties_enabled==='true',
    playoff_playout_enabled:data.playoff_playout_enabled==='true',
    ... (Object.keys(rules).length?{discipline_rules:rules}:{})
  }};
 }
 if(kind==='opponents')return {table:'app_opponents',id:blank.opponents||null,payload:cleaned(data,['name','short_name','logo_url','primary_color','secondary_color','home_venue_name','home_venue_address'])};
 if(kind==='fixtures'){
  if(!blank.fixtures){
   const round=Number(data.round_no);
   if(!Number.isInteger(round)||round<1||round>250||!data.competition_id)throw Error('Competizione e giornata obbligatorie');
   if(!data.home_team||!data.away_team||data.home_team===data.away_team)throw Error('Le due squadre devono essere diverse');
   return {table:'new-fixture',payload:{
    competition_id:data.competition_id,round_no:round,
    kickoff_at:parseKickoff(data.kickoff_at),home_team:data.home_team,
    away_team:data.away_team,venue_name:data.venue_name||null,
    venue_address:data.venue_address||null
   }};
  }
  const d=cleaned(data,['venue_name','venue_address','status']);
  if(data.kickoff_at)d.kickoff_at=parseKickoff(data.kickoff_at);
  d.home_score=numberOrNull(data.home_score);d.away_score=numberOrNull(data.away_score);
  return {table:'app_competition_fixtures',id:blank.fixtures,payload:d};
 }
 return {table:null,id:null,payload:data};
}
const pendingFn=async(form,fn)=>{const button=form.querySelector('[type="submit"]');if(button){button.disabled=true;button.textContent='Salvataggio…'}try{return await fn()}finally{if(button){button.disabled=false;button.textContent='Salva'}}};
async function reloadMatch(ctx){
 const m=ctx.resolveMatch().operational;
 if(m){
  const rows=await get('app_matches','select=*&id=eq.'+encodeURIComponent(m.id));
  if(rows.length){const i=ctx.state.data.matches.findIndex(x=>x.id===m.id);if(i<0)ctx.state.data.matches.push(rows[0]);else ctx.state.data.matches[i]=rows[0]}
  ctx.state.matchData=await ctx.loadMatchInfo(m.id);
 }
 const fixture=await get('app_competition_fixtures','select=*&id=eq.'+encodeURIComponent(ctx.state.match));
 if(fixture.length){const index=ctx.state.data.fixtures.findIndex(x=>x.id===ctx.state.match);if(index>=0)ctx.state.data.fixtures[index]=fixture[0]}
 ctx.render();
}
export async function staffClick(e,button,ctx){
 if(!isStaff(ctx))return false;
 if(button.dataset.staffArea){
  memory.area=button.dataset.staffArea;ctx.render();return true;
 }
 if(button.dataset.staffMatchTab){
  memory.matchTab=button.dataset.staffMatchTab;ctx.render();return true;
 }
 const action=button.dataset.staffAction;if(!action)return false;
 if(memory.busy)return true;
 memory.busy=true;button.disabled=true;
 try{
  const m=ctx.resolveMatch().operational;
  if(action==='password-resolve'||action==='password-reject'){
   if(roleOf(ctx)!=='admin')throw Error('Operazione riservata agli amministratori');
   const approved=action==='password-resolve';
   if(!window.confirm(approved?'Approvare la richiesta e sostituire la password precedente?':'Rifiutare questa richiesta di recupero?'))return true;
   const result=await reviewPasswordRequest(button.dataset.requestId,approved?'resolve':'reject');
   await ctx.reloadAll();
   if(approved){
    const dialog=document.createElement('div');dialog.className='overlay staff-password-overlay';
    dialog.innerHTML='<section class="overlay-card" role="dialog" aria-modal="true" aria-label="Password provvisoria">'+
      '<span class="eyebrow">RECUPERO ACCOUNT</span><h2>Password temporanea</h2>'+
      '<p>Comunicala direttamente all’utente. Dopo la chiusura non potrà più essere visualizzata.</p>'+
      '<code class="staff-temporary"></code><div class="staff-temporary-actions">'+
      '<button class="staff-soft" data-copy type="button">Copia</button>'+
      '<button class="staff-submit" type="button" data-close>Chiudi</button></div></section>';
    const password=String(result.temporary_password||'');
    dialog.querySelector('code').textContent=password;
    dialog.addEventListener('click',e=>{
     if(e.target.closest('[data-close]'))dialog.remove();
     if(e.target.closest('[data-copy]'))navigator.clipboard?.writeText(password).catch(()=>{});
    });
    document.body.appendChild(dialog);
   }else ctx.toast('Richiesta rifiutata');
   return true;
  }
  if(action==='activate-season'){
   const id=memory.selected.seasons;if(!id)throw Error('Seleziona la stagione');
   if(!window.confirm('Attivare questa stagione? La precedente verrà archiviata.'))return true;
   await rpc('tm_app_activate_season',{p_season_id:id});
   await ctx.reloadAll();ctx.toast('Stagione attiva aggiornata');return true;
  }
  if(action==='ensure'){
   const id=await rpc('tm_app_ensure_match',{p_fixture_id:ctx.state.match});
   const rows=await get('app_matches','select=*&id=eq.'+encodeURIComponent(id));
   if(!rows.length)throw Error('Tabellino creato ma non leggibile');
   const index=ctx.state.data.matches.findIndex(x=>x.id===id);if(index>=0)ctx.state.data.matches[index]=rows[0];else ctx.state.data.matches.push(rows[0]);
   ctx.state.matchData=await ctx.loadMatchInfo(id);memory.matchTab='lineup';ctx.render();ctx.toast('Tabellino operativo collegato');return true;
  }
  if(action==='audit-integrity'){integrityError='';try{integrityData=await rpc('tm_app_integrity_report')}catch(e){integrityError=e.message||String(e)}ctx.render();return true}
  if(action==='refresh-match'){await reloadMatch(ctx);return true}
  if(action==='review-edit'){reviewEditEvent=button.dataset.eventId;reviewHistoryEvent=null;ctx.render();return true;}
  if(action==='review-cancel-edit'){reviewEditEvent=null;ctx.render();return true;}
  if(action==='review-history'){
   if(!m)throw Error('Tabellino non disponibile');
   const eventId=button.dataset.eventId;
   reviewHistoryEntries=await get('tm_app_event_revisions','select=id,reason,previous_record,next_record,created_at&match_id=eq.'+encodeURIComponent(m.id)+'&event_id=eq.'+encodeURIComponent(eventId)+'&order=created_at.desc&limit=100');
   reviewHistoryEvent=eventId;reviewEditEvent=null;ctx.render();return true;
  }
  if(action==='review-result-history'){
   if(!m)throw Error('Tabellino non disponibile');
   scoreAuditRows=await get('tm_app_result_reconciliations','select=id,old_home_score,old_away_score,new_home_score,new_away_score,created_at&match_id=eq.'+encodeURIComponent(m.id)+'&order=created_at.desc&limit=100');
   scoreAuditOpen=true;ctx.render();return true;
  }
  if(['review-result-confirm','review-result-reopen','review-result-align'].includes(action)){
   if(!m)throw Error('Tabellino non disponibile');
   const f=ctx.resolveMatch().fixture;
   const decision=action==='review-result-confirm'?'confirm':action==='review-result-reopen'?'reopen':'align_operational';
   const q=decision==='confirm'?'Confermi definitivamente il risultato della fixture?':decision==='reopen'?'Revocare la conferma e riaprire la verifica?':'Allineare solo il tabellino operativo al risultato ufficiale della fixture? Gli eventi non cambiano.';
   if(!window.confirm(q))return true;
   await rpc('tm_app_review_result',{p_match_id:m.id,p_action:decision,p_expected_home:f.home_score,p_expected_away:f.away_score});
   await reloadMatch(ctx);ctx.toast('Stato risultato aggiornato');return true;
  }
  if(action==='review-approve'||action==='review-reject'){
   if(!m)throw Error('Tabellino non disponibile');
   const eventId=button.dataset.eventId,expected=button.dataset.eventStatus;
   const decision=action==='review-approve'?'approve':'reject';
   const question=decision==='approve'?'Confermare questo evento come ufficiale? Il risultato non verrà modificato.':'Scartare logicamente questo evento? Resterà consultabile nello storico e il risultato non cambierà.';
   if(!window.confirm(question))return true;
   await rpc('tm_app_review_event',{p_match_id:m.id,p_event_id:eventId,p_decision:decision,p_expected_status:expected});
   await reloadMatch(ctx);ctx.toast(decision==='approve'?'Evento ufficializzato':'Evento scartato senza eliminazione');return true;
  }
  if(!m)throw Error('Apri prima la gestione del match');
  if(action==='start'&&!window.confirm('Avviare ora il live? I comandi cronometro, eventi e risultato saranno attivi.'))return true;
  if(action==='finish'&&!window.confirm('Finalizzare la partita? Risultato e cronologia saranno ufficializzati.'))return true;
  if(action==='reopen'&&!window.confirm('Riaprire questa partita per correzioni?'))return true;
  if(action==='void'&&!window.confirm('Annullare questo evento e rettificare l’eventuale gol?'))return true;
  const payload=['void','approve'].includes(action)?{event_id:button.dataset.eventId}:
   action==='start'?
    {force_start:(()=>{const kickoff=Date.parse(ctx.resolveMatch().fixture?.kickoff_at||'');
      const delta=Date.now()-kickoff;
      return (delta< -30*60000||delta>4*3600000)?
        window.confirm('Partita fuori dall’orario previsto. Confermi l’avvio forzato del LIVE?'):false})()}:

   ['halftime','second_half','extra','penalties'].includes(action)?{period:action}:{};
  if(action==='start'){
   const kickoff=Date.parse(ctx.resolveMatch().fixture?.kickoff_at||'');
   if((Date.now()-kickoff< -30*60000||Date.now()-kickoff>4*3600000)&&!payload.force_start)return true;
  }
  const map={halftime:'period',second_half:'period',extra:'period',penalties:'period',void:'void_event',approve:'approve_event'};
  if(action==='sync-blue'){const count=await rpc('tm_app_sync_blue',{p_match_id:m.id});await reloadMatch(ctx);ctx.toast(count>0?count+' rientri blu registrati':'Nessun rientro necessario');return true;}
  await rpc('tm_app_match_action',{p_match_id:m.id,p_action:map[action]||action,p_payload:payload});
  await reloadMatch(ctx);ctx.toast('Operazione registrata');
  return true;
 }catch(err){ctx.toast('Errore: '+(err.message||err));return true}
 finally{memory.busy=false;button.disabled=false}
}
export function staffSelect(element,ctx){
 if(!isStaff(ctx))return false;
 const key=element.dataset.staffSelect;if(!key)return false;
 memory.selected[key]=element.value;ctx.render();return true;
}
export async function staffSubmit(e,ctx){
 const form=e.target,kind=form.dataset.staffForm;if(!kind)return false;
 e.preventDefault();
 if(!isStaff(ctx))return true;
 try{
  if(kind==='amend-event'){
   const m=ctx.resolveMatch().operational;if(!m)throw Error('Partita non collegata');
   const ev=ctx.state.matchData?.events?.find(x=>x.id===form.dataset.eventId);
   if(!ev||ev.validation_status!==form.dataset.eventStatus)throw Error('Evento cambiato: ricarica la partita');
   const d=dataForm(form);
   const changes={event_type:d.event_type,team_side:d.team_side,
    player_id:d.team_side==='team'?d.player_id||null:null,
    secondary_player_id:d.team_side==='team'?d.secondary_player_id||null:null,
    minute:numberOrNull(d.minute),stoppage_minute:numberOrNull(d.stoppage_minute),
    substitution_reason:d.substitution_reason||null,notes:d.notes||''};
   await pendingFn(form,()=>rpc('tm_app_amend_event',{p_match_id:m.id,p_event_id:ev.id,
    p_expected_status:ev.validation_status,p_changes:changes,p_reason:d.reason||''}));
   reviewEditEvent=null;reviewHistoryEvent=null;await reloadMatch(ctx);
   ctx.toast('Rettifica salvata nello storico, da riapprovare');return true;
  }
  if(kind==='tactics'){
   const match=ctx.resolveMatch().operational;
   if(!match||match.status!=='live')throw Error('Variazioni tattiche disponibili solo durante il live');
   const info=tacticalPayload(form);
   await pendingFn(form,()=>rpc('tm_app_record_tactic',{
    p_match_id:match.id,p_minute:info.minute,p_formation:info.formation_to,
    p_positions:info.positions,p_notes:info.notes||null
   }));
   await reloadMatch(ctx);ctx.toast('Variazione tattica registrata');return true;
  }
  if(kind==='lineup'){
   const m=ctx.resolveMatch().operational;if(!m)throw Error('Match da associare');
   const rows=[...form.querySelectorAll('[data-lineup-player]')].map(el=>{
    const query=name=>el.querySelector('[name="'+name+'"]').value;
    const st=query('status');
    return {player_id:el.dataset.lineupPlayer,selection_status:st,
     shirt_number:numberOrNull(query('shirt')),tactical_slot:st==='starter'?numberOrNull(query('slot')):null,
     is_captain:form.querySelector('[name=captain]:checked')?.value===el.dataset.lineupPlayer&&st==='starter',
     unavailability_reason:st==='absent'?query('reason')||null:null,unavailability_note:null};
   });
   const num=rows.filter(x=>x.selection_status==='starter').length;
   if(num>11)throw Error('Massimo undici titolari');
   if(new Set(rows.filter(x=>x.tactical_slot!=null).map(x=>x.tactical_slot)).size!==rows.filter(x=>x.tactical_slot!=null).length)throw Error('Slot tattici ripetuti');
   await pendingFn(form,()=>rpc('tm_app_save_lineup',{p_match_id:m.id,p_rows:rows,p_formation:dataForm(form).formation||null}));
   await reloadMatch(ctx);ctx.toast('Formazione e convocazioni salvate');return true;
  }
  if(kind==='event'){
   const m=ctx.resolveMatch().operational;if(!m)throw Error('Match da associare');
   const d=dataForm(form),c=(ctx.state.data?.competitions||[]).find(c=>c.id===m.competition_id);
   const period=m.live_period;
   const offset=period==='second_half'?(c?.minutes_per_period||45):period==='extra'?2*(c?.minutes_per_period||45):0;
   const minute=numberOrNull(d.minute);
   const payload={event_type:d.event_type,team_side:d.team_side,
    player_id:d.team_side==='team'?d.player_id||null:null,
    secondary_player_id:d.team_side==='team'?d.secondary_player_id||null:null,
    minute:minute===null?null:minute+offset,stoppage_minute:numberOrNull(d.stoppage_minute),
    substitution_reason:d.substitution_reason,notes:d.notes,
    count_score:Boolean(d.count_score),request_key:crypto.randomUUID()};
   if(payload.event_type==='substitution'&&!payload.player_id)throw Error('Indica chi esce');
   await pendingFn(form,()=>rpc('tm_app_match_action',{p_match_id:m.id,p_action:'event',p_payload:payload}));
   await reloadMatch(ctx);ctx.toast('Evento live registrato');return true;
  }
  if(kind==='score'){
   const m=ctx.resolveMatch().operational;if(!m)throw Error('Match da associare');
   const d=dataForm(form);const home=numberOrNull(d.home_score),away=numberOrNull(d.away_score);
   if(!Number.isInteger(home)||!Number.isInteger(away)||home<0||away<0)throw Error('Risultato non valido');
   await pendingFn(form,()=>rpc('tm_app_match_action',{p_match_id:m.id,p_action:'score',p_payload:{home_score:home,away_score:away}}));
   await reloadMatch(ctx);ctx.toast('Risultato aggiornato');return true;
  }
  if(kind==='injuries'||kind==='suspensions'){
   const d=dataForm(form),app=ctx.state.base.seasons.find(x=>x.id===ctx.state.season);
   const general=findGeneralSeason(ctx.state.data?.generalSeasons,app,ctx.state.base.team.id);
   if(!general)throw Error('La stagione gestionale non corrisponde alla stagione selezionata');
   const id=memory.selected[kind]||null;
   const fields=kind==='injuries'?
    ['status','injury_date','expected_return','actual_return','public_summary']:
    ['suspension_type','reason','issued_date','matches_count','matches_served','status','start_date','end_date'];
   const payload=cleaned(d,fields);
   if(kind==='suspensions'){
    payload.matches_count=Number(payload.matches_count);
    payload.matches_served=Number(payload.matches_served);
    if(payload.matches_served>payload.matches_count)throw Error('I turni scontati non possono superare gli assegnati');
   }
   if(!id){
    if(!d.player_id)throw Error('Indica il giocatore');
    Object.assign(payload,{team_id:ctx.state.base.team.id,season_id:general.id,player_id:d.player_id});
   }
   await pendingFn(form,()=>adminWrite(kind,id?'PATCH':'POST',payload,id?{id}:{}));
   await ctx.reloadAll();ctx.toast('Situazione aggiornata');return true;
  }
  if(kind==='participants'){
   const competitionId=memory.selected.competitions;
   if(!competitionId)throw Error('Seleziona una competizione');
   const ids=[...form.querySelectorAll('input[name="opponent_ids"]:checked:not(:disabled)')].map(x=>x.value);
   const output=await pendingFn(form,()=>rpc('tm_app_add_competition_opponents',{p_competition_id:competitionId,p_opponent_ids:ids}));
   await ctx.reloadAll();ctx.toast((output?.added??0)+' partecipanti aggiunti');return true;
  }
  if(kind==='account'){
   if(roleOf(ctx)!=='admin')throw Error('Accesso riservato agli amministratori');
   const userId=form.dataset.userId;
   if(!userId)throw Error('Utente non identificato');
   const d=dataForm(form);
   await pendingFn(form,()=>rpc('tm_app_manage_account',{
    p_user_id:userId,p_role:d.role,
    p_player_id:d.player_id||null,p_set_player:true,p_active:d.active==='true'
   }));
   await ctx.reloadAll();ctx.toast('Permessi e collegamento giocatore aggiornati');return true;
  }
  if(kind==='players'){
   const d=dataForm(form),payload={...d,id:memory.selected.players||null,
    active:d.active==='true',height_cm:d.height_cm===''?null:Number(d.height_cm)};
   await pendingFn(form,()=>rpc('tm_app_save_player',{p_season_id:ctx.state.season,p_data:payload}));
   await ctx.reloadAll();ctx.toast('Giocatore e rosa aggiornati');return true;
  }
  const obj=adminPayload(form);
  if(!obj.table)throw Error('Modulo sconosciuto');
  if(obj.table==='new-fixture'){
   if(!(ctx.state.data?.competitions||[]).some(c=>c.id===obj.payload.competition_id))throw Error('Competizione non appartenente alla stagione');
   if(!window.confirm('Inserire la nuova partita nel calendario?'))return true;
   const {competition_id,...row}=obj.payload;
   const result=await pendingFn(form,()=>rpc('tm_app_import_fixtures',{p_competition_id:competition_id,p_rows:[row],p_dry_run:false}));
   if(result?.new!==1)throw Error('Partita già presente nel calendario');
   await ctx.reloadAll();ctx.toast('Nuova partita inserita');return true;
  }
  if(obj.table==='teams')obj.id=ctx.state.base.team.id;
  if(obj.table==='app_competitions'){
   const previous=ctx.state.data?.competitions?.find(c=>c.id===obj.id);
   if(obj.payload.discipline_rules)obj.payload.discipline_rules={...(previous?.discipline_rules||{}),...obj.payload.discipline_rules};
   if(!obj.id)obj.payload.season_id=ctx.state.season;
  }
  if(obj.table==='app_seasons'&&!obj.id)obj.payload.team_id=ctx.state.base.team.id;
  if(obj.table==='app_seasons'&&obj.id&&obj.payload.status==='future'&&
   ctx.state.base.seasons.find(s=>s.id===obj.id)?.status==='active')
   throw Error('La stagione attiva può essere cambiata solo con «Imposta come attiva»');
  if(obj.table==='app_competition_fixtures'&&
   ['live','finished'].includes(obj.payload.status))
    throw Error('Per avviare/concludere una partita usa la console del Match Center');
  if(obj.table==='app_competition_fixtures'){
   await pendingFn(form,()=>rpc('tm_app_edit_fixture',{p_fixture_id:obj.id,p_changes:obj.payload}));
  }else{
   const written=await pendingFn(form,()=>adminWrite(obj.table,obj.id?'PATCH':'POST',obj.payload,obj.id?{id:obj.id}:{}));
   if(obj.table==='app_competitions'){
    const rowId=obj.id||written?.[0]?.id;
    if(!rowId)throw Error('Competizione salvata, ma identificativo non restituito: riprova a collegarla');
    const linkId=String(dataForm(form).general_competition_id||'');
    await rpc('tm_app_link_competition',{p_app_id:rowId,p_general_id:linkId||null});
   }
  }
  await ctx.reloadAll();ctx.toast('Configurazione salvata');return true;
 }catch(err){ctx.toast('Errore: '+(err.message||err));return true}
}
let clockInterval,clockContext=null,syncBusy=false,lastSyncTime=0;
function tickClock(){
 const el=document.querySelector('[data-staff-clock]');if(!el)return;
 const base=Number(el.dataset.seconds||0),anchor=Date.parse(el.dataset.anchor||'');
 const n=base+(el.dataset.running==='true'&&Number.isFinite(anchor)?Math.max(0,Math.floor((Date.now()-anchor)/1000)):0);
 el.textContent=String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
 if(el.dataset.running==='true' && Number(el.dataset.blueMin)>0 &&
    clockContext && !syncBusy && !document.hidden && Date.now()-lastSyncTime>20000){
   lastSyncTime=Date.now();syncBusy=true;
   rpc('tm_app_sync_blue',{p_match_id:el.dataset.match})
     .then(async count=>{if(count>0)await clockContext.refreshLive()})
     .catch(error=>console.warn('Rientro blu non verificato:',error.message))
     .finally(()=>{syncBusy=false});
 }
}
export function startStaffClock(ctx){clockContext=ctx;if(clockInterval)return;clockInterval=setInterval(tickClock,1000);tickClock()}
