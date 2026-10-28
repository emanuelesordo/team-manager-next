/** Player/tournament carousel arithmetic, independent of DOM offset parents. */
export function nextStatSlide(current,delta,length){
 const size=Math.max(0,Number(length)||0);
 if(!size)return 0;
 return Math.max(0,Math.min(size-1,Math.trunc(Number(current)||0)+Math.trunc(Number(delta)||0)));
}
export function nearestStatSlide(offsets=[],scrollLeft=0){
 if(!offsets.length)return 0;
 const start=Number(offsets[0])||0;
 const position=Number(scrollLeft)||0;
 return offsets.reduce((best,value,i)=>
  Math.abs((Number(value)||0)-start-position)<Math.abs((Number(offsets[best])||0)-start-position)?i:best,0);
}
export function statSlideOffset(offsets=[],index=0){
 if(!offsets.length)return 0;
 const first=Number(offsets[0])||0;
 return Math.max(0,(Number(offsets[nextStatSlide(0,index,offsets.length)])||first)-first);
}
