import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { parseHTML } from "npm:linkedom@0.18.12";
import { assertFixtureIdentity, fetchCsiHtml, parseCsiMatch } from "./csi-parser.js";
import { validatePayload } from "./csi-payload.js";

const url=Deno.env.get("SUPABASE_URL")!;
const service=createClient(url,Deno.env.get("SUPABASE_SECRET_KEY")||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json"};
const respond=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:cors});

export function csiHandler(mode:"scrape"|"import"){
 return async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return respond({error:"Metodo non consentito"},405);
  let fixtureId:string|null=null,sourceUrl:string|null=null,authorized=false;
  try{
   let createdBy:string|null=null;
   const schedulerToken=req.headers.get("x-csi-sync");
   if(schedulerToken&&mode==="scrape"){
    const {data,error}=await service.rpc("tm_csi_scheduler_authorized",{p_token:schedulerToken});
    if(error||data!==true)return respond({error:"Non autenticato"},401);
   }else{
    const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
    if(!token)return respond({error:"Non autenticato"},401);
    const {data:{user},error}=await service.auth.getUser(token);
    if(error||!user)return respond({error:"Non autenticato"},401);
    const {data:role,error:roleError}=await service.from("app_user_roles").select("role").eq("user_id",user.id).maybeSingle();
    if(roleError||!["admin","manager"].includes(role?.role||""))return respond({error:"Accesso riservato allo staff"},403);
    createdBy=user.id;
   }
   const body=await req.json().catch(()=>null);
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body?.fixture_id||""))return respond({error:"Partita non valida"},400);
   fixtureId=body.fixture_id;
   const {data:fixture,error}=await service.from("app_competition_fixtures").select("id,match_code,source_url,home_team,away_team,competition_id,is_test").eq("id",fixtureId).maybeSingle();
   if(error)throw error;if(!fixture)return respond({error:"Partita non trovata"},404);
   sourceUrl=fixture.source_url;
   if(schedulerToken&&fixture.is_test)return respond({error:"Partita di test esclusa"},400);
   authorized=true;
   let raw=body.payload;
   if(mode==="scrape"){
    if(!sourceUrl)throw Error("URL CSI non disponibile per questa partita");
    const {data:competition,error:competitionError}=await service.from("app_competitions").select("minutes_per_period").eq("id",fixture.competition_id).single();
    if(competitionError)throw competitionError;
    raw=parseCsiMatch(parseHTML(await fetchCsiHtml(sourceUrl)).document,sourceUrl,competition.minutes_per_period||40);
   }
   const payload=validatePayload(raw);
   assertFixtureIdentity(fixture,payload);
   const {data:result,error:saveError}=await service.rpc("tm_csi_stage_snapshot",{p_fixture_id:fixtureId,p_source_url:sourceUrl||"manual-json",p_payload:payload,p_created_by:createdBy});
   if(saveError)throw saveError;
   return respond(result);
  }catch(error){
   const message=error instanceof Error?error.message:String((error as any)?.message||"Controllo CSI non riuscito");
   if(authorized&&fixtureId){
    const {error:saveError}=await service.from("app_match_source_checks").upsert({fixture_id:fixtureId,source_url:sourceUrl,last_attempt_at:new Date().toISOString(),last_error:message.slice(0,500),check_status:"error"},{onConflict:"fixture_id"});
    if(saveError)console.error("CSI status persistence failed",saveError.code);
   }
   console.error("CSI check failed",fixtureId,message);
   return respond({ok:false,error:message},502);
  }
 };
}
