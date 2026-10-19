/**
 * 經文管線（不依賴任何套件，瀏覽器與 Node 共用）
 * Scripture pipeline shared by the Next.js server and the standalone page.
 *
 *   1. buildSelectPrompt  → LLM 只回傳「出處」，不回傳經文文字
 *   2. validateSelection  → 對照和合本資料檢查書卷／章／節是否存在
 *   3. buildReviewPrompt  → 第二次呼叫：附上和合本原文與上下文，做釋經審核、寫祝福與禱告
 *   4. assembleResult     → 只保留審核通過的經文，經文文字一律取自和合本
 */

export const CATEGORIES = {
  comfort: "安慰",
  encourage: "鼓勵",
  edify: "造就",
  exhort: "勸勉",
};

export const MOTIF_KEYS = ["lamp", "sheep", "dove", "tree", "eagle", "rock", "boat", "sprout", "path", "vine", "hands", "lily", "anchor", "cross", "birds", "nest", "house", "rainbow", "moon", "book"];

const MAX_VERSES = 8;          // 一段經文最多幾節（以完整意思單元為準，但不要整章）
const CONTEXT_RADIUS = 5;      // 「看上下文」前後各幾節

/* ---------------- Bible access ---------------- */

/** 包裝和合本資料，提供查詢 */
export function createBible(data) {
  const byId = new Map();
  data.books.forEach((b, i) => byId.set(b.id, { ...b, index: i }));
  const aliases = new Map();
  for (const b of byId.values()) {
    for (const k of [b.id, b.name, b.abbr, b.en, b.en.replace(/\s/g, "")]) aliases.set(norm(k), b.id);
  }
  return {
    translation: data.translation,
    books: [...byId.values()],
    book(id) { return byId.get(id) || byId.get(aliases.get(norm(id))) || null; },
    /** 取一段經文，回傳 [{v, text}]；併入上節的空節會被略過 */
    verses(bookId, chapter, start, end) {
      const b = this.book(bookId); if (!b) return [];
      const ch = b.chapters[chapter - 1]; if (!ch) return [];
      const out = [];
      for (let v = Math.max(1, start); v <= Math.min(end, ch.length); v++) if (ch[v - 1]) out.push({ v, text: ch[v - 1] });
      return out;
    },
    chapterLength(bookId, chapter) {
      const b = this.book(bookId); return b?.chapters[chapter - 1]?.length ?? 0;
    },
  };
}
const norm = (s) => String(s || "").toLowerCase().replace(/[\s.]/g, "");

/** 出處字串 → 物件，接受 "Ps 23:1-4"、"詩篇 23:1–4"、"詩 23:4" */
export function parseRef(bible, s) {
  const m = String(s).trim().match(/^(.+?)\s*(\d+)\s*[:：]\s*(\d+)(?:\s*[-–—~]\s*(\d+))?$/);
  if (!m) return null;
  const b = bible.book(m[1]); if (!b) return null;
  return { book: b.id, chapter: +m[2], start: +m[3], end: +(m[4] || m[3]) };
}

export function refLabel(bible, ref) {
  const b = bible.book(ref.book);
  const range = ref.start === ref.end ? `${ref.start}` : `${ref.start}–${ref.end}`;
  return { zh: `${b.name} ${ref.chapter}:${range}`, en: `${b.en.toUpperCase()} ${ref.chapter}:${range}`, abbr: `${b.abbr} ${ref.chapter}:${range}` };
}

/* ---------------- crisis ---------------- */

const CRISIS_PATTERNS = [
  /自殺|輕生|尋死|想死|死掉算了|乾脆死|不如死|去死|消失就好|不想活|活不下去|活著沒意思|結束(自己的)?生命|了結|跳樓|跳下去|燒炭|割腕|上吊|吞藥|安眠藥.{0,6}(很多|一堆|全部)/,
  /自殘|自傷|傷害自己|割自己|劃自己/,
  /家暴|被打|打我|毆打|施暴|虐待|性侵|強暴|性騷擾|被摸|威脅要殺|想殺/,
];
/** 本地危機偵測（LLM 也會判斷；兩者任一為真就顯示求助資訊） */
export function detectCrisis(text) {
  return CRISIS_PATTERNS.some((re) => re.test(String(text || "")));
}

export const HELPLINES = [
  { name: "安心專線", number: "1925", note: "24 小時，免付費" },
  { name: "生命線", number: "1995", note: "24 小時" },
  { name: "張老師專線", number: "1980", note: "" },
  { name: "保護專線（家暴、性侵）", number: "113", note: "24 小時" },
  { name: "緊急求助", number: "110 / 119", note: "有立即危險時" },
];

/* ---------------- step 1: select references ---------------- */

export function buildSelectPrompt({ bible, topics, situation, forWhom = "self", name = "", category = "" }) {
  const bookList = bible.books.map((b) => `${b.id}=${b.name}`).join(" ");
  const library = topics.map((t) => `- ${t.name}（${t.key}）：${t.refs.join("、")}`).join("\n");
  return `你是熟悉聖經與正統釋經學的牧者助手。使用者描述了一個處境，請從聖經中挑選最合適、而且不會斷章取義的經文出處。

【處境】
對象：${forWhom === "other" ? `為他人（稱呼：${name || "未提供"}）` : "為自己"}
使用者指定的用途：${category ? CATEGORIES[category] : "未指定，請你判斷"}
內容：「${situation}」

【規則】
1. 只回傳出處，不要寫出任何經文文字。經文文字會由系統從和合本資料庫取出。
2. 選 4 段候選經文（之後會再審核並刪去不合適的）。每段 1–${MAX_VERSES} 節，以完整意思單元為準，不要只截半句。
3. 優先選擇本身就是普遍性教導的經文（詩篇的禱告、耶穌的教導、書信中的勸勉）。對特定對象的應許（例如給被擄以色列民的應許）只有在能合理應用時才選，並保留給審核階段說明。
4. 不要選會被讀成「一定痊癒」「一定發財」「問題立刻解決」的經文用法；不要選會讓受苦的人覺得被定罪的經文。
5. 用途判斷：安慰（悲傷、失落、病痛）、鼓勵（軟弱、懼怕、需要力量）、造就（成長、學習、服事）、勸勉（需要調整方向、悔改、和好），溫和為本。
6. 可以從下面的主題經文庫選，也可以選庫外經文，但書卷代號必須用下面的代號。
7. 若內容有自殺、自傷、家暴、性侵等危機訊號，crisis 設為 true。

【書卷代號】
${bookList}

【主題經文庫】
${library}

【只回傳一個 JSON 物件，格式如下】
{"category":"comfort|encourage|edify|exhort","crisis":false,"themes":["主題 key"],"candidates":[{"book":"Ps","chapter":23,"start":1,"end":4,"why":"一句話說明為何適合"}]}`;
}

/** 驗證 LLM 選的出處；回傳合法的出處（去重、修正範圍） */
export function validateSelection(bible, raw) {
  const out = [], seen = new Set(), rejected = [];
  const list = Array.isArray(raw?.candidates) ? raw.candidates : [];
  for (const c of list) {
    const b = bible.book(c?.book);
    const chapter = Math.trunc(Number(c?.chapter));
    let start = Math.trunc(Number(c?.start)), end = Math.trunc(Number(c?.end ?? c?.start));
    const len = b ? bible.chapterLength(b.id, chapter) : 0;
    if (!b || !len || !(start >= 1) || start > len) { rejected.push(c); continue; }
    if (!(end >= start)) end = start;
    end = Math.min(end, len, start + MAX_VERSES - 1);
    const key = `${b.id}.${chapter}.${start}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ book: b.id, chapter, start, end, why: String(c?.why || "").slice(0, 200) });
  }
  return {
    category: CATEGORIES[raw?.category] ? raw.category : "comfort",
    crisis: !!raw?.crisis,
    themes: Array.isArray(raw?.themes) ? raw.themes.map(String).slice(0, 4) : [],
    candidates: out.slice(0, 5),
    rejected,
  };
}

/** 從主題經文庫補候選（LLM 回傳不足時使用） */
export function fallbackCandidates(bible, topics, situation, n = 3) {
  const scored = topics.map((t) => ({ t, s: t.keywords.reduce((a, k) => a + (situation.includes(k) ? 1 : 0), 0) }))
    .sort((a, b) => b.s - a.s);
  const pick = scored[0]?.s ? scored[0].t : topics.find((t) => t.key === "peace");
  return pick.refs.slice(0, n).map((r) => ({ ...parseRef(bible, r), why: `主題經文庫：${pick.name}` }));
}

/** 附上原文與上下文 */
export function withText(bible, ref) {
  const verses = bible.verses(ref.book, ref.chapter, ref.start, ref.end);
  const before = bible.verses(ref.book, ref.chapter, ref.start - CONTEXT_RADIUS, ref.start - 1);
  const after = bible.verses(ref.book, ref.chapter, ref.end + 1, ref.end + CONTEXT_RADIUS);
  return { ...ref, label: refLabel(bible, ref), verses, before, after };
}

/* ---------------- step 2: exegetical review + blessing + prayer ---------------- */

export function buildReviewPrompt({ situation, forWhom = "self", name = "", category, passages, motifs }) {
  const who = forWhom === "other"
    ? `為他人代求（稱呼：${name || "這位朋友"}），祝福與禱告用第三人稱，例如「願主…${name || "他"}…」`
    : "為自己，祝福用第二人稱「你」，禱告用第一人稱「我」";
  const blocks = passages.map((p, i) => `#${i} ${p.label.zh}（選擇理由：${p.why || "—"}）
前文：${p.before.map((v) => `${v.v} ${v.text}`).join(" ") || "（章首）"}
【經文】${p.verses.map((v) => `${v.v} ${v.text}`).join(" ")}
後文：${p.after.map((v) => `${v.v} ${v.text}`).join(" ") || "（章末）"}`).join("\n\n");
  const motifList = Object.entries(motifs).map(([k, v]) => `${k}=${v.zh}`).join("、");

  return `你是嚴謹的釋經審核者，也是溫柔的牧者。以下經文文字取自和合本（1919），請不要改寫或另外引用經文文字。

【使用者處境】「${situation}」
【對象】${who}
【用途】${CATEGORIES[category] || "安慰"}

【候選經文（含上下文）】
${blocks}

【第一步：審核每一段】
逐段判斷用在這個處境是否合乎上下文、沒有斷章取義、沒有過度應用：
- 說話者是誰、對誰說、在什麼處境下說？
- 原意是什麼？套用到使用者身上的合理橋樑是什麼？
- 若原本是給特定對象（例如以色列民、某位先知、某間教會）的話，要誠實說明，並指出可以應用的「神的屬性或原則」是什麼，而不是把應許直接當成個人保證。
- 不得用經文暗示「一定痊癒」「一定成功」「受苦是因為信心不夠」。
不合適就 keep:false 並寫 reason。

【第二步：寫祝福與禱告】
- 只根據審核通過的經文，祝福 80–150 字，禱告 100–200 字，以「奉主耶穌的名求，阿們。」結尾。
- 溫暖、具體回應處境，不說教、不定罪；勸勉時溫和指出方向，仍以恩典為基調。
- 不承諾具體結果；可以求神同在、賜力量、賜平安、引導醫治的過程。
- 用繁體中文，避免宗派色彩濃厚的用語。
- 若處境涉及危機，禱告中也鼓勵當事人向身邊的人與專業求助。

【第三步：插畫】
從以下版畫主題挑一個最貼近主要經文意象的：${motifList}
另給一個代表主題的漢字作為落款印章（例如 安、望、恩、力、光、愛、靜、生）。
再用一句英文描述一個象徵性的畫面（image_concept），供圖像模型使用：只用象徵物（光、燈、羊、牧杖、葡萄樹、磐石、鴿子、水流、種子、雙手、道路等），不要描繪耶穌或任何人物的清楚面孔，畫面中不要有文字。

【只回傳一個 JSON 物件】
{"review":[{"index":0,"keep":true,"reason":"若不保留，說明原因","context_summary":"上下文：說話者、對象、處境（40–80字）","original_meaning":"原意（30–60字）","application_bridge":"為何能合理應用在此處境（40–80字）","caution":"容易被誤用之處，沒有就留空"}],"order":[0,2,1],"blessing":"","prayer":"","motif":"lamp","seal":"安","image_concept":"an oil lamp glowing on a dark path"}
order 只放 keep:true 的 index，最適合的排第一，最多 3 個。`;
}

export function assembleResult({ selection, passages, review, motifs }) {
  const rv = new Map();
  for (const r of Array.isArray(review?.review) ? review.review : []) {
    const i = Number(r?.index); if (Number.isInteger(i) && passages[i]) rv.set(i, r);
  }
  let order = (Array.isArray(review?.order) ? review.order : []).map(Number)
    .filter((i, k, a) => Number.isInteger(i) && passages[i] && rv.get(i)?.keep !== false && a.indexOf(i) === k);
  if (!order.length) order = passages.map((_, i) => i).filter((i) => rv.get(i)?.keep === true);
  const kept = order.slice(0, 3).map((i) => {
    const r = rv.get(i) || {};
    return {
      ...passages[i],
      reviewed: rv.has(i),
      context_summary: str(r.context_summary), original_meaning: str(r.original_meaning),
      application_bridge: str(r.application_bridge), caution: str(r.caution),
    };
  });
  const dropped = passages.map((p, i) => ({ p, r: rv.get(i) })).filter(({ r }) => r && r.keep === false)
    .map(({ p, r }) => ({ label: p.label, reason: str(r.reason) }));
  const motif = MOTIF_KEYS.includes(review?.motif) ? review.motif : "lamp";
  const seal = (str(review?.seal).match(/[一-鿿]/) || ["恩"])[0];
  return {
    category: selection.category,
    crisis: selection.crisis,
    passages: kept,
    dropped,
    blessing: str(review?.blessing),
    prayer: str(review?.prayer),
    motif, seal,
    motifName: motifs?.[motif]?.zh || "",
    imageConcept: str(review?.image_concept).slice(0, 300),
  };
}
const str = (s) => (typeof s === "string" ? s.trim() : "");
