const $ = id => document.getElementById(id);
let collected = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
function notice(message,error=false){$('status').textContent=message;$('status').className=error?'error':'ok'}
function blocked(b){for(const id of ['single','bulk','send','export'])$(id).disabled=b}
function setResult(items){collected=items;$('export').disabled=!items.length;$('send').disabled=items.length!==1;$('results').textContent=items.map(p=>p.code+' · '+(p.home?.name||'?')+' – '+(p.away?.name||'?')+' · '+p.events.length+' eventi').join('\n')}
function validUrl(address){try{const u=new URL(address);return u.protocol==='https:'&&u.hostname==='live.centrosportivoitaliano.it'&&u.pathname.startsWith('/26/Calcio-a-11/')?u:null}catch{return null}}
function links(doc,base){const result=new Map();for(const a of doc.querySelectorAll('a[href]')){let resolved;try{resolved=new URL(a.getAttribute('href'),base).href}catch{continue}const u=validUrl(resolved);const match=u?.pathname.match(/\/P(C[0-9A-Z]+)\/$/i);if(match&&u.searchParams.has('j'))result.set(match[1],u.href)}return [...result.values()]}
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
function nameFromElement(node){return clean(node?.textContent).replace(/^\d+\s*[-–]\s*\d+\s*/,'')}
function parse(doc,address){
 const url=validUrl(address),match=url?.pathname.match(/\/P(C[0-9A-Z]+)\/$/i);
 if(!match)throw Error('Apri una scheda partita CSI Live, non una pagina generica');
 if(!url.searchParams.has('j'))throw Error('Link CSI incompleto: manca il parametro ?j=');
 const code=match[1],title=clean(doc.title),text=clean(doc.body?.innerText||doc.body?.textContent);
 const teamLinks=[...doc.querySelectorAll('a[href]')].filter(a=>/\/S\d+\/|[?&]j=/.test(a.getAttribute('href')||'')&&/squadra|team|club|logo|shield/i.test((a.className||'')+' '+(a.parentElement?.className||'')));
 const candidateNames=teamLinks.map(a=>nameFromElement(a)).filter(v=>v.length>2&&v.length<65&&!/classifica|calendario|campionato|risultati|girone/i.test(v));
 const compact=[...new Set(candidateNames)];
 const splitTitle=title.match(/(?:Partita|Gara)?\s*[:\-]?\s*([^|–]+?)\s+(?:vs|[-–])\s+([^|–]+)/i);
 let home=compact[0]||clean(doc.querySelector('[class*="home-team"],[class*="team-home"],[class*="squadra-casa"]')?.textContent);
 let away=compact[1]||clean(doc.querySelector('[class*="away-team"],[class*="team-away"],[class*="squadra-ospite"]')?.textContent);
 if((!home||!away)&&splitTitle){home=home||clean(splitTitle[1]);away=away||clean(splitTitle[2])}
 // Do not guess team names, scores or events: incomplete pages are rejected.
 if(!home||!away||home===away)throw Error('Nomi delle squadre non riconosciuti: HTML CSI da verificare');
 const scoreElement=doc.querySelector('[class*="score"],[class*="result"],[class*="punteggio"]');
 const score=clean(scoreElement?.textContent).match(/\b(\d{1,2})\s*[-–:]\s*(\d{1,2})\b/);
 const eventRows=[...doc.querySelectorAll('tr, li, [class*="event"], [class*="cronologia"] > div')].filter(el=>el.children.length<22);
 const events=[],seen=new Set();
 for(const row of eventRows){
  const rowText=clean(row.textContent);
  if(rowText.length>250||rowText.length<4)continue;
  const minuteMatch=rowText.match(/(?:^|\s)(\d{1,3})(?:\s*['′])?(?:\s*\+\s*(\d{1,2}))?(?=\s|['′]|$)/);
  if(!minuteMatch)continue;
  const css=String(row.className||'')+' '+[...row.querySelectorAll('[class]')].map(x=>String(x.className)).join(' ');
  let type=/sostituz|cambio|substitution|change/i.test(rowText+' '+css)?'substitution':/ammoniz|yellow/i.test(rowText+' '+css)?'yellow_card':/espuls|red.?card/i.test(rowText+' '+css)?'red_card':/gol|goal|rete|soccer-ball/i.test(rowText+' '+css)?'goal':null;
  if(!type)continue;
  const minute=Number(minuteMatch[1]);if(minute>130)continue;
  const side=/away|ospit|trasferta/i.test(css)?'away':/home|casa/i.test(css)?'home':null;
  if(!side)continue;
  const period=minute>40?2:1;
  const event={period,minute,team:side,type,stoppage_minute:minuteMatch[2]?Number(minuteMatch[2]):null};
  const key=[period,minute,side,type,rowText].join('|');if(seen.has(key))continue;seen.add(key);
  events.push(event);
 }
 // A completed game without reliably attributable events must not silently export a fabricated timeline.
 if(score&&events.length===0)throw Error('Risultato trovato, ma eventi non leggibili: esportazione bloccata per evitare dati incompleti');
 const metadata=(text.match(/(\d{2})\/(\d{2})\/(20\d{2})/)||[]);
 const date=metadata.length?metadata[3]+'-'+metadata[2]+'-'+metadata[1]:null;
 const timeMatch=text.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
 return {url:url.href,code,date,time:timeMatch?.[0]||null,home:{name:home,score:score?Number(score[1]):null},away:{name:away,score:score?Number(score[2]):null},events};
}
async function page(address){const r=await fetch(address,{credentials:'include',redirect:'follow'});if(!r.ok)throw Error('HTTP '+r.status+' · '+address);return new DOMParser().parseFromString(await r.text(),'text/html')}
async function active(){const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const url=validUrl(tab?.url);if(!url)throw Error('Apri una pagina di live.centrosportivoitaliano.it');return url.href}
$('single').addEventListener('click',async()=>{blocked(true);try{const url=await active();const doc=await page(url);const data=parse(doc,url);setResult([data]);notice('Scheda estratta. Controlla i dati prima di importarli.')}catch(e){setResult([]);notice(e.message,true)}finally{$('single').disabled=false;$('bulk').disabled=false}});
$('bulk').addEventListener('click',async()=>{blocked(true);try{const url=await active(),doc=await page(url),urls=links(doc,url);if(!urls.length)throw Error('Nessun link gara con parametro ?j= rilevato');notice('Rilevate '+urls.length+' gare. Estrazione in corso…');const items=[],errors=[];for(let i=0;i<Math.min(urls.length,120);i++){try{items.push(parse(await page(urls[i]),urls[i]))}catch(e){errors.push(urls[i]+' · '+e.message)}notice((i+1)+'/'+urls.length+' visitate · '+items.length+' complete · '+errors.length+' non leggibili');await sleep(800)}setResult(items);notice(items.length+' schede esportabili. '+errors.length+' fallite/incomplete.\n'+errors.slice(0,3).join('\n'),!!errors.length)}catch(e){notice(e.message,true)}finally{$('single').disabled=false;$('bulk').disabled=false}});
$('export').addEventListener('click',()=>{if(!collected.length)return;const raw=JSON.stringify(collected.length===1?collected[0]:{format:'csi-scraper-batch-v1',matches:collected},null,2);const blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=collected.length===1?collected[0].code+'.json':'csi-partite.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)});
$('send').addEventListener('click',async()=>{if(collected.length!==1)return;try{const tabs=await chrome.tabs.query({url:'https://emanuelesordo.github.io/team-manager-next/*'});const tab=tabs.find(x=>/^#match\/[0-9a-f-]+$/i.test(new URL(x.url).hash));if(!tab)throw Error('Apri prima la partita corrispondente su Team Manager Next');const result=await chrome.tabs.sendMessage(tab.id,{type:'CSI_DELIVER',payload:collected[0]});if(!result?.ok)throw Error(result?.error||'Scheda Team Manager non raggiungibile');notice('JSON consegnato. Passa su Team Manager, controlla il codice e premi «Importa e confronta».')}catch(e){notice(e.message,true)}});
