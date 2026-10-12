import { createClient } from "npm:@supabase/supabase-js@2.57.0";

// CSI Live integration readiness endpoint. It never receives, echoes or logs CSI credentials.
// A server-side login will be added only after verifying CSI's supported auth contract.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
  const secretKey = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !publicKey || !secretKey) return json({ error: "Server configuration unavailable" }, 503);
  const authorization = req.headers.get("Authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) return json({ error: "Unauthorized" }, 401);
  const token = authorization.replace(/^Bearer\s+/i, "");
  const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await auth.auth.getUser(token);
  if (error || !user) return json({ error: "Unauthorized" }, 401);
  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: role, error: roleError } = await admin.from("app_user_roles")
    .select("role").eq("user_id", user.id).maybeSingle();
  if (roleError) return json({ error: "Role lookup failed" }, 503);
  if (role?.role !== "admin") return json({ error: "Forbidden" }, 403);

  // A secret presence check is intentionally not included in responses.
  return json({
    ok: true,
    integration: "csi-live",
    authentication: "not_implemented",
    automated_sync: "disabled",
    manual_import: "csi-match-import",
    next_step: "Verify documented/authorized CSI Live login and data API endpoints before enabling",
  });
});
