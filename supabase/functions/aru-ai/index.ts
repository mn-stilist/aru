// Aru AI — фото клиентки, разбор цветотипа, примерки образов и причёсок (Google Gemini)
// Все действия — POST JSON { action, ... } с заголовком Authorization: Bearer <токен входа>.
//   save_photos   { face?, body?, answers? }  — сохранить фото (dataURL/base64 JPEG) и анкету
//   analyze       {}                          — разбор цветотипа по её фото
//   tryon         { kind: "look"|"hair", key, text? } — примерка (тратит 1 из лимита); key "custom" + text — свой вариант её словами
//   list          {}                          — всё сохранённое: разбор, примерки, ссылки на фото
//   save_style    { slot: 0..2, image?: dataURL } — пример стиля «хочу вот так» (без image — убрать)
//   guide         {}                          — личный гид стиля по разбору (одежда, аксессуары, макияж, советы)
//   chat          { q, history? }             — вопрос стилисту, ответ с учётом её разбора
//   items         { cat }                     — фото вещей из её гида (clothes|shoes|bags|jewelry|makeup), один раз, без расхода примерок
//   tryon: color? — тот же образ в другом цвете из палитры / причёска в другом оттенке волос
//   tryon: key "photo" + ref (dataURL) + text? — «Примерить по фото»: образ или причёска в духе присланной картинки (картинка не сохраняется)
//   i18n          {}                          — дописать в разбор казахский и английский (объяснение и названия цветов), один раз
//   delete_photos {}                          — удалить два исходных фото (разбор и примерки остаются)
//   delete_all    {}                          — удалить всё: фото, примерки, разбор, анкету (подписка остаётся)
// Живые клиентки обрабатываются только на платном тарифе Google (секрет GEMINI_PAID = 1).
// Тестовые аккаунты (тариф "test", только ИИ-героини) работают и на бесплатном.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
// base64 без внешних пакетов (jsr.io бывает недоступен при сборке)
const decodeBase64 = (s: string) => Uint8Array.from(atob(s.replace(/\s/g, "")), (c) => c.charCodeAt(0));
const encodeBase64 = (u: Uint8Array) => { let r = ""; for (let i = 0; i < u.length; i += 0x8000) r += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(r); };

const BUCKET = "client-files";
const RATE_PER_HOUR = 10;
const TEXT_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
// разбор цветотипа — более сильная модель (дороже, но всё равно меньше цента), запасные — лёгкие
const ANALYZE_MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
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
  toi: "a glamorous modern evening look for a big Kazakh celebration (toi) in a luxury banquet hall in Almaty: a stunning evening dress in a rich luxurious fabric (satin, silk, velvet, sequins or lace) with a refined fashionable cut, floor-length by default (or an elegant midi to mid-calf if she does not wear long dresses), elegant heeled shoes, a small evening clutch and statement earrings; at most one subtle contemporary ethnic accent (a delicate ornament embroidery or modern ethnic-inspired earrings) — this is a chic evening outfit, NOT a folk costume and NOT a village or everyday look",
};
const clean = (v: unknown, n = 400) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const wishLine = (answers: any) => { const w = clean(answers?.wish, 600); return w ? `Her own wishes in her words (follow them where possible, but keep her face and colour palette): "${w}". ` : ""; };
const dislikeLine = (answers: any) => { const w = clean(answers?.dislike, 300); return w ? `She does NOT wear or like: "${w}" — strictly avoid this, even if the outfit description suggests it (for example, if she does not wear floor-length or long items, make the dress a graceful midi to mid-calf, never with trousers underneath). ` : ""; };
const FACE_RULE =
  "MOST IMPORTANT: this must be exactly the same woman as in the attached photos — copy her face precisely: the same face shape, eyes, eyebrows, nose, lips, smile, skin tone and moles. Do not beautify, slim or change her face or body; keep her real age and proportions. ";
const MAX_STYLES = 3;
const styleLine = (her: number, n: number) => n
  ? `IMAGES: the first ${her === 1 ? "image is" : her + " images are"} HER (the client). The next ${n === 1 ? "image is" : n + " images are"} style inspiration she saved (other people) — take from them only the style: cut, silhouette, type of garments, how things are combined, length, accessories and the overall mood. Never copy the face, hair colour, body or skin of the people in the inspiration images. Colours: if a colour from the inspiration is not in her personal palette, use the closest colour from her palette instead. `
  : "";

function palette(a: any) {
  const best = (a?.best_colors ?? []).map((c: any) => (typeof c === "string" ? c : c?.name_en || c?.name)).filter(Boolean).slice(0, 8);
  const avoid = (a?.avoid_colors ?? []).map((c: any) => (typeof c === "string" ? c : c?.name_en || c?.name)).filter(Boolean).slice(0, 4);
  return { best: best.join(", "), avoid: avoid.join(", "), metal: a?.metal_en || a?.metal || "" };
}
function hairPrompt(key: string, a: any, answers?: any, text?: string, sl = "", color = "") {
  const shade = color || (a?.hair_shades ?? []).map((c: any) => c?.name_en || c?.name).filter(Boolean)[0] || "her natural hair colour";
  return FACE_RULE + sl +
    "Create one wide image made of three side-by-side head-and-shoulders photos of her against a plain soft light grey studio background. " +
    "Show the hairstyle from different angles: left — head turned to the left with a happy smile, middle — three-quarter view to the right glancing at the camera over her shoulder, right — looking slightly up and to the side, joyful expression. " +
    "Fresh natural makeup, glowing skin. Keep exactly the same top or clothes she wears in her photo — do not change the clothing, its colour or neckline; only the hairstyle changes. Fill the whole frame with the three photos, no empty margins. " +
    `Hairstyle: ${key === "custom" ? clean(text) : HAIR[key]}, hair colour: ${shade}, glossy and healthy. ` + (key === "custom" ? "" : wishLine(answers)) +
    "Modern hair-salon campaign photo, natural soft daylight, realistic, no text, no logos.";
}
function lookPrompt(key: string, a: any, answers: any, text?: string, sl = "") {
  const p = palette(a);
  const h = Number(answers?.height) || 0;
  const petite = h && h < 160 ? "She is petite: use high-waisted bottoms, jackets cropped at the waist, a defined waist and heeled shoes to lengthen the legs. " : "";
  return FACE_RULE + sl +
    "Create one wide image made of two side-by-side photos of her on a plain light grey studio wall and concrete floor: left — full-length front view showing the whole outfit and shoes, right — a closer waist-up shot where her face is large and clearly visible, natural smile. " +
    (key === "custom"
      ? `Outfit exactly as she describes it in her own words: "${clean(text)}". Where she does not name colours, use colours from her personal palette: ${p.best}. `
      : `Outfit: ${LOOK[key]}. Use only colours from her personal palette: ${p.best}. Avoid: ${p.avoid}. `) +
    `Jewellery in ${p.metal || "a metal that suits her"}. ` + petite + dislikeLine(answers) + wishLine(answers) +
    "Dress her in a completely new outfit — do not reuse or copy the clothes from her photo. " +
    "The outfit must look like something a well-dressed woman would really wear today: one coherent look, no trousers, leggings or jeans under a dress or skirt, no odd layering, no costume or caricature. " +
    "Modern 2026 style, premium fabrics, perfect fit, no visible logos or brand names. Natural soft daylight, realistic photo, no text.";
}
const REF_RULE = (her: number) => `IMAGES: the first ${her === 1 ? "image is" : her + " images are"} HER (the client). The LAST image is a reference picture she likes (it may show another person, a shop photo or a flat lay). Never copy the face, skin, body or identity of anyone in the reference — the result must show only HER. `;
function photoLookPrompt(a: any, answers: any, note: string, her: number) {
  const p = palette(a);
  return FACE_RULE + REF_RULE(her) +
    "Create one wide image made of two side-by-side photos of her on a plain light grey studio wall and concrete floor: left — full-length front view showing the whole outfit and shoes, right — a closer waist-up shot where her face is large and clearly visible, natural smile. " +
    "Dress her in an outfit in the same direction as the reference: the same types of garments, cut, silhouette, length, how the pieces are combined, the kind of shoes and accessories and the overall mood. A similar look on her, not a pixel copy. " +
    `Colours: keep a colour from the reference only if it suits her personal palette (${p.best}); otherwise use the closest colour from her palette. Avoid: ${p.avoid}. Jewellery in ${p.metal || "a metal that suits her"}. ` +
    (note ? `Her note about the reference (follow it): "${note}". ` : "") + dislikeLine(answers) +
    "Make it look like something a well-dressed woman would really wear today: no trousers or leggings under a dress or skirt, no costume or caricature, perfect fit, premium fabrics, no logos or brand names. Natural soft daylight, realistic photo, no text.";
}
// Preserve the selected product instead of adapting a reference to a personal palette.
function shopItemPrompt(note: string, her: number) {
  return FACE_RULE + REF_RULE(her) +
    "Virtual clothing try-on of the actual product in the LAST image on the client. Preserve the product's original colour, print, pattern scale, cut, length, neckline, sleeves, fabric appearance, seams, fastenings and visible details as faithfully as possible. Do NOT recolour it to her palette, restyle, redesign or substitute a similar garment. " +
    "If the reference shows a single item, replace only the matching clothing category and keep her other clothing where visible, adding only neutral essentials if needed. If it shows a complete outfit, reproduce the visible outfit unless her note selects only one item. Ignore shop UI, price tags, hangers, mannequins and background text. Never transfer another model's identity. " +
    (note ? `Product selection / client note: "${note}". Keep original product details unless she explicitly requests a change. ` : "") +
    "Keep her body proportions, age, face and hairstyle. Show one realistic full-length front view with the complete head, feet and outfit visible against a neutral light grey background. Adapt clothing drape naturally to her existing body; do not slim her. This is an approximate visualisation, never add size, fit or fabric-quality claims. Natural daylight, no added text or watermarks.";
}
function photoHairPrompt(note: string, her: number) {
  return FACE_RULE + REF_RULE(her) +
    "Create one wide image made of three side-by-side head-and-shoulders photos of her against a plain soft light grey studio background: left — head turned to the left with a happy smile, middle — three-quarter view to the right glancing at the camera over her shoulder, right — looking slightly up and to the side, joyful expression. " +
    "Give her the hairstyle from the reference: the same length, layers, fringe, parting, texture, volume and styling, adapted naturally to her face and hair. " +
    "Hair colour: keep her current hair colour exactly as in her photo, unless her note asks for the colour from the reference. " +
    (note ? `Her note about the reference (follow it): "${note}". ` : "") +
    "Keep exactly the same top or clothes she wears in her photo. Fresh natural makeup. Fill the whole frame with the three photos, no empty margins. Modern hair-salon campaign photo, natural soft daylight, realistic, no text, no logos.";
}
const ANALYZE_PROMPT = (answers: any) => `You are an experienced personal stylist and colour analyst. Look at the woman in the photos (the first is a close-up of the face, the second, if present, is full length).
Determine her colour type using the 12-season system. Consider skin undertone, hair colour (including grey hair), eye colour and contrast. Ignore the clothes and the background lighting.
Her age group: ${JSON.stringify(answers?.age ?? "")}. Decide the colour type ONLY from her natural colouring in the photos; her style preferences must not influence it.
Colour names: correct, common literary Russian fashion colour names with correct spelling and ё (e.g. «Кэмел», «Терракотовый», «Тёплый бежевый»), no brand names, no invented words; all 12 best colours must be clearly different from each other.
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
"why":"2 sentences in Russian explaining the colour type in simple words, addressing her directly as вы (У вас…)",
"confidence":0.0}`;

const T3 = '["Russian","Kazakh","English"]';
const GUIDE_PROMPT = (a: any, answers: any) => `You are an experienced personal stylist. Build a personal style guide for a woman.
Her colour analysis: ${JSON.stringify({ season: a?.season, undertone: a?.undertone, contrast: a?.contrast, chroma: a?.chroma, metal: a?.metal, best_colors: a?.best_colors, avoid_colors: a?.avoid_colors, lips: a?.lips, hair_shades: a?.hair_shades })}.
Her questionnaire: ${JSON.stringify(answers ?? {})}. Respect what she does not wear and her wishes. Modern 2026 style, real wearable clothes, Kazakhstan city life.
Do NOT name a body type. All colours must come from or harmonise with her best colours. Each text field is an array of 3 strings: ${T3}. Keep names short (2-4 words), tips one sentence.
Reply with strict JSON only:
{"neutrals":[{"name":${T3},"hex":"#RRGGBB"} x5],
"clothes_yes":[{"type":"dress|coat|trousers|skirt|top|knit|jacket|jeans","name":${T3},"hex":"#RRGGBB"} x6],
"clothes_no":[{"type":"dress|coat|trousers|skirt|top|knit|jacket|jeans|oversize","name":${T3}} x3],
"silhouettes":${T3},
"necklines":[${T3} x4],"fabrics":[${T3} x5],"prints_yes":[${T3} x3],"prints_no":[${T3} x2],
"shoe_shapes":[${T3} x3],"shoe_colors":[{"name":${T3},"hex":"#RRGGBB"} x3],
"bag_shapes":[${T3} x2],"bag_colors":[{"name":${T3},"hex":"#RRGGBB"} x3],
"details":[${T3} x3],
"lips_ok":[{"name":${T3},"hex":"#RRGGBB"} x3],"lips_no":[{"name":${T3},"hex":"#RRGGBB"} x2],
"blush":[{"name":${T3},"hex":"#RRGGBB"} x2],"eyes":[{"name":${T3},"hex":"#RRGGBB"} x3],
"makeup_note":${T3},
"tips":[${T3} x6]}`;
const chatColorName = (c: any, lang: string) => String((lang === "kk" ? c?.name_kk : lang === "en" ? c?.name_en : c?.name) || c?.name || c?.name_en || "");
const chatLanguageOk = (text: unknown, lang: string) => {
  if (typeof text !== "string" || !text.trim()) return false;
  if (lang === "en") return /[a-z]/i.test(text) && !/[Ѐ-ӿ]/u.test(text);
  if (lang === "kk") return /[әғқңөұүһі]/i.test(text);
  return /[а-яё]/i.test(text);
};
const CHAT_PROMPT = (a: any, answers: any, history: any[], q: string, lang: string) => `You are Aru, a warm and practical personal stylist for this woman. Answer in ${lang === "kk" ? "Kazakh" : lang === "en" ? "English" : "Russian"}, 2-5 short sentences, ${lang === "en" ? 'Address her politely as "you".' : lang === "kk" ? 'Address her politely as "сіз".' : 'Address her politely as "вы".'} no greetings like "Привет", concrete: which garments, which of HER colours (use her colour names), metal, shoes, hair or makeup. No body-type labels. If the question is not about style, gently bring it back to style.
Her colour analysis: ${JSON.stringify({ season: a?.season, undertone: a?.undertone, contrast: a?.contrast, metal: a?.metal, best_colors: (a?.best_colors ?? []).map((c: any) => chatColorName(c, lang)), avoid_colors: (a?.avoid_colors ?? []).map((c: any) => chatColorName(c, lang)), lips: (a?.lips ?? []).map((c: any) => chatColorName(c, lang)) })}.
Her questionnaire: ${JSON.stringify(answers ?? {})}.
Conversation so far: ${JSON.stringify((history ?? []).slice(-6))}.
Her question: ${JSON.stringify(q)}.
OUTPUT LANGUAGE: ${lang === "kk" ? "Kazakh" : lang === "en" ? "English" : "Russian"}. This overrides the language of the questionnaire, analysis and conversation history. Do not copy earlier replies in another language. ${lang === "en" ? "The text must contain no Russian or Kazakh sentences and no Cyrillic characters." : ""}\nReply with strict JSON only: {"text":"answer in the required output language","colors":["exact names of 1-3 of her best colours you recommend"]}`;
const ITEM_CATS = ["clothes", "shoes", "bags", "jewelry", "makeup"];
function itemsPrompt(cat: string, a: any) {
  const g = a?.guide ?? {};
  const en = (x: any) => (Array.isArray(x?.name) ? x.name[2] || x.name[0] : x?.name_en || x?.name || "");
  const nm = (x: any) => (Array.isArray(x) ? x[2] || x[0] : String(x ?? ""));
  const col = (x: any) => `${en(x)} (${x?.hex ?? ""})`;
  const metal = a?.metal_en || a?.metal || "gold";
  const base = "Professional e-commerce flat lay product photo, top view, items neatly arranged on a soft warm light-beige background, natural soft daylight, realistic fabrics and materials, premium modern 2026 style, no people, no hands, no text, no logos, no brand names. ";
  if (cat === "clothes") return base + "Exactly these garments, each in its exact colour: " + (g.clothes_yes ?? []).map((c: any) => `${en(c)} in ${col(c)}`).join("; ") + ".";
  if (cat === "shoes") return base + "Three pairs of women's shoes: " + (g.shoe_shapes ?? []).map((s: any, i: number) => `${nm(s)} in ${col((g.shoe_colors ?? [])[i] ?? (g.shoe_colors ?? [])[0])}`).join("; ") + ".";
  if (cat === "bags") { const sh = g.bag_shapes ?? []; return base + `Exactly ${(g.bag_colors ?? []).length || 3} women's bags, one in each colour: ` + (g.bag_colors ?? []).map((c: any, i: number) => `${nm(sh[i % Math.max(1, sh.length)] ?? "bag")} in ${col(c)}`).join("; ") + `; plus small details: ${(g.details ?? []).map(nm).join(", ")}.`; }
  if (cat === "jewelry") return base + `Elegant women's jewellery all in ${metal}: hoop earrings, delicate stud earrings, a fine chain necklace with a small pendant, two thin rings, a slim bracelet and a watch with a ${metal} case.`;
  return base + "Make-up products: lipsticks in " + (g.lips_ok ?? []).map(col).join(", ") + "; a blush compact in " + (g.blush ?? []).map(col).join(", ") + "; an eyeshadow palette with " + (g.eyes ?? []).map(col).join(", ") + "; a soft brush.";
}
const COLOR_LISTS = ["best_colors", "avoid_colors", "hair_shades", "hair_avoid", "lips"];
const missingTranslation = (v: unknown) => typeof v !== "string" || !v.trim() || /^#[0-9a-f]{3,8}$/i.test(v.trim());
const needsI18n = (a: any) => !a || missingTranslation(a.why_kk) || missingTranslation(a.why_en) || COLOR_LISTS.some((k) => (a?.[k] ?? []).some((c: any) => c && typeof c === "object" && (missingTranslation(c.name_kk) || missingTranslation(c.name_en))));
// Перевод разбора на казахский и английский: объяснение цветотипа и названия всех цветов
async function addI18n(a: any) {
  const names = [...new Set(COLOR_LISTS.flatMap((k) => (a?.[k] ?? []).map((c: any) => String(c?.name ?? "")).filter(Boolean)))];
  const prompt = `Translate a personal colour analysis from Russian into Kazakh and English.
Kazakh: natural, modern, literate Kazakh (Cyrillic), fashion vocabulary a stylist in Almaty would use; address the woman politely as "сіз". English: natural fashion English.
Explanation (Russian): ${JSON.stringify(a?.why ?? "")}
Colour names (Russian): ${JSON.stringify(names)}
Reply with strict JSON only: {"why_kk":"...","why_en":"...","names":[["<Russian exactly as given>","<Kazakh>","<English>"], ...one entry per colour name]}`;
  for (const model of TEXT_MODELS) {
    const { status, d } = await gemini(model, [{ text: prompt }], { responseMimeType: "application/json", temperature: 0.2 }, 60000);
    if (isQuota(status, d)) return false;
    const txt = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    try {
      const r = JSON.parse(txt);
      if (missingTranslation(r?.why_kk) || missingTranslation(r?.why_en) || !Array.isArray(r.names)) continue;
      const map: Record<string, [string, string]> = {};
      for (const n of r.names) if (Array.isArray(n) && n[0]) map[String(n[0]).trim().toLowerCase()] = [String(n[1] ?? ""), String(n[2] ?? "")];
      if (names.some((name) => { const pair = map[name.trim().toLowerCase()]; return !pair || pair.some(missingTranslation); })) continue;
      for (const k of COLOR_LISTS) for (const c of (a?.[k] ?? [])) {
        if (!c || typeof c !== "object") continue;
        const m = map[String(c.name ?? "").trim().toLowerCase()];
        if (m?.[0]) c.name_kk = m[0];
        if (missingTranslation(c.name_en) && m?.[1]) c.name_en = m[1];
      }
      a.why_kk = String(r.why_kk); if (r.why_en) a.why_en = String(r.why_en);
      return true;
    } catch { /* следующая модель */ }
  }
  return false;
}
async function makeGuide(a: any, answers: any) {
  for (const model of TEXT_MODELS) {
    const { status, d } = await gemini(model, [{ text: GUIDE_PROMPT(a, answers) }], { responseMimeType: "application/json", temperature: 0.3 }, 60000);
    if (isQuota(status, d)) return null;
    const txt = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    try { const g = JSON.parse(txt); if (g?.clothes_yes?.length) return g; } catch { /* следующая модель */ }
  }
  return null;
}

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

    if (action === "save_style") {
      const slot = Math.floor(Number(b.slot));
      if (!(slot >= 0 && slot < MAX_STYLES)) return json({ ok: false, reason: "bad_input" });
      const cur: string[] = Array.from({ length: MAX_STYLES }, (_, i) => (prof?.style_paths ?? [])[i] ?? "");
      const path = `${uid}/style/${slot}.jpg`;
      if (b.image) {
        const bytes = toBytes(b.image);
        if (!bytes) return json({ ok: false, reason: "bad_image" });
        const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: true });
        if (error) return json({ ok: false, reason: "upload_failed" });
        cur[slot] = path;
      } else {
        if (cur[slot]) await db.storage.from(BUCKET).remove([cur[slot]]);
        cur[slot] = "";
      }
      const { error: upErr } = await db.from("client_profile").upsert({ user_id: uid, style_paths: cur, updated_at: new Date().toISOString() });
      if (upErr) { console.error(upErr); return json({ ok: false, reason: "upload_failed" }); }
      return json({ ok: true, styles: await Promise.all(cur.map((x) => signed(x || null))) });
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
        styles: await Promise.all(Array.from({ length: MAX_STYLES }, (_, i) => signed((prof?.style_paths ?? [])[i] || null))),
        items: Object.fromEntries(await Promise.all(Object.entries(an?.result?.items ?? {}).map(async ([k, v]) => [k, await signed(String(v))]))),
        tryons, tryons_used: client.tryons_used, tryons_limit: client.tryons_limit, extra_tryons: client.extra_tryons ?? 0, plan: client.plan,
      });
    }

    if (action === "delete_photos") {
      const paths = [prof?.face_path, prof?.body_path, ...(prof?.style_paths ?? [])].filter(Boolean) as string[];
      if (paths.length) await db.storage.from(BUCKET).remove(paths);
      await db.from("client_profile").update({ face_path: null, body_path: null, style_paths: [] }).eq("user_id", uid);
      return json({ ok: true, removed: paths.length });
    }

    if (action === "delete_all") {
      const { data: tr } = await db.from("tryons").select("image_path").eq("user_id", uid);
      const paths = [prof?.face_path, prof?.body_path, ...(prof?.style_paths ?? []), ...(tr ?? []).map((x) => x.image_path)].filter(Boolean) as string[];
      const { data: an2 } = await db.from("analyses").select("result").eq("user_id", uid);
      for (const r of an2 ?? []) for (const v of Object.values(r?.result?.items ?? {})) paths.push(String(v));
      if (paths.length) await db.storage.from(BUCKET).remove(paths);
      await db.from("tryons").delete().eq("user_id", uid);
      await db.from("analyses").delete().eq("user_id", uid);
      await db.from("client_profile").delete().eq("user_id", uid);
      return json({ ok: true, removed: paths.length });
    }

    if (action === "items") {
      if (!enabled) return json({ ok: false, reason: "not_enabled" });
      if (!KEY()) return json({ ok: false, reason: "no_key" });
      const cat = String(b.cat ?? "");
      if (!ITEM_CATS.includes(cat)) return json({ ok: false, reason: "bad_input" });
      const { data: an } = await db.from("analyses").select("id,result").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!an?.result?.guide) return json({ ok: false, reason: "need_analysis" });
      const have = an.result.items?.[cat];
      if (have) return json({ ok: true, cat, url: await signed(have) });
      const since = new Date(Date.now() - 3600e3).toISOString();
      const { count } = await db.from("usage_log").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("kind", "items").gte("created_at", since);
      if ((count ?? 0) >= 12) return json({ ok: false, reason: "rate" });
      for (const model of IMAGE_MODELS) {
        const { status, d } = await gemini(model, [{ text: itemsPrompt(cat, an.result) }], { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "4:3" } }, 120000);
        if (isQuota(status, d)) continue;
        const part = d?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data || p.inline_data?.data);
        const data = part?.inlineData?.data ?? part?.inline_data?.data;
        if (!data) continue;
        const mime = part?.inlineData?.mimeType ?? part?.inline_data?.mime_type ?? "image/png";
        const path = `${uid}/items/${an.id}-${cat}.${mime.includes("jpeg") ? "jpg" : "png"}`;
        await db.storage.from(BUCKET).upload(path, decodeBase64(data), { contentType: mime, upsert: true });
        const { data: fresh } = await db.from("analyses").select("result").eq("id", an.id).maybeSingle();
        const res = fresh?.result ?? an.result;
        await db.from("analyses").update({ result: { ...res, items: { ...(res.items ?? {}), [cat]: path } } }).eq("id", an.id);
        await db.from("usage_log").insert({ user_id: uid, kind: "items" });
        return json({ ok: true, cat, url: await signed(path) });
      }
      return json({ ok: false, reason: "ai_failed" });
    }

    if (action === "guide" || action === "chat" || action === "i18n") {
      if (!enabled) return json({ ok: false, reason: "not_enabled" });
      if (!KEY()) return json({ ok: false, reason: "no_key" });
      const { data: an } = await db.from("analyses").select("id,result").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!an) return json({ ok: false, reason: "need_analysis" });
      if (action === "i18n") {
        if (!needsI18n(an.result)) return json({ ok: true, analysis: an.result });
        const res = an.result;
        if (!(await addI18n(res))) return json({ ok: false, reason: "ai_failed" });
        const { data: fresh } = await db.from("analyses").select("result").eq("id", an.id).maybeSingle();
        const merged = { ...(fresh?.result ?? {}), ...res, items: fresh?.result?.items ?? res.items, guide: fresh?.result?.guide ?? res.guide };
        await db.from("analyses").update({ result: merged }).eq("id", an.id);
        return json({ ok: true, analysis: merged });
      }
      if (action === "guide") {
        if (an.result?.guide) return json({ ok: true, guide: an.result.guide });
        const guide = await makeGuide(an.result, prof?.answers);
        if (!guide) return json({ ok: false, reason: "ai_failed" });
        await db.from("analyses").update({ result: { ...an.result, guide } }).eq("id", an.id);
        return json({ ok: true, guide });
      }
      const q = clean(b.q, 500);
      if (q.length < 2) return json({ ok: false, reason: "bad_input" });
      const since = new Date(Date.now() - 3600e3).toISOString();
      const { count } = await db.from("usage_log").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("kind", "chat").gte("created_at", since);
      if ((count ?? 0) >= 40) return json({ ok: false, reason: "rate" });
      const chatLang = b.lang === "en" ? "en" : b.lang === "kk" || b.lang === "kz" ? "kk" : "ru";
      const hist = Array.isArray(b.history) ? b.history.slice(-6).map((m: any) => ({ me: !!m?.me, text: clean(m?.text, 400) })) : [];
      for (const model of TEXT_MODELS) {
        const { status, d } = await gemini(model, [{ text: CHAT_PROMPT(an.result, prof?.answers, hist, q, chatLang) }], { responseMimeType: "application/json", temperature: 0.5 }, 40000);
        if (isQuota(status, d)) return json({ ok: false, reason: "billing" });
        const txt = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
        try {
          const r = JSON.parse(txt);
          if (!chatLanguageOk(r?.text, chatLang)) continue;
          const names = (Array.isArray(r.colors) ? r.colors : []).map((x: any) => String(x).trim().toLowerCase());
          const colors = (an.result?.best_colors ?? []).filter((c: any) => names.some((n: string) => [c?.name, c?.name_en, c?.name_kk].some((v: any) => typeof v === "string" && v.trim().toLowerCase() === n))).slice(0, 3);
          await db.from("usage_log").insert({ user_id: uid, kind: "chat" });
          return json({ ok: true, text: String(r.text), colors });
        } catch { /* следующая модель */ }
      }
      return json({ ok: false, reason: "ai_failed" });
    }

    if (action === "analyze" || action === "tryon") {
      if (!enabled) return json({ ok: false, reason: "not_enabled" });
      if (!KEY()) return json({ ok: false, reason: "no_key" });
      const since = new Date(Date.now() - 3600e3).toISOString();
      const { count } = await db.from("usage_log").select("id", { count: "exact", head: true }).eq("user_id", uid).in("kind", ["analysis", "tryon"]).gte("created_at", since);
      if ((count ?? 0) >= RATE_PER_HOUR) return json({ ok: false, reason: "rate" });
      const face = await readFile(prof?.face_path ?? null);
      if (!face) return json({ ok: false, reason: "need_photo" });
      const body = await readFile(prof?.body_path ?? null);
      const imgs = [{ inline_data: { mime_type: "image/jpeg", data: face } }, ...(body ? [{ inline_data: { mime_type: "image/jpeg", data: body } }] : [])];

      if (action === "analyze") {
        // Пять независимых разборов параллельно и голосование: один и тот же цветотип на одних и тех же фото.
        const HX = /^#[0-9a-f]{6}$/i;
        const one = async (model: string) => {
          const { status, d } = await gemini(model, [...imgs, { text: ANALYZE_PROMPT(prof?.answers) }], { responseMimeType: "application/json", temperature: 0 }, 50000);
          if (isQuota(status, d)) return { quota: true };
          const txt = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
          try { const r = JSON.parse(txt); return r?.season ? { r } : { d }; } catch { return { d }; }
        };
        let last: any = null;
        for (const model of ANALYZE_MODELS) {
          const runs = await Promise.all([one(model), one(model), one(model), one(model), one(model)]);
          if (runs.some((x: any) => x.quota)) return json({ ok: false, reason: "billing" });
          const ok = runs.map((x: any) => x.r).filter(Boolean);
          last = runs.find((x: any) => x.d)?.d ?? last;
          if (!ok.length) continue;
          const key = (r: any) => String(r.season || r.season_en).toLowerCase().replace(/ё/g, "е").trim();
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
          const [guide] = await Promise.all([makeGuide(result, prof?.answers), addI18n(result)]);
          if (guide) result.guide = guide;
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
      const color = clean(b.color, 60);
      const refBytes = key === "photo" ? toBytes(b.ref) : null;
      if (key === "photo" ? !refBytes : key === "custom" ? text.length < 3 : !(kind === "hair" ? HAIR : LOOK)[key]) return json({ ok: false, reason: key === "photo" ? "bad_image" : "bad_input" });
      if (client.tryons_used >= client.tryons_limit && (client.extra_tryons ?? 0) <= 0) return json({ ok: false, reason: "quota" });
      const { data: an } = await db.from("analyses").select("result").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!an) return json({ ok: false, reason: "need_analysis" });
      // примеры стиля: для образов всегда, для причёски — только «свой вариант»
      const useStyles = key !== "photo" && (kind === "look" || key === "custom");
      const styleImgs = useStyles ? (await Promise.all((prof?.style_paths ?? []).filter(Boolean).slice(0, MAX_STYLES).map((x: string) => readFile(x)))).filter(Boolean) as string[] : [];
      const sl = styleLine(imgs.length, styleImgs.length);
      let prompt = key === "photo"
        ? (kind === "hair" ? photoHairPrompt(text, imgs.length) : (b.photo_mode === "garment" ? shopItemPrompt(text, imgs.length) : photoLookPrompt(an.result, prof?.answers, text, imgs.length)))
        : kind === "hair" ? hairPrompt(key, an.result, prof?.answers, text, sl, color) : lookPrompt(key, an.result, prof?.answers, text, sl);
      if (color && kind === "look" && !(key === "photo" && b.photo_mode === "garment")) prompt += ` IMPORTANT: make the main garment (dress, or jacket/top) in the colour "${color}", keep the rest of the outfit harmonious with it.`;
      const refImg = refBytes ? [{ inline_data: { mime_type: "image/jpeg", data: encodeBase64(refBytes) } }] : [];
      const parts = [...imgs, ...styleImgs.map((d) => ({ inline_data: { mime_type: "image/jpeg", data: d } })), ...refImg, { text: prompt }];
      let last: any = null;
      for (const model of IMAGE_MODELS) {
        const base = { responseModalities: ["TEXT", "IMAGE"] };
        let { status, d } = await gemini(model, parts, (kind === "hair" ? { ...base, imageConfig: { aspectRatio: "16:9" } } : base), 120000);
        if (status === 400 && kind === "hair") ({ status, d } = await gemini(model, parts, base, 120000));
        last = { status, d };
        if (isQuota(status, d)) continue;
        const part = d?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data || p.inline_data?.data);
        const data = part?.inlineData?.data ?? part?.inline_data?.data;
        if (!data) continue;
        const mime = part?.inlineData?.mimeType ?? part?.inline_data?.mime_type ?? "image/png";
        const ext = mime.includes("jpeg") ? "jpg" : "png";
        const ctext = key === "custom" || key === "photo" ? (text || null) : (color ? "🎨 " + (clean(b.color_label, 60) || color) : null);
        const { data: row } = await db.from("tryons").insert({ user_id: uid, kind, key, status: "done", model, custom_text: ctext }).select("id").single();
        const path = `${uid}/tryons/${row!.id}.${ext}`;
        await db.storage.from(BUCKET).upload(path, decodeBase64(data), { contentType: mime, upsert: true });
        await db.from("tryons").update({ image_path: path }).eq("id", row!.id);
        await db.from("usage_log").insert({ user_id: uid, kind: "tryon" });
        const fromExtra = client.tryons_used >= client.tryons_limit;
        const used = fromExtra ? client.tryons_used : client.tryons_used + 1;
        const extra = fromExtra ? (client.extra_tryons ?? 0) - 1 : (client.extra_tryons ?? 0);
        await db.from("clients").update(fromExtra ? { extra_tryons: extra } : { tryons_used: used }).eq("user_id", uid);
        return json({ ok: true, id: row!.id, kind, key, text: ctext, url: await signed(path), tryons_used: used, tryons_limit: client.tryons_limit, tryons_left: Math.max(0, client.tryons_limit - used) + extra });
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
