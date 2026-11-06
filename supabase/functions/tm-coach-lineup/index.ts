const cors={'Access-Control-Allow-Origin':'https://emanuelesordo.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const isUUID=(x:unknown)=>typeof x==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(x);
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return respond({error:'Metodo non consentito'},405);
 const url=Deno.env.get('SUPABASE_URL')||'',secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(!url||!secret||!token)return respond({error:'Autenticazione richiesta'},401);
 const auth=await fetch(url+'/auth/v1/user',{headers:{apikey:secret,Authorization:'Bearer '+token}});
 if(!auth.ok)return respond({error:'Sessione non valida'},401);
 const user=await auth.json();
 let input:any;try{input=await req.json()}catch{return respond({error:'JSON non valido'},400)}
 if(!isUUID(input?.fixtureId)||!['read','generate'].includes(input?.mode))return respond({error:'Richiesta non valida'},400);
 const dbheaders={apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'};
 const rows=async(table:string,query:Record<string,string>)=>{
  const response=await fetch(url+'/rest/v1/'+table+'?'+new URLSearchParams(query),{headers:dbheaders});
  if(!response.ok)throw Error('Lettura '+table+' fallita: '+response.status);
  return await response.json();
 };
 let fixture:any,season:any;
 try{
  fixture=(await rows('app_competition_fixtures',{id:'eq.'+input.fixtureId,select:'id,season_id,kickoff_at,status,home_team,away_team',limit:'1'}))[0];
  if(!fixture)return respond({error:'Partita non trovata'},404);
  season=(await rows('app_seasons',{id:'eq.'+fixture.season_id,select:'id,team_id',limit:'1'}))[0];
  if(!season)return respond({error:'Stagione non trovata'},404);
  const [members,admins]=await Promise.all([
   rows('team_members',{team_id:'eq.'+season.team_id,profile_id:'eq.'+user.id,is_active:'eq.true',select:'id',limit:'1'}),
   rows('platform_user_roles',{profile_id:'eq.'+user.id,active:'eq.true',role_code:'eq.platform_super_admin',select:'role_code',limit:'1'})
  ]);
  if(!members.length&&!admins.length)return respond({error:'Accesso riservato allo staff'},403);
 }catch(e){return respond({error:String((e as Error).message)},500)}
 const id=String(input.fixtureId),now=Date.now();
 const cache=async()=>{const r=await rows('tm_ai_coach_lineup_cache',{fixture_id:'eq.'+id,select:'fingerprint,result,status,last_error,retry_after,updated_at',limit:'1'});return r[0]||null};
 const save=async(record:any)=>{
  const res=await fetch(url+'/rest/v1/tm_ai_coach_lineup_cache?on_conflict=fixture_id',{method:'POST',headers:{...dbheaders,Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({fixture_id:id,...record,updated_at:new Date().toISOString()})});
  if(!res.ok)throw Error('Salvataggio cache fallito: '+res.status);
 };
 let saved:any;try{saved=await cache()}catch(e){return respond({error:String(e)},500)}
 if(input.mode==='read')return respond({cached:true,status:saved?.status||'missing',fingerprint:saved?.fingerprint||null,result:saved?.result||null,lastError:saved?.last_error||null,retryAfter:saved?.retry_after||null});
 const payload=input.payload;
 if(!payload||JSON.stringify(payload).length>65000)return respond({error:'Payload troppo grande o assente'},400);
 const fingerprint=String(input.fingerprint||'');
 if(!/^[0-9a-f]{64}$/.test(fingerprint))return respond({error:'Fingerprint non valido'},400);
 if(saved?.fingerprint===fingerprint&&saved?.status==='success'&&saved.result)return respond({cached:true,status:'success',result:saved.result});
 if(saved?.fingerprint===fingerprint&&saved?.retry_after&&Date.parse(saved.retry_after)>now&&!input.force)return respond({status:'error',error:saved.last_error||'Riprovare più tardi',retryAfter:saved.retry_after},429);
 if(!Array.isArray(payload.proposals)||!payload.proposals.length||payload.proposals.length>9)return respond({error:'Formazioni candidate non valide'},400);
 if(!Array.isArray(payload.history)||payload.history.length<3)return respond({status:'insufficient',error:'Servono almeno 3 formazioni storiche ufficiali con convocati attendibili.'});
 const currentIds=new Set((await rows('app_roster',{season_id:'eq.'+season.id,active:'eq.true',select:'player_id',limit:'150'})).map((r:any)=>r.player_id));
 const proposals=payload.proposals.map((p:any)=>({id:String(p.id),formation:String(p.formation),players:(p.players||[]).map((x:any)=>({id:String(x.id),slot:Number(x.slot),role:String(x.role||'')}))}));
 if(proposals.some((p:any)=>!p.players.length||p.players.length>11||new Set(p.players.map((x:any)=>x.id)).size!==p.players.length||p.players.some((x:any)=>!currentIds.has(x.id))))return respond({error:'Una proposta contiene giocatori non tesserati o duplicati'},400);
 const cutoff=Date.parse(fixture.kickoff_at);
 const hist=payload.history.filter((h:any)=>isUUID(h.matchId)&&Date.parse(h.kickoff)<cutoff&&Array.isArray(h.available)&&Array.isArray(h.starters)&&h.starters.length>=10&&h.available.length>=11).sort((a:any,b:any)=>Date.parse(a.kickoff)-Date.parse(b.kickoff)).slice(-45);
 if(hist.length<3)return respond({status:'insufficient',error:'Storico verificabile insufficiente: disponibilità e titolari devono essere presenti nelle distinte.'});
 // Check that referenced past matches truly belong to this season and predate kickoff.
 const authoritative=await rows('app_matches',{season_id:'eq.'+season.id,select:'id,kickoff_at,status,formation',limit:'200'});
 const valid=new Map(authoritative.filter((m:any)=>m.status==='finished'&&Date.parse(m.kickoff_at)<cutoff).map((m:any)=>[m.id,m]));
 const historicalIds=hist.filter((h:any)=>valid.has(h.matchId)).map((h:any)=>h.matchId);
 const officialRows=historicalIds.length?await rows('app_match_players',{match_id:'in.('+historicalIds.join(',')+')',select:'match_id,player_id,started,selection_status,unavailability_reason',limit:'2500'}):[];
 const grouped=new Map<string,any[]>();
 for(const p of officialRows){const key=String(p.match_id);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key)!.push(p)}
 const evidence=hist.filter((h:any)=>valid.has(h.matchId)).map((h:any)=>{
  const record:any=valid.get(h.matchId),p=grouped.get(h.matchId)||[];
  const starters=[...new Set(p.filter((x:any)=>x.started===true||x.selection_status==='starter').map((x:any)=>x.player_id))];
  const available=[...new Set(p.filter((x:any)=>x.selection_status!=='absent'&&!x.unavailability_reason).map((x:any)=>x.player_id))];
  return {matchId:h.matchId,kickoff:record.kickoff_at,formation:record.formation,opponent:h.opponent,
   venue:h.venue,homeScore:h.homeScore,awayScore:h.awayScore,starters,available};
 }).filter((h:any)=>h.starters.length>=10&&h.available.length>=11);
 if(evidence.length<3)return respond({status:'insufficient',error:'Le distinte ufficiali non contengono abbastanza disponibilità e titolari verificabili.'});
 const apiKey=Deno.env.get('GEMINI_API_KEY');
 if(!apiKey)return respond({error:'GEMINI_API_KEY non configurata'},503);
 const prompt='Sei un analista delle abitudini decisionali di un allenatore di calcio amatoriale. Analizza cronologicamente solo le partite precedenti. Non interpretare un assente come scelta tecnica, non inventare disponibilità storiche, non usare risultati successivi alla data della partita. Devi SELEZIONARE ESCLUSIVAMENTE uno degli id delle proposte ricevute, motivandolo con frequenza dei titolari, sistema di gioco, rotazioni, precedenti contro avversari comparabili, assenze e continuità. Non inventare giocatori. JSON obbligatorio: {"selectedId":"id","reason":"testo italiano sintetico","signals":["massimo 4 motivi"],"confidence":"bassa|media|alta"}. La confidence è qualitativa. I dati dei match sono una sequenza temporale; evita causalità non supportata.';
 const body={contents:[{parts:[{text:prompt+'\nDATI:\n'+JSON.stringify({target:payload.target,history:evidence,proposals})}]}],generationConfig:{responseMimeType:'application/json',temperature:0.2}};
 let failure='Errore Gemini',status=503;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key='+encodeURIComponent(apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
   if(!response.ok){status=response.status;failure='Gemini HTTP '+status;if(![429,500,502,503,504].includes(status))break;await delay(500*(attempt+1)**2);continue}
   const data=await response.json(),raw=data?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||'').join('')||'';
   const result=JSON.parse(raw);
   if(!proposals.some((p:any)=>p.id===result.selectedId))throw Error('Gemini ha restituito una formazione non valida');
   const clean={selectedId:result.selectedId,reason:String(result.reason||'').slice(0,1000),signals:Array.isArray(result.signals)?result.signals.slice(0,4).map((v:any)=>String(v).slice(0,220)):[],confidence:['bassa','media','alta'].includes(result.confidence)?result.confidence:'bassa',sampleSize:evidence.length};
   await save({fingerprint,status:'success',result:clean,last_error:null,retry_after:null});
   return respond({status:'success',result:clean,cached:false});
  }catch(error){failure=String((error as Error).message);if(attempt<2)await delay(500*(attempt+1)**2)}
 }
 const retryAfter=new Date(Date.now()+(status===429?120000:30000)).toISOString();
 await save({fingerprint,status:'error',result:null,last_error:failure,retry_after:retryAfter});
 return respond({status:'error',error:failure,retryAfter},status===429?429:503);
});
