import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const url=Deno.env.get("SUPABASE_URL")!;
const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("SUPABASE_SECRET_KEY")!;
const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json"};
function reply(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:cors})}

async function notifyAdmins(requestId:string,userId:string,username:string){
 const [{data:members},{data:roles}]=await Promise.all([
  admin.from("team_members").select("team_id").eq("profile_id",userId).eq("is_active",true).limit(1),
  admin.from("app_user_roles").select("user_id").eq("role","admin")
 ]);
 let teamId=members?.[0]?.team_id||null;
 if(!teamId){
  const {data:teams}=await admin.from("teams").select("id").limit(1);
  teamId=teams?.[0]?.id||null;
 }
 const adminIds=[...new Set((roles||[]).map(r=>r.user_id).filter(Boolean))];
 if(!teamId||!adminIds.length)return;
 const rows=adminIds.map(recipient_profile_id=>({
  team_id:teamId,
  recipient_profile_id,
  notification_type:"password_reset_request",
  title:"Richiesta reset password",
  body:`${username} ha richiesto il reset della password.`,
  entity_type:"password_reset_request",
  entity_id:requestId
 }));
 const {error}=await admin.from("team_notifications").insert(rows);
 if(error)console.error("password reset notification insert failed",error.message);
}

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"Metodo non consentito"},405);
 try{
  const body=await req.json();
  const username=String(body.username||"").trim().toLowerCase();
  if(!/^[a-z0-9._'-]{3,64}$/.test(username))return reply({ok:true});
  const {data:profile}=await admin.from("profiles").select("id,is_active").eq("username",username).maybeSingle();
  if(profile?.is_active){
   const {data:pending}=await admin.from("tm_password_reset_requests").select("id")
    .eq("user_id",profile.id).eq("status","pending").limit(1);
   if(!pending?.length){
    const {data:created,error}=await admin.from("tm_password_reset_requests").insert({user_id:profile.id}).select("id").single();
    if(!error&&created?.id)await notifyAdmins(created.id,profile.id,username);
   }
  }
  return reply({ok:true,message:"Se l'account è presente, la richiesta sarà esaminata da un amministratore."});
 }catch{return reply({ok:true,message:"Se l'account è presente, la richiesta sarà esaminata da un amministratore."})}
});
