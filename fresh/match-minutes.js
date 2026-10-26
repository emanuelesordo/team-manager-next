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
 const numeric=Number(period);
 if(Number.isInteger(numeric)&&numeric>0)return (numeric-1)*length;
 const match=String(period||'').match(/^period_(\d+)$/);
 if(match)return (Math.max(1,Number(match[1]))-1)*length;
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
 // A completed second-half period may already store the absolute end minute.
 // Do not add the first-half offset again (80+8 must not become 120+8).
 const periods=Number(competition?.periods)||2;
 const lastPeriodEnd=event?.event_type==='period_end'&&
  event?.payload?.period==='second_half'&&
  n>=length*periods;
 if(length!==null&&legacyRelativeMinute(event)&&!lastPeriodEnd)return n+length;
 return n;
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
 if(n===null)return missing;
 const length=matchPeriodLength(competition);
 if(event?.payload?.period==='halftime'&&length!==null)return String(length+1)+'′';
 const stoppage=Number(event?.stoppage_minute)||0;
 if(stoppage>0)return String(n)+'+'+stoppage+'′';
 let shown=n;
 const delta=Number(event?.timing_delta_seconds);
 const liveNow=event?.payload?.entered_from==='tm_app_live'&&event?.payload?.minute_mode==='now_estimated';
 // Live display uses the started minute by excess: 40:00 stays 40', 40:01..40:59 shows 41'.
 // Keep manual/historic corrections untouched; old live rows can use their captured timing remainder.
 if(liveNow&&Number.isFinite(delta)&&delta>0&&delta<60)shown=n+1;
 return String(shown)+'′';
}

/** Resolve legacy unknown-period events after a trusted minute was supplied.
 * A missing minute stays unplaced; a known cumulative minute is placed into its period.
 * Explicit timeline period overrides are handled by the calling timeline.
 */
export function timelinePeriodFromMinute(event,competition){
 const minute=cumulativeEventMinute(event,competition);
 if(minute===null)return 0;
 const length=matchPeriodLength(competition);
 if(length===null)return 0;
 return Math.max(1,Math.ceil(Math.max(1,minute)/length));
}
