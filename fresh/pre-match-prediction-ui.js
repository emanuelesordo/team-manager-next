const pct=value=>Math.round(Number(value||0)*100);
const score=value=>Number(value||0).toLocaleString('it-IT',{minimumFractionDigits:1,maximumFractionDigits:1});
const signed=value=>{const n=Math.round((Number(value||.5)-.5)*200);return n===0?'neutro':(n>0?'+':'')+n};
const metric=value=>Number(value||0).toLocaleString('it-IT',{minimumFractionDigits:1,maximumFractionDigits:1});
const metric2=value=>Number(value||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});
const venueLabel=v=>{
 if(!v)return '';
 const labels={natural:'naturale',synthetic:'sintetico',hybrid:'ibrido',narrow:'stretto',standard:'standard',wide:'largo',short:'corto',long:'lungo'};
 return [v.surface_type,v.width_profile,v.length_profile].filter(Boolean).map(x=>labels[x]||x).join(' · ');
};

export function preMatchPredictionContainer(fixture,escape=value=>String(value??'')){
 if(!fixture||!['scheduled','postponed'].includes(String(fixture.status||'')))return '';
 return '<section class="glass prematch-prediction" data-prematch-prediction="'+escape(fixture.id)+'" aria-label="Pronostico statistico pre-partita">'+
  '<div class="prematch-prediction-head"><div><span class="eyebrow">MODELLO PRE-PARTITA</span><h3>Pronostico statistico</h3></div>'+
  '<span class="prematch-model-badge">DATI · NON QUOTE</span></div>'+
  '<div class="prematch-loading"><span class="loader"></span><span>Analisi forma, rango, situazioni di gara e campo…</span></div></section>';
}

export function renderPreMatchPrediction(result,escape=value=>String(value??'')){
 if(!result)return '<p class="empty">Dati insufficienti per elaborare un pronostico pre-partita.</p>';
 const p=result.probabilities||{},most=p.mostLikely||{},comparison=result.comparison||{};
 const homeStats=comparison.home||{},awayStats=comparison.away||{};
 const comparisonRows=[
  ['Punti / gara',metric2(homeStats.ppg),metric2(awayStats.ppg)],
  ['Gol fatti / gara',metric(homeStats.gfPerGame),metric(awayStats.gfPerGame)],
  ['Gol subiti / gara',metric(homeStats.gaPerGame),metric(awayStats.gaPerGame)],
  ['DR / gara',(homeStats.gdPerGame>=0?'+':'')+metric(homeStats.gdPerGame),(awayStats.gdPerGame>=0?'+':'')+metric(awayStats.gdPerGame)],
  ['Forma recente · pt/g',metric2(homeStats.recentPpg),metric2(awayStats.recentPpg)]
 ];
 const attention=(result.attention||[]);
 const outcomes=[
  ['1',result.home.name,p.home],
  ['X','Pareggio',p.draw],
  ['2',result.away.name,p.away]
 ];
 const factorRows=(result.factors||[]).map(f=>{
  const home=signed(f.home),away=signed(f.away);
  return '<div class="prematch-factor"><div class="prematch-factor-title"><strong>'+escape(f.label)+'</strong>'+
   '<span><b>'+escape(home)+'</b><i>vs</i><b>'+escape(away)+'</b></span></div><small>'+escape(f.detail||'')+'</small></div>';
 }).join('');
 const field=result.venue?'<div class="prematch-field-profile"><span>CAMPO</span><strong>'+escape(result.venue.name||'Campo partita')+'</strong>'+
  '<small>'+escape(venueLabel(result.venue)||'Profilo non definito')+'</small></div>':'';
 const comparisonMarkup='<section class="prematch-compare"><div class="prematch-section-title"><span class="eyebrow">CONFRONTO</span><h4>Numeri delle due squadre</h4></div>'+
  '<div class="prematch-compare-head"><strong>'+escape(result.home.name)+'</strong><span></span><strong>'+escape(result.away.name)+'</strong></div>'+
  comparisonRows.map(row=>'<div class="prematch-compare-row"><b>'+escape(row[1])+'</b><span>'+escape(row[0])+'</span><b>'+escape(row[2])+'</b></div>').join('')+'</section>';
 const attentionMarkup='<section class="prematch-attention"><div class="prematch-section-title"><span class="eyebrow">PUNTI DI ATTENZIONE</span><h4>Pattern da tenere d’occhio</h4></div>'+
  (attention.length?'<div class="prematch-attention-grid">'+attention.map(item=>'<article class="prematch-attention-item '+escape(item.tone||'watch')+'">'+
   '<div><span>'+escape(item.club)+'</span><strong>'+escape(item.label)+'</strong></div><b>'+escape(item.value)+'</b><small>'+escape(item.detail)+'</small></article>').join('')+'</div>':
   '<p class="prematch-attention-empty">Campione ancora troppo ridotto per evidenziare pattern situazionali affidabili.</p>')+'</section>';
 return '<div class="prematch-summary">'+
  '<div class="prematch-expected"><span>RISULTATO ATTESO</span><strong>'+score(result.expectedGoals.home)+' <i>–</i> '+score(result.expectedGoals.away)+'</strong>'+
  '<small>Risultato esatto più probabile: <b>'+escape(most.home)+'–'+escape(most.away)+'</b> ('+pct(most.probability)+'%)</small></div>'+
  '<div class="prematch-ranks"><span><small>Potenziale atteso</small><b>#'+escape(result.home.potentialRank)+' '+escape(result.home.name)+'</b></span>'+
  '<span><small>Potenziale atteso</small><b>#'+escape(result.away.potentialRank)+' '+escape(result.away.name)+'</b></span></div>'+
  '</div>'+
  '<div class="prematch-probabilities">'+outcomes.map(([key,label,value])=>
   '<div class="prematch-probability"><div><b>'+escape(key)+'</b><span>'+escape(label)+'</span><strong>'+pct(value)+'%</strong></div>'+
   '<i><span style="width:'+pct(value)+'%"></span></i></div>').join('')+'</div>'+
  field+comparisonMarkup+attentionMarkup+
  (result.narrative?'<section class="prematch-narrative"><div class="prematch-section-title"><span class="eyebrow">SCENARIO ATTESO</span><h4>Come può svilupparsi la gara</h4></div><p>'+escape(result.narrative)+'</p></section>':'')+
  '<details class="prematch-details"><summary>Dettaglio dei fattori del modello</summary><div class="prematch-factor-grid">'+factorRows+'</div></details>'+
  '<p class="prematch-footnote">Copertura dati: <b>'+escape(result.coverage)+'%</b> · '+escape(result.completedCompetitionMatches)+
  ' gare concluse della competizione disponibili prima di questa partita. Il modello usa solo dati antecedenti al match e non incorpora informazioni successive.</p>';
}
