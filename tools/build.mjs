// 重新產生 index.html（中文）與 en/index.html（English）：node tools/build.mjs
// 1. 檢查 content/ 裡每個經文出處都存在於聖經資料，祝福與禱告格式正確
// 2. 從 data/cuv.json（和合本）／data/web.json（World English Bible）取出經文與前後各五節上下文
// 3. 把資料、介面文字（tools/strings.json）、版畫產生器、樣式組成單一的 HTML（GitHub Pages 直接使用）
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createBible, parseRef, withText } from "./pipeline.js";
const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const SITE = "https://ystudiotwo-create.github.io/gods-word-for-you/";
const strings = JSON.parse(read("tools/strings.json"));
const zhTopics = JSON.parse(read("content/topics.json"));

// 英文版沿用中文版的分類、版畫主題與印章，只替換文字
function englishTopics() {
  const en = new Map(JSON.parse(read("content/en/topics.json")).map((t) => [t.key, t]));
  return zhTopics.map(({ keywords, ...t }) => {
    const e = en.get(t.key);
    return e ? { ...t, name: e.name, passages: e.passages, blessings: e.blessings, prayers: e.prayers } : { ...t, missing: true };
  });
}

const LANGS = [
  { lang: "zh", bible: "data/cuv.json", notes: "content/passages.json", topics: () => zhTopics, out: "index.html",
    amen: "奉主耶穌的名求，阿們。", label: "個主題、{p} 段經文" },
  { lang: "en", bible: "data/web.json", notes: "content/en/passages.json", topics: englishTopics, out: "en/index.html",
    amen: "In Jesus’ name, Amen.", label: "topics, {p} passages" },
];

const errors = [];
const built = LANGS.map((L) => {
  const bible = createBible(JSON.parse(read(L.bible)));
  const notes = JSON.parse(read(L.notes));
  const topics = L.topics();
  const P = {};
  for (const t of topics) {
    if (t.missing) { errors.push(`[${L.lang}] content/en/topics.json 缺少 ${t.key}`); continue; }
    if (t.passages.map(([r]) => r).join() !== zhTopics.find((z) => z.key === t.key).passages.map(([r]) => r).join())
      errors.push(`[${L.lang}] ${t.key} 的經文出處和中文版不同`);
    for (const [ref] of t.passages) {
      if (P[ref]) continue;
      const r = parseRef(bible, ref);
      if (!r) { errors.push(`[${L.lang}] 找不到出處 ${ref}`); continue; }
      if (r.end > bible.chapterLength(r.book, r.chapter)) errors.push(`[${L.lang}] 超出章節範圍 ${ref}`);
      if (!notes[ref]) errors.push(`[${L.lang}] ${L.notes} 缺少 ${ref} 的說明`);
      const x = withText(bible, r);
      P[ref] = { label: x.label, verses: x.verses, before: x.before, after: x.after, ...notes[ref] };
    }
    // 每段經文各有一則祝福與一則禱告（為自己／為他人），順序對應 passages
    for (const k of ["blessings", "prayers"]) {
      if (t[k]?.length !== t.passages.length) errors.push(`[${L.lang}] ${t.key}.${k} 數量要和 passages 一樣`);
      (t[k] || []).forEach((b, i) => {
        if (!b.self) errors.push(`[${L.lang}] 缺少 ${t.key}.${k}[${i}].self`);
        if (!b.other?.includes("{name}")) errors.push(`[${L.lang}] ${t.key}.${k}[${i}].other 缺少 {name}`);
        if (k === "prayers") for (const w of ["self", "other"])
          if (!(b[w] || "").endsWith(L.amen)) errors.push(`[${L.lang}] 禱告結尾 ${t.key}.prayers[${i}].${w}`);
      });
    }
  }
  return { L, topics, P };
});
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }

const lin = read("tools/linocut.js").replace(/^export\s+/gm, "");
for (const { L, topics, P } of built) {
  const S = strings[L.lang];
  const page = read("tools/index.src.html").replace("/*BASECSS*/", () => read("tools/base.css"))
    .replace("/*LINOCUT*/", () => lin).replace("/*DATA*/", () => JSON.stringify({ topics, passages: P }))
    .replace("/*STRINGS*/", () => JSON.stringify(S.js))
    .replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in S)) throw new Error(`tools/strings.json 缺少 ${L.lang}.${k}`); return S[k]; });
  const i = page.indexOf("</style>") + 8;
  const alternates = LANGS.map((x) => `<link rel="alternate" hreflang="${strings[x.lang].htmlLang}" href="${SITE}${x.out.replace("index.html", "")}">`).join("\n");
  const html = `<!doctype html>\n<html lang="${S.htmlLang}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${alternates}\n${page.slice(0, i)}\n</head>\n<body>\n${page.slice(i)}\n</body>\n</html>\n`;
  if (L.out.includes("/")) mkdirSync(new URL(L.out.replace(/[^/]+$/, ""), root), { recursive: true });
  writeFileSync(new URL(L.out, root), html);
  console.log(`✓ ${topics.length} ${L.label.replace("{p}", Object.keys(P).length)} → ${L.out}`);
}
