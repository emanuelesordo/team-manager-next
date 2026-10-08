const $ = id => document.getElementById(id);
let collected = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
function notice(message,error=false){$('status').textContent=message;$('status').className=error?'error':'ok'}
function blocked(b){for(const id of ['single','bulk','send','export','copy'])$(id).disabled=b}
function setResult(items){collected=items;$('copy').disabled=!items.length;$('export').disabled=!items.length;$('send').disabled=items.length!==1;$('results').textContent=items.map(p=>p.code+' · '+(p.home?.name||'?')+' – '+(p.away?.name||'?')+' · '+p.events.length+' eventi').join('\n')}
function validUrl(address){try{const u=new URL(address);return u.protocol==='https:'&&u.hostname==='live.centrosportivoitaliano.it'&&u.pathname.startsWith('/26/Calcio-a-11/')?u:null}catch{return null}}
function links(doc,base){const result=new Map();for(const a of doc.querySelectorAll('a[href]')){let resolved;try{resolved=new URL(a.getAttribute('href'),base).href}catch{continue}const u=validUrl(resolved);const match=u?.pathname.match(/\/P(C[0-9A-Z]+)\/$/i);if(match&&u.searchParams.has('j'))result.set(match[1],u.href)}return [...result.values()]}
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
function nameFromElement(node){return clean(node?.textContent).replace(/^\d+\s*[-–]\s*\d+\s*/,'')}
function parse(doc,address){
 const url=validUrl(address),match=url?.pathname.match(/\/P(C[0-9A-Z]+)\/$/i);
 if(!match||!url.searchParams.has('j'))throw Error('Apri una scheda gara CSI con parametro ?j= completo');
 const hero=doc.querySelector('.hero-gara');if(!hero)throw Error('Intestazione gara CSI non trovata');
 const boxes=[...hero.querySelectorAll('.row.justify-content-center > .col-md-4')];
 if(boxes.length!==2)throw Error('Squadre non riconosciute nell’intestazione CSI');
 const team=box=>{const link=box.querySelector('h5 a[href]'),img=box.querySelector('img[src]');if(!link)throw Error('Nome squadra assente');
 return {name:clean(link.textContent),url:new URL(link.getAttribute('href'),url.href).href,logo:img?new URL(img.getAttribute('src'),url.href).href:null,score:null}};
 const home=team(boxes[0]),away=team(boxes[1]);
 const score=clean(hero.querySelector('.col-md-3 h3')?.textContent).match(/^(\d+)\s*[-–]\s*(\d+)$/);
 if(score){home.score=Number(score[1]);away.score=Number(score[2])}
 const field=[...hero.querySelectorAll('.text-center')].find(x=>/^Campo:/i.test(clean(x.querySelector('b')?.textContent)));
 const venueLink=field?.querySelector('a[href]');
 const venue=venueLink?{name:clean(venueLink.textContent),url:new URL(venueLink.getAttribute('href'),url.href).href}:null;
 const bc=[...doc.querySelectorAll('.breadcrumb-item a[aria-label]')];
 const byLabel=part=>bc.find(x=>(x.getAttribute('aria-label')||'').includes(part));
 const competition={committee:byLabel('Comitato CSI')?.getAttribute('aria-label')||null,sport:byLabel('Attività')?.textContent.trim()||null,name:bc.find(x=>/serie|girone|open/i.test(x.getAttribute('aria-label')||''))?.getAttribute('aria-label')||null};
 const dateText=clean(hero.querySelector('.fad.fa-calendar')?.parentElement?.textContent),dm=dateText.match(/(\d{2})\/(\d{2})\/(\d{4})/),clock=dateText.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
 const date=dm?dm[3]+'-'+dm[2]+'-'+dm[1]:null,time=clock?.[0]||null;
 const events=[],periods=[];
 const cards=[...doc.querySelectorAll('.card')].filter(c=>c.querySelector(':scope > .card-body > .event-header'));
 for(const card of cards){
  let period=null;
  for(const row of card.querySelector(':scope > .card-body').children){
   if(row.classList.contains('event-header')){
    const header=clean(row.textContent);
    period=/primo tempo/i.test(header)?1:/^Fine\b/i.test(header)?2:null;
    if(period)periods.push({period,label:header,stoppage_minutes:null});
    continue;
   }
   if(row.classList.contains('event-header-info')){
    const recovery=clean(row.textContent).match(/(\d+)\s+minut[oi]/i);
    if(period&&periods.length)periods[periods.length-1].stoppage_minutes=recovery?Number(recovery[1]):null;
    continue;
   }
   if(!row.classList.contains('event-row')||!period)continue;
   const css=row.querySelector('.event-icon i')?.className||'';
   const type=/fa-futbol/.test(css)?'goal':/fa-exchange/.test(css)?'substitution':/rectangle-portrait/.test(css)?(/text-danger/.test(css)?'red_card':'yellow_card'):null;
   if(!type)continue;
   const side=row.querySelector('.event-details.event-left')?'home':row.querySelector('.event-details.event-right')?'away':null;
   const localTime=clean(row.querySelector('.event-time')?.textContent),tm=localTime.match(/^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?'{1,2}$/);
   if(!side||!tm)throw Error('Evento CSI con squadra/minuto non riconosciuti: '+localTime);
   const relative=Number(tm[1]);if(relative>50)throw Error('Minuto periodo non valido '+localTime);
   const minute=relative+(period-1)*40,details=row.querySelector('.event-details');
   const event={period,minute,team:side,type,stoppage_minute:tm[2]?Number(tm[2]):null};
   const person=node=>{if(!node)return null;const clone=node.cloneNode(true),num=clone.querySelector('sup small')?.textContent.match(/\d+/);clone.querySelectorAll('sup').forEach(n=>n.remove());const name=clean(clone.textContent).replace(/^(Esce|Entra):\s*/i,'');return name?{name,number:num?Number(num[0]):null}:null};
   if(type==='substitution'){
    const out=details?.querySelector('.player_out'),clone=details?.cloneNode(true);clone?.querySelector('.player_out')?.remove();
    event.player_out=person(out);event.player_in=person(clone);
    if(!event.player_out||!event.player_in)throw Error('Sostituzione incompleta al minuto '+minute);
   }else if(type==='goal'){
    const result=clean(details?.textContent).match(/(\d+)\s*[-–]\s*(\d+)/);
    if(result)event.score={home:Number(result[1]),away:Number(result[2])};
   }else event.player=person(details);
   events.push(event);
  }
 }
 if(!periods.length)throw Error('Periodi CSI non riconosciuti');
 if(home.score!==null&&away.score!==null&&home.score+away.score>0&&!events.some(e=>e.type==='goal'))throw Error('Gol assenti da una partita con reti');
 events.sort((a,b)=>a.minute-b.minute||(a.stoppage_minute||0)-(b.stoppage_minute||0));
 periods.sort((a,b)=>a.period-b.period);
 return {url:url.href,code:match[1],date,time,competition,venue,status:null,home,away,periods,events};
}
async function page(address){const r=await fetch(address,{credentials:'include',redirect:'follow'});if(!r.ok)throw Error('HTTP '+r.status+' · '+address);return new DOMParser().parseFromString(await r.text(),'text/html')}
async function active(){const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const url=validUrl(tab?.url);if(!url)throw Error('Apri una pagina di live.centrosportivoitaliano.it');return url.href}
$('single').addEventListener('click',async()=>{blocked(true);try{const url=await active();const doc=await page(url);const data=parse(doc,url);setResult([data]);notice('Scheda estratta. Controlla i dati prima di importarli.')}catch(e){setResult([]);notice(e.message,true)}finally{$('single').disabled=false;$('bulk').disabled=false}});
$('bulk').addEventListener('click',async()=>{blocked(true);try{const url=await active(),doc=await page(url),urls=links(doc,url);if(!urls.length)throw Error('Nessun link gara con parametro ?j= rilevato');notice('Rilevate '+urls.length+' gare. Estrazione in corso…');const items=[],errors=[];for(let i=0;i<Math.min(urls.length,120);i++){try{items.push(parse(await page(urls[i]),urls[i]))}catch(e){errors.push(urls[i]+' · '+e.message)}notice((i+1)+'/'+urls.length+' visitate · '+items.length+' complete · '+errors.length+' non leggibili');await sleep(800)}setResult(items);notice(items.length+' schede esportabili. '+errors.length+' fallite/incomplete.\n'+errors.slice(0,3).join('\n'),!!errors.length)}catch(e){notice(e.message,true)}finally{$('single').disabled=false;$('bulk').disabled=false}});
function outputJSON(){return JSON.stringify(collected.length===1?collected[0]:{format:'csi-scraper-batch-v1',matches:collected},null,2)}
$('copy').addEventListener('click',async()=>{
 if(!collected.length)return;
 try{
  await navigator.clipboard.writeText(outputJSON());
  notice('JSON copiato negli appunti ('+collected.length+' '+(collected.length===1?'partita':'partite')+').');
 }catch(error){notice('Copia non riuscita: '+(error.message||String(error)),true)}
});
$('export').addEventListener('click',()=>{if(!collected.length)return;const raw=outputJSON();const blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=collected.length===1?collected[0].code+'.json':'csi-partite.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)});
$('send').addEventListener('click',async()=>{if(collected.length!==1)return;try{const tabs=await chrome.tabs.query({url:'https://emanuelesordo.github.io/team-manager-next/*'});const tab=tabs.find(x=>/^#match\/[0-9a-f-]+$/i.test(new URL(x.url).hash));if(!tab)throw Error('Apri prima la partita corrispondente su Team Manager Next');const result=await chrome.tabs.sendMessage(tab.id,{type:'CSI_DELIVER',payload:collected[0]});if(!result?.ok)throw Error(result?.error||'Scheda Team Manager non raggiungibile');notice('JSON consegnato. Passa su Team Manager, controlla il codice e premi «Importa e confronta».')}catch(e){notice(e.message,true)}});
