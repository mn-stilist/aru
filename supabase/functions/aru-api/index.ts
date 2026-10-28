// Aru API — ключи Gumroad, аккаунты, подписка, лимиты примерок
// Действия (POST JSON, поле "action"):
//   check     { license_key }                      — проверить ключ (без входа)
//   activate  { license_key, email, password }     — привязать ключ, создать аккаунт
//   status    (заголовок Authorization: Bearer <токен входа>) — доступ и счётчики
//   use       { kind: "tryon" | "analysis" } (+ токен) — списать одну примерку/анализ
//   admin_list  { code }                         — (Мурат) все клиентки
//   admin_grant { code, email, password?, plan, months, tryons_limit, note } — (Мурат) ручной доступ, оплата Kaspi
//   admin_add   { code, email, tryons }        — (Мурат) докинуть примерки (оплата Kaspi)
//   redeem      { license_key } (+ токен)      — активировать пакет примерок Gumroad вручную
//   Gumroad Ping (форма, ?ping=1)              — пакет примерок начисляется сам после оплаты
// Пакетные примерки (extra_tryons) не сгорают в конце месяца и тратятся после месячных.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const PRODUCT_ID = "RH0ftOQ4Z1Rnqq17qkMTMw=="; // Aru — Your Personal AI Stylist (Gumroad)
const PACK_PRODUCT_ID = () => Deno.env.get("PACK_PRODUCT_ID") ?? ""; // товар «+N примерок» в Gumroad
const PACK_TRYONS = () => Math.max(1, Number(Deno.env.get("PACK_TRYONS") ?? 20) || 20);
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
async function verifyGumroad(licenseKey: string, productId = PRODUCT_ID): Promise<Verdict> {
  const body = new URLSearchParams({ product_id: productId, license_key: licenseKey.trim(), increment_uses_count: "false" });
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
  if (c.source === "manual") {
    const live = c.paid_until && new Date(c.paid_until).getTime() > Date.now();
    const st = live ? "active" : "expired";
    if (st !== c.status) patch.status = st;
  }
  const last = c.last_checked_at ? new Date(c.last_checked_at).getTime() : 0;
  if (c.source !== "manual" && Date.now() - last > RECHECK_HOURS * 3600e3) {
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
  plan: c.plan,
  status: c.status,
  paid_until: c.paid_until,
  tryons_used: c.tryons_used,
  tryons_limit: c.tryons_limit,
  extra_tryons: c.extra_tryons ?? 0,
  tryons_left: Math.max(0, c.tryons_limit - c.tryons_used) + (c.extra_tryons ?? 0),
});

// Начислить пакет примерок по ключу Gumroad (один ключ — один раз)
async function redeemPack(key: string, userId: string | null, emailHint?: string) {
  if (!PACK_PRODUCT_ID()) return { ok: false, reason: "pack_off" };
  const v = await verifyGumroad(key, PACK_PRODUCT_ID());
  if (!v.ok && v.reason !== "subscription_ended") return { ok: false, reason: v.reason };
  let uid = userId;
  if (!uid) {
    const em = String(v.email ?? emailHint ?? "").trim().toLowerCase();
    const { data: c } = await db.from("clients").select("user_id").eq("email", em).maybeSingle();
    if (!c) return { ok: false, reason: "no_client" };
    uid = c.user_id;
  }
  const n = PACK_TRYONS();
  const { error } = await db.from("pack_redemptions").insert({ license_key: key.trim(), user_id: uid, tryons: n });
  if (error) return { ok: false, reason: "pack_used" };
  const { data: c } = await db.from("clients").select("extra_tryons").eq("user_id", uid).maybeSingle();
  const { data: u } = await db.from("clients").update({ extra_tryons: (c?.extra_tryons ?? 0) + n }).eq("user_id", uid).select("*").single();
  return { ok: true, added: n, client: u };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  // Gumroad Ping: приходит формой после каждой оплаты
  if ((req.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
    const f = new URLSearchParams(await req.text());
    const key = f.get("license_key") ?? "";
    if (PACK_PRODUCT_ID() && f.get("product_id") === PACK_PRODUCT_ID() && key) {
      const r = await redeemPack(key, null, f.get("email") ?? "");
      console.log("ping pack", f.get("email"), JSON.stringify({ ok: r.ok, reason: (r as any).reason }));
    }
    return new Response("ok");
  }
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
      if (kind === "tryon" && c.tryons_used >= c.tryons_limit && (c.extra_tryons ?? 0) <= 0) return json({ ok: false, reason: "quota", ...publicView(c) });
      const since = new Date(Date.now() - 3600e3).toISOString();
      const { count } = await db.from("usage_log").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).gte("created_at", since);
      if ((count ?? 0) >= RATE_PER_HOUR) return json({ ok: false, reason: "rate", ...publicView(c) });
      await db.from("usage_log").insert({ user_id: user.id, kind });
      const fromExtra = kind === "tryon" && c.tryons_used >= c.tryons_limit;
      const patch = fromExtra ? { extra_tryons: (c.extra_tryons ?? 0) - 1 } : { tryons_used: kind === "tryon" ? c.tryons_used + 1 : c.tryons_used };
      const { data: u } = await db.from("clients").update(patch).eq("user_id", user.id).select("*").single();
      return json({ ok: true, ...publicView(u ?? c) });
    }

    if (action === "redeem") {
      const user = await userFromRequest(req);
      if (!user) return json({ ok: false, reason: "not_signed_in" }, 401);
      const key = String(b.license_key ?? "").trim();
      if (!key) return json({ ok: false, reason: "no_key" });
      const r = await redeemPack(key, user.id);
      return json(r.ok ? { ok: true, added: r.added, ...publicView(r.client) } : r);
    }

    if (action === "admin_add") {
      const ADMIN = Deno.env.get("ADMIN_CODE") ?? "";
      if (!ADMIN || String(b.code ?? "") !== ADMIN) return json({ ok: false, reason: "bad_code" }, 403);
      const email = String(b.email ?? "").trim().toLowerCase();
      const n = Math.max(1, Math.min(1000, Number(b.tryons ?? 20) || 20));
      const { data: c } = await db.from("clients").select("*").eq("email", email).maybeSingle();
      if (!c) return json({ ok: false, reason: "no_client" });
      const { data: u } = await db.from("clients").update({ extra_tryons: (c.extra_tryons ?? 0) + n }).eq("user_id", c.user_id).select("*").single();
      return json({ ok: true, added: n, client: publicView(u) });
    }

    if (action === "admin_list" || action === "admin_grant") {
      const ADMIN = Deno.env.get("ADMIN_CODE") ?? "";
      if (!ADMIN || String(b.code ?? "") !== ADMIN) return json({ ok: false, reason: "bad_code" }, 403);
      if (action === "admin_list") {
        const { data } = await db.from("clients").select("email,plan,source,status,paid_until,tryons_used,tryons_limit,extra_tryons,note,created_at").order("created_at", { ascending: false });
        return json({ ok: true, clients: data ?? [] });
      }
      const email = String(b.email ?? "").trim().toLowerCase();
      const password = String(b.password ?? "");
      const plan = String(b.plan ?? "personal").slice(0, 40) || "personal";
      const months = Math.max(1, Math.min(24, Number(b.months ?? 1) || 1));
      const limit = Math.max(1, Math.min(10000, Number(b.tryons_limit ?? 100) || 100));
      const note = String(b.note ?? "").slice(0, 300);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, reason: "bad_input" });
      const { data: ex } = await db.from("clients").select("*").eq("email", email).maybeSingle();
      if (ex) {
        const base = ex.paid_until && new Date(ex.paid_until).getTime() > Date.now() ? new Date(ex.paid_until) : new Date();
        if (password) {
          if (password.length < 6) return json({ ok: false, reason: "bad_input" });
          await db.auth.admin.updateUserById(ex.user_id, { password });
        }
        const { data: u } = await db.from("clients").update({
          plan, source: "manual", status: "active", paid_until: addMonths(base, months).toISOString(),
          tryons_limit: limit, note: note || ex.note,
        }).eq("user_id", ex.user_id).select("*").single();
        return json({ ok: true, created: false, client: publicView(u) });
      }
      if (password.length < 6) return json({ ok: false, reason: "bad_input" });
      const { data: created, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !created?.user) return json({ ok: false, reason: /already|registered|exists/i.test(error?.message ?? "") ? "email_exists" : "create_failed" });
      const { data: u, error: insErr } = await db.from("clients").insert({
        user_id: created.user.id, email, license_key: null, source: "manual", plan, status: "active",
        paid_until: addMonths(new Date(), months).toISOString(), tryons_limit: limit, note,
        last_checked_at: new Date().toISOString(),
      }).select("*").single();
      if (insErr) { await db.auth.admin.deleteUser(created.user.id); return json({ ok: false, reason: "create_failed" }); }
      return json({ ok: true, created: true, client: publicView(u) });
    }

    return json({ ok: false, reason: "unknown_action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ ok: false, reason: "server_error" }, 500);
  }
});
