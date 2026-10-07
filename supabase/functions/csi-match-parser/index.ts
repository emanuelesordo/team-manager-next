const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json"};
Deno.serve((req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 return new Response(JSON.stringify({ok:false,error:"Controllo CSI diretto disabilitato. Usa Importa dati CSI con il JSON generato da csi-scraper."}),{status:410,headers:cors});
});