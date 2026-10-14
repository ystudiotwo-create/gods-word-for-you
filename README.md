# God's word for you（免費靜態版）

選擇你或朋友最接近的處境，從和合本找到合適的經文，附上下文說明、祝福、禱告與版畫插畫。

- **完全免費**：純靜態網頁，不呼叫 AI，可直接放在 GitHub Pages。
- **不收集資料**：使用者直接點選需要（安慰／鼓勵／造就／勸勉）與最接近的狀況，不需要打字，也不會傳出任何資料。
- **經文只取自和合本**：經文文字在建置時從 `data/cuv.json`（和合本 1919，公有領域）取出，不另外打字、不改寫。

## 放上 GitHub Pages

1. 在 GitHub 建立一個新的 repo，例如 `gods-word-for-you`
2. 把這個資料夾裡的所有檔案上傳到 repo（網頁上傳或 `git push` 都可以）
3. 到 repo 的 **Settings → Pages**
   - Source 選 **Deploy from a branch**
   - Branch 選 **main**，資料夾選 **/(root)**，按 Save
4. 約一分鐘後，網站會出現在 `https://<你的帳號>.github.io/gods-word-for-you/`

之後只要更新 repo 裡的檔案，網站就會自動更新。

## 修改內容

所有文字都在 `content/`：

| 檔案 | 內容 |
|---|---|
| `content/topics.json` | 29 個主題：名稱、分類（comfort 安慰／encourage 鼓勵／edify 造就／exhort 勸勉）、關鍵字、3 段經文與「應用」、每段經文各自的祝福（`blessings`，與 `passages` 順序對應，分為自己／為他人）、為自己／為他人的禱告、版畫主題與印章字 |
| `content/passages.json` | 每段經文的上下文、原意、提醒 |

- 首頁的「最接近的狀況」選項直接列出每個主題的名稱，依需要分類篩選。`keywords` 目前沒有用到（舊版文字比對用），保留以備日後需要。
- 選到「低潮與盼望」或「危險中的投靠」時，會一併顯示求助專線。
- 祝福會跟著使用者在「祝福與圖卡經文」選的那段經文更換；改經文時記得一起改對應的祝福。
- 為他人的祝福與禱告用 `{name}` 代表對方的稱呼，沒填稱呼時會顯示「這位朋友」。
- 經文出處用英文代號，例如 `Ps 23:1-4`、`1John 1:9`、`Phil 4:6-7`。

改完後執行（需要 Node.js 18 以上）：

```bash
node tools/build.mjs
```

它會檢查每個出處都存在於和合本、每段禱告都以「奉主耶穌的名求，阿們。」結尾，然後重新產生 `index.html`。再把 `index.html` 和 `content/` 一起上傳即可。

## 上線前

內容是依主題預先寫好的草稿，**請熟悉聖經的牧者或同工逐一讀過** `content/` 裡的經文說明、祝福與禱告，確認沒有斷章取義、語氣合適。

## 檔案

```
index.html            網站本身（由 build 產生，GitHub Pages 直接使用）
content/              可編輯的內容
data/cuv.json         和合本全本（建置時使用）
tools/                建置腳本、版面與版畫產生器
```

經文：和合本（繁體）公有領域，資料來源 [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases)。
