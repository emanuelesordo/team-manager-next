import {API_URL,PUBLISHABLE_KEY} from './config.js';
const SESSION_KEY='tm_next_session';
let session=null;
try{session=JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{localStorage.removeItem(SESSION_KEY)}
const unauthorized=e=>[401,403].includes(e.status);
const headers=()=>({'apikey':PUBLISHABLE_KEY,'Authorization':'Bearer '+(session?.access_token||PUBLISHABLE_KEY),'Accept':'application/json'});
async function call(path,{method='GET',body,signal,extraHeaders={}}={}){
 const response=await fetch(API_URL+path,{method,headers:{...headers(),...extraHeaders,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal,cache:'no-store'});
 const data=await response.json().catch(()=>null);
 if(!response.ok){const err=new Error(data?.message||data?.error_description||data?.error||'Richiesta non riuscita');err.status=response.status;throw err}
 return data;
}
async function refresh(){
 if(!session?.refresh_token)return false;
 try{const s=await call('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});
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
 const rows=await Promise.allSettled([get('app_user_roles','select=user_id,role,player_id&user_id=eq.'+id),get('profiles','select=id,display_name,username& id=eq.'+id).catch(()=>[])]);
 return {user:id,role:rows[0].status==='fulfilled'?rows[0].value[0]||null:null,profile:rows[1].status==='fulfilled'?rows[1].value[0]||null:null};
}
export async function loadBase(){
 const [t,s,o]=await Promise.all([get('teams','select=id,name,short_name,logo_url,primary_color,secondary_color,accent_color,home_venue_name&limit=10'),get('app_seasons','select=id,team_id,name,status,start_date,end_date&order=start_date.desc'),get('app_opponents','select=id,name,short_name,logo_url,primary_color,secondary_color')]);
 const current=s.find(x=>x.status==='active')||s[0],team=t.find(x=>x.id===current?.team_id)||t[0];
 if(!current||!team)throw Error('Squadra o stagione non configurata');
 return {team,seasons:s,opponents:o};
}
export async function loadSeason(id){
 const requests={
  competitions:['app_competitions','select=*&season_id=eq.'+id],
  fixtures:['app_competition_fixtures','select=*&season_id=eq.'+id+'&order=kickoff_at.asc&limit=1000'],
  standings:['app_competition_standings','select=*&season_id=eq.'+id],
  roster:['app_roster','select=*&season_id=eq.'+id],
  playerStats:['app_player_season_stats','select=*&season_id=eq.'+id],
  matches:['app_matches','select=*&season_id=eq.'+id],
  players:['players','select=id,team_id,first_name,last_name,photo_url,generic_role_manual,preferred_foot,height_cm,birth_date,nationality_code&limit=1000']
 };
 const names=Object.keys(requests),arr=await Promise.allSettled(names.map(k=>get(...requests[k])));
 const output={errors:{}};
 names.forEach((n,i)=>{const x=arr[i];output[n]=x.status==='fulfilled'?x.value:[];if(x.status==='rejected')output.errors[n]=x.reason.message});
 return output;
}
export async function loadMatchInfo(matchId){
 if(!matchId)return {players:[],events:[],ratings:[],errors:{}};
 const params={players:['app_match_players','select=*&match_id=eq.'+matchId],events:['app_match_events','select=*&match_id=eq.'+matchId+'&order=minute.asc.nullslast,created_at.asc'],ratings:['app_match_ratings','select=*&match_id=eq.'+matchId]};
 const names=Object.keys(params),results=await Promise.allSettled(names.map(x=>get(...params[x])));
 const data={errors:{}};names.forEach((k,i)=>{data[k]=results[i].status==='fulfilled'?results[i].value:[];if(results[i].status==='rejected')data.errors[k]=results[i].reason.message});
 return data;
}
