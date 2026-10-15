/* Eventi Caselle: metadati facoltativi, separati dal punteggio e dal minutaggio. */
export const GOAL_TYPES=['goal','own_goal','penalty_scored','penalty_goal'];
export const CARD_TYPES=['yellow_card','blue_card','red_card','second_yellow'];
const body=[['foot','Piede'],['knee','Ginocchio'],['head','Testa']];
const plays=[['open_play','Azione'],['corner','Calcio d’angolo'],['penalty','Rigore'],['free_kick','Punizione']];
const dynamics=[['counterattack','Contropiede'],['cross','Su cross'],['rebound','Su ribattuta'],['shot','Tiro'],['scramble','In mischia'],['tap_in','Tap-in'],['direct_free_kick','Tiro su punizione'],['personal_action','Azione personale']];
const discipline=[['protest','Proteste'],['foul','Fallo'],['violent_conduct','Condotta violenta'],['unsporting','Comportamento antisportivo'],['other','Altro']];
const changes=[['injury','Infortunio'],['physical_precaution','Precauzione fisica'],['disciplinary_precaution','Precauzione disciplinare'],['energy','Energia'],['technical_tactical','Cambio tecnico/tattico']];
const zones=[['goal_area','Area del portiere'],['penalty_area','Area di rigore'],['16_25','16–25 m'],['26_35','26–35 m'],['over_35','Oltre 35 m']];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const choices=(name,label,values,current)=>'<label class="staff-field"><span>'+esc(label)+'</span><select name="'+name+'"><option value="">Non specificato</option>'+values.map(([v,t])=>'<option value="'+v+'"'+(v===current?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>';
const cleanPoint=p=>p&&typeof p==='object'&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y))?{x:Number(p.x),y:Number(p.y)}:null;
const marker=(name,point)=>point?'<span class="event-pitch-marker event-pitch-marker-'+name+'" data-marker="'+name+'" style="left:'+(point.x/68*100)+'%;top:'+(point.y/105*100)+'%">'+(name==='shot'?'T':'A')+'</span>':'<span class="event-pitch-marker event-pitch-marker-'+name+'" data-marker="'+name+'" hidden></span>';
export function goalDistance(point){
 const p=cleanPoint(point);if(!p||p.x<0||p.x>68||p.y<0||p.y>105)return null;
 const meters=Math.round(Math.hypot(p.x-34,p.y));
 const zone=p.y<=5.5&&p.x>=24.84&&p.x<=43.16?'goal_area':
  p.y<=16.5&&p.x>=13.84&&p.x<=54.16?'penalty_area':
  meters<=25?'16_25':meters<=35?'26_35':'over_35';
 return {meters,zone};
}
export function legacyChangeReason(value){
 return ({injury:'injury',physical_precaution:'injury_prevention',disciplinary_precaution:'disciplinary_prevention',technical_tactical:'tactical'})[value]||null;
}
function normalizedChange(payload,legacy){
 return payload?.substitution_motivation||({injury:'injury',injury_prevention:'physical_precaution',disciplinary_prevention:'disciplinary_precaution',tactical:'technical_tactical',technical:'technical_tactical',technical_choice:'technical_tactical'})[legacy]||'';
}
export function eventAdvancedMarkup(ev=null,eventType='goal',teamSide='team'){
 const p=ev?.payload||{},goal=p.goal_details||{},shot=cleanPoint(goal.shot),assist=cleanPoint(goal.assist),isGoal=GOAL_TYPES.includes(eventType),isCard=CARD_TYPES.includes(eventType)&&teamSide==='team',isChange=eventType==='substitution'&&teamSide==='team';
 const available=isGoal;
 return '<div class="event-advanced-launch" data-event-advanced-launch'+(available?'':' hidden')+'>'+
 '<button type="button" class="staff-soft" data-event-advanced-open>Dettagli avanzati <span aria-hidden="true">→</span></button>'+
 '<span class="event-advanced-hint">Facoltativi, compilabili anche dopo la partita</span></div>'+
 '<section class="event-advanced" data-event-advanced hidden><div class="event-advanced-return">'+
 '<button type="button" class="staff-soft" data-event-advanced-back>← Torna ai dati base</button>'+
 '<strong>Dettagli avanzati</strong></div><div class="event-advanced-inner">'+
 '<div data-event-group="goal"'+(isGoal?'':' hidden')+'>'+
 '<p class="event-advanced-caption">Come è stato segnato</p>'+
 '<div class="event-goal-layout"><div class="event-body-wrap"><div class="event-body-figure" role="group" aria-label="Seleziona la parte del corpo">'+
 '<svg viewBox="0 0 120 204" aria-hidden="true"><circle cx="60" cy="26" r="19"/><path d="M40 53 Q60 44 80 53 L87 110 L76 123 L76 160 L87 194 L69 194 L60 143 L51 194 L33 194 L44 160 L44 123 L33 110 Z"/><path d="M40 59 L21 102 L31 111 L48 81 M80 59 L99 102 L89 111 L72 81" /></svg>'+
 '<button type="button" data-event-body="head" style="--bx:50%;--by:13%" aria-label="Testa">●</button>'+
 '<button type="button" data-event-body="knee" style="--bx:40%;--by:72%" aria-label="Ginocchio">●</button>'+
 '<button type="button" data-event-body="foot" style="--bx:59%;--by:94%" aria-label="Piede">●</button>'+
 '</div>'+choices('goal_body_part','Parte del corpo',body,goal.body_part||'')+'</div>'+
 '<div class="event-goal-selects">'+choices('goal_play_type','Tipo di gioco',plays,goal.play_type||'')+choices('goal_dynamics','Dinamica',dynamics,goal.dynamics||'')+'</div></div>'+
 '<p class="event-advanced-caption">Posizione di tiro e assist</p><p class="event-advanced-help">Seleziona Tiro o Assist, poi tocca il campo. La porta attaccata è sempre in alto, anche per i gol subiti.</p>'+
 '<div class="event-spatial"><div class="event-pitch-wrap">'+
 '<div class="event-pitch-tools"><button type="button" data-event-pitch-mode="shot" aria-pressed="true">Tiro</button><button type="button" data-event-pitch-mode="assist" aria-pressed="false">Assist</button><button type="button" data-event-clear-point>Rimuovi punto</button></div>'+
 '<input type="hidden" name="pitch_mode" value="shot">'+
 '<button type="button" class="event-pitch" data-event-pitch aria-label="Posiziona tiro o assist sul campo">'+
 '<svg viewBox="0 0 68 105" preserveAspectRatio="none" aria-hidden="true"><rect x="0.5" y="0.5" width="67" height="104" rx="0.3"/><line x1="0" y1="52.5" x2="68" y2="52.5"/><circle cx="34" cy="52.5" r="9.15"/><rect x="13.84" y="0" width="40.32" height="16.5"/><rect x="24.84" y="0" width="18.32" height="5.5"/><circle cx="34" cy="11" r=".6"/><path d="M25 16.5 Q34 25 43 16.5"/><rect x="13.84" y="88.5" width="40.32" height="16.5"/><rect x="24.84" y="99.5" width="18.32" height="5.5"/><circle cx="34" cy="94" r=".6"/></svg>'+
 '<span class="event-pitch-goal" aria-hidden="true">PORTA</span>'+marker('shot',shot)+marker('assist',assist)+'</button>'+
 '<input type="hidden" name="goal_shot_x" value="'+esc(shot?.x??'')+'"><input type="hidden" name="goal_shot_y" value="'+esc(shot?.y??'')+'">'+
 '<input type="hidden" name="goal_assist_x" value="'+esc(assist?.x??'')+'"><input type="hidden" name="goal_assist_y" value="'+esc(assist?.y??'')+'"></div>'+
 '<div class="event-distance">'+choices('goal_distance_zone','Distanza indicativa',zones,goal.distance_zone||goalDistance(shot)?.zone||'')+
 '<small data-event-distance-label>'+(shot?'Distanza stimata: '+goalDistance(shot)?.meters+' m':'Puoi selezionare manualmente la fascia, anche senza indicare il tiro')+'</small></div></div></div>'+
 '</div></section>';
}
export function eventBaseMotivationMarkup(ev=null,eventType='goal',teamSide='team'){
 const p=ev?.payload||{},card=CARD_TYPES.includes(eventType)&&teamSide==='team',change=eventType==='substitution'&&teamSide==='team';
 return '<div class="event-base-motivation" data-event-base-motivation'+(card||change?'':' hidden')+'>'+
 '<div data-base-motivation="discipline"'+(card?'':' hidden')+'>'+choices('disciplinary_reason','Motivo del cartellino',discipline,p.disciplinary_reason||'')+'</div>'+
 '<div data-base-motivation="substitution"'+(change?'':' hidden')+'>'+choices('substitution_motivation','Motivo del cambio',changes,normalizedChange(p,ev?.substitution_reason))+'</div></div>';
}
const numberField=(form,name)=>{const s=String(form.elements.namedItem(name)?.value??'').trim();return s===''?null:Number(s)};
function readPoint(form,kind){
 const x=numberField(form,'goal_'+kind+'_x'),y=numberField(form,'goal_'+kind+'_y');
 if(x===null&&y===null)return null;
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>68||y<0||y>105)throw Error('Posizione '+kind+' non valida');
 return {x:Math.round(x*10)/10,y:Math.round(y*10)/10};
}
export function readEventAdvanced(form){
 const type=form.elements.namedItem('event_type')?.value||'goal',side=form.elements.namedItem('team_side')?.value||'team';
 const get=n=>String(form.elements.namedItem(n)?.value||'').trim()||null;
 const result={goal_details:null,disciplinary_reason:null,substitution_motivation:null,substitution_reason:null};
 if(GOAL_TYPES.includes(type)){
  const shot=readPoint(form,'shot'),assist=readPoint(form,'assist'),distance=goalDistance(shot);
  const zone=distance?.zone||get('goal_distance_zone'),details={body_part:get('goal_body_part'),play_type:get('goal_play_type'),dynamics:get('goal_dynamics'),
   shot,assist,distance_zone:zone,distance_m:distance?.meters??null};
  if(details.body_part||details.play_type||details.dynamics||shot||assist||zone)result.goal_details=details;
 }
 if(CARD_TYPES.includes(type)&&side==='team')result.disciplinary_reason=get('disciplinary_reason');
 if(type==='substitution'&&side==='team'){
  result.substitution_motivation=get('substitution_motivation');
  result.substitution_reason=legacyChangeReason(result.substitution_motivation);
 }
 return result;
}
export function mergeEventAdvanced(payload,advanced){
 const next={...(payload||{})};
 for(const key of ['goal_details','disciplinary_reason','substitution_motivation']){
  if(advanced[key]===null||advanced[key]===undefined)delete next[key];
  else next[key]=advanced[key];
 }
 return next;
}
function redraw(wrapper){
 const form=wrapper.closest('form');if(!form)return;
 const type=form.elements.namedItem('event_type')?.value||'goal',side=form.elements.namedItem('team_side')?.value||'team';
 const groups={goal:GOAL_TYPES.includes(type)};
 for(const [key,active] of Object.entries(groups)){const el=wrapper.querySelector('[data-event-group="'+key+'"]');if(el)el.hidden=!active;}
 const available=Object.values(groups).some(Boolean);
 wrapper.hidden=!available||form.dataset.eventMode!=='advanced';
 const launch=form.querySelector('[data-event-advanced-launch]');
 if(launch)launch.hidden=!available||form.dataset.eventMode==='advanced';
 const base=form.querySelector('[data-event-base-motivation]');
 if(base){
  const card=CARD_TYPES.includes(type)&&side==='team',change=type==='substitution'&&side==='team';
  const c=base.querySelector('[data-base-motivation="discipline"]'),s=base.querySelector('[data-base-motivation="substitution"]');
  if(c)c.hidden=!card;if(s)s.hidden=!change;base.hidden=!card&&!change;
 }
 const note=form.querySelector('[data-event-note]');if(note)note.hidden=GOAL_TYPES.includes(type)||CARD_TYPES.includes(type)||type==='substitution';
 if(!available&&form.dataset.eventMode==='advanced')setEventDetailsScreen(form,false);
 const selected=form.elements.namedItem('goal_body_part')?.value;
 for(const el of wrapper.querySelectorAll('[data-event-body]'))el.classList.toggle('selected',el.dataset.eventBody===selected);
}
export function setEventDetailsScreen(form,showAdvanced){
 const wrapper=form?.querySelector('[data-event-advanced]');
 if(!wrapper)return;
 form.dataset.eventMode=showAdvanced?'advanced':'base';
 redraw(wrapper);
 const sheet=form.closest('.live-event-sheet');
 sheet?.classList.toggle('event-sheet-advanced',showAdvanced);
 const title=sheet?.querySelector('.live-sheet-head h3');
 if(title){
  if(!title.dataset.baseTitle)title.dataset.baseTitle=title.textContent;
  title.textContent=showAdvanced?'Dettagli avanzati':title.dataset.baseTitle;
 }
 if(sheet)sheet.setAttribute('aria-label',showAdvanced?'Dettagli avanzati':(title?.dataset.baseTitle||'Modifica evento'));
 if('scrollTop' in form)form.scrollTop=0;
 const focus=showAdvanced?wrapper.querySelector('[data-event-advanced-back]'):form.querySelector('[data-event-advanced-open]');
 focus?.focus?.({preventScroll:true});
}
if(typeof document!=='undefined'){
 document.addEventListener('change',event=>{
  const form=event.target.closest('form'),wrapper=form?.querySelector('[data-event-advanced]');
  if(wrapper&&['event_type','team_side','goal_body_part'].includes(event.target.name))redraw(wrapper);
 });
 document.addEventListener('click',event=>{
  const target=event.target;
  const open=target.closest?.('[data-event-advanced-open]');
  if(open){setEventDetailsScreen(open.closest('form'),true);return;}
  const back=target.closest?.('[data-event-advanced-back]');
  if(back){setEventDetailsScreen(back.closest('form'),false);return;}
  const wrapper=target.closest?.('[data-event-advanced]');if(!wrapper)return;
  const form=wrapper.closest('form');
  const bodyButton=target.closest('[data-event-body]');
  if(bodyButton){form.elements.namedItem('goal_body_part').value=bodyButton.dataset.eventBody;redraw(wrapper);return;}
  const modeButton=target.closest('[data-event-pitch-mode]');
  if(modeButton){const mode=modeButton.dataset.eventPitchMode;form.elements.namedItem('pitch_mode').value=mode;
   wrapper.querySelectorAll('[data-event-pitch-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.eventPitchMode===mode)));return;}
  const pitch=target.closest('[data-event-pitch]'),clear=target.closest('[data-event-clear-point]');
  if(!pitch&&!clear)return;
  const mode=form.elements.namedItem('pitch_mode').value;
  const rect=(pitch||wrapper.querySelector('[data-event-pitch]')).getBoundingClientRect();
  const p=clear?null:{x:Math.round(Math.min(68,Math.max(0,((event.clientX-rect.left)/rect.width)*68))*10)/10,
   y:Math.round(Math.min(105,Math.max(0,((event.clientY-rect.top)/rect.height)*105))*10)/10};
  form.elements.namedItem('goal_'+mode+'_x').value=p?.x??'';
  form.elements.namedItem('goal_'+mode+'_y').value=p?.y??'';
  const markerEl=wrapper.querySelector('[data-marker="'+mode+'"]');
  markerEl.hidden=!p;if(p){markerEl.style.left=p.x/68*100+'%';markerEl.style.top=p.y/105*100+'%';}
  if(mode==='shot'){
   const distance=goalDistance(p),zone=form.elements.namedItem('goal_distance_zone');
   zone.value=distance?.zone||'';
   wrapper.querySelector('[data-event-distance-label]').textContent=distance?'Distanza stimata: '+distance.meters+' m':'Puoi selezionare manualmente la fascia, anche senza indicare il tiro';
  }
 });
}
