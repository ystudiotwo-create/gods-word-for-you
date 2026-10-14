// 重新產生 index.html：node tools/build.mjs
// 1. 檢查 content/ 裡每個經文出處都存在於和合本，祝福與禱告格式正確
// 2. 從 data/cuv.json（和合本）取出經文與前後各五節上下文
// 3. 把資料、版畫產生器、樣式組成單一的 index.html（GitHub Pages 直接使用）
import { readFileSync, writeFileSync } from "node:fs";
import { createBible, parseRef, withText } from "./pipeline.js";
const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const bible = createBible(JSON.parse(read("data/cuv.json")));
const notes = JSON.parse(read("content/passages.json"));
const topics = JSON.parse(read("content/topics.json"));
const P = {}, errors = [];
for (const t of topics) {
  for (const [ref] of t.passages) {
    if (P[ref]) continue;
    const r = parseRef(bible, ref);
    if (!r) { errors.push(`找不到出處 ${ref}`); continue; }
    if (r.end > bible.chapterLength(r.book, r.chapter)) errors.push(`超出章節範圍 ${ref}`);
    if (!notes[ref]) errors.push(`content/passages.json 缺少 ${ref} 的說明`);
    const x = withText(bible, r);
    P[ref] = { label: x.label, verses: x.verses, before: x.before, after: x.after, ...notes[ref] };
  }
  for (const w of ["self", "other"]) for (const k of ["blessing", "prayer"]) {
    const s = t[w]?.[k] || "";
    if (!s) errors.push(`缺少 ${t.key}.${w}.${k}`);
    if (k === "prayer" && !s.endsWith("奉主耶穌的名求，阿們。")) errors.push(`禱告結尾 ${t.key}.${w}`);
    if (w === "other" && !s.includes("{name}")) errors.push(`${t.key}.other.${k} 缺少 {name}`);
  }
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
const lin = read("tools/linocut.js").replace(/^export\s+/gm, "");
const page = read("tools/index.src.html").replace("/*BASECSS*/", () => read("tools/base.css"))
  .replace("/*LINOCUT*/", () => lin).replace("/*DATA*/", () => JSON.stringify({ topics, passages: P }));
const i = page.indexOf("</style>") + 8;
const html = `<!doctype html>\n<html lang="zh-Hant-TW">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${page.slice(0, i)}\n</head>\n<body>\n${page.slice(i)}\n</body>\n</html>\n`;
writeFileSync(new URL("index.html", root), html);
console.log(`✓ ${topics.length} 個主題、${Object.keys(P).length} 段經文 → index.html`);
