/**
 * Private staff-only injury/discipline history.
 * Underlying source: existing general-model injuries and suspensions tables.
 * These queries are never made for unauthenticated / ordinary players.
 */
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=v=>{if(!v)return '—';const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'}):'—'};
export function staffPlayerHistory(role,playerId,teamId,data){
 if(!['admin','manager'].includes(role))return '';
 const injuries=(data?.injuries||[]).filter(x=>x.player_id===playerId&&x.team_id===teamId)
  .sort((a,b)=>String(b.injury_date||'').localeCompare(String(a.injury_date||'')));
 const suspensions=(data?.suspensions||[]).filter(x=>x.player_id===playerId&&x.team_id===teamId)
  .sort((a,b)=>String(b.issued_date||'').localeCompare(String(a.issued_date||'')));
 const injuryRows=injuries.map(x=>'<article class="private-history-entry"><div><strong>'+
  E(x.status||'Da verificare')+'</strong><small>'+E(format(x.injury_date))+'</small></div>'+
  '<p>Rientro: '+E(format(x.actual_return||x.expected_return))+'</p>'+
  (x.public_summary?'<p>'+E(x.public_summary)+'</p>':'')+'</article>').join('');
 const suspensionRows=suspensions.map(x=>'<article class="private-history-entry"><div><strong>'+
  E(x.suspension_type||'Squalifica')+'</strong><small>'+E(x.status||'')+'</small></div>'+
  '<p>'+E(x.matches_served??'—')+' / '+E(x.matches_count??'—')+' giornate scontate'+
  (x.issued_date?' · '+E(format(x.issued_date)):'')+'</p>'+
  (x.reason?'<p>'+E(x.reason)+'</p>':'')+'</article>').join('');
 return '<section class="glass panel private-player-history"><div class="panel-heading"><h2>Disponibilità e disciplina</h2><span class="staff-private-mark">RISERVATO STAFF</span></div>'+
  '<div class="private-history-grid"><div><h3>Infortuni</h3>'+injuryRows+
  (injuries.length?'':'<p class="staff-help">Nessuna registrazione leggibile nello storico corrente.</p>')+
  '</div><div><h3>Squalifiche</h3>'+suspensionRows+
  (suspensions.length?'':'<p class="staff-help">Nessuna registrazione leggibile nello storico corrente.</p>')+'</div></div>'+
  '<p class="subnote">Dati riservati letti solo con permessi RLS del modello generale. Assenza di registrazioni non significa automaticamente idoneità sportiva.</p></section>';
}
