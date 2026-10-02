import{changePassword,requestPassword,rpc,hasSession}from './api.js';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let contextFn=null,installed=false;
const dialog=(label,body,force=false)=>{
 const old=document.getElementById('tm-account-dialog');if(old)old.remove();
 const box=document.createElement('div');box.className='overlay account-overlay';box.id='tm-account-dialog';
 box.innerHTML='<section class="overlay-card" role="dialog" aria-modal="true" aria-label="'+E(label)+'">'+body+'</section>';
 box.dataset.force=String(force);document.body.appendChild(box);return box;
};
function formError(form,msg){const t=form.querySelector('[role=alert]');if(t)t.textContent=String(msg||'Errore');}
function safeClose(){const box=document.getElementById('tm-account-dialog');if(box?.dataset.force!=='true')box?.remove()}
function showRecovery(){
 dialog('Recupero credenziali','<button type="button" class="close-overlay" data-account-close aria-label="Chiudi">×</button>'+
 '<span class="eyebrow">RECUPERO ACCESSO</span><h2>Richiedi il ripristino</h2>'+
 '<p>Un amministratore valuterà la richiesta. Per privacy non viene indicato se lo username esiste.</p>'+
 '<form data-account-recovery><label>Username<input name="username" autocomplete="username" minlength="3" maxlength="32" required></label>'+
 '<div class="form-error" role="alert"></div><button class="primary-btn" type="submit">Invia richiesta</button></form>');
 document.querySelector('[data-account-recovery] input')?.focus();
}
export function showPasswordChange(force=false){
 dialog('Cambio password',''+(force?'':'<button type="button" class="close-overlay" data-account-close aria-label="Chiudi">×</button>')+
 '<span class="eyebrow">SICUREZZA ACCOUNT</span><h2>'+(force?'Aggiorna la password':'Cambia password')+'</h2>'+
 '<p>'+(force?'La password iniziale deve essere sostituita prima di utilizzare il gestionale.':'Per la modifica è necessaria una sessione autenticata.')+'</p>'+
 '<form data-account-change><label>Nuova password<input name="password" type="password" minlength="10" maxlength="128" autocomplete="new-password" required></label>'+
 '<label>Ripeti password<input name="confirm" type="password" minlength="10" maxlength="128" autocomplete="new-password" required></label>'+
 '<div class="form-error" role="alert"></div><button class="primary-btn" type="submit">Conferma nuova password</button></form>'+
 (force?'<button type="button" data-account-signout class="soft-btn">Esci dall’account</button>':''),force);
 document.querySelector('[data-account-change] input')?.focus();
}
export function maybeRequirePasswordChange(identity){
 if(!hasSession()||identity?.profile?.must_change_password!==true)return;
 if(!document.getElementById('tm-account-dialog'))showPasswordChange(true);
}
export function profilePanel(identity,seasonName){
 if(!hasSession())return '<section class="glass panel account-center"><h2>Accedi al tuo account</h2><p>Per aggiornare i dati personali è necessario autenticarsi.</p><button class="primary-btn" data-action="account">Accedi</button></section>';
 const profile=identity?.profile||{};
 return '<section class="glass panel account-center"><div class="staff-panel-heading"><div><span class="eyebrow">DATI PERSONALI</span><h2>Il mio account</h2></div></div>'+
 '<div class="account-badges"><span>'+E(profile.username||'utente')+'</span><span>'+E(identity?.role?.role||'profilo')+'</span><span>'+E(seasonName||'')+'</span></div>'+
 '<form data-account-profile class="staff-form"><label class="staff-field"><span>Nome pubblico</span><input name="display_name" required minlength="2" maxlength="90" value="'+E(profile.display_name||'')+'"></label>'+
 '<div role="alert" class="form-error"></div><button class="staff-submit" type="submit">Salva profilo</button></form>'+
 '<div class="account-tools"><button type="button" data-account-password class="soft-btn">Cambia password</button></div>'+
 (profile.must_change_password?'<p class="data-warning">Devi cambiare la password provvisoria.</p>':'')+
 '</section>';
}
export function installAccountUI(getContext){
 if(installed)return;installed=true;contextFn=getContext;
 document.addEventListener('click',async e=>{
  const click=e.target.closest('[data-account-recover],[data-account-password],[data-account-close],[data-account-signout]');
  if(!click)return;
  if(click.hasAttribute('data-account-recover'))showRecovery();
  if(click.hasAttribute('data-account-password'))showPasswordChange();
  if(click.hasAttribute('data-account-close'))safeClose();
  if(click.hasAttribute('data-account-signout')){
   document.getElementById('tm-account-dialog')?.remove();
   await contextFn().logoutUser();
  }
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape')safeClose()});
 document.addEventListener('submit',async e=>{
  const form=e.target;
  if(!form.matches('[data-account-recovery],[data-account-change],[data-account-profile]'))return;
  e.preventDefault();if(form.dataset.busy==='true')return;
  form.dataset.busy='true';const button=form.querySelector('[type=submit]');if(button)button.disabled=true;
  const ctx=contextFn();
  try{
   const data=new FormData(form);
   if(form.hasAttribute('data-account-recovery')){
    await requestPassword(String(data.get('username')||''));const pane=document.querySelector('#tm-account-dialog .overlay-card');
    if(pane)pane.innerHTML='<span class="eyebrow">RECUPERO INVIATO</span><h2>Richiesta ricevuta</h2><p>Se lo username esiste, un amministratore potrà valutarla. Non verranno inviati dettagli sull’esistenza dell’account.</p><button type="button" class="primary-btn" data-account-close>Chiudi</button>';
    return;
   }
   if(form.hasAttribute('data-account-change')){
    const pwd=String(data.get('password')||''),confirm=String(data.get('confirm')||'');
    if(pwd!==confirm)throw Error('Le password non coincidono');
    if(pwd.length<10||pwd.length>128)throw Error('La password deve contenere da 10 a 128 caratteri');
    await changePassword(pwd);
    if(ctx.state.identity.profile)ctx.state.identity.profile.must_change_password=false;
    document.getElementById('tm-account-dialog')?.remove();ctx.render();ctx.toast('Password aggiornata');return;
   }
   if(form.hasAttribute('data-account-profile')){
    const display=String(data.get('display_name')||'').trim();
    const res=await rpc('tm_app_update_profile',{p_display_name:display});
    if(ctx.state.identity.profile)ctx.state.identity.profile.display_name=res.display_name;
    ctx.render();ctx.toast('Profilo aggiornato');
   }
  }catch(ex){formError(form,ex.message||ex)}finally{form.dataset.busy='false';if(button)button.disabled=false}
 });
}
