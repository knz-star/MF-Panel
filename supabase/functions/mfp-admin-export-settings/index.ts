import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) return reply({ error: "Server configuration is incomplete." }, 500);
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token || token === auth) return reply({ error: "Please sign in as an administrator." }, 401);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return reply({ error: "Your session has expired. Please sign in again." }, 401);
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await admin.from("mfp_user_profiles").select("role,account_status").eq("user_id", userData.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role !== "ADMIN" || profile.account_status !== "ACTIVE") return reply({ error: "Administrator access is required." }, 403);
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "read";
    if (action === "read") {
      const { data, error } = await admin.from("config").select("value").eq("key", "export_settings").maybeSingle();
      if (error) throw error;
      return reply({ success: true, zip_password: typeof data?.value?.zip_password === "string" ? data.value.zip_password : "" });
    }
    if (action === "write") {
      const password = typeof body.zip_password === "string" ? body.zip_password.trim() : "";
      if (!password || password.length > 256) return reply({ error: "Enter a valid ZIP password (1–256 characters)." }, 400);
      const { error } = await admin.from("config").upsert({ key: "export_settings", value: { zip_password: password }, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
      return reply({ success: true });
    }
    return reply({ error: "Unsupported action." }, 400);
  } catch (error) {
    console.error("mfp-admin-export-settings", error);
    return reply({ error: "Could not process export settings. Check the Edge Function logs." }, 500);
  }
});
