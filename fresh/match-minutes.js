/** Cumulative match minute, shared by all Match Center read/write views.
 * Legacy imported events store a second-half-relative minute with payload.period;
 * live events (entered_from=tm_app_live) already store the cumulative minute.
 */
export const matchPeriodLength=competition=>{
 const n=Number(competition?.minutes_per_period);
 return Number.isFinite(n)&&n>0?n:null;
};
export const legacyRelativeMinute=event=>event?.payload?.period==='second_half' &&
 event?.payload?.minute_relative!==false && event?.payload?.entered_from!=='tm_app_live';

export function livePeriodOffset(period,competition){
 const length=matchPeriodLength(competition);
 if(length===null)throw Error('Durata della competizione non disponibile');
 if(period==='second_half')return length;
 if(period==='extra')return 2*length;
 return 0;
}
export function cumulativeMinuteFromPeriod(minute,period,competition){
 if(minute===null||minute===undefined||minute==='')return null;
 const n=Number(minute);
 if(!Number.isInteger(n)||n<0||n>300)throw Error('Minuto del periodo non valido');
 return n+livePeriodOffset(period,competition);
}
export function periodRelativeMinute(cumulative,period,competition){
 if(cumulative===null||cumulative===undefined||cumulative==='')return null;
 const n=Number(cumulative);
 if(!Number.isFinite(n))return null;
 return Math.max(0,n-livePeriodOffset(period,competition));
}
export function cumulativeEventMinute(event,competition){
 if(event?.minute===null||event?.minute===undefined||event.minute==='')return null;
 const n=Number(event.minute);if(!Number.isFinite(n))return null;
 const length=matchPeriodLength(competition);
 return length!==null&&legacyRelativeMinute(event)?n+length:n;
}
export function storedEventMinute(event,cumulative,competition){
 if(cumulative===null||cumulative===undefined||cumulative==='')return null;
 const n=Number(cumulative);
 if(!Number.isInteger(n)||n<0||n>300)throw Error('Minuto cumulativo non valido');
 const length=matchPeriodLength(competition);
 if(legacyRelativeMinute(event)){
  if(length===null)throw Error('Durata della competizione non disponibile');
  if(n<length)throw Error('Un evento del secondo tempo non può precedere il primo tempo');
  return n-length;
 }
 return n;
}
export function displayEventMinute(event,competition,missing='—'){
 const n=cumulativeEventMinute(event,competition);
 return n===null?missing:String(n)+(Number(event?.stoppage_minute)>0?'+'+Number(event.stoppage_minute):'')+'′';
}
