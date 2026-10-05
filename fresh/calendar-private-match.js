import {loadIdentity,loadBase,loadSeason,rpc} from './api.js?calendar-private=20261005v1';

const q=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function adminContext(){
 const identity=await loadIdentity().catch(()=>null);
 if(identity?.role?.role!=='admin')return null;
 const base=await loadBase();
 const seasonId=sessionStorage.getItem('tm_next_season')||base.seasons.find(s=>s.status==='active')?.id||base.seasons[0]?.id;
 return {identity,base,seasonId};
}

function installButton(ctx){
 if(document.body.dataset.page!=='calendar')return;
 const toolbar=q('.calendar-toolbar')||q('.filters');
 if(!toolbar)return;
 toolbar.querySelector('.segmented')?.remove();
 const select=toolbar.querySelector('[data-comp-select]');
 if(select){
  select.classList.add('calendar-comp-filter');
  toolbar.prepend(select);
 }
 if(toolbar.querySelector('[data-calendar-private-fallback]'))return;
 const button=document.createElement('button');
 button.type='button';
 button.className='roster-add calendar-new';
 button.dataset.calendarPrivateFallback='1';
 button.textContent='+ Nuovo';
 button.addEventListener('click',()=>openModal(ctx));
 toolbar.append(button);
}

async function openModal(ctx){
 let data;
 try{data=await loadSeason(ctx.seasonId,true,true)}catch(e){alert('Dati non disponibili: '+e.message);return}
 const opponents=(ctx.base.opponents||[]).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'it'));
 const layer=q('#modal-layer')||document.body;
 const wrap=document.createElement('div');
 wrap.className='overlay';
 wrap.dataset.privateFallbackOverlay='1';
 const now=new Date(Date.now()+5*60000);
 const local=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
 wrap.innerHTML='<section class="overlay-card calendar-new-sheet" role="dialog" aria-modal="true" aria-label="Nuova amichevole o test">'+
  '<button type="button" class="close-overlay" data-close aria-label="Chiudi">×</button>'+
  '<span class="eyebrow">CALENDARIO</span><h2>Nuova amichevole / test</h2>'+
  '<p>Partita privata visibile solo al tuo account e esclusa dalle statistiche ufficiali.</p>'+
  '<form class="calendar-new-form">'+
   '<label>Avversaria<select name="opponent_id" required><option value="">Seleziona</option>'+opponents.map(o=>'<option value="'+esc(o.id)+'">'+esc(o.name)+'</option>').join('')+'</select></label>'+
   '<label>Casa / trasferta<select name="home_away"><option value="home">Casa</option><option value="away">Trasferta</option></select></label>'+
   '<label>Data e ora inizio<input name="kickoff_at" type="datetime-local" value="'+esc(local)+'" required></label>'+
   '<label>Luogo<input name="venue_name" placeholder="Campo / impianto"></label>'+
   '<div class="calendar-rule-grid"><label>Numero tempi<input name="periods" type="number" min="1" max="6" value="2" required></label><label>Durata per tempo<input name="minutes_per_period" type="number" min="1" max="120" value="40" required></label></div>'+
   '<label class="staff-check calendar-rolling"><input type="checkbox" name="rolling_substitutions"> Cambi rotanti <small>un giocatore uscito può rientrare</small></label>'+
   '<div class="form-error" data-error aria-live="polite"></div>'+
   '<button type="submit" class="primary-btn">Crea partita</button>'+
  '</form></section>';
 const close=()=>wrap.remove();
 wrap.addEventListener('click',e=>{if(e.target===wrap||e.target.closest('[data-close]'))close()});
 wrap.querySelector('form').addEventListener('submit',async e=>{
  e.preventDefault();
  const form=e.currentTarget,fd=new FormData(form),error=form.querySelector('[data-error]'),button=form.querySelector('[type=submit]');
  const kickoff=new Date(String(fd.get('kickoff_at')||'')),periods=Number(fd.get('periods')),minutes=Number(fd.get('minutes_per_period'));
  if(!fd.get('opponent_id')){error.textContent='Seleziona un’avversaria.';return}
  if(!Number.isFinite(kickoff.getTime())){error.textContent='Data e ora non valide.';return}
  if(!Number.isInteger(periods)||periods<1||periods>6||!Number.isInteger(minutes)||minutes<1||minutes>120){error.textContent='Numero o durata dei tempi non validi.';return}
  button.disabled=true;button.textContent='Creazione…';error.textContent='';
  try{
   const result=await rpc('tm_app_create_private_match',{
    p_season_id:ctx.seasonId,p_opponent_id:String(fd.get('opponent_id')),p_home_away:String(fd.get('home_away')||'home'),
    p_kickoff_at:kickoff.toISOString(),p_venue_name:String(fd.get('venue_name')||'').trim()||null,p_venue_address:null,
    p_periods:periods,p_minutes_per_period:minutes,p_rolling_substitutions:fd.get('rolling_substitutions')==='on'
   });
   close();
   if(result?.fixture_id)location.hash='#match/'+result.fixture_id;
   location.reload();
  }catch(err){error.textContent=err.message||String(err);button.disabled=false;button.textContent='Crea partita'}
 });
 layer.append(wrap);
}

async function init(){
 const ctx=await adminContext();
 if(!ctx)return;
 const apply=()=>installButton(ctx);
 apply();
 const observer=new MutationObserver(apply);
 observer.observe(document.getElementById('app')||document.body,{subtree:true,childList:true});
}
init();
