import {projectLeague,projectionSignature} from './projection.js?history=20261006v1';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lastKey='',busyKey='';
export function projectionContainer(competition){
 if(!competition||!['league','tournament'].includes(String(competition.kind||'league')))
  return '';
 return '<section class="projected glass panel" aria-label="Classifica proiettata"><div class="panel-heading"><h2>Classifica proiettata</h2><span class="projected-meta">SIMULAZIONE</span></div><div data-projection-target="'+escape(competition.id)+'"><p class="empty">Calcolo delle 10.000 stagioni…</p></div></section>';
}
export function updateProjection(config,allFixtures,allStandings,history=[],crest=()=>'' ){
 const target=document.querySelector('[data-projection-target]');
 if(!target||!config||target.dataset.projectionTarget!==config.id)return;
 const key=projectionSignature(config,allFixtures,allStandings,history);
 if(target.dataset.ready===key)return;
 if(busyKey===key)return;
 busyKey=key;
 setTimeout(()=>{
  try{
   const output=projectLeague(config,allFixtures,allStandings,10000,history);
   const node=document.querySelector('[data-projection-target="'+CSS.escape(config.id)+'"]');
   if(!node||node.dataset.ready===key)return;
   node.innerHTML=renderProjection(output,crest);
   node.dataset.ready=key;lastKey=key;
  }catch(err){
   const node=document.querySelector('[data-projection-target="'+CSS.escape(config.id)+'"]');
   if(node)node.textContent='Proiezione non disponibile: '+err.message;
  }finally{busyKey=''}
 },30);
}
export function renderProjection(result,crest=()=>'' ){
 if(!result)return '<p class="empty">Dati insufficienti per stimare il torneo.</p>';
 if(result.complete)return '<p class="empty">Calendario concluso: consulta la classifica ufficiale.</p>';
 const n=number=>Math.round(Number(number)).toLocaleString('it-IT');
 const rows=result.rows.map((r,i)=>{
  const projectedRank=i+1;
  const change=Number(r.currentPosition)-projectedRank;
  const movement=change>0?'<span class="projection-move up">▲ +'+change+'</span>':change<0?'<span class="projection-move down">▼ '+change+'</span>':'<span class="projection-move flat">—</span>';
  const gf=Number(r.expectedGoalsFor),gs=Number(r.expectedGoalsAgainst);
  return '<tr><td>'+projectedRank+'</td><td><span class="standing-team">'+crest(r)+'<span>'+escape(r.team)+'</span></span></td>'+
   '<td class="points">'+n(r.expectedPoints)+'</td>'+
   '<td class="tabular">'+n(gf)+'</td>'+
   '<td class="tabular">'+n(gs)+'</td>'+
   '<td class="tabular">'+n(gf-gs)+'</td>'+
   '<td class="tabular">'+movement+'</td></tr>';
 }).join('');
 return '<div class="table-scroller"><table class="standing-table projection-table"><thead><tr>'+
  '<th>#</th><th>Squadra</th><th>Pt</th><th>GF</th><th>GS</th><th>DR</th><th>+/-</th>'+
  '</tr></thead><tbody>'+rows+'</tbody></table></div>'+
  '<p class="projection-footnote">'+result.iterations.toLocaleString('it-IT')+' simulazioni · '+result.remaining+' gare da disputare · '+result.reliability+'% stagione disputata. Valori attesi arrotondati; variazione rispetto alla posizione attuale. Stima indicativa, spareggi non simulati.</p>';
}
