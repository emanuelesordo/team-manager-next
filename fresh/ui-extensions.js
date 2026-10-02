import {saveFixture} from './api.js';
function safeColor(c,fallback){return /^(#[0-9a-f]{3}|#[0-9a-f]{6})$/i.test(String(c||''))?c:fallback}
export function clubPage({team,seasons,season,opponents,E,crest,heading,ico}){
 const chosen=seasons.find(s=>s.id===season);
 const bands=[safeColor(team.primary_color,'#356b98'),safeColor(team.secondary_color,'#d5e6ff'),safeColor(team.accent_color,'#bce7a3')];
 const opponentsHtml=opponents.map(o=>'<div class="opponent-card">'+crest(o.name,'sm')+'<span><b>'+E(o.name)+'</b><small>'+E(o.home_venue_name||'Campo non indicato')+'</small></span></div>').join('');
 const seasonsHtml=seasons.map(s=>'<div class="season-card'+(s.id===season?' selected':'')+'"><b>'+E(s.name)+'</b><small>'+E(s.status||'')+'</small></div>').join('');
 return heading('IL CLUB','Squadra e avversarie','Identità sportiva, stagioni e squadre del calendario.')+
 '<section class="glass club-banner">'+crest(team.name,'xl')+'<div><span class="eyebrow">SQUADRA PRINCIPALE</span><h2>'+E(team.name)+'</h2><p>'+E(team.short_name||'')+' · '+E(chosen?.name||'')+'</p><div class="club-bands">'+bands.map(c=>'<i style="background:'+E(c)+'"></i>').join('')+'</div></div></section>'+
 '<div class="club-columns"><section class="glass panel"><div class="panel-heading"><h2>Avversarie</h2><span class="muted small">'+opponents.length+' squadre</span></div><div class="opponent-grid">'+(opponentsHtml||'<p class="empty">Nessuna avversaria disponibile.</p>')+'</div></section>'+
 '<section class="glass panel"><div class="panel-heading"><h2>Stagioni</h2></div><div class="season-cards">'+seasonsHtml+'</div><p class="subnote">Cambia stagione dal selettore nel menu.</p></section></div>';
}
export function personalPanel(identity,data,E,ico){
 const id=identity?.role?.player_id;if(!id)return '';
 const player=data?.players?.find(p=>p.id===id);if(!player)return '';
 const stats=data?.playerStats?.find(p=>p.player_id===id);
 const name=String(player.first_name||'')+' '+String(player.last_name||'');
 const metric=(value,label)=>'<span><b>'+E(value??'—')+'</b><small>'+label+'</small></span>';
 return '<section class="glass my-dashboard"><div><span class="eyebrow">LA MIA STAGIONE</span><h2>'+E(name)+'</h2><p>Le mie statistiche personali</p></div><div class="my-values">'+metric(stats?.appearances,'Presenze')+metric(stats?.goals,'Gol')+metric(stats?.avg_rating!=null?Number(stats.avg_rating).toFixed(1):null,'Voto medio')+'</div><button class="soft-btn" data-player="'+E(id)+'">Scheda '+ico('chevron',15)+'</button></section>';
}
export function openScoreEditor(fixture,onSaved){
 const overlay=document.createElement('div');overlay.className='overlay editor-overlay';
 overlay.innerHTML='<section class="overlay-card" role="dialog" aria-modal="true" aria-label="Modifica risultato"><button type="button" class="close-overlay" aria-label="Chiudi">×</button><span class="eyebrow">GESTIONE RISULTATO</span><h2>Tabellone ufficiale</h2><p>Risultato e marcatori sono distinti. Non vengono inventati eventi mancanti.</p><form class="result-form"><div class="score-editor"><label class="home-club">Casa<input name="home" min="0" max="99" type="number" inputmode="numeric" placeholder="—"></label><strong>:</strong><label class="away-club">Ospite<input name="away" min="0" max="99" type="number" inputmode="numeric" placeholder="—"></label></div><label>Stato<select name="status"><option value="scheduled">Programmata</option><option value="live">In corso</option><option value="finished">Conclusa</option></select></label><div class="form-error" role="alert"></div><button class="primary-btn" type="submit">Salva risultato</button></form></section>';
 overlay.querySelector('.home-club').firstChild.textContent=fixture.home_team;
 overlay.querySelector('.away-club').firstChild.textContent=fixture.away_team;
 const form=overlay.querySelector('form');form.elements.home.value=fixture.home_score??'';form.elements.away.value=fixture.away_score??'';
 form.elements.status.value=['live','in_progress','playing'].includes(fixture.status)?'live':['finished','finalized','completed','final','ft'].includes(fixture.status)?'finished':'scheduled';
 const close=()=>{document.removeEventListener('keydown',onEscape);overlay.remove()};
 const onEscape=e=>{if(e.key==='Escape')close()};
 overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('.close-overlay'))close()});
 document.addEventListener('keydown',onEscape);
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  const submit=form.querySelector('[type=submit]'),error=form.querySelector('.form-error');
  const numberOf=n=>{const v=form.elements[n].value.trim();return v===''?null:Number(v)};
  submit.disabled=true;error.textContent='';
  try{const updated=await saveFixture(fixture.id,{home_score:numberOf('home'),away_score:numberOf('away'),status:form.elements.status.value});close();onSaved(updated)}
  catch(ex){error.textContent=ex.message||'Modifica non riuscita';submit.disabled=false}
 });
 document.body.appendChild(overlay);form.elements.home.focus();
}
