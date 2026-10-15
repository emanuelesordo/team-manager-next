const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=1&&Number(v)<=10;
export function ratingTimeline(rows=[],{title='Media rating',empty='Nessuna valutazione disponibile'}={}){
 const games=[...rows].filter(r=>r?.kickoff_at).sort((a,b)=>Date.parse(a.kickoff_at)-Date.parse(b.kickoff_at)).slice(-5);
 if(!games.length||!games.some(r=>valid(r.rating)))return '<p class="empty">'+E(empty)+'</p>';
 const vals=games.filter(r=>valid(r.rating)),avg=vals.reduce((n,r)=>n+Number(r.rating),0)/vals.length;
 const min=4,max=10,y=v=>Math.max(0,Math.min(100,(max-Number(v))/(max-min)*100));
 const shade=v=>Number(v)>=7.5?'high':Number(v)>=6.5?'good':Number(v)>=6?'mid':'low';
 const label=n=>Number(n).toLocaleString('it-IT',{maximumFractionDigits:2});
 return '<section class="rt-chart" aria-label="'+E(title)+'">'+
  '<div class="rt-heading"><span>'+E(title)+'</span><b>'+label(avg)+'</b></div>'+
  '<div class="rt-scroll"><div class="rt-columns" style="--rt-items:'+games.length+'">'+
  '<div class="rt-average-line" style="top:calc(83px + '+y(avg)+' * 1.68px)"></div>'+
  games.map(row=>{
   const value=valid(row.rating)?Number(row.rating):null;
   const when=new Date(row.kickoff_at).toLocaleDateString('it-IT',{day:'numeric',month:'short',timeZone:'Europe/Rome'});
   return '<div class="rt-column" title="'+E((row.opponent||'Avversaria')+' · '+when+' · '+(value===null?'SV':label(value)))+'">'+
    '<div class="rt-date">'+E(when)+'</div>'+
    '<div class="rt-opponent">'+(row.logo?'<img src="'+E(row.logo)+'" alt="'+E(row.opponent||'Avversaria')+'" loading="lazy">':'<span>'+E((row.opponent||'?').slice(0,3).toUpperCase())+'</span>')+'</div>'+
    '<div class="rt-plot">'+(value!==null?'<b class="rt-value '+shade(value)+'" style="top:'+y(value)+'%">'+label(value)+'</b>':'<span class="rt-unrated">SV</span>')+'</div></div>';
  }).join('')+'</div></div><p class="rt-foot">Media sulle '+vals.length+' gare valutate · scala 4–10 · SV esclusi</p></section>';
}
