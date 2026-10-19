/**
 * 手繪版畫（麻膠版／木刻）風格 SVG 產生器
 * Linocut-style SVG generator — zero dependencies, runs in browser and Node.
 *
 * 模擬多色套印：先印暖黃太陽版，再印天空／地面的淺色版（刻掉的地方露出紙色），
 * 最後以深青色印細節線。色調清新明亮，不使用純黑。
 *
 *   renderLinocut({ motif: "sheep", seed: 7, seal: "安", caption: "PS 23:1-4" })
 */

export const MOTIFS = {
  lamp:   { zh: "燈與光",     hint: "lamp, light, guidance, word of God (Ps 119:105, Matt 5:14)" },
  sheep:  { zh: "羊與牧杖",   hint: "shepherd, care, provision, being led (Ps 23, John 10)" },
  dove:   { zh: "鴿子與橄欖枝", hint: "peace, Holy Spirit, new beginning (Gen 8, John 14:27)" },
  tree:   { zh: "溪水旁的樹", hint: "rootedness, fruitfulness, delight in the word (Ps 1, Jer 17:7-8)" },
  eagle:  { zh: "展翅的鷹",   hint: "renewed strength, rising above (Isa 40:31)" },
  rock:   { zh: "磐石",       hint: "refuge, stability, God as fortress (Ps 18, Ps 62, Matt 7:24)" },
  boat:   { zh: "風浪中的小船", hint: "storm, fear, Jesus calming the sea (Mark 4:35-41)" },
  sprout: { zh: "種子發芽",   hint: "growth, waiting, sowing and reaping (Gal 6:9, John 12:24)" },
  path:   { zh: "通往光的路", hint: "direction, decisions, trusting God's way (Prov 3:5-6)" },
  vine:   { zh: "葡萄樹與枝子", hint: "abiding, fruit, community (John 15)" },
  hands:  { zh: "捧著光的雙手", hint: "prayer, receiving grace, offering (Phil 4:6-7)" },
  lily:   { zh: "野地的百合與飛鳥", hint: "provision, not worrying (Matt 6:25-34)" },
  anchor: { zh: "錨",         hint: "hope, steadfastness (Heb 6:19)" },
  cross:  { zh: "山上的十字架", hint: "salvation, forgiveness, grace (Rom 5:8, 1 John 1:9)" },
  birds:  { zh: "枝頭的一對鳥", hint: "companionship, love, waiting together (Eccl 4:9, Song 2)" },
  nest:   { zh: "巢中的雛鳥", hint: "parenting, care, being sheltered (Isa 40:11, Ps 91:4)" },
  house:  { zh: "亮著燈的家", hint: "home, family, coming back, the Father's house (Luke 15, John 14:2)" },
  rainbow:{ zh: "雨後的彩虹", hint: "covenant love, healing after tears (Gen 9, Isa 54:9-10)" },
  moon:   { zh: "夜裡的月亮與小屋", hint: "night, rest, God who never sleeps (Ps 121, Ps 4:8)" },
  book:   { zh: "打開的書", hint: "study, wisdom, the word as light (Ps 119:105)" },
};

const W = 600, H = 750, M = 34;           // canvas, paper margin
const X0 = M, Y0 = M, X1 = W - M, Y1 = H - M;
const PAPER = "#FFFBF1";

/* ---------- small helpers ---------- */
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const f = (n) => Math.round(n * 10) / 10;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** 刀痕：兩端尖、中間寬的梭形 gouge mark */
function gouge(x1, y1, x2, y2, w, fill) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1;
  const L = Math.hypot(dx, dy) || 1, nx = -dy / L * w, ny = dx / L * w;
  return `<path d="M${f(x1)} ${f(y1)}Q${f(mx + nx)} ${f(my + ny)} ${f(x2)} ${f(y2)}Q${f(mx - nx)} ${f(my - ny)} ${f(x1)} ${f(y1)}Z" fill="${fill}"/>`;
}
const C = "#000", K = "#fff";             // in the black-plate mask: C = carve away, K = keep ink

function circle(cx, cy, r, fill) { return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}"/>`; }
function ellipse(cx, cy, rx, ry, rot, fill) {
  return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})" fill="${fill}"/>`;
}
function path(d, fill, extra = "") { return `<path d="${d}" fill="${fill}" ${extra}/>`; }
function stroke(d, color, w, extra = "") {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
}

/* ---------- background carving ---------- */
function skyRays(r, cx, cy, r0, clipId) {
  let s = "";
  const n = 64;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.04;
    const ra = r0 + 6 + r() * 14, rb = ra + 120 + r() * 420;
    const w = 2.2 + r() * 4.5;
    s += gouge(cx + Math.cos(a) * ra, cy + Math.sin(a) * ra, cx + Math.cos(a) * rb, cy + Math.sin(a) * rb, w, C);
  }
  return `<g clip-path="url(#${clipId})">${s}</g>`;
}
function skyStreaks(r, top, bottom, clipId) {
  let s = "";
  for (let y = top + 10; y < bottom - 4; y += 13 + r() * 6) {
    let x = X0 - 20 + r() * 40;
    while (x < X1) {
      const len = 30 + r() * 140, gap = 8 + r() * 30;
      s += gouge(x, y + r() * 3, x + len, y + r() * 3 - 1.5, 1.6 + r() * 2.6, C);
      x += len + gap;
    }
  }
  return `<g clip-path="url(#${clipId})">${s}</g>`;
}
function skyNight(r, bottom, clipId) {
  let s = "";
  for (let i = 0; i < 60; i++) {
    const x = X0 + r() * (X1 - X0), y = Y0 + r() * (bottom - Y0 - 20), k = 2 + r() * 5;
    s += r() < 0.25
      ? `${gouge(x - k * 2, y, x + k * 2, y, k * 0.35, C)}${gouge(x, y - k * 2, x, y + k * 2, k * 0.35, C)}`
      : circle(x, y, k * 0.45, C);
  }
  for (let y = bottom - 70; y < bottom - 4; y += 12 + r() * 5) {
    let x = X0 + r() * 30;
    while (x < X1) { const len = 20 + r() * 70; s += gouge(x, y, x + len, y, 1.4 + r() * 1.6, C); x += len + 20 + r() * 50; }
  }
  return `<g clip-path="url(#${clipId})">${s}</g>`;
}
/** 太陽：黑版刻空的圓 + 兩圈斷續刀痕 */
function sunCarve(r, cx, cy, R, clipId) {
  let s = circle(cx, cy, R, C);
  for (let k = 1; k <= 2; k++) {
    const rr = R + k * 13;
    const dash = `${f(10 + r() * 16)} ${f(5 + r() * 7)}`;
    s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rr)}" fill="none" stroke="${C}" stroke-width="${f(3.5 - k * 0.6)}" stroke-dasharray="${dash}" stroke-linecap="round"/>`;
  }
  return clipId ? `<g clip-path="url(#${clipId})">${s}</g>` : s;
}
/** 起伏山丘的等高刀痕 */
function hillY(x, horizon, phase, amp) {
  return horizon + Math.sin(x / 95 + phase) * amp + Math.sin(x / 41 + phase * 2) * amp * 0.25;
}
function hills(r, horizon, amp = 14) {
  const phase = r() * 6;
  let edge = `M${X0 - 10} ${Y1 + 10}`;
  for (let x = X0 - 10; x <= X1 + 10; x += 10) edge += `L${x} ${f(hillY(x, horizon, phase, amp))}`;
  edge += `L${X1 + 10} ${Y1 + 10}Z`;
  let lines = "";
  for (let k = 1, dy = 14; horizon + dy < Y1 + 10; k++, dy += 10 + k * 1.6) {
    let d = "";
    for (let x = X0 - 10; x <= X1 + 10; x += 12) d += `${d ? "L" : "M"}${x} ${f(hillY(x, horizon, phase + k * 0.18, amp * (1 + k * 0.06)) + dy)}`;
    const dash = `${f(18 + r() * 60)} ${f(6 + r() * 16)} ${f(8 + r() * 30)} ${f(5 + r() * 12)}`;
    lines += stroke(d, C, f(1.6 + r() * 1.8 + k * 0.12), `stroke-dasharray="${dash}"`);
  }
  return { ground: path(edge, K), lines, top: (x) => hillY(x, horizon, phase, amp) };
}
function waves(r, top, color = C) {
  let s = "";
  for (let y = top + 12, row = 0; y < Y1 + 10; y += 15 + row * 1.2, row++) {
    const off = r() * 60, wl = 46 + row * 4;
    let d = "";
    for (let x = X0 - 60 + off; x < X1 + 60; x += wl) {
      d += `M${f(x)} ${f(y)}q${f(wl / 4)} ${f(-7 - row * 0.4)} ${f(wl / 2)} 0q${f(wl / 5)} ${f(4)} ${f(wl * 0.38)} ${f(-1)}`;
    }
    s += stroke(d, color, f(2 + r() * 1.6 + row * 0.08));
  }
  return s;
}
function mountains(r, base) {
  const peaks = [[X0 - 20, base + 30], [90, base - 60], [150, base - 10], [230, base - 130], [300, base - 40],
    [380, base - 150], [450, base - 30], [520, base - 90], [X1 + 20, base - 10]];
  let edge = `M${X0 - 20} ${Y1 + 10}`; for (const [x, y] of peaks) edge += `L${x} ${y}`; edge += `L${X1 + 20} ${Y1 + 10}Z`;
  let lines = "";
  for (let i = 1; i < peaks.length - 1; i++) {
    const [px, py] = peaks[i];
    for (let k = 0; k < 9; k++) {
      const t = 18 + k * 16 + r() * 6;
      lines += gouge(px - 4 + k * 3, py + 10 + k * 6, px - t * 0.7 + 10, py + t * 1.3, 1.2 + r() * 1.4, C);
    }
  }
  for (let y = base + 20; y < Y1 + 10; y += 12 + r() * 5) {
    let x = X0 + r() * 20;
    while (x < X1) { const l = 20 + r() * 90; lines += gouge(x, y, x + l, y + r() * 4 - 2, 1.5 + r() * 1.8, C); x += l + 14 + r() * 40; }
  }
  let ridge = ""; for (const [x, y] of peaks) ridge += `${ridge ? "L" : "M"}${x} ${y}`;
  lines += stroke(ridge, C, 4.5);
  return { ground: path(edge, K), lines };
}

const zoom = (k, cx, cy) => (g) => g && `<g transform="translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})">${g}</g>`;

/* ---------- motifs ----------
 * each returns { sky, sun, ground, carve, ink, red, horizon }
 *   carve: silhouettes cut away (show paper; knocked out of the red plate too)
 *   ink:   black details kept inside the carved shapes
 *   red:   shapes printed on the vermilion plate
 */
const motifs = {
  lamp(r) {
    const flameD = "M454 528C436 504 442 470 462 440C466 470 486 488 472 516C468 526 462 530 454 528Z";
    const body = "M120 585C115 548 175 528 250 528C310 528 360 536 398 552L450 530C460 526 466 536 458 544L412 574C396 600 342 612 250 612C176 612 125 604 120 585Z";
    let ink = ellipse(250, 541, 24, 7, 0, K) + stroke("M140 590C190 604 310 604 392 580", K, 3.2);
    for (let i = 0; i < 9; i++) ink += circle(165 + i * 26, 575 + Math.sin(i / 1.4) * 2, 3.2, K);
    ink += stroke("M412 556C420 552 432 546 446 540", K, 2.4);
    return {
      horizon: 612, sky: "rays", sunAt: [462, 482, 34], sunHidden: true,
      carve: path(body, C) + stroke("M122 575C88 570 78 540 96 528C110 520 126 534 130 552", C, 15) +
        path("M190 608L310 608L300 626L200 626Z", C) + path(flameD, C),
      ink, red: path(flameD, K) + circle(462, 486, 30, K),
    };
  },
  sheep(r) {
    let carve = ellipse(310, 550, 112, 62, 0, C);
    const lumps = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, x = 310 + Math.cos(a) * 104, y = 550 + Math.sin(a) * 56;
      carve += circle(x, y, 24 + r() * 10, C); lumps.push([x, y]);
    }
    carve += ellipse(196, 520, 26, 38, -32, C) + ellipse(214, 494, 22, 9, -20, C);
    for (const x of [244, 276, 344, 376]) carve += path(`M${x - 8} 596L${x + 8} 596L${x + 6} 652L${x - 6} 652Z`, C);
    carve += stroke("M120 690L120 300C120 236 196 236 196 296C196 320 176 324 166 306", C, 15);
    let ink = circle(186, 512, 4.2, K) + stroke("M174 540C182 548 192 548 198 542", K, 2.6) + stroke("M206 494L224 496", K, 2.2);
    for (let i = 0; i < 26; i++) {
      const x = 240 + r() * 150, y = 512 + r() * 80, s = 6 + r() * 5;
      ink += stroke(`M${f(x)} ${f(y)}c${f(-s)} ${f(-s * 0.6)} ${f(-s * 0.4)} ${f(s * 1.3)} ${f(s * 0.5)} ${f(s * 0.6)}`, K, 2.3);
    }
    for (const x of [244, 276, 344, 376]) ink += stroke(`M${x - 6} 644L${x + 6} 644`, K, 3);
    return { horizon: 600, sky: "rays", sunAt: [440, 210, 58], carve, ink, red: "" };
  },
  dove(r) {
    const body = "M150 330C190 300 260 290 320 300C360 306 392 296 412 280C424 270 440 268 452 276C462 283 470 284 486 283C474 292 464 300 454 306C432 330 400 350 360 360C320 370 300 380 280 410L262 380C230 372 190 352 150 330Z";
    const tail = "M162 326L96 298L112 330L94 356L162 344Z";
    const wing = "M280 302C250 250 210 190 196 112C240 148 300 170 340 210C360 230 368 260 360 300Z";
    const wing2 = "M330 296C350 240 384 180 436 138C436 190 412 250 382 296Z";
    let carve = path(wing2, C) + path(body, C) + path(tail, C) + path(wing, C);
    let ink = circle(447, 281, 3.4, K) + stroke("M454 287L486 284", K, 2);
    for (let i = 0; i < 6; i++) ink += stroke(`M${290 - i * 4} ${296 - i * 8}C${270 - i * 10} ${250 - i * 12} ${250 - i * 9} ${210 - i * 12} ${234 - i * 7} ${160 - i * 6}`, K, 2.2);
    for (let i = 0; i < 4; i++) ink += stroke(`M${352 + i * 6} ${292 - i * 10}C${368 + i * 8} ${250 - i * 12} ${390 + i * 8} ${210 - i * 8} ${414 + i * 4} ${170 - i * 4}`, K, 2);
    for (let i = 0; i < 4; i++) ink += stroke(`M${170 + i * 30} ${338 + i * 4}C${200 + i * 30} ${344 + i * 4} ${230 + i * 30} ${346 + i * 2} ${250 + i * 30} ${344}`, K, 1.8);
    ink += stroke("M160 330L112 316M160 336L106 342", K, 2);
    carve += stroke("M484 288C506 296 524 310 540 330", C, 4.5);
    for (const [x, y, a] of [[500, 296, 30], [516, 312, -20], [526, 300, 50], [534, 326, 0], [512, 324, -60]]) carve += ellipse(x, y, 12, 4.6, a, C);
    return { horizon: 560, ground: "waves", sky: "streaks", sunAt: [300, 560, 92], sunClip: true, carve, ink, red: "" };
  },
  tree(r) {
    let carve = path("M282 610C290 520 286 452 272 398L330 398C316 452 310 520 318 610C328 618 348 622 362 626L238 626C252 622 272 618 282 610Z", C);
    carve += stroke("M300 420C270 380 236 360 204 350M302 430C338 384 370 368 404 360M298 400L298 300", C, 12);
    const blobs = [];
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2, d = r() * 92, x = 300 + Math.cos(a) * d * 1.3, y = 280 + Math.sin(a) * d * 0.75;
      const rr = 46 + r() * 26; carve += circle(x, y, rr, C); blobs.push([x, y, rr]);
    }
    let ink = "";
    for (let i = 0; i < 70; i++) {
      const [bx, by, br] = blobs[Math.floor(r() * blobs.length)];
      const a = r() * Math.PI * 2, d = r() * br * 0.75, x = bx + Math.cos(a) * d, y = by + Math.sin(a) * d, ang = r() * 3;
      ink += gouge(x, y, x + Math.cos(ang) * 14, y + Math.sin(ang) * 14, 3, K);
    }
    for (let i = 0; i < 5; i++) ink += stroke(`M${292 + i * 4} ${600 - i * 2}C${290 + i * 3} ${540} ${294 + i * 2} ${480} ${286 + i * 4} ${410}`, K, 1.6);
    const stream = "M150 716C200 680 250 668 300 650C346 634 372 622 382 610C388 602 392 600 404 600L414 600C410 612 400 628 380 642C340 668 300 690 270 716Z";
    carve += path(stream, C);
    for (let i = 0; i < 9; i++) { const t = i / 9; ink += gouge(200 + t * 180 + r() * 10, 700 - t * 90, 220 + t * 180 + r() * 10, 698 - t * 90, 1.5, K); }
    return { horizon: 610, sky: "streaks", sunAt: [118, 142, 42], carve, ink, red: "" };
  },
  eagle(r) {
    const lw = "M300 332C250 304 180 284 64 300C104 312 114 318 92 330C134 334 144 342 122 354C164 352 184 360 168 372C214 364 256 362 292 364Z";
    let carve = path(lw, C) + `<g transform="translate(600 0) scale(-1 1)">${path(lw, C)}</g>`;
    carve += ellipse(300, 340, 20, 36, 0, C) + circle(300, 304, 15, C) + path("M296 296L300 284L304 296Z", C);
    carve += path("M284 368L316 368L334 418L300 406L266 418Z", C);
    let ink = "";
    for (let i = 0; i < 7; i++) {
      const x = 110 + i * 26;
      ink += stroke(`M${x + 20} ${312 + i * 1.5}L${x} ${336 + i * 2}`, K, 2);
      ink += stroke(`M${600 - x - 20} ${312 + i * 1.5}L${600 - x} ${336 + i * 2}`, K, 2);
    }
    ink += stroke("M286 380L300 400L314 380", K, 1.8) + circle(296, 302, 2.2, K) + circle(304, 302, 2.2, K);
    return { horizon: 560, ground: "mountains", sky: "rays", sunAt: [300, 214, 74], carve, ink, red: "" };
  },
  rock(r) {
    const rockD = "M34 716L34 430L80 392L132 318L196 284L248 310L292 252L346 276L372 352L414 420L456 506L566 590L566 716Z";
    let ink = "";
    for (let i = 0; i < 26; i++) {
      const x = 60 + r() * 380, y = 340 + r() * 340;
      ink += gouge(x, y, x + 16 + r() * 40, y + 30 + r() * 50, 1.6 + r() * 2.2, K);
    }
    for (let k = 0; k < 7; k++) ink += stroke(`M${110 + k * 48} ${330 + k * 18}L${92 + k * 46} ${450 + k * 22}L${122 + k * 44} ${570 + k * 18}`, K, 2.4, `stroke-dasharray="${f(14 + r() * 20)} ${f(8 + r() * 12)}"`);
    ink += stroke("M132 318L150 380L120 470M248 310L240 380M346 276L330 360L360 440", K, 3);
    const figure = stroke("M292 250L292 222M284 234L300 234M287 250L292 238L297 250", C, 5) + circle(292, 214, 6.5, C);
    let surf = "";
    for (let i = 0; i < 6; i++) surf += stroke(`M${430 + i * 22} ${600 + i * 10}c10 -14 26 -14 30 0`, K, 3);
    return { horizon: null, sky: "rays", sunAt: [452, 168, 54], carve: path(rockD, C) + figure, ink: ink + surf, red: "" };
  },
  boat(r) {
    const hull = "M190 486L410 486C400 512 380 528 350 532L250 532C220 528 200 512 190 486Z";
    let carve = path(hull, C) + stroke("M300 486L300 300", C, 8);
    carve += path("M306 306C352 350 372 410 376 474L306 474Z", C) + path("M294 330C262 370 248 420 246 474L294 474Z", C);
    let ink = stroke("M200 500L400 500", K, 2.6) + stroke("M226 516L374 516", K, 2);
    for (let i = 0; i < 5; i++) ink += stroke(`M${314 + i * 10} ${340 + i * 22}L${314 + i * 12} ${470}`, K, 1.5);
    const lantern = circle(300, 296, 9, K);
    return { horizon: 500, ground: "waves", sky: "night", sunAt: [150, 150, 44], carve: carve + circle(300, 296, 9, C), ink, red: lantern };
  },
  sprout(r) {
    let carve = ellipse(300, 610, 30, 19, -12, C);
    carve += stroke("M300 594C304 540 296 470 300 360", C, 10);
    carve += path("M300 380C258 382 214 352 196 306C246 300 288 330 300 380Z", C);
    carve += path("M302 360C326 316 378 292 420 300C404 346 354 372 302 360Z", C);
    for (let i = 0; i < 7; i++) carve += stroke(`M${290 + i * 4} 624C${270 + i * 10} 660 ${230 + i * 22} 680 ${210 + i * 30} 706`, C, 2.4 - i * 0.12);
    let ink = stroke("M298 376C268 364 238 344 214 312", K, 2.2) + stroke("M304 364C336 340 368 320 404 306", K, 2.2);
    ink += stroke("M288 612C296 604 308 604 314 610", K, 2);
    let soil = "";
    for (let i = 0; i < 90; i++) { const x = X0 + r() * (X1 - X0), y = 500 + r() * 210; soil += r() < 0.5 ? circle(x, y, 1.6 + r() * 2.4, C) : gouge(x, y, x + 8 + r() * 10, y + r() * 4, 1.4, C); }
    return { horizon: 490, flatGround: true, sky: "rays", sunAt: [300, 196, 60], preCarve: soil, carve, ink, red: "" };
  },
  path(r) {
    const road = "M196 716C250 660 404 630 328 568C300 544 300 516 300 492L306 492C314 514 338 540 370 566C454 632 404 684 430 716Z";
    let ink = "";
    for (let i = 0; i < 8; i++) { const t = i / 8, y = 700 - t * 196, x = 316 + Math.sin(t * 3.4) * 40 * (1 - t); ink += gouge(x - 6 + t * 3, y, x + 6 - t * 3, y - 10 + t * 6, 2.4 - t * 1.4, K); }
    return { horizon: 494, ground: "hills", hillAmp: 8, sky: "rays", sunAt: [303, 494, 66], sunClip: true, carve: path(road, C), ink, red: "" };
  },
  vine(r) {
    let carve = stroke("M300 716C290 640 320 600 300 540C280 480 220 470 210 410C200 350 260 320 300 300C350 274 380 230 360 170", C, 15);
    carve += stroke("M300 540C350 530 400 500 410 450M210 410C170 400 130 370 120 320M300 300C250 270 220 220 230 170", C, 8);
    const leaf = (x, y, s, a) => `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})">${path("M0 0C-10 -20 -34 -24 -40 -6C-52 -10 -56 8 -44 16C-50 30 -30 40 -18 30C-14 44 6 44 6 30C14 40 34 34 28 18C42 12 38 -8 26 -8C26 -26 6 -26 0 0Z", C)}</g>`;
    carve += leaf(420, 448, 1.3, 30) + leaf(116, 316, 1.2, -40) + leaf(232, 166, 1.1, 10) + leaf(366, 168, 1.2, 40) + leaf(262, 600, 1.1, -70);
    let ink = "", red = "";
    const cluster = (cx, cy, isRed) => {
      for (let row = 0; row < 5; row++) for (let j = 0; j <= 4 - row; j++) {
        const x = cx + (j - (4 - row) / 2) * 20 + r() * 3, y = cy + row * 18;
        carve += circle(x, y, 10, C); ink += stroke(`M${f(x - 4)} ${f(y - 4)}a5 5 0 0 1 6 -2`, K, 1.6);
        if (isRed) red += circle(x, y, 10, K);
      }
    };
    cluster(400, 470, true); cluster(150, 350, false); cluster(320, 330, false);
    for (const [x, y, a, s] of [[420, 448, 30, 1.3], [116, 316, -40, 1.2], [232, 166, 10, 1.1], [366, 168, 40, 1.2], [262, 600, -70, 1.1]])
      ink += `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})">${stroke("M-36 4L22 8M-8 6L-20 -14M-8 6L-14 28M8 7L18 -10M8 7L18 26", K, 1.5)}</g>`;
    return { horizon: null, sky: "streaks", sunAt: [470, 140, 46], carve, ink, red };
  },
  hands(r) {
    const left = "M300 700C238 700 178 660 166 592C164 574 176 566 186 574C190 560 202 556 212 566C216 552 230 550 236 562C242 550 256 552 260 564C266 556 280 558 282 570C292 604 300 646 300 700Z";
    const wristL = "M196 670L176 716L300 716L300 690Z";
    let carve = path(left, C) + path(wristL, C) + `<g transform="translate(600 0) scale(-1 1)">${path(left, C)}${path(wristL, C)}</g>`;
    let ink = "";
    for (const sx of [1, -1]) {
      const g = (d) => sx > 0 ? stroke(d, K, 2) : `<g transform="translate(600 0) scale(-1 1)">${stroke(d, K, 2)}</g>`;
      ink += g("M212 572L216 600M236 566L240 596M260 568L262 598M186 580L194 606");
      ink += g("M200 640C230 660 262 666 296 668");
    }
    ink += stroke("M300 640L300 712", K, 2.4);
    const big = (g) => `<g transform="translate(300 716) scale(1.45) translate(-300 -716)">${g}</g>`;
    return { horizon: null, sky: "rays", sunAt: [300, 380, 50], carve: big(carve), ink: big(ink), red: "" };
  },
  lily(r) {
    let carve = "", ink = "", red = "";
    const flower = (x, y, s) => {
      carve += stroke(`M${x} ${y + 30 * s}C${x - 6} ${y + 120 * s} ${x + 8} ${y + 200 * s} ${x} 716`, C, 6 * s);
      carve += ellipse(x - 24 * s, y + 110 * s, 30 * s, 8 * s, 50, C) + ellipse(x + 22 * s, y + 150 * s, 30 * s, 8 * s, -50, C);
      for (const a of [-40, 0, 40]) carve += `<g transform="translate(${x} ${y + 30 * s}) rotate(${a}) scale(${s})">${path("M0 0C-22 -20 -24 -60 0 -84C24 -60 22 -20 0 0Z", C)}</g>`;
      for (const a of [-40, 0, 40]) red += `<g transform="translate(${x} ${y + 30 * s}) rotate(${a}) scale(${s})">${path("M0 0C-22 -20 -24 -60 0 -84C24 -60 22 -20 0 0Z", K)}</g>`;
      for (const a of [-40, 0, 40]) ink += `<g transform="translate(${x} ${y + 30 * s}) rotate(${a}) scale(${s})">${stroke("M0 -6L0 -66", K, 2)}</g>`;
    };
    flower(300, 330, 1.25); flower(170, 410, 1); flower(440, 400, 1.05);
    const bird = (x, y, s) => stroke(`M${x - 22 * s} ${y}C${x - 12 * s} ${y - 12 * s} ${x - 4 * s} ${y - 6 * s} ${x} ${y + 2 * s}C${x + 4 * s} ${y - 6 * s} ${x + 12 * s} ${y - 12 * s} ${x + 22 * s} ${y}`, K, 4 * s);
    return { horizon: 560, ground: "hills", sky: "streaks", sunAt: [112, 136, 40], carve, ink, figure: bird(420, 160, 1.4) + bird(480, 200, 1) + bird(370, 214, 0.8), red };
  },
  anchor(r) {
    let carve = `<circle cx="300" cy="268" r="30" fill="none" stroke="${C}" stroke-width="13"/>`;
    carve += stroke("M300 298L300 640", C, 24) + stroke("M218 340L382 340", C, 18);
    carve += stroke("M168 540C186 620 246 652 300 652C354 652 414 620 432 540", C, 20);
    carve += path("M150 556L168 510L196 552Z", C) + path("M450 556L432 510L404 552Z", C);
    carve += stroke("M300 254C380 240 420 300 380 360C350 404 250 420 236 480C226 524 280 560 310 600", C, 9);
    let ink = "";
    for (let i = 0; i < 26; i++) { const y = 300 + i * 12; ink += stroke(`M296 ${y}L304 ${y + 6}`, K, 1.6); }
    let bubbles = "";
    for (let i = 0; i < 26; i++) bubbles += `<circle cx="${f(80 + r() * 440)}" cy="${f(260 + r() * 420)}" r="${f(3 + r() * 6)}" fill="none" stroke="${C}" stroke-width="2"/>`;
    return { horizon: 230, ground: "water", sky: "streaks", sunAt: [300, 230, 70], sunClip: true, preCarve: bubbles, carve, ink, red: "" };
  },
  cross(r) {
    const carve = path("M286 230L314 230L316 300L392 302L392 330L316 332L320 560L280 560L284 332L208 330L208 302L284 300Z", C);
    let ink = "";
    for (let i = 0; i < 12; i++) ink += stroke(`M${292 + (i % 3) * 6} ${340 + i * 18}L${294 + (i % 3) * 6} ${352 + i * 18}`, K, 1.4);
    return { horizon: 560, ground: "hills", hillAmp: 22, sky: "rays", sunAt: [300, 316, 120], carve, ink, red: "" };
  },
  birds(r) {
    // 一對面對面停在枝頭的鳥，中間一顆紅心
    let one = ellipse(225, 448, 48, 32, -12, C) + circle(262, 412, 22, C) + path("M281 405L304 412L281 419Z", C);
    one += path("M184 458L118 488L128 470L114 460L182 438Z", C) + stroke("M218 476L214 500M236 474L234 498", C, 4.5);
    let oneInk = circle(268, 407, 3.2, K) + stroke("M196 446C214 430 242 432 258 450C240 466 212 468 194 458", K, 2.2);
    for (let i = 0; i < 4; i++) oneInk += stroke(`M${204 + i * 12} ${452 + (i % 2) * 2}L${214 + i * 12} ${462}`, K, 1.6);
    oneInk += stroke("M128 476L176 456M132 466L178 448", K, 1.6);
    const mirror = (g) => `<g transform="translate(600 0) scale(-1 1)">${g}</g>`;
    const heart = "M300 384C268 362 258 334 278 326C290 322 298 330 300 340C302 330 310 322 322 326C342 334 332 362 300 384Z";
    let carve = stroke("M34 520C150 500 250 500 330 496C420 492 500 472 566 432", C, 16);
    carve += stroke("M120 508C110 480 90 470 70 470M470 480C480 450 500 440 524 438", C, 6);
    for (const [x, y, a] of [[70, 470, -20], [524, 438, 20], [150, 520, 40], [420, 500, -40], [96, 488, 60], [500, 452, -60]]) carve += ellipse(x, y, 22, 8, a, C);
    carve += one + mirror(one) + path(heart, C);
    let ink = oneInk + mirror(oneInk);
    for (let i = 0; i < 10; i++) { const x = 60 + i * 50 + r() * 10; ink += gouge(x, 516 - i * 2, x + 26, 512 - i * 2.4, 1.4, K); }
    for (const [x, y, a] of [[70, 470, -20], [524, 438, 20], [150, 520, 40], [420, 500, -40], [96, 488, 60], [500, 452, -60]])
      ink += `<g transform="translate(${x} ${y}) rotate(${a})">${stroke("M-18 0L18 0", K, 1.4)}</g>`;
    const z = zoom(1.22, 300, 520);
    return { horizon: 600, ground: "hills", sky: "rays", sunAt: [300, 290, 92], carve: z(carve), ink: z(ink),
      red: z(path(heart, K) + path("M281 405L304 412L281 419Z", K) + mirror(path("M281 405L304 412L281 419Z", K))) };
  },
  nest(r) {
    // 母鳥張開翅膀護著巢裡張嘴的雛鳥
    const lw = "M292 270C252 228 196 208 126 216C146 240 172 260 204 276C232 288 262 294 290 300Z";
    let carve = stroke("M34 560C140 540 240 556 330 540C420 524 490 506 566 470", C, 18);
    carve += stroke("M450 516C470 490 500 480 530 482M140 548C130 520 110 506 84 504", C, 6);
    for (const [x, y, a] of [[530, 482, 10], [84, 504, -10], [500, 498, -50], [112, 520, 50]]) carve += ellipse(x, y, 22, 8, a, C);
    carve += path(lw, C) + `<g transform="translate(600 0) scale(-1 1)">${path(lw, C)}</g>`;
    carve += ellipse(300, 290, 20, 34, 0, C) + circle(300, 250, 17, C) + path("M292 262L300 278L308 262Z", C) + path("M286 318L314 318L326 352L300 342L274 352Z", C);
    const chicks = [[250, 476], [300, 462], [350, 476]];
    const beak = (x, y) => `M${x - 9} ${y - 14}L${x} ${y - 40}L${x + 9} ${y - 14}Z`;
    for (const [x, y] of chicks) carve += circle(x, y, 21, C) + path(beak(x, y), C);
    const nestD = "M200 480C204 538 246 566 300 566C354 566 396 538 400 480Z";
    carve += path(nestD, C);
    let ink = circle(294, 248, 2.4, K) + circle(306, 248, 2.4, K);
    for (let i = 0; i < 6; i++) {
      const x = 150 + i * 24;
      ink += stroke(`M${x + 18} ${232 + i * 6}L${x + 4} ${252 + i * 6}`, K, 2) + stroke(`M${600 - x - 18} ${232 + i * 6}L${600 - x - 4} ${252 + i * 6}`, K, 2);
    }
    ink += stroke("M288 330L300 344L312 330", K, 1.8);
    for (const [x, y] of chicks) ink += circle(x - 7, y - 4, 2.8, K) + circle(x + 7, y - 4, 2.8, K);
    for (let i = 0; i < 16; i++) {
      const y = 490 + r() * 66, w = 96 - Math.abs(y - 500) * 0.6, x = 300 - w + r() * w * 1.4;
      ink += gouge(x, y, x + 30 + r() * 30, y + (r() - 0.5) * 12, 1.6, K);
    }
    ink += stroke("M204 492C240 500 360 500 396 492", K, 2.4);
    const z = zoom(1.12, 300, 430);
    return { horizon: 640, ground: "hills", hillAmp: 8, sky: "streaks", sunAt: [470, 130, 44], carve: z(carve), ink: z(ink),
      red: z(chicks.map(([x, y]) => path(beak(x, y), K)).join("")) };
  },
  house(r) {
    // 山坡上亮著燈的家，一條小路通到門口
    const roof = "M150 436L300 300L450 436Z";
    let carve = path("M354 318L390 318L390 400L354 380Z", C) + path(roof, C) + path("M184 430L416 430L416 606L184 606Z", C);
    carve += path("M282 606L318 606C334 646 382 690 408 716L192 716C218 690 266 646 282 606Z", C);
    carve += stroke("M372 306C360 286 388 276 376 254C366 236 390 226 382 204", C, 8);
    const door = "M276 606L276 538C276 520 324 520 324 538L324 606Z";
    const win = (x) => `M${x} 470L${x + 48} 470L${x + 48} 516L${x} 516Z`;
    let ink = "";
    for (let y = 340; y < 432; y += 14) { const hw = (y - 300) / 136 * 150 - 10; ink += stroke(`M${f(300 - hw)} ${y}L${f(300 + hw)} ${y}`, K, 1.8, `stroke-dasharray="${f(20 + r() * 30)} ${f(6 + r() * 8)}"`); }
    ink += stroke("M150 436L450 436", K, 3);
    for (let i = 0; i < 7; i++) { const y = 452 + i * 22; ink += gouge(196 + r() * 20, y, 236 + r() * 20, y, 1.2, K); ink += gouge(366 + r() * 10, y, 404, y, 1.2, K); }
    for (const x of [206, 346]) ink += stroke(`M${x + 24} 470L${x + 24} 516M${x} 493L${x + 48} 493`, K, 2.4) + stroke(`M${x - 4} 520L${x + 52} 520`, K, 3);
    ink += circle(314, 572, 3, K);
    for (let i = 0; i < 6; i++) { const t = i / 6, y = 700 - t * 86; ink += gouge(296 - (1 - t) * 30, y, 304 + (1 - t) * 30, y - 2, 1.6 - t, K); }
    return { horizon: 600, ground: "hills", hillAmp: 8, sky: "rays", sunAt: [470, 150, 44], carve, ink,
      red: path(door, K) + path(win(206), K) + path(win(346), K) };
  },
  rainbow(r) {
    // 雨雲在左上，雨停後彩虹跨過山丘
    const cx = 300, cy = 612, band = (R2, R1) => `M${cx - R2} ${cy}A${R2} ${R2} 0 0 1 ${cx + R2} ${cy}L${cx + R1} ${cy}A${R1} ${R1} 0 0 0 ${cx - R1} ${cy}Z`;
    const radii = [262, 238, 214, 190, 166];
    let carve = "", red = "", ink = "";
    for (let i = 0; i < radii.length - 1; i++) { carve += path(band(radii[i], radii[i + 1]), C); if (i % 2 === 0) red += path(band(radii[i], radii[i + 1]), K); }
    for (const R of radii) ink += `<path d="M${cx - R} ${cy}A${R} ${R} 0 0 1 ${cx + R} ${cy}" fill="none" stroke="${K}" stroke-width="2"/>`;
    for (let i = 0; i < 40; i++) {
      const a = Math.PI + (i / 40) * Math.PI + r() * 0.03, R = 196 + r() * 12;
      ink += gouge(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx + Math.cos(a + 0.05) * R, cy + Math.sin(a + 0.05) * R, 1.2, K);
    }
    const cloud = (pts) => pts.map(([x, y, rr]) => circle(x, y, rr, C)).join("");
    carve += cloud([[70, 600, 34], [112, 584, 42], [156, 604, 30], [36, 618, 26]]) + cloud([[530, 600, 34], [488, 584, 42], [444, 604, 30], [564, 618, 26]]);
    carve += cloud([[100, 150, 30], [140, 132, 40], [186, 150, 32], [220, 162, 22]]);
    for (let i = 0; i < 18; i++) { const x = 84 + r() * 140, y = 190 + r() * 120; carve += gouge(x, y, x - 10, y + 26 + r() * 14, 2, C); }
    for (const [x, y] of [[112, 600], [488, 600], [140, 150]]) ink += stroke(`M${x - 30} ${y + 12}C${x - 10} ${y + 20} ${x + 10} ${y + 20} ${x + 30} ${y + 12}`, K, 1.8);
    return { horizon: 600, ground: "hills", hillAmp: 8, sky: "streaks", sunAt: [470, 160, 44], carve, ink, red };
  },
  moon(r) {
    // 夜空裡的彎月，小屋窗口還亮著燈，旁邊一棵柏樹
    const [mx, my, mR] = [410, 176, 66];
    let carve = path("M120 520L250 520L250 610L120 610Z", C) + path("M104 524L185 452L266 524Z", C) + path("M222 474L240 474L240 500L222 488Z", C);
    carve += ellipse(330, 520, 30, 82, 0, C) + path("M324 596L336 596L336 616L324 616Z", C);
    const win = "M146 548L178 548L178 578L146 578Z", door = "M200 610L200 566C200 556 226 556 226 566L226 610Z";
    let ink = stroke("M104 524L266 524", K, 2.6) + stroke("M162 548L162 578M146 563L178 563", K, 2);
    for (let i = 0; i < 6; i++) ink += stroke(`M${f(150 + i * 6)} ${494 + i * 4}L${f(220 - i * 6)} ${494 + i * 4}`, K, 1.4);
    for (let i = 0; i < 12; i++) { const y = 452 + i * 12, w = Math.sin((i + 1) / 13 * Math.PI) * 22; ink += stroke(`M${f(330 - w)} ${y + 8}L330 ${y}L${f(330 + w)} ${y + 8}`, K, 1.6); }
    // Zz：輕輕的睡意
    ink += stroke("M206 420L222 420L206 436L222 436M232 392L244 392L232 404L244 404", K, 2.4);
    const z = zoom(1.38, 230, 614);
    return { horizon: 600, ground: "hills", hillAmp: 10, sky: "night", sunAt: [mx, my, mR],
      inkOver: circle(mx + 30, my - 22, mR * 0.9, K), carve: z(carve), ink: z(ink), red: z(path(win, K) + path(door, K)) };
  },
  book(r) {
    // 攤開的書，光從書頁後方照出來
    const left = "M300 522C250 494 170 488 100 502L100 628C170 616 250 622 300 648Z";
    let carve = path("M84 512L84 646C170 632 250 642 300 666C350 642 430 632 516 646L516 512Z", C);
    carve += path(left, C) + `<g transform="translate(600 0) scale(-1 1)">${path(left, C)}</g>`;
    const ribbon = "M316 650L330 650L330 704L323 694L316 704Z";
    carve += path(ribbon, C);
    let ink = stroke("M300 522L300 664", K, 2.6) + stroke("M100 628C170 616 250 622 300 648C350 622 430 616 500 628", K, 2.2);
    ink += stroke("M84 646C170 632 250 642 300 666C350 642 430 632 516 646", K, 2.6);
    for (let i = 0; i < 7; i++) {
      const y = 526 + i * 14, dash = `${f(14 + r() * 26)} ${f(5 + r() * 6)} ${f(8 + r() * 18)} ${f(4 + r() * 5)}`;
      const L = `M${118} ${y}C${170} ${y - 10} ${240} ${y - 6} ${282} ${y + 12}`;
      ink += stroke(L, K, 1.6, `stroke-dasharray="${dash}"`) + `<g transform="translate(600 0) scale(-1 1)">${stroke(L, K, 1.6, `stroke-dasharray="${dash}"`)}</g>`;
    }
    for (let i = 0; i < 3; i++) ink += stroke(`M${96 - i * 4} ${632 + i * 4}C${170} ${620 + i * 4} ${250} ${628 + i * 4} ${300} ${654 + i * 4}`, K, 1);
    return { horizon: 670, flatGround: true, sky: "rays", sunAt: [300, 432, 70], carve, ink, red: path(ribbon, K) };
  },
};

/* ---------- palettes ----------
 * 清新多色套印：天空、地面各一版淺色，太陽一版暖黃，細節線用深青色（不用純黑）。
 * 依 seed 挑一組，讓每次重刻都有些微不同的晨光色調。 */
export const PALETTES = [
  { sky: "#A8DCF0", ground: "#93D3A8", water: "#7FC8E4", soil: "#EBC48F", night: "#AEB8EE", sun: "#FFD25A", accent: "#FF8A70", line: "#2C4A5A" },
  { sky: "#BEE7E1", ground: "#A9DA90", water: "#86CFE0", soil: "#EFCB9C", night: "#B9B6EC", sun: "#FFC94D", accent: "#FF9479", line: "#2D4B57" },
  { sky: "#C6E2F8", ground: "#9DD5B3", water: "#8EC5EC", soil: "#F2CB96", night: "#B2C2F2", sun: "#FFDA6A", accent: "#FF8F8F", line: "#334866" },
  { sky: "#D4ECF7", ground: "#B5DE9F", water: "#95D3E6", soil: "#EDC48C", night: "#C0BDF0", sun: "#FFCF55", accent: "#FF9F6E", line: "#2F4F5C" },
];

/* ---------- main ---------- */
export function renderLinocut({ motif = "lamp", seed = 1, seal = "", caption = "", width, uid = "" } = {}) {
  const r = rng(seed * 9973 + motif.length * 31);
  // 以 motif + seed 決定 id，伺服器與瀏覽器輸出一致（避免 hydration 不一致）；同頁多張同圖時傳 uid
  const id = "lc" + motif + (seed >>> 0).toString(36) + (uid ? "_" + uid : "");
  const pal = PALETTES[(seed >>> 0) % PALETTES.length];
  const m = (motifs[motif] || motifs.lamp)(r);
  const horizon = m.horizon ?? Y1;
  const [sx, sy, sR] = m.sunAt;

  // --- key-block mask: white = color printed, black = carved away (paper shows) ---
  let mask = `<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="${K}"/>`;
  if (m.sky === "rays") mask += skyRays(r, sx, sy, sR, `${id}sky`);
  else if (m.sky === "night") mask += skyNight(r, horizon, `${id}sky`);
  else mask += skyStreaks(r, Y0, horizon, `${id}sky`);
  if (!m.sunHidden) mask += sunCarve(r, sx, sy, sR, m.sunClip ? `${id}sky` : null);
  else mask += circle(sx, sy, sR, C);

  // region colors: which color each part of the block is inked with
  let groundShape = "", groundColor = pal.ground;
  if (m.horizon != null) {
    const rect = `<rect x="${X0}" y="${horizon}" width="${X1 - X0}" height="${Y1 - horizon}" fill="${K}"/>`;
    if (m.ground === "waves" || m.ground === "water") { groundShape = rect; groundColor = pal.water; mask += rect + waves(r, horizon); }
    else if (m.ground === "mountains") { const g = mountains(r, horizon); groundShape = g.ground; mask += g.ground + g.lines; }
    else if (m.flatGround) {
      groundShape = rect; groundColor = pal.soil;
      mask += rect + stroke(`M${X0} ${horizon + 3}L${X1} ${horizon + 3}`, C, 3, `stroke-dasharray="40 9 16 7"`);
    } else { const g = hills(r, horizon, m.hillAmp ?? 10); groundShape = g.ground; mask += g.ground + g.lines; }
  }
  if (m.inkOver) mask += m.inkOver;
  if (m.preCarve) mask += m.preCarve;
  mask += m.carve;
  const skyColor = m.sky === "night" ? pal.night : pal.sky;
  const regions = `<rect width="${W}" height="${H}" fill="${skyColor}"/>` + groundShape.replaceAll(`"${K}"`, `"${groundColor}"`);

  // details (wool, feathers, veins, birds) printed last in the deep line color
  const details = (m.ink + (m.figure || "")).replaceAll(`"${K}"`, `"${pal.line}"`);

  // --- sun plate: sun + motif warm parts, knocked out by motif silhouettes ---
  const redMask = `<rect width="${W}" height="${H}" fill="${K}"/>` + m.carve.replaceAll(`"${C}"`, `"#000"`) + (m.red || "");
  const warm = m.red ? `<g>${m.red.replaceAll(`"${K}"`, `"${pal.accent}"`)}</g>` : "";
  let sun = m.sunHidden ? "" : circle(sx, sy, sR + 3, pal.sun) + `<circle cx="${f(sx)}" cy="${f(sy)}" r="${f(sR * 0.55)}" fill="#FFF3C4" opacity=".55"/>`;
  sun = m.sunClip ? `<g clip-path="url(#${id}sky)">${sun}</g>${warm}` : sun + warm;

  const sealSvg = seal ? `<g transform="translate(${X1 - 30} ${Y1 + 6})" filter="url(#${id}rough)">
      <rect width="30" height="26" fill="${pal.accent}"/>
      <text x="15" y="19.5" text-anchor="middle" font-size="17" font-weight="900" fill="${PAPER}" font-family="'Noto Serif TC','Noto Sans TC',serif">${esc(seal.slice(0, 1))}</text></g>` : "";
  const cap = caption ? `<text x="${X0}" y="${Y1 + 22}" font-size="11" letter-spacing="2" fill="${pal.line}" font-family="'JetBrains Mono','IBM Plex Mono',ui-monospace,monospace">${esc(caption.toUpperCase())} · 1/1</text>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"${width ? ` width="${width}"` : ""} role="img" aria-label="${esc((MOTIFS[motif] || MOTIFS.lamp).zh)} 版畫插畫">
<defs>
  <clipPath id="${id}sky"><rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${(m.horizon ?? Y1) - Y0}"/></clipPath>
  <filter id="${id}rough" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="${seed % 97}"/>
    <feDisplacementMap in="SourceGraphic" scale="4.5"/>
  </filter>
  <filter id="${id}speck" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${(seed * 7) % 89}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 0.984  0 0 0 0 0.945  18 0 0 0 -12.4"/>
    <feComposite in2="SourceGraphic" operator="in"/>
  </filter>
  <filter id="${id}edge" x="-5%" y="-5%" width="110%" height="110%">
    <feMorphology in="SourceAlpha" operator="dilate" radius="2.4" result="d"/>
    <feComposite in="d" in2="SourceAlpha" operator="out" result="ring"/>
    <feFlood flood-color="${pal.line}"/>
    <feComposite in2="ring" operator="in"/>
  </filter>
  <clipPath id="${id}print"><rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}"/></clipPath>
  <mask id="${id}blk" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><g clip-path="url(#${id}print)">${mask}</g></mask>
  <mask id="${id}red" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">${redMask}</mask>
</defs>
<rect width="${W}" height="${H}" fill="${PAPER}"/>
<g filter="url(#${id}rough)">
  <g mask="url(#${id}red)" transform="translate(2.5 1.5)">${sun}</g>
  <g mask="url(#${id}blk)">${regions}</g>
  <g filter="url(#${id}edge)" clip-path="url(#${id}print)">${m.carve}</g>
  <g transform="translate(-1 0.5)">${details}</g>
</g>
<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="#000" filter="url(#${id}speck)" opacity="0.5"/>
${cap}${sealSvg}
</svg>`;
}
