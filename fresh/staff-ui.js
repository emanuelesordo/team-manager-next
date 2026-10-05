import {matchPlayerLabel} from './match-player-label.js';
import {roundRobinDraft} from './phase-scheduler.js';
import {openKitConfigurator,collectionForClub} from './kit-editor.js';
import {get,rpc,adminWrite,reviewPasswordRequest,uploadClubBadge} from './api.js?callups=20261004v2';
import {importPanel} from './calendar-import.js';
import {pitchMarkup,formationModules} from './lineup-pitch.js?callups=20261004moduli';
import {availabilityDefault,normalizedReason,unavailabilityReasons} from './availability.js';
import {staffTacticsPanel,tacticalPayload} from './tactics.js';
import {parseKickoff} from './import-domain.js';
import {reviewPanel} from './postmatch-review.js?live=20261005merge2';
import {storedEventMinute,cumulativeMinuteFromPeriod,periodRelativeMinute} from './match-minutes.js';
import {logoPicker,handleLogoEditorEvent,prepareLogoForUpload} from './logo-editor.js?layout=20261003d';

export const staffLogoEvent=handleLogoEditorEvent;
export function openNewPlayer(){memory.area='players';memory.selected.players='';}
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const attrs=(rows,key,label)=>rows.map(row=>'<option value="'+esc(row[key])+'">'+esc(row[label])+'</option>').join('');
const option=(value,label,selected)=>'<option value="'+esc(value)+'"'+(String(value)===String(selected)?' selected':'')+'>'+esc(label)+'</option>';
const input=(name,label,value='',type='text',extra='')=>'<label class="staff-field"><span>'+esc(label)+'</span><input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>';
const selection=(name,label,choices,current)=>'<label class="staff-field"><span>'+esc(label)+'</span><select name="'+name+'">'+choices.map(x=>option(x[0],x[1],current)).join('')+'</select></label>';
const help=text=>'<p class="staff-help">'+esc(text)+'</p>';
const title=(name,text)=>'<div class="staff-panel-heading"><div><span class="eyebrow">'+esc(name)+'</span><h2>'+esc(text)+'</h2></div></div>';
const btn=(action,label)=>'<button type="button" class="staff-soft" data-staff-action="'+esc(action)+'">'+esc(label)+'</button>';
const submit=label=>'<button type="submit" class="staff-submit">'+esc(label)+'</button>';
const initial={area:'team',selected:{seasons:'',competitions:'',opponents:'',players:'',fixtures:'',injuries:'',suspensions:''},matchTab:'callups',busy:false};
const memory=initial;
let reviewEditEvent=null,reviewHistoryEvent=null,reviewHistoryEntries=[];
let scoreAuditRows=[],scoreAuditOpen=false;
let integrityData=null,integrityError='';
let phaseDraft=null;
function integrityPanel(){
 const count=Number(integrityData?.issue_count||0);
 const entries=(integrityData?.issues||[]).map(x=>'<div class="staff-event-row"><div><strong>'+esc(x.kind)+'</strong><span>'+esc(x.message)+'</span><small>Match: '+esc(x.match_id||'—')+' / Fixture: '+esc(x.fixture_id||'—')+'</small></div></div>').join('');
 return '<section class="glass panel staff-editor">'+title('DIAGNOSTICA','Integrità dei dati')+help('Controlla collegamenti, risultati discordanti, giocatori ed eventi orfani. Non modifica, elimina o approva nulla.')+btn('audit-integrity','Esegui controllo')+(integrityError?'<p class="data-warning">'+esc(integrityError)+'</p>':'')+(integrityData?'<p class="staff-help">Segnalazioni: '+count+' · '+esc(new Date(integrityData.checked_at).toLocaleString('it-IT'))+'</p>'+ (entries||help('Nessuna incongruenza rilevata.')):help('Controllo non ancora eseguito.'))+'<div class="staff-event-list">'+entries+'</div></section>';
}

const areas=[['team','Squadra'],['seasons','Stagioni'],['competitions','Competizioni'],['opponents','Avversarie'],['players','Rosa'],['fixtures','Calendario'],['import','Importa CSV'],['integrity','Integrità'],['availability','Disponibilità'],['users','Utenti']];
const types=[['available','Disponibile'],['starter','Titolare'],['bench','Panchina'],['absent','Indisponibile / non convocato']];
const reasons=[['','—'],...unavailabilityReasons];
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
function wrapForm(id,heading,form,description){return '<section class="glass panel staff-editor'+(['team','opponents'].includes(id)?' staff-editor-club staff-editor-'+id:'')+'">'+(id==='opponents'?'':title('CONFIGURAZIONE',heading)+(description?help(description):''))+'<form data-staff-form="'+id+'" class="staff-form">'+form+submit('Salva')+'</form></section>'}
export function adminPage(ctx){
 if(!isStaff(ctx))return '<div class="empty">Gestione riservata allo staff autorizzato.</div>';
 const data=ctx.state.data||{},base=ctx.state.base||{},t=base.team||{};
 const S=memory.selected,seasons=base.seasons||[],comps=data.competitions||[],opps=base.opponents||[],players=data.players||[],fixtures=data.fixtures||[];
 const unlinked=(data.matches||[]).filter(m=>!m.fixture_id);
 let form='';
 if(memory.area==='team'){
  form=wrapForm('team','Identità squadra',
   '<div class="staff-team-layout">'+
    '<div class="staff-team-details">'+
     input('name','Nome completo',t.name,'text','required maxlength="100"')+
     input('short_name','Sigla',t.short_name,'text','required maxlength="12"')+
     input('home_venue_name','Nome campo',t.home_venue_name||'')+
     input('home_venue_street','Via / viale / strada',t.home_venue_street||'')+
     input('home_venue_city','Comune / località',t.home_venue_city||'')+
     input('home_venue_province','Provincia (sigla)',t.home_venue_province||'','text','maxlength="2" pattern="[a-zA-Z]{2}"')+
     btn('configure-kits','Configura maglie')+
     input('logo_url','URL stemma (alternativa)',t.logo_url||'','url')+
    '</div>'+
    '<div class="staff-team-brand">'+
     logoPicker(t.logo_url||'',[t.primary_color,t.secondary_color,t.accent_color],t.logo_shape||'rounded',true,t.logo_background_color)+
    '</div></div>',
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
  const tieOrder=(Array.isArray(settings.standings_tiebreakers)&&settings.standings_tiebreakers.length===4?settings.standings_tiebreakers:['gd','h2h','gf','gs']);
  const tieLabels={gd:'Differenza reti',h2h:'Scontri diretti · classifica avulsa',gf:'Gol fatti',gs:'Gol subiti'};
  const tieMarkup='<div class="staff-tiebreak"><strong>Parità punti · ordine criteri</strong><small>Trascina per modificare la priorità (oppure usa le frecce).</small><input type="hidden" name="standings_tiebreakers" value="'+esc(tieOrder.join(','))+'"><div data-tiebreak-list>'+tieOrder.map((key,i)=>'<div class="staff-tie-item" draggable="true" data-tie-key="'+esc(key)+'"><span class="staff-tie-grip">⠿</span><span>'+esc(tieLabels[key]||key)+'</span><button type="button" data-staff-tie-move="up" aria-label="Sposta in alto" '+(i===0?'disabled':'')+'>↑</button><button type="button" data-staff-tie-move="down" aria-label="Sposta in basso" '+(i===3?'disabled':'')+'>↓</button></div>').join('')+'</div></div>';
  form=wrapForm('competitions','Regolamenti delle competizioni',selectExisting('competitions',comps,'name')+
   '<div class="staff-form-grid">'+input('name','Denominazione',c?.name||'','text','required')+
   selection('kind','Categoria',[['league','Campionato'],['cup','Coppa'],['friendly','Amichevole'],['tournament','Torneo'],['other','Altro']],c?.kind||'league')+
   input('format','Formato',c?.format||'round_robin','text','required maxlength="80"')+
   input('tier_level','Livello (A1=1, A2=2, B=3; avanzamenti 3.1, 3.2)',c?.tier_level??'','number','step="0.001" min="0.001" max="999"')+
   input('group_code','Girone della prima fase (es. D / E)',c?.group_code||'','text','maxlength="12"')+
   selection('postseason_mode','Formula della fase successiva',[
    ['none','Nessuna prosecuzione'],['knockout','Eliminazione diretta'],
    ['league_then_final','Nuovo girone a 0 punti, poi eventuale finale']
   ],c?.postseason_mode||'none')+
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
    chosenBridge?.general_competition_id||'')+'</div>'+( ['league','tournament','cup'].includes(c?.kind||'league')?tieMarkup:'' ),
   'Le competizioni conservano la propria durata e regole. Non vengono cancellati calendario o partite.');
  if(c){
   const linked=new Set((data.competitionOpponents||[]).filter(x=>x.competition_id===c.id).map(x=>x.opponent_id));
   const choices=opps.map(o=>'<label class="staff-check staff-participant">'+
    '<input type="checkbox" name="opponent_ids" value="'+esc(o.id)+'" '+(linked.has(o.id)?'checked disabled':'')+'>'+
    '<span>'+esc(o.name)+(linked.has(o.id)?' · già associata':'')+'</span></label>').join('');

   const parent=c;
   const children=comps.filter(x=>x.parent_competition_id===parent.id);
   const chosenPhase=idOf(children,S.phases);
   const configured=(data.phaseSources||[]).filter(x=>x.phase_competition_id===chosenPhase?.id);
   const sourceChoices=comps.filter(x=>x.season_id===ctx.state.season&&(!x.parent_competition_id||x.id===parent.id))
    .map(x=>[x.id,(x.tier_level!=null?x.tier_level+' · ':'')+x.name+(x.group_code?' · Girone '+x.group_code:'')]);
   const suggestedRole=chosenPhase?.phase_role||(parent.phase_format==='league_then_final'?'final':'playoff');
   const targetRank=suggestedRole==='consolation'||suggestedRole==='playout'?6:1;
   const sourceA=configured[0]?.source_competition_id||parent.id;
   const sourceB=configured[1]?.source_competition_id||'';
   const usedLevels=new Set(children.map(x=>Number(x.tier_level)));
   const levelStep=parent.parent_competition_id?0.01:0.1;
   let suggestedLevel=Number(parent.tier_level??3)+levelStep;
   while(usedLevels.has(Number(suggestedLevel.toFixed(3))))suggestedLevel+=levelStep;
   const phaseEditor=selectExisting('phases',children,'name')+
    '<div class="staff-form-grid">'+
    input('phase_name','Nome sottocompetizione',chosenPhase?.name||'', 'text','required maxlength="100"')+
    selection('phase_role','Tipo',[['playoff','Play Off'],['consolation','Torneo Primavera / consolazione'],
     ['playout','Play Out'],['final','Finale']],suggestedRole)+
    selection('phase_format','Formula',[['league','Girone nuovo: tutti da 0'],
     ['knockout','Eliminazione diretta'],['league_then_final','Girone nuovo + finale']],chosenPhase?.phase_format||(suggestedRole==='final'?'knockout':'league_then_final'))+
    input('phase_tier','Livello modificabile (es. 3.1, 3.2)',chosenPhase?.tier_level??suggestedLevel.toFixed(1),'number','step="0.001" min="0.001" max="999" required')+
    selection('phase_source_a','Girone di origine 1',sourceChoices,sourceA)+
    selection('phase_source_b','Girone di origine 2',[['','Da indicare quando censito'],...sourceChoices],sourceB)+
    input('phase_min_rank','Dalla posizione',configured[0]?.min_rank??targetRank,'number','min="1" max="100" required')+
    input('phase_max_rank','Alla posizione (vuoto = tutte le restanti)',configured[0]?.max_rank??(suggestedRole==='final'?2:targetRank===1?5:''),'number','min="1" max="100"')+
    '</div>'+
    '<p class="staff-help">Ogni sottocompetizione ha ID, calendario e classifica propri. Si riparte da zero: nessun punto o risultato della stagione regolare viene trasferito. Imposta entrambi i gironi sorgente prima di qualificare le squadre.</p>';
   form+=wrapForm('phase','Fasi collegate · Play Off / Primavera',phaseEditor,
    'Una fase può iniziare con un girone oppure direttamente a eliminazione; le fasi sono sempre collegate alla competizione madre.');
   if(chosenPhase){
    const entries=(data.phaseEntries||[]).filter(x=>x.phase_competition_id===chosenPhase.id);
    const sourceStatus=configured.map(source=>{
     const comp=comps.find(c=>c.id===source.source_competition_id);
     const matches=(data.fixtures||[]).filter(f=>f.competition_id===source.source_competition_id);
     const finished=matches.filter(f=>f.status==='finished'&&f.home_score!=null&&f.away_score!=null).length;
     return '<span>'+esc(comp?.name||'Girone sconosciuto')+': '+finished+'/'+matches.length+' partite concluse</span>';
    }).join('');
    const clubName=x=>x.team_id===t.id?t.name:(opps.find(o=>o.id===x.opponent_id)?.name||'Squadra non censita');
    const nameFromId=(tid,oid)=>clubName({team_id:tid,opponent_id:oid});
    const draft=phaseDraft?.phaseId===chosenPhase.id?phaseDraft.rows:null;
    const preview=draft?'<details class="phase-preview" open><summary>Bozza: '+draft.length+
     ' partite, '+new Set(draft.map(x=>x.round_no)).size+' giornate. Date non assegnate.</summary>'+
     '<div class="phase-draft-scroll">'+draft.map(x=>'<div class="staff-event-row">'+
      '<small>G'+x.round_no+'</small><span>'+esc(nameFromId(x.home_team_id,x.home_opponent_id))+
      ' — '+esc(nameFromId(x.away_team_id,x.away_opponent_id))+
      (x.previous_fixture_id?' · campo invertito':'')+'</span></div>').join('')+'</div></details>':'';
    form+='<section class="glass panel staff-phase-summary"><h3>Qualificazioni e calendario 2.0</h3>'+
     '<p class="staff-help">Qualificati confermati: <strong>'+entries.length+'</strong>. '+
     (configured.length<2&&chosenPhase.phase_role!=='final'?'Manca ancora il secondo girone sorgente. ':'')+
     'La classifica riparte da 0; nessuna gara viene ripresa dalla fase precedente.</p>'+
     '<div class="phase-sources-status">'+sourceStatus+'</div>'+
     '<div class="staff-after">'+btn('qualify-phase','Conferma qualificati dopo la Regular Season')+
     (chosenPhase.phase_format!=='knockout'?btn('draft-phase','Anteprima girone 2.0'):'')+'</div>'+
     (entries.length?'<p class="staff-help">Squadre: '+entries.map(clubName).map(esc).join(', ')+'</p>':'')+
     preview+'</section>';
   }
   form+=wrapForm('participants','Squadre partecipanti', 
    '<p class="staff-help">Le associazioni esistenti restano nello storico. Seleziona nuove avversarie da aggiungere senza rimuovere quelle già collegate.</p>'+
    '<div class="participant-grid">'+choices+'</div>',
    'L’aggiunta è transazionale. I risultati e le giornate esistenti non vengono alterati.');
  }
 }
 if(memory.area==='opponents'){
  const o=idOf(opps,S.opponents);
  form=wrapForm('opponents','Anagrafiche avversarie',
   '<div class="staff-club-selector">'+selectExisting('opponents',opps,'name')+'</div>'+
   '<div class="staff-team-layout">'+
    '<div class="staff-team-details">'+
     input('name','Nome',o?.name||'','text','required')+
     input('short_name','Sigla',o?.short_name||'','text','maxlength="15"')+
     input('home_venue_name','Nome campo',o?.home_venue_name||'')+
     input('home_venue_street','Via / viale / strada',o?.home_venue_street||'')+
     input('home_venue_city','Comune / località',o?.home_venue_city||'')+
     input('home_venue_province','Provincia (sigla)',o?.home_venue_province||'','text','maxlength="2" pattern="[a-zA-Z]{2}"')+
     btn('configure-kits','Configura maglie')+
     input('logo_url','Stemma (URL alternativo)',o?.logo_url||'','url')+
    '</div>'+
    '<div class="staff-team-brand">'+
     logoPicker(o?.logo_url||'',[o?.primary_color,o?.secondary_color,o?.accent_color],t.logo_shape||'rounded',false,o?.logo_background_color)+
    '</div></div>',
   'Ogni avversaria mantiene la sua identità tra stagioni e competizioni.');
 }
 if(memory.area==='players'){
  const list=[...players].sort((a,b)=>String(a.last_name).localeCompare(String(b.last_name),'it'));
  const p=idOf(players,S.players);const r=data.roster?.find(x=>x.player_id===p?.id);
  const season=seasons.find(x=>x.id===ctx.state.season);
  const contract=(data.contracts||[]).filter(x=>x.player_id===p?.id&&x.season_id===ctx.state.season).sort((a,b)=>String(b.start_date).localeCompare(String(a.start_date)))[0];
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const firstDay=p?(p.created_at?.slice(0,10)>season?.start_date?p.created_at.slice(0,10):season?.start_date):today;
  const starting=contract?.start_date||firstDay||today;
  const ending=contract?.end_date||season?.end_date||'';
  const previousPeriods=(data.contracts||[]).filter(x=>x.player_id===p?.id&&x.season_id===ctx.state.season).sort((a,b)=>String(a.start_date).localeCompare(String(b.start_date)));
  const periodHistory=previousPeriods.length?'<div class="staff-help"><strong>Periodi registrati:</strong> '+previousPeriods.map(x=>esc(x.start_date)+' → '+esc(x.end_date)).join(' · ')+'</div>':'';
  form=wrapForm('players','Gestione anagrafica e rosa',
   selectExisting('players',list,'last_name')+
   '<div class="staff-form-grid">'+input('first_name','Nome',p?.first_name||'','text','required')+
   input('last_name','Cognome',p?.last_name||'','text','required')+
   selection('generic_role_manual','Ruolo',[['','Non specificato'],['P','Portiere'],['D','Difensore'],['C','Centrocampista'],['A','Attaccante']],p?.generic_role_manual||'')+
   selection('preferred_foot','Piede',[['','Non indicato'],['right','Destro'],['left','Sinistro'],['both','Ambidestro']],p?.preferred_foot||'')+
   input('height_cm','Altezza (cm)',p?.height_cm??'','number','min="100" max="245"')+
   selection('active','Nella rosa della stagione',[['true','Sì'],['false','No']],r?.active===false?'false':'true')+
   input('contract_start','In rosa dal',starting,'date','required')+
   input('contract_end','In rosa fino al',ending,'date','required')+
   selection('contract_mode','Periodo',[['edit','Modifica ultimo periodo'],['new','Aggiungi nuovo periodo']],p?'edit':'new')+'</div>'+periodHistory,
   'Le date delimitano le gare in cui il giocatore è convocabile. Fuori da questo periodo non compare fra disponibili o indisponibili. La modifica non cancella lo storico.');
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
   selectExisting('fixtures',own.map(f=>({...f,name:(f.is_test?'[TEST] ':'')+f.home_team+' – '+f.away_team+' · '+(f.round_no??'')})),'name')+
   (!f?'<p class="staff-help">Nuova partita: scegli giornata, competizione, squadre, data e campo. Per molti incontri usa Importa CSV.</p>'+
   '<div class="staff-form-grid">'+
    selection('competition_id','Competizione',comps.map(c=>[c.id,c.name]),comps[0]?.id)+
    input('round_no','Giornata',1,'number','min="1" max="250" required')+
    selection('home_club_id','Squadra di casa',[[t.id,t.name],...opps.map(o=>[o.id,o.name])],t.id)+
    selection('away_club_id','Ospite',[[t.id,t.name],...opps.map(o=>[o.id,o.name])],opps[0]?.id)+
    input('kickoff_at','Data e ora (Italia)','', 'datetime-local','required')+
    input('venue_name','Campo','')+input('venue_address','Indirizzo','')+
    selection('is_test','Tipo partita',[['false','Normale / ufficiale'],['true','TEST privato · visibile solo a me']],'false')+'</div>':
   '<div class="staff-form-grid">'+input('kickoff_at','Data e ora',local,'datetime-local','required')+
   (f.is_test?'<div class="staff-field"><span>Tipo partita</span><strong>TEST privato · solo tu</strong></div>':'')+
   input('venue_name','Campo',f.venue_name||'')+
   input('venue_address','Indirizzo',f.venue_address||'')+
   input('home_score','Gol casa',f.home_score??'','number','min="0" max="99"')+
   input('away_score','Gol ospite',f.away_score??'','number','min="0" max="99"')+
   selection('status','Stato',statuses,f.status)+'</div>'),
   'La fixture è la fonte ufficiale di calendario e risultati. Per modifiche durante il live usa il Match Center.');
 }
 const tabs='<div class="staff-switch" role="tablist">'+areas.filter(x=>x[0]!=='users'||roleOf(ctx)==='admin').map(([key,label])=>
 '<button type="button" role="tab" aria-selected="'+(key===memory.area)+'" data-staff-area="'+key+'" class="'+(key===memory.area?'selected':'')+'">'+label+'</button>').join('')+'</div>';
 return  tabs+(unlinked.length?'<div class="staff-link-warning" role="status"><strong>'+unlinked.length+' tabellino/i senza fixture collegata</strong><p>Le partite programmate vengono associate solo se dati e avversaria sono univoci. Quelle concluse con risultati discordanti richiedono revisione prima del collegamento.</p>'+unlinked.map(m=>'<div>'+esc(m.round_label||'Giornata non indicata')+' · '+esc(m.status)+' · '+esc(m.kickoff_at?.slice(0,10)||'Data assente')+'</div>').join('')+'</div>':'')+form+'<p class="staff-footnote">Moduli operativi di partita e convocazioni: apri un incontro dal calendario e scegli «Gestione».</p>';
}
const playerText=p=>matchPlayerLabel(p);
function picker(name,label,choices,value){return selection(name,label,choices,value)}
const statusOf=m=>String(m?.status||'scheduled');
function displayClock(m,competition){
 if(!m)return '';
 return '<div class="clockline"><span class="status '+(m.status==='live'?'live':'end')+'">'+esc(m.status==='live'?'LIVE':m.status==='finished'?'FINALE':'PREPARTITA')+'</span><strong data-staff-clock data-seconds="'+Number(m.live_clock_seconds||0)+'" data-anchor="'+esc(m.live_clock_anchor||'')+'" data-running="'+Boolean(m.live_clock_running)+'" data-match="'+esc(m.id)+'" data-blue-min="'+Number(competition?.discipline_rules?.blue_duration_minutes||0)+'">00:00</strong><span>'+esc(m.live_period||'pre')+'</span></div>';
}
const callupReasons=[
 ['illness','Malattia','thermometer'],
 ['injury','Infortunio','cross'],
 ['suspension','Squalifica','red'],
 ['personal','Assente','person'],
 ['technical_choice','Escluso','minus']
];
function playerEligibleAt(data,row,kickoff){
 if(!kickoff||!Number.isFinite(Date.parse(kickoff)))return true;
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(kickoff));
 const periods=(data.contracts||[]).filter(p=>p.player_id===row.player_id&&p.season_id===row.season_id);
 if(periods.length)return periods.some(p=>p.start_date<=day&&day<=p.end_date);
 return false;
}
function matchCallups(ctx,m){
 const data=ctx.state.data||{},current=ctx.state.matchData?.players||[];
 const roster=(data.roster||[]).map(r=>({...r,person:(data.players||[]).find(p=>p.id===r.player_id)}))
  .filter(r=>r.person&&playerEligibleAt({...data,seasonStart:ctx.state.base?.seasons?.find(s=>s.id===ctx.state.season)?.start_date},r,m.kickoff_at)).sort((a,b)=>String(a.person.last_name||'').localeCompare(String(b.person.last_name||''),'it'));
 const rows=roster.map(row=>{
  const saved=current.find(p=>p.player_id===row.player_id);
  const proposal=availabilityDefault({saved,injuries:data.injuries||[],suspensions:data.suspensions||[],
   playerId:row.player_id,fixtureDate:m.kickoff_at,priorSelections:data.priorSelections||[],
   matches:data.matches||[],matchId:m.id,disciplinaryEvents:data.disciplinaryEvents||[],
   competitionId:m.competition_id,competitionRules:(data.competitions||[]).find(c=>c.id===m.competition_id)?.discipline_rules||{},
   competitionLinks:data.competitionLinks||[]});
  const out=proposal.status==='absent',reason=out?proposal.reason||'technical_choice':'';
  const locked=m.status!=='scheduled'&&Boolean(saved?.started||Number(saved?.minutes_played)>0);
  const buttons=callupReasons.map(([key,label,icon])=>
   '<button type="button" class="callup-reason '+(reason===key?'selected':'')+'" data-callup-reason="'+key+'" title="'+label+'" aria-label="'+label+'" aria-pressed="'+(reason===key)+'" '+(locked?'disabled':'')+'>'+
    '<span class="callup-symbol callup-'+icon+'" aria-hidden="true">'+({thermometer:'🤒',cross:'✚',red:'🟥',person:'👤',minus:'🚫'}[icon])+'</span></button>').join('');
  return '<div class="callup-person" data-callup-player="'+esc(row.player_id)+'" data-out="'+out+'" data-locked="'+locked+'" data-persisted-status="'+(out?'absent':'available')+'" data-persisted-reason="'+esc(reason)+'">'+
   '<span class="callup-player-name">'+esc(playerText(row.person))+'</span>'+
   '<input type="hidden" name="selection" value="'+(out?'absent':'available')+'">'+
   '<input type="hidden" name="reason" value="'+esc(reason)+'">'+
   '<span class="callup-reasons">'+buttons+'</span>'+
   '</div>';
 }).join('');
 return '<section class="staff-subpanel">'+title('PREPARTITA','Convocazioni')+
 help('Ogni scelta viene salvata automaticamente. Tocca un’icona per assegnare o modificare la motivazione; tocca quella selezionata per reintegrare il giocatore.')+
 '<form data-staff-form="callups" data-callup-match="'+esc(m.id)+'"><div class="callup-columns">'+
 '<section class="callup-list"><h3>Disponibili <span data-callup-count="available"></span></h3><div data-callup-list="available"></div></section>'+
 '<section class="callup-list"><h3>Indisponibili <span data-callup-count="absent"></span></h3><div data-callup-list="absent"></div></section>'+
 '</div><div class="callup-store" data-callup-store>'+rows+'</div><p class="staff-help" role="status">Salvataggio automatico a ogni modifica.</p></form></section>';
}
export function matchLineup(ctx,m){
 const data=ctx.state.data||{},players=data.players||[],current=ctx.state.matchData?.players||[];
 const roster=(data.roster||[]).map(x=>({...x,person:players.find(p=>p.id===x.player_id)}))
  .filter(x=>x.person&&playerEligibleAt({...data,seasonStart:ctx.state.base?.seasons?.find(s=>s.id===ctx.state.season)?.start_date},x,m.kickoff_at))
  .sort((a,b)=>String(a.person.last_name||'').localeCompare(String(b.person.last_name||''),'it')||String(a.person.first_name||'').localeCompare(String(b.person.first_name||''),'it'));
 const savedKits=collectionForClub(ctx.state.base?.team||{});
 const activeJersey=savedKits[m.match_kit_key]||savedKits.home||Object.values(savedKits)[0];
 const confirmed=current.some(p=>['available','absent','starter','bench'].includes(p.selection_status));
 const allowed=confirmed;
 const fields=roster.filter(x=>!['absent'].includes(current.find(p=>p.player_id===x.player_id)?.selection_status)).map(x=>{
  const old=current.find(p=>p.player_id===x.player_id);
  const status=['starter','bench'].includes(old?.selection_status)?old.selection_status:'available';
  const shirt=old?.shirt_number??(data.habitual||[]).find(h=>h.player_id===x.player_id)?.shirt_number??x.shirt_number??x.person?.shirt_number??'';
  const stat=(data.playerStats||[]).find(p=>p.player_id===x.player_id||p.id===x.player_id);
  const avg=stat?.avg_rating??stat?.rating_average??null;
  const rating=avg!==null&&Number.isFinite(Number(avg))?Number(avg).toFixed(1).replace('.',','):'—';
  const role=x.person.generic_role_manual||x.person.role||'—';
  const surname=String(x.person.last_name||'').trim();
  const initial=String(x.person.first_name||'').trim().slice(0,1);
  const compactName=(initial?initial+'. ':'')+surname;
  return '<div class="lineup-row" data-lineup-player="'+esc(x.player_id)+'" data-sort-role="'+esc(role)+'" data-sort-number="'+esc(shirt===''?'':shirt)+'" data-sort-name="'+esc(surname)+'" data-sort-rating="'+esc(avg??'')+'">'+
   '<span class="lineup-bench-col"><span class="lineup-bench" data-lineup-bench title="Panchina" aria-label="Panchina" '+(status==='starter'?'hidden':'')+'><svg class="lineup-bench-svg" viewBox="0 0 64 64" aria-hidden="true"><path fill="currentColor" d="M9 11a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v2h30v-2a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v27l3.5 5a2 2 0 0 1-1.7 3H7.2a2 2 0 0 1-1.7-3L9 38V11Zm8 8v19h6V19h-6Zm12 0v19h6V19h-6Zm12 0v19h6V19h-6ZM5 48h54a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-5l-1 7h-5l-1-7H17l-1 7h-5l-1-7H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2Z"/></svg></span></span>'+'<span class="lineup-role">'+esc(role)+'</span>'+
   '<button type="button" class="lineup-list-number" data-lineup-number aria-label="Modifica numero '+esc(compactName)+'">'+esc(shirt||'—')+'</button>'+
   '<button type="button" class="lineup-name" draggable="'+allowed+'" aria-label="Posiziona '+esc(playerText(x.person))+'" '+(allowed?'':'disabled')+'><strong>'+esc(compactName)+'</strong></button>'+
   '<span class="lineup-rating" title="Rating medio">'+esc(rating)+'</span>'+
   '<input type="hidden" name="status" value="'+esc(status)+'">'+
   '<input type="hidden" name="shirt" value="'+esc(shirt)+'">'+
   '<input type="hidden" name="slot" value="'+esc(old?.tactical_slot??'')+'">'+
   '<input type="hidden" name="reason" value="">'+
   '<input type="radio" name="captain" value="'+esc(x.player_id)+'" aria-label="Capitano '+esc(playerText(x.person))+'" '+(old?.is_captain?'checked':'')+' '+(allowed?'':'disabled')+'>'+
   '</div>';
 }).join('');
 return '<section class="staff-subpanel lineup-minimal">'+
 (allowed?'':'<p class="staff-help">Conferma prima le convocazioni nella relativa sezione per abilitare la formazione.</p>')+
 '<form data-staff-form="lineup" data-lineup-match="'+esc(m.id)+'" data-lineup-enabled="'+allowed+'" data-lineup-kit="'+esc(JSON.stringify(activeJersey))+'">'+
 '<div class="lineup-split"><div class="lineup-pitch-column">'+
 '<label class="lineup-formation-select"><select name="formation" aria-label="Modulo" '+(allowed?'':'disabled')+'>'+
 [...new Set([...formationModules,...(m.formation&&!formationModules.includes(m.formation)?[m.formation]:[])])].map(f=>option(f,f,m.formation||'4-4-2')).join('')+
 '</select></label>'+pitchMarkup()+'</div>'+
 '<div class="lineup-player-column"><div class="lineup-sort-head"><span class="lineup-sort-spacer" aria-hidden="true"></span>'+[['role','Ruolo'],['number','N°'],['name','Cognome'],['rating','Rating']].map(([key,label])=>'<button type="button" data-lineup-sort="'+key+'" aria-label="Ordina per '+label+'">'+label+'</button>').join('')+'</div><div class="lineup-rows">'+fields+'</div></div></div>'+
 (m.status==='finished'?'<div class="lineup-bench-reasons"><span class="lineup-reason-title">Panchinari non entrati</span>'+roster.filter(x=>{const r=current.find(p=>p.player_id===x.player_id);return r?.selection_status==='bench'&&!Number(r.minutes_played)&&!(ctx.state.matchData?.events||[]).some(e=>e.validation_status!=='rejected'&&e.event_type==='substitution'&&e.secondary_player_id===x.player_id)}).map(x=>{const r=current.find(p=>p.player_id===x.player_id);return '<div class="lineup-unused-row"><span>'+esc(playerText(x.person))+'</span><select data-unused-player="'+esc(x.player_id)+'" aria-label="Motivo mancato ingresso '+esc(playerText(x.person))+'">'+[['','—'],['illness','🤒 Malattia'],['injury','🩹 Infortunio'],['technical_choice','⚙ Scelta tecnica']].map(([v,l])=>option(v,l,r?.unused_sub_reason||'')).join('')+'</select></div>'}).join('')+'</div>':'')+
 '<div class="lineup-confirm"><button type="button" class="staff-submit" data-lineup-confirm '+(allowed?'':'disabled')+'>'+(m.lineup_confirmed_at?'Riconferma formazione ufficiale':'Salva · Conferma titolari')+'</button><span>'+(m.lineup_confirmed_at?'Ufficializzata':'Bozza autosalvata')+'</span></div>'+
 '<span class="lineup-save-status" data-lineup-save-status role="status" aria-live="polite"></span>'+
 '</form></section>';
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
function liveClockMinute(m,competition){
 if(!m?.live_clock_running)return null;
 const base=Number(m.live_clock_seconds||0),anchor=Date.parse(m.live_clock_anchor||'');
 const seconds=base+(Number.isFinite(anchor)?Math.max(0,Math.floor((Date.now()-anchor)/1000)):0);
 return periodRelativeMinute(Math.floor(seconds/60),m.live_period,competition);
}
function matchLive(ctx,m,competition){
 const people=ctx.state.data?.players||[],rows=ctx.state.matchData?.players||[],present=rows.filter(r=>['starter','bench'].includes(r.selection_status)||r.started);
 const playerOpts=[['','Non indicato']].concat(present.map(x=>[x.player_id,playerText(people.find(p=>p.id===x.player_id))]));
 const fixture=ctx.resolveMatch().fixture;
 const kickoff=Date.parse(fixture?.kickoff_at||'');
 const active=m.status==='live'||(m.status==='scheduled'&&Number.isFinite(kickoff)&&Date.now()>=kickoff);
 const mins=Number(competition?.minutes_per_period)>0?Number(competition.minutes_per_period):null;
 const suggested=active&&mins?liveClockMinute(m,competition):null;
 const minuteValue=suggested==null?'':String(Math.max(0,suggested));
 const eventForm=active?'<form data-staff-form="event" class="staff-form live-event-form"><input type="hidden" name="captured_at" value="">'+
 '<div class="staff-form-grid">'+
 picker('event_type','Evento',events,'goal')+picker('team_side','Squadra',[['team','Nostra squadra'],['opponent','Avversaria']],'team')+
 picker('player_id','Giocatore principale / uscente',playerOpts,'')+
 picker('secondary_player_id','Assist / subentrante',playerOpts,'')+
 input('minute','Minuto del periodo (facoltativo)',minuteValue,'number','min="0" max="300" placeholder="'+(m.live_period==='second_half'?'Es. 16':'Es. 28')+'"')+
 picker('minute_mode','Se il minuto resta vuoto',[['now_estimated','È avvenuto ora · stima da orario inizio'],['past_unknown','Evento passato · minuto sconosciuto']],'now_estimated')+
 input('stoppage_minute','Recupero', '','number','min="0" max="30" placeholder="—"')+
 picker('substitution_reason','Motivo del cambio',[['tactical','Tattico'],['injury','Infortunio'],['technical','Tecnico'],['other','Altro']],'tactical')+
 input('notes','Note (facoltative)','','text','maxlength="400"')+'</div>'+
 '<label class="staff-check"><input type="checkbox" name="count_score" checked> Aggiorna il tabellone quando l’evento diventa ufficiale</label>'+
 help(mins?(m.live_clock_running?
  'Il minuto è relativo al periodo ed è precompilato dal timer. Puoi correggerlo per eventi avvenuti prima; oltre ±5 minuti dal timestamp l’evento richiede conferma in gestione.':
  'Timer fermo o non avviato: se il fatto è appena avvenuto lascia il minuto vuoto e scegli la stima dall’orario di inizio; verrà salvato un minuto provvisorio. Se invece stai recuperando un evento passato di cui non sai il minuto, scegli «Evento passato»: resterà senza minuto e andrà completato in gestione.'):'Durata non disponibile: verifica Setup → Competizioni prima di registrare eventi.')+
 submit('Registra evento')+'</form>':help('L’inserimento live è disponibile dall’orario di inizio della partita.');
 const staff=isStaff(ctx);
 const staffTools=staff?displayClock(m,competition)+liveControls(m)+(Number(competition?.discipline_rules?.blue_duration_minutes)>0?'<div class="staff-blue-action">'+btn('sync-blue','Verifica rientri blu')+'</div>':''):'';
 const score=staff?'<div class="staff-live-panel"><h3>Risultato della partita</h3>'+ (m.status==='finished'?help('Partita finalizzata. Riapri per rettificare.'):scoreForm(fixture||m))+'</div>':'';
 return '<section class="staff-subpanel">'+title('DIRETTA','Console di gara')+staffTools+
 '<div class="staff-live-grid">'+score+'<div class="staff-live-panel"><h3>Nuovo evento</h3>'+eventForm+'</div></div></section>';
}
function matchEvents(ctx,m){const fixture=ctx.resolveMatch().fixture,competition=(ctx.state.data?.competitions||[]).find(c=>c.id===fixture?.competition_id);return reviewPanel({match:m,fixture,competition,events:ctx.state.matchData?.events||[],players:ctx.state.data?.players||[],editingEventId:reviewEditEvent,historyEventId:reviewHistoryEvent,historyEntries:reviewHistoryEntries,resultHistoryEntries:scoreAuditOpen?scoreAuditRows:null});}

export function staffMatchSection(ctx,f,m,section){
 const staff=isStaff(ctx),liveContributor=section==='live'&&Boolean(ctx.state.identity?.user);
 if(!staff&&!liveContributor)return '';
 if(!['callups','lineup','live','events','tactics'].includes(section))return '';
 if((!m||!m.fixture_id)&&['finished','live'].includes(f?.status))
  return '<section class="glass panel staff-root"><p class="data-warning">Tabellino operativo non collegato: verifica il collegamento prima di modificare la partita.</p></section>';
 if(!m||!m.fixture_id)return '<section class="glass panel staff-root">'+
  help('Per iniziare collega un unico tabellino operativo alla partita.')+btn('ensure','Prepara tabellino')+'</section>';
 const competition=(ctx.state.data?.competitions||[]).find(c=>c.id===f.competition_id);
 const content=section==='callups'?matchCallups(ctx,m):section==='lineup'?matchLineup(ctx,m):
  section==='live'?matchLive(ctx,m,competition):section==='tactics'?staffTacticsPanel(ctx,m):matchEvents(ctx,m);
 return '<section class="staff-root staff-direct-section">'+content+'</section>';
}
export function staffMatchPanel(ctx,f,m){
 if(!isStaff(ctx))return '';
 if((!m||!m.fixture_id)&&['finished','live'].includes(f?.status))return '<section class="glass panel staff-root"><h2>Verifica collegamento partita</h2><p class="data-warning">Questa gara è già in corso o conclusa ma non ha un tabellino operativo collegato con certezza. Per evitare duplicazioni è necessario riconciliare manualmente risultati e provenienza dei dati.</p></section>';
 if(!m||!m.fixture_id)return '<section class="glass panel staff-root"><div class="staff-panel-heading"><div><span class="eyebrow">OPERAZIONI</span><h2>Prepara il Match Center</h2></div></div>'+
 help('Associa la partita ufficiale a un unico tabellino operativo, riutilizzando le registrazioni già esistenti quando la corrispondenza è univoca. Nessun dato storico viene duplicato.')+
 btn('ensure','Apri gestione di questa partita')+'</section>';
 const competition=(ctx.state.data?.competitions||[]).find(c=>c.id===f.competition_id);
 const tabs=[['callups','Convocazioni'],['lineup','Formazione'],['live','Live'],['events','Eventi'],['tactics','Tattica']];
 const tabNav='<div class="staff-switch small-tabs" role="tablist">'+tabs.map(([k,v])=>
  '<button type="button" role="tab" aria-selected="'+(k===memory.matchTab)+'" class="'+(k===memory.matchTab?'selected':'')+'" data-staff-match-tab="'+k+'">'+v+'</button>').join('')+'</div>';
 const page=memory.matchTab==='callups'?matchCallups(ctx,m):memory.matchTab==='lineup'?matchLineup(ctx,m):memory.matchTab==='live'?matchLive(ctx,m,competition):memory.matchTab==='tactics'?staffTacticsPanel(ctx,m):matchEvents(ctx,m);
 return '<section class="glass panel staff-root">'+tabNav+page+'<div class="staff-bottom-actions">'+btn('refresh-match','Aggiorna tabellino')+'</div></section>';
}
function dataForm(form){return Object.fromEntries(new FormData(form))}
function cleaned(o,fields){return Object.fromEntries(fields.map(k=>[k,o[k]===''?null:o[k]]))}
function numberOrNull(n){return n===''||n==null?null:Number(n)}
function clubVenuePayload(data){
 const province=String(data.home_venue_province||'').trim().toUpperCase();
 if(province&&!/^[A-Z]{2}$/.test(province))throw Error('Inserisci la sigla della provincia (due lettere)');
 const street=String(data.home_venue_street||'').trim();
 const city=String(data.home_venue_city||'').trim();
 return {home_venue_street:street||null,home_venue_city:city||null,
  home_venue_province:province||null,home_venue_address:[street,city+(province?' ('+province+')':'')].filter(Boolean).join(', ')||null};
}
function adminPayload(form,ctx){
 const data=dataForm(form),kind=form.dataset.staffForm,blank=memory.selected;
 if(kind==='team')return {table:'teams',id:null,payload:{...cleaned(data,['name','short_name','logo_url','primary_color','secondary_color','accent_color','logo_shape','logo_background_color','home_venue_name']),...clubVenuePayload(data)}};
 if(kind==='seasons')return {table:'app_seasons',id:blank.seasons||null,payload:cleaned(data,['name','start_date','end_date','status'])};
 if(kind==='competitions'){
  const rules={};
  const order=String(data.standings_tiebreakers||'').split(',').filter(Boolean);
  if(order.length===4&&new Set(order).size===4&&['gd','h2h','gf','gs'].every(x=>order.includes(x)))rules.standings_tiebreakers=order;
  if(data.blue_duration)rules.blue_duration_minutes=Number(data.blue_duration);
  if(String(data.yellow_thresholds||'').trim()){
   if(!/^\d{1,2}(\s*,\s*\d{1,2}){0,9}$/.test(String(data.yellow_thresholds).trim()))
    throw Error('Soglie diffida: usa numeri separati da virgole');
   rules.yellow_thresholds=String(data.yellow_thresholds).split(',').map(x=>Number(x.trim()));
   if(rules.yellow_thresholds.some(x=>x<1||x>30))throw Error('Soglie diffida non valide');
  }
  if(data.playoff_playout_enabled==='true'&&data.postseason_mode==='none')
   throw Error('Se abiliti playoff/playout devi scegliere una formula: eliminazione diretta o girone nuovo');
  return {table:'app_competitions',id:blank.competitions||null,payload:{
    ...cleaned(data,['name','kind','format','group_code','postseason_mode']),
    tier_level:numberOrNull(data.tier_level),periods:Number(data.periods),minutes_per_period:Number(data.minutes_per_period),
    win_points:Number(data.win_points),draw_points:Number(data.draw_points),loss_points:Number(data.loss_points),
    knockout_two_legged:data.knockout_two_legged==='true',
    extra_time_enabled:data.extra_time_enabled==='true',
    extra_time_periods:Number(data.extra_time_periods),extra_time_minutes:Number(data.extra_time_minutes),
    penalties_enabled:data.penalties_enabled==='true',
    playoff_playout_enabled:data.playoff_playout_enabled==='true',
    ... (Object.keys(rules).length?{discipline_rules:rules}:{})
  }};
 }
 if(kind==='opponents')return {table:'app_opponents',id:blank.opponents||null,payload:{...cleaned(data,['name','short_name','logo_url','primary_color','secondary_color','accent_color','logo_background_color','home_venue_name']),...clubVenuePayload(data)}};
 if(kind==='fixtures'){
  if(!blank.fixtures){
   const round=Number(data.round_no);
   if(!Number.isInteger(round)||round<1||round>250||!data.competition_id)throw Error('Competizione e giornata obbligatorie');
   const t=ctx.state.base.team,opponents=ctx.state.base.opponents||[];
   const allowed=[t,...opponents];
   const home=allowed.find(x=>x.id===data.home_club_id),away=allowed.find(x=>x.id===data.away_club_id);
   if(!home||!away||home.id===away.id)throw Error('Scegli due squadre diverse tramite gli identificativi registrati');
   const clubFields=(club,side)=>club.id===t.id?
    {[side+'_team_id']:club.id,[side+'_opponent_id']:null}:
    {[side+'_team_id']:null,[side+'_opponent_id']:club.id};
   return {table:'new-fixture',payload:{
    competition_id:data.competition_id,round_no:round,
    kickoff_at:parseKickoff(data.kickoff_at),home_team:home.name,
    away_team:away.name,
    ...clubFields(home,'home'),...clubFields(away,'away'),
    venue_name:data.venue_name||null,venue_address:data.venue_address||null,
    is_test:data.is_test==='true'
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
function delayedLiveSuggestion(fixture,competition){
 const length=Number(competition?.minutes_per_period);
 const kickoff=Date.parse(fixture?.kickoff_at||'');
 if(!Number.isFinite(length)||length<=0||!Number.isFinite(kickoff))return {period:'first_half',minute:0};
 const elapsed=Math.max(0,Math.floor((Date.now()-kickoff)/60000));
 if(elapsed>=length+15)return {period:'second_half',minute:Math.max(0,elapsed-length-15)};
 return {period:'first_half',minute:Math.min(length,elapsed)};
}
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
  if(action==='recover-player'){
   if(m?.status!=='scheduled')throw Error('Il rientro può essere registrato solo prima della partita');
   const injury=(ctx.state.data?.injuries||[]).find(i=>i.id===button.dataset.injuryId);
   if(!injury||!['active','recovering'].includes(injury.status))throw Error('Infortunio non attivo');
   const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(m.kickoff_at));
   const p=k=>parts.find(x=>x.type===k)?.value;
   const day=p('year')+'-'+p('month')+'-'+p('day');
   if(!window.confirm('Chiudere l’infortunio dal '+day+'? Verrà conservato nello storico.'))return true;
   await adminWrite('injuries','PATCH',{status:'fit',actual_return:day},{id:injury.id});
   await ctx.reloadAll();ctx.toast('Rientro registrato; aggiorna la convocazione se necessario');return true;
  }
  if(action==='configure-kits'){
   const own=memory.area==='team';
   const club=own?ctx.state.base?.team:(ctx.state.base?.opponents||[]).find(o=>o.id===memory.selected.opponents);
   if(!club?.id)throw Error('Salva prima la nuova avversaria, poi configura le maglie.');
   openKitConfigurator(club,async kits=>{
    const payload={kits};
    // Keep the existing first-team jersey consumers compatible with home kit.
    if(own){const first=kits.home||Object.values(kits)[0];payload.kit_style=first.style;payload.kit_primary_color=first.primary;
     payload.kit_secondary_color=first.secondary;payload.kit_number_color=first.number;}
    await adminWrite(own?'teams':'app_opponents','PATCH',payload,{id:club.id});
    await ctx.reloadAll();ctx.toast('Divise salvate per '+club.name);
   });
   return true;
  }
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
   ctx.state.matchData=await ctx.loadMatchInfo(id);memory.matchTab='callups';ctx.render();ctx.toast('Tabellino operativo collegato');return true;
  }
  if(action==='qualify-phase'){
   const phaseId=memory.selected.phases;
   if(!phaseId)throw Error('Seleziona una sottocompetizione');
   if(!window.confirm('Confermare i qualificati? Serve la Regular Season definitiva di entrambi i gironi, senza parità irrisolte.'))return true;
   const count=await rpc('tm_app_apply_phase_qualifiers',{p_phase_id:phaseId});
   phaseDraft=null;
   await ctx.reloadAll();ctx.toast('Qualificazioni registrate: '+count+' squadre, senza risultati ereditati');
   return true;
  }
  if(action==='draft-phase'){
   const phaseId=memory.selected.phases;
   const data=ctx.state.data||{};
   const phase=(data.competitions||[]).find(x=>x.id===phaseId);
   if(!phase||phase.phase_format==='knockout')throw Error('La fase selezionata non è un girone');
   const entries=(data.phaseEntries||[]).filter(x=>x.phase_competition_id===phaseId);
   const sources=(data.phaseSources||[]).filter(x=>x.phase_competition_id===phaseId).map(x=>x.source_competition_id);
   if(!entries.length||sources.length<2)throw Error('Completa entrambi i gironi e conferma prima i qualificati');
   const draw=roundRobinDraft(entries,data.fixtures||[],sources);
   phaseDraft={phaseId,rows:draw};ctx.render();return true;
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
   const question=decision==='approve'?'Confermare questo evento come ufficiale? Se è un gol valido entrerà nel risultato ufficiale.':'Scartare logicamente questo evento? Resterà consultabile nello storico.';
   if(!window.confirm(question))return true;
   await rpc('tm_app_review_event',{p_match_id:m.id,p_event_id:eventId,p_decision:decision,p_expected_status:expected});
   await reloadMatch(ctx);ctx.toast(decision==='approve'?'Evento ufficializzato':'Evento scartato senza eliminazione');return true;
  }
  if(!m)throw Error('Apri prima la gestione del match');
  if(action==='start'){
   const fixture=ctx.resolveMatch().fixture;
   const competition=(ctx.state.data?.competitions||[]).find(x=>x.id===m.competition_id);
   const realtime=window.confirm('La partita sta iniziando adesso?\n\nOK = sì, avvia il timer da 0\nAnnulla = sto inserendo il live in ritardo');
   if(realtime){
    await rpc('tm_app_start_live_v2',{p_match_id:m.id,p_mode:'realtime',p_period:'first_half',p_approx_minute:0});
    await reloadMatch(ctx);ctx.toast('LIVE avviato in tempo reale');return true;
   }
   const suggestion=delayedLiveSuggestion(fixture,competition);
   const suggestedSecond=suggestion.period==='second_half';
   const second=window.confirm('Periodo attuale suggerito: '+(suggestedSecond?'2° tempo':'1° tempo')+'.\n\nOK = 2° tempo\nAnnulla = 1° tempo');
   const period=second?'second_half':'first_half';
   const suggested=period===suggestion.period?suggestion.minute:0;
   const raw=window.prompt('Minuto approssimativo attuale del '+(second?'2°':'1°')+' tempo.\nIl timer partirà da questo riferimento e gli eventi inseriti dal live resteranno ricalibrabili.',String(suggested));
   if(raw===null)return true;
   const approx=Number(raw);
   if(!Number.isInteger(approx)||approx<0||approx>180)throw Error('Minuto approssimativo non valido');
   await rpc('tm_app_start_live_v2',{p_match_id:m.id,p_mode:'delayed',p_period:period,p_approx_minute:approx});
   await reloadMatch(ctx);ctx.toast('LIVE avviato da riferimento approssimativo');return true;
  }
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
  const map={void:'void_event',approve:'approve_event'};
  if(action==='sync-blue'){const count=await rpc('tm_app_sync_blue',{p_match_id:m.id});await reloadMatch(ctx);ctx.toast(count>0?count+' rientri blu registrati':'Nessun rientro necessario');return true;}
  if(['halftime','second_half','extra','penalties'].includes(action))
   await rpc('tm_app_set_period_v2',{p_match_id:m.id,p_period:action});
  else await rpc('tm_app_match_action',{p_match_id:m.id,p_action:map[action]||action,p_payload:payload});
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
const callupWrites=new Map();
export async function persistCallupChange({matchId,playerId,status,reason},notify){
 if(!matchId||!playerId||!['available','absent'].includes(status))throw Error('Selezione convocazione non valida');
 const normalized=normalizedReason(status,reason);
 const key=matchId+':'+playerId;
 const previous=callupWrites.get(key)||Promise.resolve();
 const run=previous.catch(()=>{}).then(async()=>{
  await rpc('tm_app_save_callups',{p_match_id:matchId,p_rows:[{player_id:playerId,selection_status:status,unavailability_reason:normalized}]});
  const rows=await get('app_match_players','select=selection_status,unavailability_reason&match_id=eq.'+encodeURIComponent(matchId)+'&player_id=eq.'+encodeURIComponent(playerId));
  if(rows.length!==1||rows[0].selection_status!==status||(rows[0].unavailability_reason||null)!==normalized)
   throw Error('Il database non conferma la convocazione. Riprova.');
  return rows[0];
 });
 callupWrites.set(key,run);
 try{const result=await run;notify?.(null);return result}catch(error){notify?.(error);throw error}finally{if(callupWrites.get(key)===run)callupWrites.delete(key)}
}
let lineupWrite=Promise.resolve();
export function persistLineupSnapshot(snapshot,notify){
 const task=lineupWrite.catch(()=>{}).then(async()=>{
  if(!snapshot?.matchId||!snapshot.rows?.length)throw Error('Formazione incompleta');
  const n=snapshot.rows.filter(x=>x.selection_status==='starter').length;
  if(n>11)throw Error('Massimo undici titolari');
  const slots=snapshot.rows.filter(x=>x.tactical_slot!=null).map(x=>x.tactical_slot);
  if(new Set(slots).size!==slots.length)throw Error('Posizioni duplicate');
  await rpc('tm_app_save_formation',{p_match_id:snapshot.matchId,p_rows:snapshot.rows,p_formation:snapshot.formation});
  notify?.(null);
 });
 lineupWrite=task;
 return task.catch(e=>{notify?.(e);throw e});
}
export async function staffSubmit(e,ctx){
 const form=e.target,kind=form.dataset.staffForm;if(!kind)return false;
 e.preventDefault();
 const eventContribution=kind==='event'&&Boolean(ctx.state.identity?.user);
 if(!isStaff(ctx)&&!eventContribution)return true;
 try{
  if(kind==='amend-event'){
   const m=ctx.resolveMatch().operational;if(!m)throw Error('Partita non collegata');
   const ev=ctx.state.matchData?.events?.find(x=>x.id===form.dataset.eventId);
   if(!ev||ev.validation_status!==form.dataset.eventStatus)throw Error('Evento cambiato: ricarica la partita');
   const d=dataForm(form);
   const competition=(ctx.state.data?.competitions||[]).find(c=>c.id===m.competition_id);
   const relativeMinute=numberOrNull(d.minute);
   const cumulativeMinute=cumulativeMinuteFromPeriod(relativeMinute,ev.payload?.period||m.live_period,competition);
   const changes={event_type:d.event_type,team_side:d.team_side,
    player_id:d.team_side==='team'?d.player_id||null:null,
    secondary_player_id:d.team_side==='team'?d.secondary_player_id||null:null,
    minute:storedEventMinute(ev,cumulativeMinute,competition),stoppage_minute:numberOrNull(d.stoppage_minute),
    substitution_reason:d.substitution_reason||null,notes:d.notes||''};
   await pendingFn(form,()=>rpc('tm_app_amend_event',{p_match_id:m.id,p_event_id:ev.id,
    p_expected_status:ev.validation_status,p_changes:changes,p_reason:d.reason||''}));
   reviewEditEvent=null;reviewHistoryEvent=null;await reloadMatch(ctx);
   ctx.toast(roleOf(ctx)==='admin'?'Rettifica salvata e ufficializzata':'Rettifica salvata nello storico, da verificare');return true;
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
  if(kind==='callups'){
   const m=ctx.resolveMatch().operational;if(!m)throw Error('Match da associare');
   const rows=[...form.querySelectorAll('[data-callup-player]')].map(el=>({player_id:el.dataset.callupPlayer,
    selection_status:el.querySelector('[name=selection]').value,
    unavailability_reason:normalizedReason(el.querySelector('[name=selection]').value,el.querySelector('[name=reason]').value)}));
   if(!rows.length)throw Error('Nessun giocatore da salvare: verifica la rosa della partita');
   await pendingFn(form,async()=>{
    const result=await rpc('tm_app_save_callups',{p_match_id:m.id,p_rows:rows});
    if(Number(result)!==rows.length)throw Error('Salvataggio incompleto: il server ha registrato '+result+' di '+rows.length+' giocatori');
    const saved=await get('app_match_players','select=player_id,selection_status,unavailability_reason&match_id=eq.'+encodeURIComponent(m.id)+'&limit=1000');
    const byId=new Map(saved.map(p=>[p.player_id,p]));
    const differences=rows.filter(p=>{const actual=byId.get(p.player_id);return !actual||actual.selection_status!==p.selection_status||(actual.unavailability_reason||null)!==(p.unavailability_reason||null)});
    if(differences.length)throw Error('Verifica fallita: '+differences.length+' convocazioni diverse dai dati salvati su Supabase');
   });
   await reloadMatch(ctx);ctx.toast('Convocazioni salvate e verificate: '+rows.length+' giocatori');return true;
  }
  if(kind==='lineup'){
   const m=ctx.resolveMatch().operational;if(!m)throw Error('Match da associare');
   if(!ctx.state.matchData?.players?.some(p=>['available','absent','starter','bench'].includes(p.selection_status)))throw Error('Conferma prima le convocazioni');
   const rows=[...form.querySelectorAll('[data-lineup-player]')].map(el=>{
    const query=name=>el.querySelector('[name="'+name+'"]').value;
    const st=query('status');
    return {player_id:el.dataset.lineupPlayer,selection_status:st,
     shirt_number:numberOrNull(query('shirt')),tactical_slot:st==='starter'?numberOrNull(query('slot')):null,
     is_captain:form.querySelector('[name=captain]:checked')?.value===el.dataset.lineupPlayer&&st==='starter',
     unavailability_reason:normalizedReason(st,query('reason')),unavailability_note:null};
   });
   const num=rows.filter(x=>x.selection_status==='starter').length;
   if(num>11)throw Error('Massimo undici titolari');
   if(new Set(rows.filter(x=>x.tactical_slot!=null).map(x=>x.tactical_slot)).size!==rows.filter(x=>x.tactical_slot!=null).length)throw Error('Slot tattici ripetuti');
   await pendingFn(form,()=>rpc('tm_app_save_formation',{p_match_id:m.id,p_rows:rows,p_formation:dataForm(form).formation||null}));
   await reloadMatch(ctx);ctx.toast('Formazione e panchina salvate');return true;
  }
  if(kind==='event'){
   const m=ctx.resolveMatch().operational;if(!m)throw Error('Match da associare');
   const d=dataForm(form),c=(ctx.state.data?.competitions||[]).find(c=>c.id===m.competition_id);
   const period=m.live_period;
   const configuredMinutes=Number(c?.minutes_per_period);
   if(!Number.isFinite(configuredMinutes)||configuredMinutes<=0)throw Error('Durata dei tempi non configurata nella competizione: controlla Setup → Competizioni');
   const relativeMinute=numberOrNull(d.minute);
   const minute=cumulativeMinuteFromPeriod(relativeMinute,period,c);
   const timerMinute=m.live_clock_running?liveClockMinute(m,c):null;
   const minuteOrigin=relativeMinute===null?
    (d.minute_mode==='past_unknown'?'past_unknown':'live_estimated'):
    (timerMinute!==null&&relativeMinute===timerMinute?'timer':'manual');
   const payload={event_type:d.event_type,team_side:d.team_side,
    player_id:d.team_side==='team'?d.player_id||null:null,
    secondary_player_id:d.team_side==='team'?d.secondary_player_id||null:null,
    minute,stoppage_minute:numberOrNull(d.stoppage_minute),
    substitution_reason:d.substitution_reason,notes:d.notes,
    count_score:Boolean(d.count_score),captured_at:d.captured_at||new Date().toISOString(),
    minute_mode:d.minute_mode||'now_estimated',minute_origin:minuteOrigin,request_key:crypto.randomUUID()};
   if(payload.event_type==='substitution'&&!payload.player_id)throw Error('Indica chi esce');
   const duplicate=await rpc('tm_app_find_event_duplicate',{p_match_id:m.id,p_event:payload});
   let saved;
   if(duplicate?.candidate){
    const seconds=Number(duplicate.distance_seconds)||0;
    const merge=window.confirm('Evento simile già registrato '+seconds+' s fa.\n\nOK = unisci al precedente\nAnnulla = mantieni come evento separato');
    if(merge){
     saved=await pendingFn(form,()=>rpc('tm_app_merge_event_submission',{p_match_id:m.id,p_event_id:duplicate.event_id,p_event:payload}));
     await reloadMatch(ctx);
     const conflicts=saved?.conflicts&&Object.keys(saved.conflicts).length;
     ctx.toast(conflicts?'Evento unificato · alcuni dati discordanti restano da verificare':'Evento unificato al precedente');
     return true;
    }
   }
   saved=await pendingFn(form,()=>rpc('tm_app_submit_live_event',{p_match_id:m.id,p_event:payload}));
   await reloadMatch(ctx);
   ctx.toast(saved?.status==='official'?'Evento registrato e confermato':'Evento registrato · in attesa di conferma');
   return true;
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
  if(kind==='phase'){
   const d=dataForm(form);
   const selected=(ctx.state.data?.competitions||[]).find(c=>c.id===memory.selected.competitions);
   if(!selected)throw Error('Seleziona prima una competizione madre');
   const parentId=selected.id;
   const role=d.phase_role,format=d.phase_format,sourceA=d.phase_source_a,sourceB=d.phase_source_b||null;
   const rankMin=Number(d.phase_min_rank),rankMax=numberOrNull(d.phase_max_rank);
   const tier=Number(d.phase_tier);
   if(!d.phase_name?.trim()||!Number.isInteger(rankMin)||rankMin<1||
    (rankMax!==null&&(!Number.isInteger(rankMax)||rankMax<rankMin))||
    !Number.isFinite(tier)||tier<=0||!sourceA||sourceA===sourceB)
     throw Error('Dati fase non validi: verifica livello, gironi e posizioni');
   const all=ctx.state.data?.competitions||[];
   const existing=all.find(x=>x.id===memory.selected.phases&&x.parent_competition_id===parentId);
   const phaseId=await pendingFn(form,()=>rpc('tm_app_save_subcompetition',{
     p_parent_id:parentId,p_phase_id:existing?.id||null,p_name:d.phase_name.trim(),
     p_phase_role:role,p_phase_format:format,p_tier_level:tier,
     p_source_a:sourceA,p_source_b:sourceB,p_rank_min:rankMin,p_rank_max:rankMax
   }));
   memory.selected.phases=phaseId;
   await ctx.reloadAll();ctx.toast('Sottocompetizione salvata: calendario e punteggi partono da zero');
   return true;
  }
  if(kind==='players'){
   const d=dataForm(form),{contract_start,contract_end,contract_mode,...raw}=d;
   if(!contract_start||!contract_end||contract_start>contract_end)throw Error('Periodo di appartenenza non valido');
   const payload={...raw,id:memory.selected.players||null,
    active:d.active==='true',height_cm:d.height_cm===''?null:Number(d.height_cm)};
   const playerId=await pendingFn(form,()=>rpc('tm_app_save_player',{p_season_id:ctx.state.season,p_data:payload}));
   await pendingFn(form,()=>rpc('tm_app_set_player_period',{p_season_id:ctx.state.season,p_player_id:playerId,p_start_date:contract_start,p_end_date:contract_end,p_period_id:contract_mode==='edit'?(ctx.state.data?.contracts||[]).filter(x=>x.player_id===playerId&&x.season_id===ctx.state.season).sort((a,b)=>String(b.start_date).localeCompare(String(a.start_date)))[0]?.id||null:null}));
   memory.selected.players=playerId;
   await ctx.reloadAll();ctx.toast('Giocatore e periodo di rosa aggiornati');return true;
  }
  const obj=adminPayload(form,ctx);
  if(!obj.table)throw Error('Modulo sconosciuto');
  if(obj.table==='new-fixture'){
   if(!(ctx.state.data?.competitions||[]).some(c=>c.id===obj.payload.competition_id))throw Error('Competizione non appartenente alla stagione');
   const {competition_id,is_test,...row}=obj.payload;
   if(is_test){
    if(roleOf(ctx)!=='admin')throw Error('I match di test privati sono riservati agli amministratori');
    if(!window.confirm('Creare un match di TEST privato? Sarà visibile solo al tuo account e non conterà in classifiche o statistiche.'))return true;
    await pendingFn(form,()=>rpc('tm_app_create_test_fixture',{p_competition_id:competition_id,p_row:row}));
    await ctx.reloadAll();ctx.toast('Match di test privato creato');return true;
   }
   if(!window.confirm('Inserire la nuova partita nel calendario?'))return true;
   const result=await pendingFn(form,()=>rpc('tm_app_import_fixtures',{p_competition_id:competition_id,p_rows:[row],p_dry_run:false}));
   if(result?.new!==1)throw Error('Partita già presente nel calendario');
   await ctx.reloadAll();ctx.toast('Nuova partita inserita');return true;
  }
  if(obj.table==='teams')obj.id=ctx.state.base.team.id;
   if(['teams','app_opponents'].includes(obj.table)){
    const cropped=await prepareLogoForUpload(form);
    if(cropped)obj.payload.logo_url=await uploadClubBadge(cropped,ctx.state.base.team.id);
   }
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

/* Riordino criteri di classifica: drag and drop desktop e frecce accessibili su touch. */
function syncTieList(list){
 const items=[...list.querySelectorAll('[data-tie-key]')],input=list.closest('form')?.querySelector('[name=standings_tiebreakers]');
 if(input)input.value=items.map(x=>x.dataset.tieKey).join(',');
 items.forEach((el,i)=>{el.querySelector('[data-staff-tie-move=up]').disabled=i===0;el.querySelector('[data-staff-tie-move=down]').disabled=i===items.length-1});
}
if(typeof document!=='undefined'){
document.addEventListener('click',event=>{
 const btn=event.target.closest('[data-staff-tie-move]');if(!btn)return;
 const item=btn.closest('[data-tie-key]'),list=item?.parentElement;if(!list)return;
 if(btn.dataset.staffTieMove==='up'&&item.previousElementSibling)list.insertBefore(item,item.previousElementSibling);
 if(btn.dataset.staffTieMove==='down'&&item.nextElementSibling)list.insertBefore(item.nextElementSibling,item);
 syncTieList(list);
});
let draggedTie=null;
document.addEventListener('dragstart',event=>{const item=event.target.closest('[data-tie-key]');if(item){draggedTie=item;event.dataTransfer.effectAllowed='move'}});
document.addEventListener('dragover',event=>{const item=event.target.closest('[data-tie-key]');if(item&&draggedTie&&item!==draggedTie){event.preventDefault();event.dataTransfer.dropEffect='move'}});
document.addEventListener('drop',event=>{const item=event.target.closest('[data-tie-key]');if(item&&draggedTie&&item!==draggedTie){event.preventDefault();const list=item.parentElement;const rect=item.getBoundingClientRect();list.insertBefore(draggedTie,event.clientY<rect.top+rect.height/2?item:item.nextSibling);syncTieList(list)}draggedTie=null});
document.addEventListener('dragend',()=>{draggedTie=null});

}
