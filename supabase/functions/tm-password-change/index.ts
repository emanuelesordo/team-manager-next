import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const url = Deno.env.get("SUPABASE_URL")!;
const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
};

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Metodo non consentito" }, 405);

  try {
    const authHeader = req.headers.get("authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt || jwt === authHeader) return reply({ error: "Accesso richiesto" }, 401);

    const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error } = await client.auth.getUser(jwt);
    if (error || !user) return reply({ error: "Accesso richiesto" }, 401);

    const { password } = await req.json();
    if (typeof password !== "string" || password.length < 10 || password.length > 128) {
      return reply({ error: "Usa una password di almeno 10 caratteri" }, 400);
    }

    const result = await admin.auth.admin.updateUserById(user.id, { password });
    if (result.error) throw result.error;

    const { error: profileError } = await admin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id);
    if (profileError) throw profileError;

    return reply({ ok: true });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Errore cambio password" }, 500);
  }
});
