/* Home dashboard: month calendar, linked player trend and transparent form estimate.
   All club association uses team_id/opponent_id FKs. No inferred aliases. */
const escapeText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const clubIdentity=(tid,oid)=>tid?'team:'+tid:oid?'opponent:'+oid:null;
export const ownOpponent=(f,teamId)=>{
 const home=f.home_team_id===teamId,away=f.away_team_id===teamId;
 if(home===away)return null;
 return home?{team_id:f.away_team_id,opponent_id:f.away_opponent_id,name:f.away_team}:
 {team_id:f.home_team_id,opponent_id:f.home_opponent_id,name:f.home_team};
};
const validDate=value=>{const d=new Date(value);return Number.isFinite(d.valueOf())?d:null};
export function monthIndex(value=new Date(),timezone='Europe/Rome'){
 const date=validDate(value);if(!date)return 0;
 const pts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'numeric'}).formatToParts(date);
 return Number(pts.find(p=>p.type==='year').value)*12+Number(pts.find(p=>p.type==='month').value)-1;
}
export function dateKey(value,timezone='Europe/Rome'){
 const date=validDate(value);if(!date)return '';
 const pts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const p=key=>pts.find(x=>x.type===key)?.value||'';
 return p('year')+'-'+p('month')+'-'+p('day');
}
export function renderMonthCalendar(fixtures,teamId,month,crest,onMonthLabel){
 const year=Math.floor(month/12),m=(month%12+12)%12;
 const first=new Date(Date.UTC(year,m,1,12));
 const count=new Date(Date.UTC(year,m+1,0)).getUTCDate();
 const offset=(first.getUTCDay()+6)%7;
 const cells=Math.ceil((offset+count)/7)*7;
 const entries=new Map();
 for(const f of fixtures){
  const other=ownOpponent(f,teamId);
  if(!other||!f.kickoff_at)continue;
  const day=dateKey(f.kickoff_at);
  if(!day.startsWith(year+'-'+String(m+1).padStart(2,'0')+'-'))continue;
  if(!entries.has(day))entries.set(day,[]);
  entries.get(day).push({f,other});
 }
 const title=new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric',timeZone:'UTC'}).format(first);
 const days=['L','M','M','G','V','S','D'];
 const markup='<div class="month-nav"><h2>'+escapeText(title.charAt(0).toUpperCase()+title.slice(1))+'</h2>'+
  '<div class="month-nav-actions"><button data-home-month="-1" aria-label="Mese precedente" title="Mese precedente">‹</button>'+
  '<button data-home-month="0" aria-label="Mese corrente" title="Torna al mese corrente">Oggi</button>'+
  '<button data-home-month="1" aria-label="Mese successivo" title="Mese successivo">›</button></div></div>'+
  '<div class="month-days" role="grid" aria-label="Partite '+escapeText(title)+'">'+
  days.map(d=>'<span class="month-weekday">'+d+'</span>').join('')+
  Array.from({length:cells},(_,index)=>{
   const d=index-offset+1;if(d<1||d>count)return '<span class="month-cell outside" aria-hidden="true"></span>';
   const key=year+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
   const gameList=entries.get(key)||[];
   return '<div class="month-cell'+(gameList.length?' with-game':'')+'" role="gridcell" aria-label="'+
    escapeText(key+(gameList.length?' · '+gameList.length+' partite':''))+'"><span class="month-number">'+d+'</span>'+
    '<div class="month-matches">'+gameList.map(({f,other})=>
     '<button type="button" data-match="'+escapeText(f.id)+'" title="'+escapeText(
      other.name+' · '+new Intl.DateTimeFormat('it-IT',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Rome'}).format(new Date(f.kickoff_at))
     )+'" aria-label="Apri '+escapeText(other.name)+' il '+d+'">'+
     crest(other.name,'tiny',{team_id:other.team_id,opponent_id:other.opponent_id})+'</button>').join('')+'</div></div>';
  }).join('')+'</div>';
 return markup;
}
export function opponentAdjustedResults(fixtures,teamId,maxRows=5){
 const sorted=fixtures.filter(f=>f.status==='finished'&&Number.isFinite(f.home_score)&&Number.isFinite(f.away_score)&&f.kickoff_at)
  .slice().sort((a,b)=>new Date(a.kickoff_at)-new Date(b.kickoff_at));
 const teamKey='team:'+teamId;
 const history=new Map(),records=[];
 const points=(goals,against)=>goals>against?3:goals===against?1:0;
 for(const f of sorted){
  const home=clubIdentity(f.home_team_id,f.home_opponent_id),away=clubIdentity(f.away_team_id,f.away_opponent_id);
  if(!home||!away||home===away)continue;
  if(home===teamKey||away===teamKey){
   const isHome=home===teamKey,other=isHome?away:home;
   const actual=points(isHome?f.home_score:f.away_score,isHome?f.away_score:f.home_score);
   const h=history.get(teamKey)||[],o=history.get(other)||[];
   // At least two earlier completed games for each club. Never use future matches
   // to estimate previous expectations.
   const expected=h.length>=2&&o.length>=2?
    Math.max(0,Math.min(3,1.5+(h.reduce((a,b)=>a+b,0)/h.length-o.reduce((a,b)=>a+b,0)/o.length)*0.5)):null;
   records.push({fixture_id:f.id,opponent:isHome?f.away_team:f.home_team,date:f.kickoff_at,actual,expected});
  }
  const hp=points(f.home_score,f.away_score),ap=points(f.away_score,f.home_score);
  history.set(home,[...(history.get(home)||[]),hp]);
  history.set(away,[...(history.get(away)||[]),ap]);
 }
 return records.reverse().slice(0,maxRows);
}
export function renderPointsTrend(records){
 if(!records.length)return '<p class="empty">Nessuna partita conclusa per questa stagione.</p>';
 const rows=[...records].reverse();
 const x0=43,width=422,top=22,height=129,y=value=>top+height-(value/3)*height;
 const xs=rows.map((_,i)=>x0+(rows.length===1?width/2:width*i/(rows.length-1)));
 const expected=rows.map((row,i)=>row.expected==null?null:{x:xs[i],y:y(row.expected)}).filter(Boolean);
 const line=expected.length>=2&&expected.length===rows.length?
  '<polyline fill="none" stroke="#9bceff" stroke-width="2.5" stroke-dasharray="6 5" points="'+expected.map(p=>p.x+','+p.y).join(' ')+'"/>':'';
 return '<svg class="home-trend-svg" viewBox="0 0 510 200" role="img" aria-label="Punti conquistati e punti attesi per ciascuna delle ultime partite">'+
 [0,1,2,3].map(v=>'<path d="M43 '+y(v)+'H477" stroke="currentColor" stroke-opacity=".14"/><text x="29" y="'+(y(v)+4)+'" text-anchor="end" fill="currentColor" font-size="12">'+v+'</text>').join('')+
 line+rows.map((row,i)=>{
  const x=xs[i],actualY=y(row.actual);
  return '<circle cx="'+x+'" cy="'+actualY+'" r="6" fill="#b8ff9a"/>'+
   (row.expected!=null?'<circle cx="'+x+'" cy="'+y(row.expected)+'" r="4.5" fill="#9bceff"/>':'')+
   '<text x="'+x+'" y="177" fill="currentColor" text-anchor="middle" font-size="10">'+
   escapeText((row.opponent||'').slice(0,11))+'</text>';
 }).join('')+'</svg><div class="home-trend-legend"><span><i class="actual"></i>Punti ottenuti</span>'+
 '<span><i class="expected"></i>Punti attesi (stima)</span></div>'+
 '<p class="subnote">Stima: 1,5 punti più metà della differenza fra le medie punti delle due squadre prima della gara; servono almeno due incontri precedenti per parte. Non è una previsione ufficiale.</p>';
}
export function renderPlayerRatingTrend(rows){
 const valid=(rows||[]).filter(r=>r.avg_rating!=null&&Number.isFinite(Number(r.avg_rating))).slice().reverse();
 if(!valid.length)return '<p class="empty">Nessuna valutazione ufficiale disponibile per questo giocatore.</p>';
 const x0=32,dx=valid.length===1?0:392/(valid.length-1),y=n=>148-Math.max(0,Math.min(10,n))*12;
 const pts=valid.map((r,i)=>({x:valid.length===1?228:x0+i*dx,y:y(Number(r.avg_rating))}));
 return '<svg class="home-trend-svg" viewBox="0 0 455 183" role="img" aria-label="Valutazioni del giocatore nelle ultime partite">'+
  [0,5,10].map(n=>'<path d="M32 '+y(n)+'H424" stroke="currentColor" stroke-opacity=".12"/><text x="24" y="'+(y(n)+4)+'" text-anchor="end" fill="currentColor" font-size="11">'+n+'</text>').join('')+
  (pts.length>1?'<polyline fill="none" stroke="#baff9e" stroke-width="3" points="'+pts.map(p=>p.x+','+p.y).join(' ')+'"/>':'')+
  pts.map((p,i)=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="5" fill="#baff9e"/>'+
   '<text x="'+p.x+'" y="166" text-anchor="middle" font-size="11" fill="currentColor">'+Number(valid[i].avg_rating).toFixed(1)+'</text>').join('')+
  '</svg><p class="subnote">Media voti registrati per singola partita, esclusi gli SV.</p>';
}
