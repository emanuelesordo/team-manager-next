/** Lightweight, accessible vector analytics. Only recorded final scores enter charts. */
import {isFinished, matchResult} from './domain.js';

const numeric = x => typeof x === 'number' && Number.isFinite(x);
const xml = x => String(x ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));

/** One team's scored fixtures, oldest first (without assuming a home/away ordering). */
export function scoredFixtures(fixtures, isOurs, limit=8) {
  return fixtures.filter(f => isFinished(f) && numeric(f.home_score) && numeric(f.away_score) && (isOurs(f.home_team)||isOurs(f.away_team)))
    .slice().sort((a,b) => new Date(a.kickoff_at) - new Date(b.kickoff_at)).slice(-limit);
}
export function scoreSeries(fixtures, isOurs) {
  return fixtures.map(f => ({
    gf: isOurs(f.home_team)?f.home_score:f.away_score,
    ga: isOurs(f.home_team)?f.away_score:f.home_score,
    date: f.kickoff_at,
    opponent: isOurs(f.home_team)?f.away_team:f.home_team,
  }));
}

/** Compact sparkline: goals for vs against; no extrapolations or fake zero points. */
export function goalsChart(fixtures, isOurs, {mini=false}={}) {
  const scores=scoreSeries(scoredFixtures(fixtures,isOurs,8),isOurs);
  if (!scores.length) return '<div class="viz-empty">Andamento non disponibile finché non risultano partite concluse.</div>';
  if (scores.length===1) {
    const v=scores[0],max=Math.max(v.gf,v.ga,1);
    return `<div class="single-goals" role="img" aria-label="Ultima partita: ${v.gf} gol fatti, ${v.ga} gol subiti"><div><span>Fatti</span><div class="single-goal-track"><i class="gf" style="width:${v.gf/max*100}%"></i></div><b>${v.gf}</b></div><div><span>Subiti</span><div class="single-goal-track"><i class="ga" style="width:${v.ga/max*100}%"></i></div><b>${v.ga}</b></div></div>`;
  }
  const W=560,H=mini?108:174,left=mini?12:28,right=12,top=14,bottom=mini?12:28;
  const plotW=W-left-right,plotH=H-top-bottom;
  const max=Math.max(1,...scores.flatMap(s=>[s.gf,s.ga]));
  const x=i=>left+(scores.length===1?plotW/2:i*plotW/(scores.length-1));
  const y=v=>top+(max-v)/max*plotH;
  const points=k=>scores.map((s,i)=>`${x(i).toFixed(1)},${y(s[k]).toFixed(1)}`).join(' ');
  const axis=mini?'':Array.from({length:3},(_,i)=>{const v=Math.round(i*max/2),yy=y(v);return `<line x1="${left}" x2="${W-right}" y1="${yy}" y2="${yy}" stroke="currentColor" stroke-opacity=".11" stroke-dasharray="3 6"/><text x="${left-8}" y="${yy+3}" text-anchor="end" fill="currentColor" font-size="11" opacity=".65">${v}</text>`}).join('');
  const lines=['ga','gf'].map((k,n)=>{
    const color=k==='gf'?'#e3ff65':'#99a9af';
    const poly=scores.length>1?`<polyline points="${points(k)}" fill="none" stroke="${color}" stroke-width="${mini?2.8:3.5}" stroke-linecap="round" stroke-linejoin="round"/>`:'';
    const dots=scores.map((s,i)=>`<circle cx="${x(i)}" cy="${y(s[k])}" r="${mini?3.5:4.5}" fill="${color}"><title>${xml(s.opponent)}: ${k==='gf'?'fatti':'subiti'} ${s[k]}</title></circle>`).join('');
    return poly+dots;
  }).join('');
  const dates=mini?'':scores.filter((_,i)=>scores.length<=5||i%Math.ceil(scores.length/5)===0||i===scores.length-1).map(s=>{const i=scores.indexOf(s);const d=new Date(s.date);return `<text x="${x(i)}" y="${H-5}" text-anchor="middle" fill="currentColor" opacity=".67" font-size="10">${Number.isNaN(+d)?'—':`${d.getDate()}/${d.getMonth()+1}`}</text>`}).join('');
  const label=`Gol fatti e subiti nelle ultime ${scores.length} partite concluse con risultato noto`;
  return `<div class="goal-plot ${mini?'mini':''}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${xml(label)}" preserveAspectRatio="xMidYMid meet"><title>${xml(label)}</title>${axis}${lines}${dates}</svg><div class="viz-legend"><span><i class="legend-gf"></i>Gol fatti</span><span><i class="legend-ga"></i>Gol subiti</span></div></div>`;
}

export function resultMix({w=0,d=0,l=0}={}, {compact=false}={}) {
  const values=[Math.max(0,w),Math.max(0,d),Math.max(0,l)];const total=values.reduce((a,b)=>a+b,0);
  if (!total)return '<div class="viz-empty">Esiti disponibili dopo il primo risultato ufficiale.</div>';
  const circumference=2*Math.PI*42;let sum=0;
  const circles=values.map((value,i)=>{const len=value/total*circumference;const out=`<circle cx="60" cy="60" r="42" fill="none" stroke="${['#e3ff65','#a1ad9a','#f3a98e'][i]}" stroke-width="12" stroke-dasharray="${len} ${circumference-len}" stroke-dashoffset="${-sum}" transform="rotate(-90 60 60)"/>`;sum+=len;return out;}).join('');
  return `<div class="mix-view ${compact?'compact':''}"><svg viewBox="0 0 120 120" role="img" aria-label="Bilancio: ${w} vittorie, ${d} pareggi, ${l} sconfitte"><circle cx="60" cy="60" r="42" fill="none" stroke="currentColor" stroke-opacity=".09" stroke-width="12"/>${circles}<text x="60" y="57" text-anchor="middle" class="donut-main">${total}</text><text x="60" y="73" text-anchor="middle" class="donut-label">GARE</text></svg><div class="mix-breakdown"><div><i class="legend-win"></i><span>Vittorie</span><b>${w}</b></div><div><i class="legend-draw"></i><span>Pareggi</span><b>${d}</b></div><div><i class="legend-loss"></i><span>Sconfitte</span><b>${l}</b></div></div></div>`;
}

export function segmentedRecord(summary) {
  const n=summary.w+summary.d+summary.l;
  if (!n)return '<div class="viz-empty">Nessun risultato registrato.</div>';
  return `<div class="segment-stack" aria-label="${summary.w} vittorie, ${summary.d} pareggi, ${summary.l} sconfitte">${[['w','win'],['d','draw'],['l','loss']].filter(([k])=>summary[k]>0).map(([k,cls])=>`<span class="${cls}" style="width:${summary[k]/n*100}%" title="${summary[k]} ${k==='w'?'vittorie':k==='d'?'pareggi':'sconfitte'}"></span>`).join('')}</div>`;
}

export function splitVenue(fixtures,isOurs) {
  const completed=scoredFixtures(fixtures,isOurs,10000);
  const halves=[{key:'Casa',list:completed.filter(f=>isOurs(f.home_team))},{key:'Trasferta',list:completed.filter(f=>isOurs(f.away_team))}];
  return `<div class="venue-comparison">${halves.map(x=>{const w=x.list.filter(f=>matchResult(f,isOurs)==='w').length, d=x.list.filter(f=>matchResult(f,isOurs)==='d').length, l=x.list.length-w-d;return `<div class="venue-line"><div><b>${x.key}</b><span>${x.list.length} partite · ${w}V ${d}N ${l}P</span></div>${x.list.length?segmentedRecord({w,d,l}):'<div class="segment-stack blank"></div>'}</div>`}).join('')}</div>`;
}

export function scorersChart(stats, {limit=7}={}) {
  const rows=stats.filter(p=>numeric(p.goals)&&p.goals>0).slice().sort((a,b)=>b.goals-a.goals||(a.last_name||'').localeCompare(b.last_name||'')).slice(0,limit);
  if(!rows.length)return '<div class="viz-empty">Nessun marcatore individuale registrato.</div>';
  const max=Math.max(...rows.map(p=>p.goals));
  return `<div class="ranking-bars">${rows.map((p,i)=>`<div class="ranking-line"><span class="ranking-index">${i+1}</span><span class="ranking-name" title="${xml(`${p.first_name||''} ${p.last_name||''}`.trim())}">${xml(`${p.first_name||''} ${p.last_name||''}`.trim())}</span><div class="ranking-track"><span style="width:${(p.goals/max*100).toFixed(1)}%"></span></div><strong>${p.goals}</strong></div>`).join('')}</div>`;
}

export function rosterDistribution(people) {
  const labels=[['P','Portieri'],['D','Difensori'],['C','Centrocampisti'],['A','Attaccanti']];
  const count=labels.map(([key,label])=>({key,label,count:people.filter(p=>String(p.role||'').toUpperCase().startsWith(key)).length}));
  const total=count.reduce((a,b)=>a+b.count,0);
  if (!total)return '<div class="viz-empty">Posizioni non disponibili.</div>';
  return `<div class="role-strip" aria-label="Distribuzione giocatori per ruolo">${count.filter(x=>x.count>0).map((x,i)=>`<div class="role-segment" style="flex:${x.count}" title="${x.label}: ${x.count}"><span>${x.key}</span><b>${x.count}</b></div>`).join('')}</div><div class="role-legend">${count.map(x=>`<span>${x.label} <b>${x.count}</b></span>`).join('')}</div>`;
}
