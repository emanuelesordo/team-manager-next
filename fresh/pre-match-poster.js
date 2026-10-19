import {timelinePresentationEvents} from './pre-match-simulation.js';
/** Render the exact displayed match scenario to a 1080×1920 PNG. */
export function drawTimelinePoster(canvas,scenario){
 const w=1080,h=1920;canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas non disponibile');
 const back=ctx.createLinearGradient(0,0,w,h);back.addColorStop(0,'#071e27');back.addColorStop(.55,'#174552');back.addColorStop(1,'#071e27');
 ctx.fillStyle=back;ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#bafa96';ctx.fillRect(52,51,7,64);
 ctx.font='bold 24px system-ui,sans-serif';ctx.fillText('TEAM MANAGER NEXT',79,88);
 ctx.fillStyle='#effbf7';ctx.font='bold 64px system-ui,sans-serif';ctx.fillText('SIMULAZIONE GARA',52,182);
 ctx.font='28px system-ui,sans-serif';ctx.fillStyle='#acc6c6';ctx.fillText('Timeline eventi · scenario prepartita',52,233);
 function panel(x,y,width,height,fill='#0c2635'){
  ctx.fillStyle=fill;ctx.strokeStyle='#275365';ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(x,y,width,height,18);ctx.fill();ctx.stroke();
 }
 function fit(text,maxWidth,font=34){ctx.font='bold '+font+'px system-ui,sans-serif';let s=String(text||'');while(s.length&&ctx.measureText(s).width>maxWidth)s=s.slice(0,-2);return s.length<String(text||'').length?s+'…':s}
 panel(52,263,976,171);
 ctx.textAlign='left';ctx.fillStyle='#f1f7fe';ctx.fillText(fit(scenario.homeName,300,33),80,326);
 ctx.fillStyle='#bafa96';ctx.font='bold 73px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(scenario.score||'—',540,362);
 ctx.textAlign='right';ctx.fillStyle='#f1f7fe';ctx.fillText(fit(scenario.awayName,300,33),997,326);
 ctx.textAlign='left';ctx.fillStyle='#9eb3c4';ctx.font='24px system-ui,sans-serif';
 ctx.fillText('MODULO  '+(scenario.formation||'N/D'),79,402);
 ctx.fillText('FATTIBILITÀ  '+(scenario.feasibility==null?'N/D':Math.round(scenario.feasibility)+'%'),380,402);
 ctx.fillText('COPERTURA DATI  '+Math.round(scenario.coverage||0)+'%',705,402);
 const events=timelinePresentationEvents(scenario.events||[]);
 const top=467,bottom=1730,space=bottom-top;
 const rowHeight=Math.min(130,Math.max(48,space/Math.max(1,events.length)));
 const size=rowHeight;
 ctx.strokeStyle='#35677b';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(94,top+size/2);ctx.lineTo(94,top+size*(events.length-.5));ctx.stroke();
 events.forEach((e,i)=>{
  const y=top+i*size,bold=e.type==='goal'?'#46e7a9':e.type==='substitution'?'#69beff':'#a8bbd0';
  panel(142,y+3,886,Math.max(44,size-8),e.type==='goal'?'#183f36':'#102d36');
  ctx.fillStyle=bold;ctx.beginPath();ctx.arc(94,y+size/2,21,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#133929';ctx.fillStyle='#133929';ctx.lineWidth=2.6;
  ctx.save();ctx.translate(94,y+size/2);ctx.scale(.92,.92);
  ctx.beginPath();
  if(e.type==='goal'){
   ctx.arc(0,0,12,0,Math.PI*2);ctx.stroke();
   ctx.moveTo(0,-7);ctx.lineTo(7,-2);ctx.lineTo(4,6);ctx.lineTo(-4,6);ctx.lineTo(-7,-2);ctx.closePath();ctx.stroke();
  }else if(e.type==='substitution'){
   ctx.moveTo(-13,-5);ctx.lineTo(12,-5);ctx.moveTo(7,-10);ctx.lineTo(12,-5);ctx.lineTo(7,0);
   ctx.moveTo(13,6);ctx.lineTo(-12,6);ctx.moveTo(-7,1);ctx.lineTo(-12,6);ctx.lineTo(-7,11);ctx.stroke();
  }else{ctx.arc(0,0,12,0,Math.PI*2);ctx.moveTo(0,-7);ctx.lineTo(0,0);ctx.lineTo(5,4);ctx.stroke()}
  ctx.restore();
  ctx.font='bold 23px system-ui,sans-serif';ctx.textAlign='left';ctx.fillText(e.minute+'′',46,y+size/2-21);
  ctx.font='bold 25px system-ui,sans-serif';ctx.fillText(e.type==='goal'?'GOL':e.type==='substitution'?'CAMBIO':'FASE',161,y+Math.min(36,size*.4));
  ctx.fillStyle='#f1f7fe';
  ctx.fillText(fit(e.changes?.length>1?e.changes.length+' CAMBI · '+(e.session==='HT'?'INTERVALLO':e.session):e.label,670,rowHeight<76?19:25),315,y+Math.min(36,size*.4));
  const detail=e.changes?.length>1?e.changes.map(c=>c.label).join(' · '):e.type==='goal'?[e.assistman?'Assist: '+e.assistman:null,e.dynamics].filter(Boolean).join(' · '):e.basis;
  if(size>=73){ctx.fillStyle='#a9c4d1';ctx.font=(size<97?17:21)+'px system-ui,sans-serif';
   const max=780;let output=String(detail||'');while(output&&ctx.measureText(output).width>max)output=output.slice(0,-2);
   ctx.fillText(output.length<String(detail||'').length?output+'…':output,162,y+Math.min(size-16,76))}
  if(e.partial){ctx.font='bold 24px system-ui,sans-serif';ctx.fillStyle=bold;ctx.textAlign='right';ctx.fillText(e.partial,998,y+Math.min(size-15,77));ctx.textAlign='left'}
 });
 panel(52,1792,976,80,'#0c2431');
 ctx.font='21px system-ui,sans-serif';ctx.fillStyle='#b7cbd5';ctx.fillText('Scenario simulato su dati pre-gara · non è un risultato ufficiale',74,1840);
 ctx.font='19px system-ui,sans-serif';ctx.fillStyle='#6ea6ad';ctx.fillText('TEAM MANAGER NEXT',52,1891);
 return canvas;
}
export async function saveTimelinePoster(scenario,fileName='simulazione-gara.png'){
 const canvas=drawTimelinePoster(document.createElement('canvas'),scenario);
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Impossibile generare PNG')),'image/png'));
 const url=URL.createObjectURL(blob);
 try{
  // Native share is optional; a direct PNG download remains available.
  const file=new File([blob],fileName,{type:'image/png'});
  if(navigator.canShare?.({files:[file]})&&navigator.share){
   try{await navigator.share({files:[file],title:'Simulazione gara'});return}
   catch(e){if(e.name==='AbortError')return}
  }
  const link=document.createElement('a');link.href=url;link.download=fileName;document.body.append(link);link.click();link.remove();
 }finally{setTimeout(()=>URL.revokeObjectURL(url),4000)}
}
