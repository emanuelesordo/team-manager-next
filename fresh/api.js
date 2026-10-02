import {API_URL,PUBLISHABLE_KEY} from './config.js';
import {fixtureOnlyEvent} from './canonical-events.js';
const SESSION_KEY='tm_next_session';
let session=null;
try{session=JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{localStorage.removeItem(SESSION_KEY)}
const unauthorized=e=>[401,403].includes(e.status);
const headers=()=>({'apikey':PUBLISHABLE_KEY,...(session?.access_token?{'Authorization':'Bearer '+session.access_token}:{}),'Accept':'application/json'});
async function call(path,{method='GET',body,signal,extraHeaders={}}={}){
 const response=await fetch(API_URL+path,{method,headers:{...headers(),...extraHeaders,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal,cache:'no-store'});
 const data=await response.json().catch(()=>null);
 if(!response.ok){const err=new Error(data?.message||data?.error_description||data?.error||'Richiesta non riuscita');err.status=response.status;throw err}
 return data;
}
async function refresh(){
 if(!session?.refresh_token)return false;
 try{const s=await call('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token},extraHeaders:{}});
   session={...session,...s};localStorage.setItem(SESSION_KEY,JSON.stringify(session));return true;
 }catch{session=null;localStorage.removeItem(SESSION_KEY);return false}
}
let refreshPromise;
async function authorized(path,options){
 try{return await call(path,options)}
 catch(e){if(e.status!==401||!session?.refresh_token)throw e;
  refreshPromise??=refresh().finally(()=>refreshPromise=null);
  if(!await refreshPromise)throw e;
  return call(path,options)
 }
}
export const hasSession=()=>Boolean(session?.access_token);
export const userId=()=>{try{return JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub}catch{return null}};
export async function get(table,query='',signal){
 const u=new URL(API_URL+'/rest/v1/'+table);
 if(query)for(const [key,value] of new URLSearchParams(query))u.searchParams.set(key,value);
 return authorized(u.pathname+u.search,{signal});
}
export async function login(username,password){
 const answer=await call('/functions/v1/auth-login',{method:'POST',body:{username,password}});
 if(!answer?.ok||!answer.session)throw new Error(answer?.error||'Credenziali non valide');
 session=answer.session;localStorage.setItem(SESSION_KEY,JSON.stringify(session));
 return answer.profile||null;
}
export async function logout(){
 if(session?.access_token)await call('/auth/v1/logout',{method:'POST'}).catch(()=>{});
 session=null;localStorage.removeItem(SESSION_KEY);
}
export async function loadIdentity(){
 if(!hasSession())return {user:null,role:null,profile:null};
 const id=userId();if(!id)return {user:null,role:null,profile:null};
 const rows=await Promise.allSettled([get('app_user_roles','select=user_id,role,player_id&user_id=eq.'+id),get('profiles','select=id,display_name,username,is_active,must_change_password&id=eq.'+id).catch(()=>[])]);
 const role=rows[0].status==='fulfilled'?rows[0].value[0]||null:null;
 const profile=rows[1].status==='fulfilled'?rows[1].value[0]||null:null;
 if(profile?.is_active===false){await logout();return {user:null,role:null,profile:null,disabled:true}}
 return {user:id,role,profile};
}
export async function loadBase(){
 const query='select=id,name,short_name,logo_url,primary_color,secondary_color,accent_color,home_venue_name&limit=10';
 const [publicTeams,s,o]=await Promise.all([get('tm_public_teams',query),get('app_seasons','select=id,team_id,name,status,start_date,end_date&order=start_date.desc'),get('app_opponents','select=id,name,short_name,logo_url,primary_color,secondary_color')]);
 const t=publicTeams.length?publicTeams:hasSession()?await get('teams',query):[];
 const current=s.find(x=>x.status==='active')||s[0],team=t.find(x=>x.id===current?.team_id)||t[0];
 if(!current||!team)throw Error('Squadra o stagione non configurata');
 return {team,seasons:s,opponents:o};
}
export async function loadSeason(id,includePrivate=false,includeAdmin=false){
 const requests={
  competitions:['app_competitions','select=*&season_id=eq.'+id],
  competitionOpponents:['app_competition_opponents','select=competition_id,opponent_id&limit=1000'],
  fixtures:['app_competition_fixtures','select=*&season_id=eq.'+id+'&order=kickoff_at.asc&limit=1000'],
  standings:['app_competition_standings','select=*&season_id=eq.'+id],
  roster:['app_roster','select=*&season_id=eq.'+id],
  playerStats:['app_player_season_stats','select=*&season_id=eq.'+id],
  habitual:['tm_player_habitual_shirts','select=player_id,shirt_number,occurrences,last_used&limit=1000'],
  matches:['app_matches','select=*&season_id=eq.'+id],
  players:['players','select=id,team_id,first_name,last_name,photo_url,generic_role_manual,preferred_foot,height_cm,birth_date,nationality_code&limit=1000']
 };
 if(includePrivate)Object.assign(requests,{
  generalCompetitions:['competitions','select=id,name,season_id&limit=300'],
  competitionLinks:['tm_app_competition_links','select=app_competition_id,general_competition_id&limit=300'],
  generalSeasons:['seasons','select=id,team_id,name,start_date,end_date&order=start_date.desc'],
  injuries:['injuries','select=*&order=injury_date.desc&limit=500'],
  suspensions:['suspensions','select=*&order=issued_date.desc&limit=500']
 });
 if(includeAdmin)Object.assign(requests,{profiles:['profiles','select=id,username,display_name,is_active,must_change_password&limit=200'],passwordRequests:['tm_password_reset_requests','select=id,user_id,status,requested_at,reviewed_at&order=requested_at.desc&limit=200'],userRoles:['app_user_roles','select=user_id,role,player_id&limit=300']});
 const names=Object.keys(requests),arr=await Promise.allSettled(names.map(k=>get(...requests[k])));
 const output={errors:{}};
 names.forEach((n,i)=>{const x=arr[i];output[n]=x.status==='fulfilled'?x.value:[];if(x.status==='rejected')output.errors[n]=x.reason.message});
 return output;
}
/** Source-separated calendar timeline. */
/** Read fixture-only events from the same physical events table as the Match Center. */
export async function loadFixtureEvents(fixtureId){
 if(!fixtureId)return [];
 const rows=await get('app_match_events',
  'select=id,fixture_id,match_id,event_type,minute,stoppage_minute,team_side,source,payload,source_raw,created_at,validation_status&fixture_id=eq.'+
  encodeURIComponent(fixtureId)+'&match_id=is.null&order=minute.asc.nullslast,created_at.asc&limit=250');
 return rows.map(fixtureOnlyEvent);
}

export async function loadMatchInfo(matchId){
 if(!matchId)return {players:[],events:[],ratings:[],ratingMeans:[],tacticalChanges:[],errors:{}};
 const params={players:['app_match_players','select=*&match_id=eq.'+matchId],events:['app_match_events','select=*&match_id=eq.'+matchId+'&order=minute.asc.nullslast,created_at.asc'],ratings:['app_match_ratings','select=*&match_id=eq.'+matchId],ratingMeans:['tm_player_recent_votes','select=player_id,avg_rating,votes,sv&match_id=eq.'+matchId],tacticalChanges:['app_match_tactical_changes','select=*&match_id=eq.'+matchId+'&order=minute.asc,created_at.asc']};
 const names=Object.keys(params),results=await Promise.allSettled(names.map(x=>get(...params[x])));
 const data={errors:{}};names.forEach((k,i)=>{data[k]=results[i].status==='fulfilled'?results[i].value:[];if(results[i].status==='rejected')data.errors[k]=results[i].reason.message});
 return data;
}

/** Scrittura transazionale del record ufficiale, con autorizzazione RLS server-side. */
export async function saveFixture(id,fields){
 const {home_score,away_score,status}=fields;
 if(!id||!['scheduled','live','finished'].includes(status))throw Error('Stato partita non valido');
 if(![home_score,away_score].every(x=>x===null||(Number.isInteger(x)&&x>=0&&x<=99)))throw Error('Punteggio non valido');
 if(status==='finished'&&(home_score===null||away_score===null))throw Error('Inserisci entrambi i punteggi');
 const result=await authorized('/rest/v1/app_competition_fixtures?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:fields,extraHeaders:{Prefer:'return=representation'}});
 if(!Array.isArray(result)||result.length!==1)throw Error('Nessuna partita aggiornata. Controlla i permessi.');
 return result[0];
}

/** RPC server-side: autorizzazioni verificate da Supabase, non dal frontend. */
export async function rpc(functionName,args={}){
 if(!/^[a-z_]+$/.test(functionName))throw new Error('Funzione non valida');
 if(!hasSession())throw new Error('Effettua l’accesso per modificare i dati');
 return authorized('/rest/v1/rpc/'+functionName,{method:'POST',body:args});
}
/** Mutazioni RLS su tabelle esplicitamente consentite alla console admin. */
const EDIT_TABLES=new Set(['teams','app_seasons','app_competitions','app_opponents',
 'players','app_roster','app_competition_fixtures','injuries','suspensions']);
export async function adminWrite(table,method,values,where={}){
 if(!EDIT_TABLES.has(table)||!['POST','PATCH'].includes(method))throw new Error('Operazione non prevista');
 if(!hasSession())throw new Error('Accesso richiesto');
 if(method==='PATCH'&&(!Object.keys(where).length||!where.id))throw new Error('ID mancante');
 const q=new URLSearchParams();
 for(const [k,v] of Object.entries(where))q.set(k,'eq.'+String(v));
 const path='/rest/v1/'+table+(q.size?'?'+q.toString():'');
 return authorized(path,{method,body:values,extraHeaders:{Prefer:'return=representation'}});
}

/** Edge action: admin auth validated by the deployed server function. */
export async function reviewPasswordRequest(request_id,decision){
 if(!hasSession())throw new Error('Accesso richiesto');
 if(!['resolve','reject'].includes(decision))throw new Error('Decisione non valida');
 const response=await authorized('/functions/v1/tm-password-admin',
  {method:'POST',body:{request_id,decision}});
 if(!response?.ok)throw new Error(response?.error||'Richiesta non gestita');
 return response;
}


/** Endpoints for password self-service; user enumeration is prevented server-side. */
export async function requestPassword(username){
 const normalized=String(username??'').trim().toLowerCase();
 if(!/^[a-z0-9._-]{3,32}$/.test(normalized))throw Error('Username non valido');
 return call('/functions/v1/tm-password-request',{method:'POST',body:{username:normalized}});
}
export async function changePassword(password){
 if(!hasSession())throw Error('Accesso richiesto');
 if(typeof password!=='string'||password.length<10||password.length>128)throw Error('Password: da 10 a 128 caratteri');
 const response=await authorized('/functions/v1/tm-password-change',{method:'POST',body:{password}});
 if(!response?.ok)throw Error(response?.error||'Password non modificata');
 return response;
}

/** Mark own notification read; recipient filter + RLS bind the mutation. */
export async function markNotificationRead(id,user){
 if(!hasSession())throw Error('Accesso richiesto');
 if(!/^[0-9a-f-]{36}$/i.test(String(id))||!/^[0-9a-f-]{36}$/i.test(String(user)))
  throw Error('Notifica o destinatario non valido');
 const rows=await authorized('/rest/v1/team_notifications?id=eq.'+encodeURIComponent(id)+
  '&recipient_profile_id=eq.'+encodeURIComponent(user),{
   method:'PATCH',body:{read_at:new Date().toISOString()},extraHeaders:{Prefer:'return=representation'}
 });
 if(!Array.isArray(rows)||rows.length!==1)throw Error('Notifica non aggiornata');
 return rows[0];
}
