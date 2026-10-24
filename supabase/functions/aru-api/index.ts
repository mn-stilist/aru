// Aru API — ключи Gumroad, аккаунты, подписка, лимиты примерок
// Действия (POST JSON, поле "action"):
//   check     { license_key }                      — проверить ключ (без входа)
//   activate  { license_key, email, password }     — привязать ключ, создать аккаунт
//   status    (заголовок Authorization: Bearer <токен входа>) — доступ и счётчики
//   use       { kind: "tryon" | "analysis" } (+ токен) — списать одну примерку/анализ
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const PRODUCT_ID = "RH0ftOQ4Z1Rnqq17qkMTMw=="; // Aru — Your Personal AI Stylist (Gumroad)
const RATE_PER_HOUR = 10;          // не чаще 10 примерок в час
const RECHECK_HOURS = 12;          // как часто сверяться с Gumroad

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

type Verdict = { ok: boolean; reason?: string; email?: string; sale_id?: string; subscription_id?: string; paid_until?: string };

function addMonths(d: Date, n: number) { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + n); return x; }

// Спросить Gumroad: ключ настоящий и подписка жива?
async function verifyGumroad(licenseKey: string): Promise<Verdict> {
  const body = new URLSearchParams({ product_id: PRODUCT_ID, license_key: licenseKey.trim(), increment_uses_count: "false" });
  let r: Response;
  try {
    r = await fetch("https://api.gumroad.com/v2/licenses/verify", { method: "POST", body });
  } catch (_) {
    return { ok: false, reason: "gumroad_unreachable" };
  }
  const data = await r.json().catch(() => ({}));
  if (!data.success) return { ok: false, reason: "key_not_found" };
  const p = data.purchase ?? {};
  if (p.refunded || p.chargebacked) return { ok: false, reason: "refunded" };
  if (p.disputed && !p.dispute_won) return { ok: false, reason: "refunded" };
  if (p.subscription_ended_at) return { ok: false, reason: "subscription_ended" };
  if (p.subscription_failed_at) return { ok: false, reason: "payment_failed" };
  // «Оплачено до»: дата покупки + целое число месяцев, ближайшая дата в будущем
  const start = new Date(p.sale_timestamp ?? Date.now());
  let paid = addMonths(start, 1);
  const now = new Date();
  let guard = 0;
  while (paid <= now && guard++ < 240) paid = addMonths(paid, 1);
  return {
    ok: true,
    email: p.email,
    sale_id: p.sale_id ?? p.id,
    subscription_id: p.subscription_id,
    paid_until: paid.toISOString(),
  };
}

async function userFromRequest(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await db.auth.getUser(token);
  return data?.user ?? null;
}

// Свежий статус клиентки: при необходимости сверяемся с Gumroad и обнуляем месячный счётчик
async function freshClient(userId: string) {
  const { data: c } = await db.from("clients").select("*").eq("user_id", userId).maybeSingle();
  if (!c) return null;
  const patch: Record<string, unknown> = {};
  const last = c.last_checked_at ? new Date(c.last_checked_at).getTime() : 0;
  if (Date.now() - last > RECHECK_HOURS * 3600e3) {
    const v = await verifyGumroad(c.license_key);
    if (v.reason !== "gumroad_unreachable") {
      patch.status = v.ok ? "active" : (v.reason === "refunded" ? "refunded" : "expired");
      if (v.paid_until) patch.paid_until = v.paid_until;
      patch.last_checked_at = new Date().toISOString();
    }
  }
  if (Date.now() > addMonths(new Date(c.period_start), 1).getTime()) {
    patch.tryons_used = 0;
    patch.period_start = new Date().toISOString();
  }
  if (Object.keys(patch).length) {
    const { data: u } = await db.from("clients").update(patch).eq("user_id", userId).select("*").single();
    return u;
  }
  return c;
}

const publicView = (c: any) => ({
  email: c.email,
  status: c.status,
  paid_until: c.paid_until,
  tryons_used: c.tryons_used,
  tryons_limit: c.tryons_limit,
  tryons_left: Math.max(0, c.tryons_limit - c.tryons_used),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const b = await req.json().catch(() => ({}));
  const action = String(b.action ?? "");

  try {
    if (action === "check") {
      const key = String(b.license_key ?? "").trim();
      if (!key) return json({ ok: false, reason: "no_key" });
      const v = await verifyGumroad(key);
      if (!v.ok) return json({ ok: false, reason: v.reason });
      const { data: used } = await db.from("clients").select("user_id").eq("license_key", key).maybeSingle();
      return json({ ok: true, bound: !!used, email: v.email });
    }

    if (action === "activate") {
      const key = String(b.license_key ?? "").trim();
      const email = String(b.email ?? "").trim().toLowerCase();
      const password = String(b.password ?? "");
      if (!key || !email || password.length < 6) return json({ ok: false, reason: "bad_input" });
      const v = await verifyGumroad(key);
      if (!v.ok) return json({ ok: false, reason: v.reason });
      const { data: used } = await db.from("clients").select("user_id").eq("license_key", key).maybeSingle();
      if (used) return json({ ok: false, reason: "key_bound" });
      const { data: created, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !created?.user) return json({ ok: false, reason: /already|registered|exists/i.test(error?.message ?? "") ? "email_exists" : "create_failed" });
      const { error: insErr } = await db.from("clients").insert({
        user_id: created.user.id, email, license_key: key,
        gumroad_sale_id: v.sale_id, gumroad_subscription_id: v.subscription_id,
        status: "active", paid_until: v.paid_until, last_checked_at: new Date().toISOString(),
      });
      if (insErr) { await db.auth.admin.deleteUser(created.user.id); return json({ ok: false, reason: "create_failed" }); }
      return json({ ok: true });
    }

    if (action === "status" || action === "use") {
      const user = await userFromRequest(req);
      if (!user) return json({ ok: false, reason: "not_signed_in" }, 401);
      const c = await freshClient(user.id);
      if (!c) return json({ ok: false, reason: "no_subscription" });
      if (action === "status") return json({ ok: true, ...publicView(c) });

      // action === "use": списать одну примерку/анализ
      const kind = b.kind === "analysis" ? "analysis" : "tryon";
      if (c.status !== "active") return json({ ok: false, reason: "inactive", ...publicView(c) });
      if (kind === "tryon" && c.tryons_used >= c.tryons_limit) return json({ ok: false, reason: "quota", ...publicView(c) });
      const since = new Date(Date.now() - 3600e3).toISOString();
      const { count } = await db.from("usage_log").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).gte("created_at", since);
      if ((count ?? 0) >= RATE_PER_HOUR) return json({ ok: false, reason: "rate", ...publicView(c) });
      await db.from("usage_log").insert({ user_id: user.id, kind });
      const used = kind === "tryon" ? c.tryons_used + 1 : c.tryons_used;
      const { data: u } = await db.from("clients").update({ tryons_used: used }).eq("user_id", user.id).select("*").single();
      return json({ ok: true, ...publicView(u ?? c) });
    }

    return json({ ok: false, reason: "unknown_action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ ok: false, reason: "server_error" }, 500);
  }
});
