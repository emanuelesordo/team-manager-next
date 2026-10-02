/** CSV parsing and strict fixture normalization, no network or browser dependency. */
export function parseDelimited(raw){
 const text=String(raw??'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
 const start=text.startsWith('sep=')?text.indexOf('\n')+1:0;
 const first=text.slice(start).split('\n')[0]||'';
 const delim=text.startsWith('sep=')?text[4]:[';',',','\t'].sort((a,b)=>unquoted(first,b)-unquoted(first,a))[0];
 const rows=[];let cells=[],cell='',quoted=false;
 for(let i=start;i<text.length;i++){
  const ch=text[i],next=text[i+1];
  if(ch==='"'){if(quoted&&next==='"'){cell+='"';i++}else if(!quoted&&cell.trim()!==''){throw Error('Virgolette CSV malformate')}else quoted=!quoted;continue}
  if(!quoted&&ch===delim){cells.push(cell.trim());cell='';continue}
  if(!quoted&&ch==='\n'){cells.push(cell.trim());if(cells.some(x=>x!==''))rows.push(cells);cells=[];cell='';continue}
  cell+=ch;
 }
 if(quoted)throw Error('Virgolette CSV non chiuse');
 cells.push(cell.trim());if(cells.some(x=>x!==''))rows.push(cells);
 if(rows.length<2)throw Error('CSV privo di dati');
 return rows;
}
function unquoted(s,delimiter){let n=0,q=false;for(let i=0;i<s.length;i++){if(s[i]==='"')q=s[i+1]==='"'?q:!q;else if(!q&&s[i]===delimiter)n++}return n}
function headerKey(v){return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}
const names={
 round_no:['round_no','giornata','turno','round'],
 kickoff_at:['kickoff_at','data_ora','dataora','data_partita','data','datetime'],
 hour:['ora','orario','time'],
 home_team:['home_team','casa','squadra_casa','squadracasa','home'],
 away_team:['away_team','ospite','squadra_ospite','squadraospite','away'],
 venue_name:['venue_name','campo','impianto','stadio','luogo'],
 venue_address:['venue_address','indirizzo','indirizzo_campo']
};
const rome=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function romeISO(y,m,d,h,min){
 const validDate=new Date(Date.UTC(y,m-1,d));
 if(validDate.getUTCFullYear()!==y||validDate.getUTCMonth()!==m-1||validDate.getUTCDate()!==d)throw Error('Data calendario inesistente');
 const matches=[];
 for(const offset of [1,2]){
  const v=new Date(Date.UTC(y,m-1,d,h-offset,min));
  const parts=Object.fromEntries(rome.formatToParts(v).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
  if(parts.year===y&&parts.month===m&&parts.day===d&&parts.hour===h&&parts.minute===min)matches.push(v);
 }
 if(matches.length!==1)throw Error(matches.length?'Orario ambiguo per cambio ora: usa ISO con +01:00/+02:00':'Orario inesistente per cambio ora');
 return matches[0].toISOString();
}
export function parseKickoff(value,hour=''){
 const text=String(value||'').trim();
 const z=text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/i);
 if(z){const d=new Date(text);if(!Number.isFinite(d.getTime()))throw Error('Data ISO non valida');return d.toISOString()}
 const plain=text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
 const isoLocal=text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/);
 let y,m,d,h,minute;
 const hm=String(hour||'').match(/^(\d{1,2}):(\d{2})$/);
 if(plain){[,d,m,y,h,minute]=plain}
 else if(isoLocal){[,y,m,d,h,minute]=isoLocal}
 else throw Error('Data non riconosciuta: usa GG/MM/AAAA con ora oppure ISO con fuso');
 if(hm){h=hm[1];minute=hm[2]}
 if(h===undefined||minute===undefined)throw Error('Ora assente');
 [y,m,d,h,minute]=[y,m,d,h,minute].map(Number);
 if(y<2000||y>2100||h>23||minute>59||m<1||m>12||d<1||d>31)throw Error('Data o ora fuori intervallo');
 return romeISO(y,m,d,h,minute);
}
export function parseFixtureCSV(text){
 const grid=parseDelimited(text);const header=grid.shift().map(headerKey);
 const keys={};for(const [key,aliases] of Object.entries(names))keys[key]=header.findIndex(h=>aliases.includes(h));
 for(const key of ['round_no','kickoff_at','home_team','away_team'])if(keys[key]<0)throw Error('Colonna obbligatoria mancante: '+key);
 if(grid.length>250)throw Error('Massimo 250 partite per importazione');
 const fixtures=[],errors=[],seen=new Set();
 for(let i=0;i<grid.length;i++){
  const row=grid[i];const col=name=>keys[name]<0?'':String(row[keys[name]]??'').trim();const line=i+2;
  try{
   if(row.length>header.length)throw Error('Numero colonne superiore all’intestazione');
   const round=Number(col('round_no'));if(!Number.isInteger(round)||round<1||round>250)throw Error('Giornata non valida');
   const home=col('home_team'),away=col('away_team');
   if(!home||!away||home.length>160||away.length>160||home.toLocaleLowerCase('it')===away.toLocaleLowerCase('it'))throw Error('Nomi squadre non validi');
   const kickoff=parseKickoff(col('kickoff_at'),col('hour'));
   const venue=col('venue_name'),address=col('venue_address');
   if(venue.length>180||address.length>400)throw Error('Campo/indirizzo troppo lungo');
   const hash=[round,home.toLocaleLowerCase('it'),away.toLocaleLowerCase('it')].join('|');
   if(seen.has(hash))throw Error('Incontro ripetuto nel CSV');
   seen.add(hash);
   fixtures.push({round_no:round,kickoff_at:kickoff,home_team:home,away_team:away,venue_name:venue||null,venue_address:address||null});
  }catch(e){errors.push({line,message:String(e.message)})}
 }
 return {rows:fixtures,errors,total:grid.length};
}
