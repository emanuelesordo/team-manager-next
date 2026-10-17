import {rpc,adminWrite} from './api.js';
const CDN='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
let lib;
async function workbookLib(){
 if(globalThis.XLSX)return globalThis.XLSX;
 if(lib)return lib;
 lib=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=CDN;script.async=true;
  script.onload=()=>globalThis.XLSX?resolve(globalThis.XLSX):reject(Error('Libreria XLSX non disponibile'));
  script.onerror=()=>reject(Error('Impossibile caricare il lettore XLSX. Verifica la connessione.'));
  document.head.append(script);
 });
 return lib;
}
export const rosterColumns=['ID','Nome','Cognome','Data nascita','Piede','Altezza cm','Ruolo generico','In rosa','Dal','Al','Ruolo naturale','Affinità ruoli'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const txt=v=>String(v??'').trim();
function season(ctx){return ctx.state.base.seasons.find(s=>s.id===ctx.state.season)}
function date(v){if(v===null||v===undefined||v==='')return '';if(v instanceof Date)return v.toISOString().slice(0,10);const s=txt(v);return /^\d{4}-\d\d-\d\d$/.test(s)?s:''}
function rowsFor(ctx){
 const d=ctx.state.data||{},positions=new Map((d.rolePositions||[]).map(p=>[p.id,p.code]));
 const seasonId=ctx.state.season,periods=d.contracts||[],roster=d.roster||[];
 const players=(d.players||[]).filter(p=>roster.some(r=>r.player_id===p.id&&r.season_id===seasonId));
 return players.sort((a,b)=>txt(a.last_name).localeCompare(txt(b.last_name),'it')).map(p=>{
  const period=periods.filter(x=>x.player_id===p.id&&x.season_id===seasonId).sort((a,b)=>txt(b.start_date).localeCompare(txt(a.start_date)))[0];
  const r=roster.find(x=>x.player_id===p.id&&x.season_id===seasonId);
  const affinity=(d.roleAffinities||[]).filter(x=>x.player_id===p.id).map(x=>({...x,code:positions.get(x.position_id)}));
  return [p.id,p.first_name||'',p.last_name||'',p.birth_date||'',p.preferred_foot||'',p.height_cm??'',p.generic_role_manual||'',r?.active===false?'No':'Sì',period?.start_date||'',period?.end_date||'',affinity.find(x=>x.is_natural)?.code||'',affinity.filter(x=>!x.is_natural&&x.code).map(x=>x.code+':'+x.affinity_pct).join('; ')];
 });
}
export async function exportRoster(ctx){
 const XLSX=await workbookLib(),wb=XLSX.utils.book_new();
 const sheet=XLSX.utils.aoa_to_sheet([rosterColumns,...rowsFor(ctx)]);
 sheet['!cols']=rosterColumns.map((h,i)=>({wch:i===0?39:i===11?48:Math.max(16,h.length+4)}));
 XLSX.utils.book_append_sheet(wb,sheet,'Rosa');
 const guide=XLSX.utils.aoa_to_sheet([['ISTRUZIONI'],['Modifica il foglio Rosa. Non modificare gli ID esistenti.'],['Per creare un giocatore lascia vuota la colonna ID.'],['Ruolo naturale: codice es. TD, DC, ATT. Il suo valore è 100%.'],['Affinità ruoli: CODICE:percentuale separati da ; es. QD:80; ED:55; TS:0'],['Lascia vuoto Affinità ruoli se non ci sono ruoli secondari.'],['Date nel formato AAAA-MM-GG.'],['Le righe non presenti non saranno eliminate.'],['In rosa: Sì oppure No.'],['L’importazione richiede l’accesso staff.']]);
 guide['!cols']=[{wch:100}];XLSX.utils.book_append_sheet(wb,guide,'Istruzioni');
 XLSX.writeFile(wb,'rosa_'+txt(season(ctx)?.name||'stagione').replace(/[^\w-]/g,'_')+'.xlsx');
}
export function parseRosterRows(records,ctx){
 const d=ctx.state.data||{},known=new Set((d.players||[]).map(x=>x.id));
 const positions=new Map((d.rolePositions||[]).map(p=>[p.code,p]));
 const seen=new Set(),rows=[],errors=[];
 records.forEach((row,index)=>{
  const n=index+2,id=txt(row.ID),first=txt(row.Nome),last=txt(row.Cognome);
  if(!Object.values(row).some(v=>txt(v)))return;
  const problems=[];
  if(id&&(!uuid.test(id)||!known.has(id)))problems.push('ID non riconosciuto');
  if(id&&seen.has(id))problems.push('ID duplicato');if(id)seen.add(id);
  if(!first||!last)problems.push('Nome e cognome obbligatori');
  const birth=txt(row['Data nascita']);if(birth&&!date(birth))problems.push('Data nascita: usa AAAA-MM-GG');
  const height=txt(row['Altezza cm']);if(height&&(!/^\d+$/.test(height)||Number(height)<100||Number(height)>245))problems.push('Altezza non valida');
  const foot=txt(row.Piede);if(foot&&!['right','left','both'].includes(foot))problems.push('Piede non valido');
  const generic=txt(row['Ruolo generico']);if(generic&&!['P','D','C','A'].includes(generic))problems.push('Ruolo generico non valido');
  const active=txt(row['In rosa']).toLowerCase();if(active&&!['sì','si','no'].includes(active))problems.push('In rosa: usa Sì o No');
  const start=txt(row.Dal)||season(ctx)?.start_date||'',end=txt(row.Al)||season(ctx)?.end_date||'';
  if(!date(start)||!date(end)||start>end)problems.push('Periodo Dal/Al non valido');
  const natural=txt(row['Ruolo naturale']).toUpperCase(),secondary=txt(row['Affinità ruoli']);
  const roles=[];
  if(natural){if(!positions.has(natural))problems.push('Ruolo naturale sconosciuto');else roles.push({code:natural,affinity:100,natural:true});}
  if(secondary&&!natural)problems.push('Imposta il ruolo naturale prima delle affinità');
  for(const entry of secondary.split(';').map(x=>x.trim()).filter(Boolean)){
   const match=entry.match(/^([A-Za-z]+)\s*:\s*(\d{1,3})$/),code=match?.[1].toUpperCase(),pct=Number(match?.[2]);
   if(!match||!positions.has(code)||pct>100||code===natural||roles.some(r=>r.code===code)){problems.push('Affinità non valida: '+entry);continue}
   roles.push({code,affinity:pct,natural:false});
  }
  if(problems.length){errors.push('Riga '+n+': '+problems.join(', '));return}
  const naturalCategory=positions.get(natural)?.category;
  const role=naturalCategory?({goalkeeper:'P',defender:'D',midfielder:'C',forward:'A'}[naturalCategory]):generic;
  rows.push({id,first,last,birth,height:height?Number(height):null,foot,role,active:active!=='no',start,end,roles});
 });
 return {rows,errors};
}
export async function importRoster(file,ctx){
 if(!file||!/\.(xlsx|xls)$/i.test(file.name))throw Error('Seleziona un file .xlsx');
 if(file.size>5*1024*1024)throw Error('File troppo grande (max 5 MB)');
 const XLSX=await workbookLib(),wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
 const sheet=wb.Sheets.Rosa;if(!sheet)throw Error('Foglio Rosa non trovato');
 const values=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:false});
 if(!values.length)throw Error('Il foglio Rosa è vuoto');
 if(rosterColumns.some(key=>!Object.hasOwn(values[0],key)))throw Error('Intestazioni diverse dal modello esportato');
 const {rows,errors}=parseRosterRows(values,ctx);
 if(errors.length)throw Error('Nessuna modifica applicata:\n'+errors.slice(0,12).join('\n')+(errors.length>12?'\n...':''));
 if(!rows.length)throw Error('Nessun giocatore da importare');
 const existing=rows.filter(x=>x.id).length,created=rows.length-existing;
 if(!window.confirm('Importare '+rows.length+' giocatori?\n'+existing+' aggiornamenti · '+created+' nuovi.\nLe righe assenti non saranno eliminate.\n\nProcedere?'))return;
 let done=0;
 for(const row of rows){
  const playerId=await rpc('tm_app_save_player',{p_season_id:ctx.state.season,p_data:{id:row.id||null,first_name:row.first,last_name:row.last,preferred_foot:row.foot||null,height_cm:row.height,generic_role_manual:row.role||null,active:row.active}});
  await rpc('tm_app_set_player_period',{p_season_id:ctx.state.season,p_player_id:playerId,p_start_date:row.start,p_end_date:row.end,p_period_id:(ctx.state.data?.contracts||[]).filter(p=>p.player_id===playerId&&p.season_id===ctx.state.season).sort((a,b)=>txt(b.start_date).localeCompare(txt(a.start_date)))[0]?.id||null});
  if(row.roles.length)await rpc('tm_app_save_player_roles',{p_season_id:ctx.state.season,p_player_id:playerId,p_roles:row.roles});
  if(row.birth)await adminWrite('players','PATCH',{birth_date:row.birth},{id:playerId});
  done++;
 }
 await ctx.reloadAll();
 ctx.toast('Importazione completata: '+done+' giocatori');
}
