/**
 * Coach-model AI: identifies which of the nine deterministic proposals resembles
 * the coach's historical decisions. The AI cannot add/replace players.
 * All scores and positional feasibility stay owned by the local optimizer.
 */
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ids=rows=>[...new Set(rows.map(x=>String(x)).filter(Boolean))];
export function buildCoachEvidence({fixture,model,data,availability={}}){
 if(!fixture||!model)return null;
 const kickoff=Date.parse(fixture.kickoff_at||'');
 const fixtureMap=new Map((data.fixtures||[]).map(f=>[String(f.id),f]));
 const selectionsByMatch=new Map();
 for(const p of data.priorSelections||[]){
  const id=String(p.match_id||'');if(!id)continue;
  if(!selectionsByMatch.has(id))selectionsByMatch.set(id,[]);
  selectionsByMatch.get(id).push(p);
 }
 const history=[];
 for(const match of (data.matches||[]).slice().sort((a,b)=>Date.parse(a.kickoff_at)-Date.parse(b.kickoff_at))){
  if(match.status!=='finished'||!Number.isFinite(Date.parse(match.kickoff_at))||Date.parse(match.kickoff_at)>=kickoff||match.is_test)continue;
  const rows=selectionsByMatch.get(String(match.id))||[];
  const starters=ids(rows.filter(p=>p.started===true||p.selection_status==='starter').map(p=>p.player_id));
  const available=ids(rows.filter(p=>p.selection_status!=='absent'&&!p.unavailability_reason).map(p=>p.player_id));
  if(starters.length<10||available.length<11)continue;
  const f=fixtureMap.get(String(match.fixture_id));
  history.push({matchId:String(match.id),kickoff:match.kickoff_at,
   formation:match.formation||null,starters,available,
   opponent:f?(f.home_team_id===data.teamId?f.away_team:f.home_team):null,
   venue:match.home_away||null,homeScore:match.home_score,awayScore:match.away_score});
 }
 const proposals=(model.proposals||[model]).filter(p=>!p.duplicate&&p.players?.length===11)
  .map(p=>({id:String(p.rank),formation:String(p.formation),players:p.players.map(x=>({id:String(x.player_id),slot:x.slot,role:x.targetRole||x.role}))}));
 return {target:{kickoff:fixture.kickoff_at,home:fixture.home_team,away:fixture.away_team,
  available:ids(model.availablePlayerIds||[]),overrides:availability},history:history.slice(-45),proposals};
}
export async function coachFingerprint(payload){
 const bytes=new TextEncoder().encode(JSON.stringify(payload));
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
/** Render a non-blocking advisor. The algorithmic XI always remains visible. */
export function mountCoachAI(host,{fixture,model,data,availability,request,onSelection=()=>{}}){
 if(!host||!fixture||!model)return;
 const old=host.querySelector('[data-coach-ai]');
 old?.remove();
 const panel=document.createElement('section');
 panel.dataset.coachAi='';
 panel.className='prematch-footnote';
 panel.style.cssText='padding:12px;margin:12px 0;border:1px solid var(--border,rgba(128,128,128,.3));border-radius:12px';
 panel.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><strong>Previsione scelta del mister · Gemini</strong><button type="button" class="soft-btn" data-coach-ai-retry hidden>Riprova Gemini</button></div><p data-coach-ai-state aria-live="polite">Verifica storico…</p>';
 host.prepend(panel);
 const line=panel.querySelector('[data-coach-ai-state]'),retry=panel.querySelector('[data-coach-ai-retry]');
 const evidence=buildCoachEvidence({fixture,model,data,availability});
 if(!evidence||evidence.history.length<3){
  line.textContent='Storico insufficiente: servono almeno 3 partite con titolari e disponibili registrati. Il confronto algoritmico resta disponibile.';
  return;
 }
 if(!evidence.proposals.length){line.textContent='Nessun undici completo disponibile per la previsione AI.';return}
 let busy=false;
 const renderResult=result=>{
  const proposal=evidence.proposals.find(p=>p.id===String(result.selectedId));
  if(!proposal){line.textContent='Risposta Gemini non compatibile con le proposte attuali.';retry.hidden=false;return}
  const selected=(model.proposals||[]).find(p=>String(p.rank)===proposal.id);
  if(!selected)return;
  onSelection(selected,result);
  line.innerHTML='<b>'+escape(proposal.formation)+'</b> · confidenza '+escape(result.confidence||'bassa')+
   '<p>'+escape(result.reason||'')+'</p>'+
   (result.signals?.length?'<small>'+result.signals.map(escape).join(' · ')+'</small>':'');
  retry.hidden=true;
 };
 const run=async(force=false)=>{
  if(busy)return;
  busy=true;retry.disabled=true;retry.hidden=true;
  line.textContent='Analisi cronologica delle formazioni in corso…';
  try{
   const fingerprint=await coachFingerprint(evidence);
   if(!force){
    const saved=await request(fixture.id,'read');
    if(saved?.fingerprint===fingerprint&&saved?.status==='success'&&saved.result){renderResult(saved.result);return}
   }
   const response=await request(fixture.id,'generate',evidence,fingerprint,force);
   if(response?.status==='success'&&response.result)renderResult(response.result);
   else if(response?.status==='insufficient')line.textContent=response.error||'Storico insufficiente.';
   else throw Error(response?.error||'Analisi Gemini non disponibile');
  }catch(error){
   line.textContent='Gemini non disponibile: '+String(error.message||error)+'. La formazione algoritmica resta valida.';
   retry.hidden=false;
  }finally{busy=false;retry.disabled=false}
 };
 retry.addEventListener('click',()=>run(true));
 run();
}
