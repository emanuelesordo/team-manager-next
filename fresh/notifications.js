import {get,hasSession,markNotificationRead} from './api.js';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const NOTIFICATION_REFRESH_MS=5*60*1000;
let cached={user:null,team:null,at:0,items:[]};
let loading=null,installed=false,getContext=null,pollTimer=null;
export function notificationList(items){
 if(!items.length)return '<p class="empty">Non ci sono notifiche per questo account.</p>';
 return '<div class="notifications-list">'+items.map(n=>{
  const day=n.created_at?new Date(n.created_at).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'}):'';
  return '<article class="notification-entry'+(n.read_at?'':' unread')+'">'+
   '<div><strong>'+E(n.title||'Aggiornamento')+'</strong><small>'+E(day)+'</small></div>'+
   (n.body?'<p>'+E(n.body)+'</p>':'')+
   (n.read_at?'<span class="notification-read">Letta</span>':'<button type="button" class="soft-btn" data-notification-mark="'+E(n.id)+'">Segna come letta</button>')+'</article>';
 }).join('')+'</div>';
}
function paintBadge(){
 const b=document.querySelector('[data-notification-badge]');
 if(!b)return;const unread=cached.items.filter(x=>!x.read_at).length;
 b.hidden=!unread;b.textContent=String(unread>9?'9+':unread);
}
export async function syncNotificationBell(ctx,force=false){
 const id=ctx.state.identity?.user,team=ctx.state.base?.team?.id;
 if(!hasSession()||!id||!team)return;
 if(cached.user!==id||cached.team!==team)cached={user:id,team,at:0,items:[]};
 if(loading)return loading;
 if(!force&&Date.now()-cached.at<NOTIFICATION_REFRESH_MS){paintBadge();return cached.items}
 loading=get('team_notifications',
  'select=id,title,body,notification_type,entity_type,entity_id,read_at,created_at&recipient_profile_id=eq.'+
    encodeURIComponent(id)+'&team_id=eq.'+encodeURIComponent(team)+'&order=created_at.desc&limit=50')
  .then(rows=>{cached.at=Date.now();cached.items=rows;paintBadge();return rows})
  .catch(err=>{cached.at=Date.now();console.warn('Notifiche non accessibili:',err.message);return cached.items})
  .finally(()=>{loading=null});
 return loading;
}
function openPanel(ctx){
 const old=document.getElementById('tm-notifications');old?.remove();
 const node=document.createElement('div');node.id='tm-notifications';node.className='overlay notifications-overlay';
 node.innerHTML='<section role="dialog" aria-modal="true" aria-label="Notifiche" class="overlay-card">'+
 '<button class="close-overlay" type="button" data-notification-close aria-label="Chiudi">×</button>'+
 '<span class="eyebrow">MESSAGGI DI SQUADRA</span><h2>Notifiche</h2>'+
 '<div data-notification-list>'+notificationList(cached.items)+'</div></section>';
 document.body.append(node);
}
function refreshInstalledBell(force=false){
 if(document.hidden||!hasSession()||!getContext)return;
 const ctx=getContext();
 if(!ctx?.state?.identity?.user)return;
 void syncNotificationBell(ctx,force);
}
export function installNotifications(provider){
 if(installed)return;installed=true;getContext=provider;
 document.addEventListener('click',async e=>{
  const target=e.target.closest('[data-notifications-open],[data-notification-close],[data-notification-mark]');if(!target)return;
  if(target.hasAttribute('data-notification-close')){document.getElementById('tm-notifications')?.remove();return}
  const ctx=getContext();if(!hasSession()||!ctx.state.identity?.user)return;
  if(target.hasAttribute('data-notifications-open')){await syncNotificationBell(ctx,true);openPanel(ctx);return}
  if(target.hasAttribute('data-notification-mark')){
   const id=target.dataset.notificationMark,row=cached.items.find(n=>n.id===id);
   if(!row||row.read_at)return;
   target.disabled=true;
   try{const server=await markNotificationRead(id,ctx.state.identity.user);
    row.read_at=server?.read_at||new Date().toISOString();
    const list=document.querySelector('[data-notification-list]');
    if(list)list.innerHTML=notificationList(cached.items);paintBadge();
   }catch(ex){ctx.toast('Notifica non aggiornata: '+ex.message);target.disabled=false}
  }
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('tm-notifications')?.remove()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshInstalledBell(false)});
 clearInterval(pollTimer);
 pollTimer=setInterval(()=>refreshInstalledBell(false),NOTIFICATION_REFRESH_MS);
}
export function resetNotifications(){
 cached={user:null,team:null,at:0,items:[]};
 document.getElementById('tm-notifications')?.remove();
}
