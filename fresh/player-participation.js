import {cumulativeEventMinute} from './match-minutes.js';

const key=x=>String(x??'');
export const confirmedMatchEvent=e=>['official','community_confirmed'].includes(e?.validation_status);

/** Physical elapsed time includes effective (rather than announced) stoppage time.
 * Displayed football minutes remain independent of these elapsed seconds/minutes.
 */
export function matchTiming(match,competition,events=[]){
 const length=Number(match?.minutes_per_period_override??competition?.minutes_per_period);
 const periods=Number(match?.periods_override??competition?.periods??2);
 const half=Number.isFinite(length)&&length>0?length:40;
 const count=Number.isInteger(periods)&&periods>0?periods:2;
 const recoveryByPeriod=Array.from({length:count},()=>0);
 const last=new Map();
 for(const e of events){
  if(!confirmedMatchEvent(e)||e.event_type!=='period_end')continue;
  const period=e.payload?.period;
  const index=period==='first_half'?0:period==='second_half'?1:Number.isInteger(Number(e.payload?.period_no))?Number(e.payload.period_no)-1:-1;
  if(index<0||index>=count)continue;
  const raw=e.payload?.recovery_actual??e.payload?.recovery_minutes??e.stoppage_minute;
  const value=Number(raw);
  if(Number.isFinite(value)&&value>=0)last.set(index,value);
 }
 for(const [index,value] of last)recoveryByPeriod[index]=value;
 const duration=half*count+recoveryByPeriod.reduce((n,x)=>n+x,0);
 return {half,periods:count,recoveryByPeriod,duration};
}

/** Converts an event into real elapsed match time, with second-half recovery offset.
 * Legacy imported events may have period-relative minutes; live events are cumulative.
 * Returns null for impossible or missing timestamps rather than clamping to full time.
 */
export function matchElapsedMinute(event,competition,timing){
 const half=timing.half;
 const period=event?.payload?.period;
 if(period==='halftime')return half+(timing.recoveryByPeriod[0]||0);
 let n=cumulativeEventMinute(event,{...competition,minutes_per_period:half});
 if(n===null){
  if(event?.event_type==='period_end'&&period==='first_half')return half+(timing.recoveryByPeriod[0]||0);
  if(event?.event_type==='period_end'&&period==='second_half')return timing.duration;
  return null;
 }
 if(!Number.isFinite(n)||n<0)return null;
 const pno=Number(event?.payload?.period_no);
 const isSecond=period==='second_half'||pno===2||(n>half&&period!=='first_half');
 if(isSecond)n+=timing.recoveryByPeriod[0]||0;
 const stoppage=Number(event?.stoppage_minute);
 if(Number.isFinite(stoppage)&&stoppage>0)n+=stoppage;
 return n>=0&&n<=timing.duration? n:null;
}

function ourEvent(e,match){
 if(e.team_side==='team')return true;
 if(e.team_side==='opponent')return false;
 return (e.team_side==='home'&&match.home_away==='home')||
   (e.team_side==='away'&&match.home_away==='away');
}

/** One canonical participation timeline shared by Rosa and player intelligence.
 * A missing or impossible team substitution prevents claims of exact playtime.
 */
export function matchPlayerIntervals(match,players=[],events=[],competition={}){
 const rows=players.filter(p=>p.player_id!=null);
 const timing=matchTiming(match,competition,events);
 const starts=new Map(),intervals=new Map(),entered=new Set(), roster=new Set();
 for(const p of rows){
  const id=key(p.player_id);roster.add(id);intervals.set(id,[]);
  if(p.started===true)starts.set(id,0);
 }
 let valid=true;
 const timeline=events.filter(e=>confirmedMatchEvent(e)&&ourEvent(e,match)&&
  ['substitution','red_card','second_yellow','blue_card','blue_return','temporary_return','return_from_blue'].includes(e.event_type))
  .map(e=>({event:e,time:matchElapsedMinute(e,competition,timing)}))
  .sort((a,b)=>(a.time??Infinity)-(b.time??Infinity)||key(a.event.created_at).localeCompare(key(b.event.created_at)));
 for(const {event:e,time} of timeline){
  if(time===null){valid=false;continue}
  const out=key(e.player_id),inId=key(e.secondary_player_id);
  if(e.event_type==='substitution'){
   if(!e.player_id||!e.secondary_player_id||out===inId||!roster.has(out)||!roster.has(inId)){valid=false;continue}
   entered.add(inId);
   if(!starts.has(out)||starts.has(inId)){valid=false;continue}
   intervals.get(out).push([starts.get(out),time]);starts.delete(out);starts.set(inId,time);
  }else{
   if(!e.player_id||!roster.has(out)){valid=false;continue}
   if(['blue_return','temporary_return','return_from_blue'].includes(e.event_type)){
    if(starts.has(out)){valid=false;continue}
    starts.set(out,time);
   }else if(starts.has(out)){
    // A second-yellow and its derived red card may share an instant.
    intervals.get(out).push([starts.get(out),time]);starts.delete(out);
   }else if(e.event_type==='blue_card'){
    valid=false;
   }
  }
 }
 for(const [id,start] of starts)intervals.get(id).push([start,timing.duration]);
 const result=new Map();
 for(const p of rows){
  const id=key(p.player_id),parts=intervals.get(id)||[];
  const minutes=parts.reduce((n,[a,b])=>n+b-a,0);
  const explicit=p.minutes_played==null?null:Number(p.minutes_played);
  const ok=valid&&parts.every(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&a<=b)
   &&(!Number.isFinite(explicit)||explicit===null||Math.abs(minutes-explicit)<=2);
  result.set(id,{intervals:ok?parts:[],minutes:ok?Math.round(minutes):null,valid:ok,
   started:p.started===true,entered:entered.has(id),duration:timing.duration,timing});
 }
 return {players:result,timing,valid};
}
