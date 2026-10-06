import {cumulativeEventMinute,matchPeriodLength} from './match-minutes.js';

const finite=n=>Number.isFinite(Number(n));
const periodNo=e=>{
 const explicit=Number(e?.payload?.period_no);
 if(Number.isInteger(explicit)&&explicit>0)return explicit;
 const p=e?.payload?.period;
 if(p==='second_half'||p==='halftime')return 2;
 if(p==='extra')return 3;
 return 1;
};

export function weightedTeamRating({match,matchPlayers=[],events=[],ratings=[],competition={}}={}){
 if(!match)return null;
 const half=Number(match?.minutes_per_period_override)||matchPeriodLength(competition)||40;
 const periods=Math.max(1,Number(match?.periods_override||competition?.periods||2));
 const validEvents=(events||[]).filter(e=>e.validation_status!=='rejected');
 const recoveryByPeriod=new Map();
 for(const e of validEvents){
  if(e.event_type!=='period_end')continue;
  const p=Math.max(1,Number(e.payload?.period_no)||periodNo(e));
  const declared=Number(e.payload?.recovery_declared)||0;
  const saved=Number(e.payload?.recovery_minutes??e.stoppage_minute)||0;
  recoveryByPeriod.set(p,declared>0?declared:saved);
 }
 const recoveryBefore=p=>{
  let total=0;
  for(let n=1;n<p;n++)total+=Number(recoveryByPeriod.get(n)||0);
  return total;
 };
 const regulationEnd=periods*half;
 const totalRecovery=Array.from({length:periods},(_,i)=>Number(recoveryByPeriod.get(i+1)||0)).reduce((a,b)=>a+b,0);
 const end=regulationEnd+totalRecovery;
 const eventTime=e=>{
  const cumulative=cumulativeEventMinute(e,{...competition,minutes_per_period:half});
  if(cumulative==null)return null;
  const p=Math.max(1,periodNo(e));
  const stoppage=Math.max(0,Number(e.stoppage_minute)||0);
  const periodBase=(p-1)*half;
  const atEnd=cumulative>=p*half;
  return Math.max(0,Math.min(end,cumulative+recoveryBefore(p)+(atEnd?stoppage:0)));
 };

 const starters=new Set((matchPlayers||[]).filter(p=>p.started||p.selection_status==='starter').map(p=>String(p.player_id)));
 const field=new Set(starters),minutes=new Map([...starters].map(id=>[id,0]));
 const ordered=validEvents
  .map((e,i)=>({e,t:eventTime(e),i}))
  .filter(x=>x.t!=null&&x.e.event_type!=='period_end')
  .sort((a,b)=>a.t-b.t||String(a.e.created_at||'').localeCompare(String(b.e.created_at||''))||a.i-b.i);
 let cursor=0;
 const addUntil=until=>{
  const next=Math.max(cursor,Math.min(end,until));
  const delta=Math.max(0,next-cursor);
  field.forEach(id=>minutes.set(id,(minutes.get(id)||0)+delta));
  cursor=next;
 };
 for(const {e,t} of ordered){
  addUntil(t);
  if(e.team_side!=='team')continue;
  const pid=e.player_id==null?null:String(e.player_id);
  if(e.event_type==='substitution'){
   if(pid)field.delete(pid);
   if(e.secondary_player_id!=null){
    const incoming=String(e.secondary_player_id);
    field.add(incoming);if(!minutes.has(incoming))minutes.set(incoming,0);
   }
  }else if(e.event_type==='red_card'){
   if(pid)field.delete(pid);
  }else if(e.event_type==='blue_card'){
   if(pid)field.delete(pid);
  }else if(['blue_return','temporary_return','return_from_blue'].includes(e.event_type)){
   if(pid){field.add(pid);if(!minutes.has(pid))minutes.set(pid,0);}
  }
 }
 addUntil(end);

 const votes=new Map();
 for(const r of ratings||[]){
  if(!finite(r.rating))continue;
  const rating=Number(r.rating);if(rating<1||rating>10)continue;
  const id=String(r.player_id);
  if(!votes.has(id))votes.set(id,[]);
  votes.get(id).push(rating);
 }
 let weighted=0,weight=0;
 votes.forEach((values,id)=>{
  const mins=Number(minutes.get(id)||0);
  if(mins<=0)return;
  const avg=values.reduce((a,b)=>a+b,0)/values.length;
  weighted+=avg*mins;weight+=mins;
 });
 return weight>0?weighted/weight:null;
}
