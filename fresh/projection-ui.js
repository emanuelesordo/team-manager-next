import {projectLeague,projectionSignature} from './projection.js?clubs=20261003id';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lastKey='',busyKey='';
export function projectionContainer(competition){
 if(!competition||!['league','tournament'].includes(String(competition.kind||'league')))
  return '';
 return '<section class="projected glass panel" aria-label="Classifica proiettata"><div class="panel-heading"><h2>Classifica proiettata</h2><span class="projected-meta">SIMULAZIONE</span></div><div data-projection-target="'+escape(competition.id)+'"><p class="empty">Calcolo delle 10.000 stagioni…</p></div></section>';
}
export function updateProjection(config,allFixtures,allStandings){
 const target=document.querySelector('[data-projection-target]');
 if(!target||!config||target.dataset.projectionTarget!==config.id)return;
 const key=projectionSignature(config,allFixtures,allStandings);
 if(target.dataset.ready===key)return;
 if(busyKey===key)return;
 busyKey=key;
 setTimeout(()=>{
  try{
   const output=projectLeague(config,allFixtures,allStandings,10000);
   const node=document.querySelector('[data-projection-target="'+CSS.escape(config.id)+'"]');
   if(!node||node.dataset.ready===key)return;
   node.innerHTML=renderProjection(output);
   node.dataset.ready=key;lastKey=key;
  }catch(err){
   const node=document.querySelector('[data-projection-target="'+CSS.escape(config.id)+'"]');
   if(node)node.textContent='Proiezione non disponibile: '+err.message;
  }finally{busyKey=''}
 },30);
}
export function renderProjection(result){
 if(!result)return '<p class="empty">Dati insufficienti per stimare il torneo.</p>';
 if(result.complete)return '<p class="empty">Calendario concluso: consulta la classifica ufficiale.</p>';
 const n=number=>Number(number).toLocaleString('it-IT',{maximumFractionDigits:1,minimumFractionDigits:1});
 const rows=result.rows.map(r=>'<tr><td>'+escape(r.team)+'</td>'+
  '<td class="tabular">'+n(r.position)+'</td>'+
  '<td class="tabular">'+n(r.expectedPoints)+'</td>'+
  '<td class="tabular">'+r.lowerPosition+'–'+r.upperPosition+'</td>'+
  '<td class="tabular">'+(r.currentPosition?'#'+r.currentPosition:'—')+'</td></tr>').join('');
 return '<div class="projection-numbers"><span><b>'+result.iterations.toLocaleString('it-IT')+'</b><small>Simulazioni</small></span>'+
  '<span><b>'+result.remaining+'</b><small>Gare residue</small></span>'+
  '<span><b>'+result.reliability+'%</b><small>Stagione disputata*</small></span></div>'+
  '<div class="table-scroller"><table class="standing-table projection-table"><thead><tr>'+
  '<th>Squadra</th><th>Pos. media</th><th>Pt attesi</th><th>Pos. P20–P80</th><th>Ora</th>'+
  '</tr></thead><tbody>'+rows+'</tbody></table></div>'+
  '<p class="subnote">Stima euristica, non classifica ufficiale. Le squadre a pari punti condividono la posizione indicativa finché non sono applicati i criteri di spareggio. *L’indicatore mostra solo la quota di gare già disputate, non una probabilità di previsione corretta.</p>';
}
