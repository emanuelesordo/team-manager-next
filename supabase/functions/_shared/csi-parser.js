// Server adaptation of tools/csi-scraper/csi_match.py; parity checked on its fixtures.
const baseUrl='https://live.centrosportivoitaliano.it/';
const text=el=>el?.textContent?.replace(/\s+/g,' ').trim()||null;
const integer=v=>{const m=String(v??'').match(/-?\d+/);return m?Number(m[0]):null};
const abs=(v,base)=>v?new URL(v,base).href:null;
function player(el){
 const value=(text(el)||'').replace(/^\s*(Esce|Entra)\s*:\s*/,'').trim();
 if(!value)return null;
 const m=value.match(/^(.*?)\s*\((\d+)\)\s*$/);
 return {name:m?m[1].trim():value,number:m?Number(m[2]):null};
}
export function validateCsiUrl(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.hostname!=='live.centrosportivoitaliano.it'||url.port||url.username||url.password||!/^\/\d+\/Calcio-a-11\/[^/]+\/[^/]+\/[^/]+\/$/.test(url.pathname))throw Error('Link CSI non valido');
 return url.href;
}
export async function fetchCsiHtml(value,fetcher=fetch){
 let url=validateCsiUrl(value);
 for(let redirects=0;redirects<4;redirects++){
  const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36','Accept':'text/html'}});
  if([301,302,303,307,308].includes(response.status)){
   const location=response.headers.get('location');if(!location)throw Error('Redirect CSI senza destinazione');
   url=validateCsiUrl(new URL(location,url).href);continue;
  }
  if(!response.ok)throw Error(`CSI HTTP ${response.status}`);
  if(!/text\/html/i.test(response.headers.get('content-type')||''))throw Error('La risposta CSI non è HTML');
  const reader=response.body.getReader();const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();throw Error('Pagina CSI troppo grande')}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  return new TextDecoder().decode(bytes);
 }
 throw Error('Troppi redirect CSI');
}
export function parseCsiMatch(document,url=null,halfLength=40){
 if(!Number.isInteger(halfLength)||halfLength<1||halfLength>60)throw Error('Durata dei tempi non valida');
 const hero=document.querySelector('.hero-gara');if(!hero)throw Error("Pagina non riconosciuta: blocco '.hero-gara' assente");
 const base=url||baseUrl,pill=text(hero.querySelector('.rounded-pill'))||'';
 const date=pill.match(/(\d{2})\/(\d{2})\/(\d{4})/),time=pill.match(/\b(\d{1,2}:\d{2})\b/);
 const cols=hero.querySelectorAll('.row > .col-md-4');if(cols.length<2)throw Error('Squadre non trovate nella pagina');
 const team=col=>{const a=col.querySelector('h5 a');return {name:text(a)||text(col.querySelector('h5')),url:abs(a?.getAttribute('href'),base),logo:col.querySelector('img')?.getAttribute('src')||null}};
 const home=team(cols[0]),away=team(cols[1]),scoreCol=hero.querySelector('.row > .col-md-3');
 const nums=Array.from(scoreCol?.querySelectorAll('h3 > span')||[]).map(text).filter(x=>x&&x!=='-').map(integer);
 home.score=nums.length===2?nums[0]:null;away.score=nums.length===2?nums[1]:null;
 const labeled=label=>Array.from(hero.querySelectorAll('b')).find(b=>(text(b)||'').replace(/:$/,'').trim().toLowerCase()===label)?.parentElement;
 const codeEl=labeled('codice gara')?.cloneNode(true);codeEl?.querySelector('b')?.remove();
 const venueEl=labeled('campo'),venueLink=venueEl?.querySelector('a');
 const labels=Array.from(document.querySelectorAll('ol.breadcrumb li.breadcrumb-item')).map(li=>text(li.querySelector('a'))).filter(Boolean);
 const blocks=[];let current=null;
 for(const el of Array.from(document.querySelector('.event-row')?.parentElement?.children||[])){
  if(el.classList.contains('event-header')){current={label:text(el),stoppage_minutes:null,rows:[]};blocks.push(current)}
  else if(el.classList.contains('event-header-info')){if(current)current.stoppage_minutes=integer(text(el))}
  else if(el.classList.contains('event-row')){if(!current){current={label:null,stoppage_minutes:null,rows:[]};blocks.push(current)}current.rows.push(el)}
 }
 const periods=[],events=[];
 for(const [index,block] of blocks.reverse().entries()){
  const period=index+1;periods.push({period,label:block.label,stoppage_minutes:block.stoppage_minutes});
  for(const row of block.rows.reverse()){
   const details=row.querySelector('.event-details')?.cloneNode(true),icon=row.querySelector('.event-icon i');
   const classes=icon?.classList;
   const type=classes?.contains('fa-futbol')?'goal':classes?.contains('fa-exchange')?'substitution':classes?.contains('fa-rectangle-portrait')?(classes.contains('text-danger')?'red_card':classes.contains('text-warning')?'yellow_card':classes.contains('text-info')?'blue_card':'unknown'):'unknown';
   const local=integer(text(row.querySelector('.event-time')));
   const ev={period,minute:local===null?null:halfLength*(period-1)+Math.min(local,halfLength),team:details?.classList.contains('event-left')?'home':details?.classList.contains('event-right')?'away':null,type};
   if(type==='goal'){const m=(text(details?.querySelector('h6'))||'').match(/^(\d+)\s*-\s*(\d+)$/);ev.score=m?{home:Number(m[1]),away:Number(m[2])}:null}
   else if(type==='substitution'&&details){const out=details.querySelector('.player_out');ev.player_out=player(out);out?.remove();ev.player_in=player(details)}
   else{ev.player=player(details);if(type==='unknown'){ev.icon=icon?.getAttribute('class')||null;ev.text=text(details)}}
   ev.stoppage_minute=local!==null&&local>halfLength?local-halfLength:null;events.push(ev);
  }
 }
 return {url,code:text(codeEl),date:date?`${date[3]}-${date[2]}-${date[1]}`:null,time:time?.[1]||null,competition:{committee:labels[0]||null,sport:labels[1]||null,name:labels[2]||null},venue:venueEl?{name:text(venueLink)||text(venueEl),url:abs(venueLink?.getAttribute('href'),base)}:null,status:text(scoreCol?.querySelector('.badge')),home,away,periods,events};
}
export const norm=v=>String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
export function assertFixtureIdentity(fixture,payload){
 if(!payload.code||!payload.home?.name||!payload.away?.name)throw Error('Identità della gara CSI incompleta');
 if(fixture.match_code&&norm(fixture.match_code)!==norm(payload.code))throw Error(`Codice gara non corrispondente: atteso ${fixture.match_code}, ricevuto ${payload.code}`);
 if(norm(fixture.home_team)!==norm(payload.home.name)||norm(fixture.away_team)!==norm(payload.away.name))throw Error('Le squadre CSI non corrispondono alla partita collegata');
}
