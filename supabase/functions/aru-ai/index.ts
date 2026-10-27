// Aru AI — фото клиентки, разбор цветотипа, примерки образов и причёсок (Google Gemini)
// Все действия — POST JSON { action, ... } с заголовком Authorization: Bearer <токен входа>.
//   save_photos   { face?, body?, answers? }  — сохранить фото (dataURL/base64 JPEG) и анкету
//   analyze       {}                          — разбор цветотипа по её фото
//   tryon         { kind: "look"|"hair", key, text? } — примерка (тратит 1 из лимита); key "custom" + text — свой вариант её словами
//   list          {}                          — всё сохранённое: разбор, примерки, ссылки на фото
//   delete_photos {}                          — удалить два исходных фото (разбор и примерки остаются)
//   delete_all    {}                          — удалить всё: фото, примерки, разбор, анкету (подписка остаётся)
// Живые клиентки обрабатываются только на платном тарифе Google (секрет GEMINI_PAID = 1).
// Тестовые аккаунты (тариф "test", только ИИ-героини) работают и на бесплатном.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { decodeBase64, encodeBase64 } from "jsr:@std/encoding@1/base64";

const BUCKET = "client-files";
const RATE_PER_HOUR = 10;
const TEXT_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
const IMAGE_MODELS = [Deno.env.get("IMAGE_MODEL") || "gemini-3.1-flash-image", "gemini-2.5-flash-image"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const KEY = () => Deno.env.get("GEMINI_API_KEY") ?? "";

/* ---------- что примеряем ---------- */
const HAIR: Record<string, string> = {
  bob: "a modern chin-length textured bob with soft volume at the crown and slightly flicked-out ends, side part",
  lob: "a collarbone-length lob with loose effortless beach waves and a deep side part",
  curtain: "long layered hair with curtain bangs parted in the middle, face-framing layers from the cheekbones, bouncy blow-dry volume",
  shag: "a youthful shoulder-length shag cut with choppy layers and wispy bangs, tousled texture",
  pixie: "an elegant modern pixie cut with a long side-swept fringe and soft texture on top, short sides",
  curls: "long voluminous Hollywood curls with soft highlights around the face",
  pony: "a sleek high ponytail with volume at the crown and a few soft face-framing strands",
  bun: "a playful messy top bun with loose face-framing tendrils",
};
const LOOK: Record<string, string> = {
  work: "a modern office look: a tailored blazer, a silk blouse or fine knit top, high-waisted trousers or a midi skirt, elegant shoes and a structured bag",
  day: "a relaxed weekend look: a soft knit sweater or cardigan, straight jeans, comfortable stylish boots or sneakers, a crossbody bag and a scarf",
  party: "a celebration look: an elegant midi dress, heeled shoes, a small clutch and statement earrings",
  date: "a date look: a feminine silk or knit top with a skirt or a slip dress, a light cardigan, delicate jewellery and heeled sandals or boots",
  travel: "a travel look: a long coat or trench, a fine knit top, comfortable trousers, ankle boots and a roomy bag",
  toi: "a festive Kazakh toi look: a modern long velvet kamzol with traditional ornament over a floor-length dress, traditional Kazakh jewellery and elegant shoes",
};
const clean = (v: unknown, n = 400) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const wishLine = (answers: any) => { const w = clean(answers?.wish, 600); return w ? `Her own wishes in her words (follow them where possible, but keep her face and colour palette): "${w}". ` : ""; };
const dislikeLine = (answers: any) => { const w = clean(answers?.dislike, 300); return w ? `She does NOT wear or like: "${w}" — strictly avoid this, even if the outfit description suggests it (for example, if she does not wear floor-length or long items, make the dress knee-length or midi). ` : ""; };
const FACE_RULE =
  "MOST IMPORTANT: this must be exactly the same woman as in the attached photos — copy her face precisely: the same face shape, eyes, eyebrows, nose, lips, smile, skin tone and moles. Do not beautify, slim or change her face or body; keep her real age and proportions. ";

function palette(a: any) {
  const best = (a?.best_colors ?? []).map((c: any) => (typeof c === "string" ? c : c?.name_en || c?.name)).filter(Boolean).slice(0, 8);
  const avoid = (a?.avoid_colors ?? []).map((c: any) => (typeof c === "string" ? c : c?.name_en || c?.name)).filter(Boolean).slice(0, 4);
  return { best: best.join(", "), avoid: avoid.join(", "), metal: a?.metal_en || a?.metal || "" };
}
function hairPrompt(key: string, a: any, answers?: any, text?: string) {
  const shade = (a?.hair_shades ?? []).map((c: any) => c?.name_en || c?.name).filter(Boolean)[0] || "her natural hair colour";
  return FACE_RULE +
    "Create one wide image made of three side-by-side head-and-shoulders photos of her against a plain soft light grey studio background. " +
    "Show the hairstyle from different angles: left — head turned to the left with a happy smile, middle — three-quarter view to the right glancing at the camera over her shoulder, right — looking slightly up and to the side, joyful expression. " +
    "Fresh natural makeup, glowing skin. Keep exactly the same top or clothes she wears in her photo — do not change the clothing, its colour or neckline; only the hairstyle changes. Fill the whole frame with the three photos, no empty margins. " +
    `Hairstyle: ${key === "custom" ? clean(text) : HAIR[key]}, hair colour: ${shade}, glossy and healthy. ` + (key === "custom" ? "" : wishLine(answers)) +
    "Modern hair-salon campaign photo, natural soft daylight, realistic, no text, no logos.";
}
function lookPrompt(key: string, a: any, answers: any, text?: string) {
  const p = palette(a);
  const h = Number(answers?.height) || 0;
  const petite = h && h < 160 ? "She is petite: use high-waisted bottoms, jackets cropped at the waist, a defined waist and heeled shoes to lengthen the legs. " : "";
  return FACE_RULE +
    "Create one wide image made of two side-by-side photos of her on a plain light grey studio wall and concrete floor: left — full-length front view showing the whole outfit and shoes, right — a closer waist-up shot where her face is large and clearly visible, natural smile. " +
    (key === "custom"
      ? `Outfit exactly as she describes it in her own words: "${clean(text)}". Where she does not name colours, use colours from her personal palette: ${p.best}. `
      : `Outfit: ${LOOK[key]}. Use only colours from her personal palette: ${p.best}. Avoid: ${p.avoid}. `) +
    `Jewellery in ${p.metal || "a metal that suits her"}. ` + petite + dislikeLine(answers) + wishLine(answers) +
    "Modern 2026 style, premium fabrics, perfect fit, no visible logos or brand names. Natural soft daylight, realistic photo, no text.";
}
const ANALYZE_PROMPT = (answers: any) => `You are an experienced personal stylist and colour analyst. Look at the woman in the photos (the first is a close-up of the face, the second, if present, is full length).
Determine her colour type using the 12-season system. Consider skin undertone, hair colour (including grey hair), eye colour and contrast. Ignore the clothes and the background lighting.
Her age group: ${JSON.stringify(answers?.age ?? "")}. Decide the colour type ONLY from her natural colouring in the photos; her style preferences must not influence it.
Reply with strict JSON only, no comments, in this exact shape:
{"season":"name in Russian, e.g. Тёмная осень","season_kk":"name in Kazakh","season_en":"name in English",
"undertone":"тёплый|холодный|нейтральный","contrast":"низкий|средний|высокий","chroma":"мягкий|чистый",
"best_colors":[{"name":"Russian","name_en":"English","hex":"#RRGGBB"} x12],
"avoid_colors":[{"name":"Russian","name_en":"English","hex":"#RRGGBB"} x6],
"metal":"золото|серебро","metal_en":"gold|silver",
"hair_shades":[{"name":"Russian","name_en":"English","hex":"#RRGGBB"} x3],
"hair_avoid":[{"name":"Russian","name_en":"English","hex":"#RRGGBB"} x2],
"lips":[{"name":"Russian","name_en":"English","hex":"#RRGGBB"} x3],
"face_shape":"овальное|круглое|квадратное|сердечко|вытянутое|ромб",
"why":"2 sentences in Russian explaining the colour type in simple words",
"confidence":0.0}`;

/* ---------- Gemini ---------- */
async function gemini(model: string, parts: unknown[], cfg: Record<string, unknown>, ms: number) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", signal: ac.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY() },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: cfg }),
    });
    const d = await r.json().catch(() => ({}));
    return { status: r.status, d };
  } catch (e) {
    return { status: 0, d: { error: { message: String(e) } } };
  } finally { clearTimeout(t); }
}
const isQuota = (s: number, d: any) => s === 429 || /quota|billing|exceeded/i.test(d?.error?.message ?? "");

async function readFile(path: string | null) {
  if (!path) return null;
  const { data } = await db.storage.from(BUCKET).download(path);
  if (!data) return null;
  return encodeBase64(new Uint8Array(await data.arrayBuffer()));
}
function toBytes(v: unknown) {
  const s = String(v ?? "");
  if (!s) return null;
  const b64 = s.includes(",") ? s.slice(s.indexOf(",") + 1) : s;
  const bytes = decodeBase64(b64);
  if (bytes.length < 1000 || bytes.length > 8 * 1024 * 1024) throw new Error("bad_image");
  return bytes;
}
async function signed(path: string | null) {
  if (!path) return null;
  const { data } = await db.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const b = await req.json().catch(() => ({}));
  const action = String(b.action ?? "");
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: ud } = token ? await db.auth.getUser(token) : { data: null };
    const user = ud?.user;
    if (!user) return json({ ok: false, reason: "not_signed_in" }, 401);
    const uid = user.id;
    const { data: client } = await db.from("clients").select("*").eq("user_id", uid).maybeSingle();
    if (!client) return json({ ok: false, reason: "no_subscription" });
    if (client.status !== "active") return json({ ok: false, reason: "inactive" });
    const enabled = Deno.env.get("GEMINI_PAID") === "1" || client.plan === "test";
    const { data: prof } = await db.from("client_profile").select("*").eq("user_id", uid).maybeSingle();

    if (action === "save_photos") {
      const patch: Record<string, unknown> = { user_id: uid, updated_at: new Date().toISOString() };
      for (const k of ["face", "body"] as const) {
        const bytes = toBytes(b[k]);
        if (bytes) {
          const path = `${uid}/${k}.jpg`;
          const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: true });
          if (error) return json({ ok: false, reason: "upload_failed" });
          patch[`${k}_path`] = path;
        }
      }
      if (b.answers && typeof b.answers === "object") patch.answers = b.answers;
      const { error: upErr } = await db.from("client_profile").upsert(patch);
      if (upErr) { console.error(upErr); return json({ ok: false, reason: "upload_failed" }); }
      return json({ ok: true });
    }

    if (action === "list") {
      const { data: an } = await db.from("analyses").select("result,created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const { data: tr } = await db.from("tryons").select("id,kind,key,image_path,created_at,custom_text").eq("user_id", uid).eq("status", "done").order("created_at", { ascending: false }).limit(60);
      const tryons = await Promise.all((tr ?? []).map(async (x) => ({ id: x.id, kind: x.kind, key: x.key, text: x.custom_text ?? null, created_at: x.created_at, url: await signed(x.image_path) })));
      return json({
        ok: true, enabled,
        analysis: an?.result ?? null, analysis_at: an?.created_at ?? null,
        answers: prof?.answers ?? {},
        face: await signed(prof?.face_path ?? null), body: await signed(prof?.body_path ?? null),
        tryons, tryons_used: client.tryons_used, tryons_limit: client.tryons_limit, plan: client.plan,
      });
    }

    if (action === "delete_photos") {
      const paths = [prof?.face_path, prof?.body_path].filter(Boolean) as string[];
      if (paths.length) await db.storage.from(BUCKET).remove(paths);
      await db.from("client_profile").update({ face_path: null, body_path: null }).eq("user_id", uid);
      return json({ ok: true, removed: paths.length });
    }

    if (action === "delete_all") {
      const { data: tr } = await db.from("tryons").select("image_path").eq("user_id", uid);
      const paths = [prof?.face_path, prof?.body_path, ...(tr ?? []).map((x) => x.image_path)].filter(Boolean) as string[];
      if (paths.length) await db.storage.from(BUCKET).remove(paths);
      await db.from("tryons").delete().eq("user_id", uid);
      await db.from("analyses").delete().eq("user_id", uid);
      await db.from("client_profile").delete().eq("user_id", uid);
      return json({ ok: true, removed: paths.length });
    }

    if (action === "analyze" || action === "tryon") {
      if (!enabled) return json({ ok: false, reason: "not_enabled" });
      if (!KEY()) return json({ ok: false, reason: "no_key" });
      const since = new Date(Date.now() - 3600e3).toISOString();
      const { count } = await db.from("usage_log").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", since);
      if ((count ?? 0) >= RATE_PER_HOUR) return json({ ok: false, reason: "rate" });
      const face = await readFile(prof?.face_path ?? null);
      if (!face) return json({ ok: false, reason: "need_photo" });
      const body = await readFile(prof?.body_path ?? null);
      const imgs = [{ inline_data: { mime_type: "image/jpeg", data: face } }, ...(body ? [{ inline_data: { mime_type: "image/jpeg", data: body } }] : [])];

      if (action === "analyze") {
        // Три независимых разбора параллельно и голосование: один и тот же цветотип на одних и тех же фото.
        const HX = /^#[0-9a-f]{6}$/i;
        const one = async (model: string) => {
          const { status, d } = await gemini(model, [...imgs, { text: ANALYZE_PROMPT(prof?.answers) }], { responseMimeType: "application/json", temperature: 0 }, 50000);
          if (isQuota(status, d)) return { quota: true };
          const txt = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
          try { const r = JSON.parse(txt); return r?.season ? { r } : { d }; } catch { return { d }; }
        };
        let last: any = null;
        for (const model of TEXT_MODELS) {
          const runs = await Promise.all([one(model), one(model), one(model)]);
          if (runs.some((x: any) => x.quota)) return json({ ok: false, reason: "billing" });
          const ok = runs.map((x: any) => x.r).filter(Boolean);
          last = runs.find((x: any) => x.d)?.d ?? last;
          if (!ok.length) continue;
          const key = (r: any) => String(r.season_en || r.season).toLowerCase().trim();
          const votes: Record<string, any[]> = {};
          for (const r of ok) (votes[key(r)] ??= []).push(r);
          const best = Object.values(votes).sort((a, b) => b.length - a.length || (Number(b[0].confidence) || 0) - (Number(a[0].confidence) || 0))[0];
          const result = best.sort((a, b) => (Number(b.confidence) || 0) - (Number(a.confidence) || 0))[0];
          result.votes = `${best.length}/${ok.length}`;
          const other = ok.find((r: any) => key(r) !== key(result));
          if (other) { result.near = other.season; result.near_kk = other.season_kk || other.season; result.near_en = other.season_en || other.season; }
          for (const k of ["best_colors", "avoid_colors", "hair_shades", "lips"]) for (const c of (Array.isArray(result[k]) ? result[k] : [])) {
            if (c && typeof c === "object" && !HX.test(String(c.hex ?? "").trim())) { const v = [c.name_en, c.name].find((x: any) => HX.test(String(x ?? "").trim())); if (v) { c.hex = String(v).trim(); if (c.name_en === v) delete c.name_en; } }
          }
          await db.from("analyses").insert({ user_id: uid, result, model });
          await db.from("usage_log").insert({ user_id: uid, kind: "analysis" });
          return json({ ok: true, analysis: result });
        }
        console.error("analyze failed", JSON.stringify(last)?.slice(0, 500));
        return json({ ok: false, reason: "ai_failed" });
      }

      // tryon
      const kind = b.kind === "hair" ? "hair" : "look";
      const key = String(b.key ?? "");
      const text = clean(b.text);
      if (key === "custom" ? text.length < 3 : !(kind === "hair" ? HAIR : LOOK)[key]) return json({ ok: false, reason: "bad_input" });
      if (client.tryons_used >= client.tryons_limit) return json({ ok: false, reason: "quota" });
      const { data: an } = await db.from("analyses").select("result").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!an) return json({ ok: false, reason: "need_analysis" });
      const prompt = kind === "hair" ? hairPrompt(key, an.result, prof?.answers, text) : lookPrompt(key, an.result, prof?.answers, text);
      let last: any = null;
      for (const model of IMAGE_MODELS) {
        const base = { responseModalities: ["TEXT", "IMAGE"] };
        let { status, d } = await gemini(model, [...imgs, { text: prompt }], (kind === "hair" ? { ...base, imageConfig: { aspectRatio: "16:9" } } : base), 120000);
        if (status === 400 && kind === "hair") ({ status, d } = await gemini(model, [...imgs, { text: prompt }], base, 120000));
        last = { status, d };
        if (isQuota(status, d)) continue;
        const part = d?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data || p.inline_data?.data);
        const data = part?.inlineData?.data ?? part?.inline_data?.data;
        if (!data) continue;
        const mime = part?.inlineData?.mimeType ?? part?.inline_data?.mime_type ?? "image/png";
        const ext = mime.includes("jpeg") ? "jpg" : "png";
        const { data: row } = await db.from("tryons").insert({ user_id: uid, kind, key, status: "done", model, custom_text: key === "custom" ? text : null }).select("id").single();
        const path = `${uid}/tryons/${row!.id}.${ext}`;
        await db.storage.from(BUCKET).upload(path, decodeBase64(data), { contentType: mime, upsert: true });
        await db.from("tryons").update({ image_path: path }).eq("id", row!.id);
        await db.from("usage_log").insert({ user_id: uid, kind: "tryon" });
        const used = client.tryons_used + 1;
        await db.from("clients").update({ tryons_used: used }).eq("user_id", uid);
        return json({ ok: true, id: row!.id, kind, key, text: key === "custom" ? text : null, url: await signed(path), tryons_used: used, tryons_limit: client.tryons_limit });
      }
      if (last && isQuota(last.status, last.d)) return json({ ok: false, reason: "billing" });
      console.error("tryon failed", JSON.stringify(last?.d)?.slice(0, 500));
      return json({ ok: false, reason: "ai_failed" });
    }

    return json({ ok: false, reason: "unknown_action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ ok: false, reason: String(e).includes("bad_image") ? "bad_image" : "server_error" }, 500);
  }
});
