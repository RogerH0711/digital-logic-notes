# AGENTS.md — 數位邏輯講義站

這份文件寫給在這個 repo 工作的 AI（Claude Code、Codex、Cursor 等）與人類協作者。
開始任何修改前先讀完這份文件；它是本專案唯一的規則來源。若規則和使用者當下的指示衝突，以使用者指示為準，並在回覆中說明你偏離了哪一條。

---

## 1. 專案目的

- **是什麼**：一個以「單元」為單位的數位邏輯複習講義網站，章節對應課本 M. Morris Mano & Michael D. Ciletti《Digital Design》（6th ed.）第 1–6 章與 Verilog 補充。
- **給誰看**：正在修「數位系統導論」、需要考前複習的大學部學生。讀者會寫程式，但對電路還不熟。
- **核心原則**：每一頁都要「能自己讀懂、能自己練習、能自己驗證答案」。
- **怎麼長大**：內容只寫在 Markdown，網站由 build script 自動產生。新增一個單元＝新增一個 `.md` 檔，不需要碰 HTML、CSS 或 JavaScript。

## 2. 常用指令

```bash
npm ci            # 第一次 clone 後安裝依賴
npm run check     # 只驗證內容格式，不輸出網站；任何修改後都要跑
npm run build     # 驗證＋產生網站到 dist/
npm run dev       # build 後在 http://localhost:4173 預覽
```

`npm run check` 失敗時會印出「檔名:行號  錯誤原因」，例如：

```
✗ 發現 2 個問題：
  content/units/03-combinational-design.md:2  tag「電路」不在 syllabus.yml 的 tags 清單內
  content/units/03-combinational-design.md:25  kmap：第 1 圈 [1, 2] 不是合法的圈：格數必須是 2 的冪次，且要形成相鄰的矩形
```

依訊息修正後重跑。**check 沒過就不算完成。**

## 3. 目錄結構

```
.
├── AGENTS.md                 ← 本文件（規則來源）
├── CLAUDE.md                 ← 只有一行 @AGENTS.md，讓 Claude Code 自動載入本文件
├── README.md                 ← 給人看的專案簡介
├── site.config.json          ← 網站標題、作者、repo 網址
├── content/
│   ├── syllabus.yml          ← 課程大綱：所有單元（含尚未撰寫的）的 id、標題、對應課本章節，以及允許使用的 tags
│   └── units/
│       ├── _template.md      ← 新單元範本（底線開頭的檔案不會被 build）
│       ├── 01-number-systems.md
│       ├── 02-boolean-algebra.md
│       └── …（每個單元一個檔）
├── assets/
│   ├── css/style.css         ← 全站唯一的樣式表
│   ├── js/main.js            ← 主題切換、目錄高亮
│   └── img/<單元檔名>/        ← 各單元圖片，例如 assets/img/03-gate-level-minimization/fig1.svg
├── templates/
│   ├── layout.html           ← 共用外框（header、footer）
│   ├── unit.html             ← 單元頁
│   └── index.html            ← 首頁
├── scripts/
│   ├── build.mjs             ← 進入點：讀內容 → 驗證 → 輸出 dist/
│   ├── serve.mjs             ← 本機預覽伺服器
│   └── lib/                  ← markdown 設定、kmap 元件、驗證規則、樣板套用
├── sources/                  ← 使用者提供的投影片 PDF（已 gitignore，不 commit）
├── .github/workflows/deploy.yml  ← push 到 main 後自動 build 並部署 GitHub Pages
└── dist/                     ← build 輸出，不進 git，不要手動編輯
```

## 4. 新增一個單元（最常見的任務）

依序做完以下步驟：

1. **確認大綱**：打開 `content/syllabus.yml`，找到要寫的單元條目。
   - 已有條目就沿用它的 `id`、`title`、`chapter`，不要改名。單元編號就是 `id` 的前兩碼。
   - 大綱裡沒有，就在清單最後新增條目（`id`、`title`、`chapter` 都必填），編號接續最後一個（check 會要求 01 起連續編號）。不要插號或重新編號既有單元，否則網址會變。
2. **建立檔案**：複製 `content/units/_template.md` 成 `content/units/<id>.md`，例如 `04-combinational-logic.md`。
3. **填 frontmatter**：見第 5 節，所有欄位都必填。
4. **寫內容**：照第 6 節的章節骨架與第 7 節的元件語法撰寫。
5. **圖片**（需要時）：放到 `assets/img/<id>/`，檔名用小寫英文加連字號，優先用 SVG。
6. **驗證**：執行 `npm run check`，修到沒有錯誤為止。
7. **自我檢查**：逐項核對第 10 節的清單。

完成後，首頁目錄、側邊欄、上一頁／下一頁會自動更新，**不需要手動改任何導覽連結**。

### 4.1 從課堂投影片整理成單元

使用者常會給一份投影片 PDF，要求整理成對應單元。投影片放在 repo 根目錄的 `sources/`；這個資料夾已列在 `.gitignore`，**不會也不可以 commit**，因為投影片版權屬於授課老師與課本出版社。

1. 先讀完整份投影片，列出它涵蓋的小節（例如 4.1–4.11）與每節的重點、例題類型。
2. 把小節對應成單元的 H2／H3。順序跟投影片一致，方便對照上課進度。
3. 投影片標成 Practice Exercise、Example 的題型，改成數字不同的新題目，放進正文的 `example` 或 `## 練習題`。
4. 投影片裡的電路圖不要截圖，改用文字、真值表、布林式或 `kmap` 表達。
5. 投影片若有錯誤或說法不精確，以正確內容為準，並用 `warning` 提醒讀者常見的誤解。
6. 其餘照第 4 節步驟 3–7 完成。

## 5. 單元檔案格式

### 5.1 檔名

- 格式：`NN-kebab-case.md`，`NN` 是兩位數單元編號，後面是英文 slug。
- 檔名去掉 `.md` 就是單元的 `id`，也是網址：`units/<id>.html`。
- 檔名必須和 `syllabus.yml` 裡的 `id` 完全一致。

### 5.2 Frontmatter

```yaml
---
title: 閘級化簡               # 必須和 syllabus.yml 的 title 相同
unit: 3                       # 整數，必須等於檔名前兩碼
summary: 用卡諾圖得到最簡 SOP／POS，再轉成 NAND、NOR 電路。   # 一句話，≤ 60 字，會顯示在首頁卡片
tags: [化簡, 卡諾圖]           # 1–4 個，只能用 syllabus.yml 裡 tags 清單中的詞
prerequisites: [02-boolean-algebra]   # 先備單元的 id；沒有就寫 []；只能指向編號更小的單元
updated: 2026-11-04           # 最後實質修改日期，YYYY-MM-DD
---
```

### 5.3 章節骨架（`npm run check` 會強制檢查）

- 內文**不寫 H1**（`#`），標題由 frontmatter 產生。
- 第一個 H2 必須是 `## 學習目標`：3–5 點條列，每點用動詞開頭（「能…」「會…」）。
- 中間是正文 H2，數量不限，用 H3 細分。不要跳級（H2 底下直接接 H4）。
- 倒數第二個 H2 必須是 `## 重點整理`：條列，每點一句。
- 最後一個 H2 必須是 `## 練習題`：至少 2 題 `exercise`，每題都要附 `answer`。
- 建議篇幅：正文 1500–4000 字（中文字）。一個單元對應課本一章（或半章），內容多時用 H2／H3 分段，不要另開單元。

## 6. 寫作風格

- **語言**：繁體中文（台灣用語）。專有名詞第一次出現時寫「中文（English）」，例如「質蘊含項（prime implicant）」，之後只用中文。
- **標點**：中文用全形標點；中文與英文、數字之間加半形空格。
- **語氣**：像學長姐寫給學弟妹的講義，直接講重點。不用「讓我們一起…」「相信你已經…」這類填充句。
- **例子先於定義**：先給一個具體的函數或真值表，再歸納規則。
- **每個化簡結果都要可驗證**：凡是給出「最簡式」，就用 `kmap` 區塊（第 7.4 節）呈現。它會自動檢查圈法是否合法，並自動產生乘積項，避免手算錯誤。
- **不編造來源**：不要寫「根據某教科書第 X 頁」這類無法驗證的引用。
- **用自己的話寫**：網站是公開的。整理課堂投影片或課本時，只取「涵蓋哪些主題、重點在哪」，說明文字要重寫，不要逐字翻譯或貼上原文，也不要放投影片或課本的截圖。例題換成同類型但數字不同的新題目。
- **符號統一**：課本與投影片用 $x'$ 表示補數，本站一律改寫成 $\inv{x}$。變數名稱沿用題目本身（$A, B, C$ 或 $x, y, z$ 皆可）。

### 統一用詞表

| 用這個 | 不要用 |
| --- | --- |
| 布林代數 | 布爾代數 |
| 最小項（minterm）／最大項（maxterm） | 極小項、小項 |
| 卡諾圖（Karnaugh map, K-map） | K 圖 |
| 蘊含項（implicant）、質蘊含項（prime implicant）、必要質蘊含項（essential prime implicant） | 主蘊含項 |
| 無關項（don't care） | 隨意項 |
| 多工器（multiplexer）／解多工器、解碼器（decoder）／編碼器 | 多路復用器、譯碼器 |
| 正反器（flip-flop）、閂鎖（latch） | 觸發器、鎖存器 |
| 全加器（full adder）、半加器（half adder） | — |

## 7. 內容元件語法

只能用以下語法。**不要寫原始 HTML**：build 會把 HTML 當純文字輸出，check 也會報錯。

### 7.1 數學式（KaTeX）

- 行內 `$F = AB + \inv{C}$`，獨立一行 `$$ ... $$`。
- **補數一律用 `\inv{X}`**（自訂巨集，等同 `\overline{X}`），不要用 `A'`、`¬A`、`~A`。
- OR 用 `+`，AND 直接相鄰（`AB`），需要分隔時用 `\cdot`，XOR 用 `\oplus`。
- 最小項和用 `\sum m(1,3,5)`，最大項積用 `\prod M(0,2)`，無關項用 `+ d(6,7)`。

### 7.2 提示框

```markdown
::: definition 對偶原理
內容…
:::
```

種類：`definition`（定義）、`note`（補充）、`tip`（技巧）、`warning`（常見錯誤）、`example`（例題）。冒號後的文字是框的標題，可省略。

### 7.3 練習題

```markdown
:::: exercise 化簡 F(A,B,C) = Σm(0,1,2,5)
題目敘述（標題之外的補充，可省略）

::: answer
解答與過程。
:::
::::
```

- 外層用 4 個冒號，內層 `answer` 用 3 個冒號。
- 題號自動產生，標題不要自己寫「第 1 題」。
- 解答要寫過程，不能只寫最終答案。
- **對應課堂作業的題型練習**：標題最前面加「〔作業 X.Y 題型〕」（多題就用頓號隔開，例如〔作業 1.3、1.9 題型〕），放在該單元練習題的最後面。題目要照作業的題型重新出題，**數字、函數都必須和原題不同**，不可以收錄作業原題的文字或原題答案，因為網站是公開的，而作業是要算分的。
- 作業若有特殊規格（例如「不合法輸入必須輸出 0」），題型練習要保留這個規格，並在解答中說明它對設計的影響。

### 7.4 卡諾圖 `kmap`

用 fenced code block，語言標記寫 `kmap`，內容是 YAML：

````markdown
```kmap
vars: [A, B, C, D]          # 2–4 個變數；前半是列、後半是欄，依格雷碼排列
ones: [0, 2, 5, 7, 8, 10, 13, 15]
dontcares: []               # 可省略
mode: sop                   # sop（圈 1）或 pos（圈 0），預設 sop
groups:                     # 可省略；省略時只畫圖不圈
  - [5, 7, 13, 15]
  - [0, 2, 8, 10]
partial: false              # true＝允許沒圈完（用於分步驟講解）
name: D_A                   # 可省略；結果式左邊的函數名稱（LaTeX），預設 F(A,B,C,D)
caption: 四個角落也是相鄰的   # 可省略，支援行內數學式
```
````

build 會自動做以下事情：

- 檢查每一圈的格數是 2 的冪次且形成合法矩形（含跨邊界、四角）。
- 檢查圈內只有 1（或 0）和無關項。
- 在 `partial: false` 時，檢查所有 1（或 0）都被圈到。
- 自動產生每一圈的乘積項（或和項）與最終式子，並用不同顏色標示（最多 6 圈）。
- 格子編號：最小項編號 = 變數依 `vars` 順序組成的二進位數，例如 `vars: [A, B, C]` 時 $AB\inv{C}$ = 110 = 6。

**不要自己寫圈出來的乘積項**；需要在正文提到結果時，與 kmap 自動產生的式子保持一致。

### 7.5 真值表與其他

- 真值表用一般 Markdown 表格，輸入欄在左、輸出欄在右，列依二進位遞增排列。
- 程式碼（Verilog 等）用 fenced code block，語言標記寫 `verilog`。
- **行內程式碼不要含錢字號**：數學式的解析比行內程式碼早，兩段行內程式碼裡各有一個錢字號時，中間的文字會被當成數學式。Verilog 的系統任務（monitor、finish 等）在正文中用文字描述，或放進 fenced code block。
- 表格儲存格裡的直線符號要寫成反斜線加直線（例如 OR 運算子），否則會被當成欄位分隔。
- 圖片：`![替代文字](../assets/img/<id>/fig1.svg)`；替代文字必填，要描述圖的內容。

## 8. 視覺風格（未經使用者要求不要改）

- 調性：乾淨的講義紙張感，配上「示波器／電路板」的點綴。單元編號以 4-bit 二進位徽章顯示，例如第 2 單元是 `0010`。
- 字型：內文 Noto Sans TC，程式碼與編號用 JetBrains Mono（Google Fonts）。
- 顏色全部定義在 `assets/css/style.css` 開頭的 CSS 變數（`--bg`、`--ink`、`--accent` 等），並支援深色模式。**新增樣式時只能使用既有變數**，不要寫死色碼。
- 版面：桌機三欄（左：單元目錄／中：內文／右：本頁目錄），手機單欄，左右各留 16px。

## 9. AI 修改規則

**可以直接做：**

- 新增或修改 `content/units/*.md`，以及對應的 `assets/img/<id>/`。
- 修改 `content/syllabus.yml`：新增單元條目、新增 tag。
- 修正錯字、補充說明、增加練習題。

**要先問使用者：**

- 改動 `scripts/`、`templates/`、`assets/css/`、`assets/js/`。
- 新增 npm 依賴。
- 重新命名或刪除已存在的單元（會讓網址失效）。
- 改變第 5 節的格式規則或第 8 節的視覺風格。

**一律不要做：**

- 手動編輯 `dist/`。
- 在 Markdown 裡寫原始 HTML 或行內樣式。
- 跳過 `npm run check`，或為了讓 check 通過而放寬驗證規則。
- 對已有單元的數學內容做「看起來對」但未經驗證的改寫。

**改了規則就要更新本文件**：任何影響內容格式、元件語法或目錄結構的程式修改，都必須在同一次修改中同步更新 AGENTS.md 對應章節。

## 10. 完成前自我檢查清單

- [ ] 檔名、`id`、`unit`、`title` 都和 `syllabus.yml` 一致。
- [ ] `tags` 都在允許清單內；`prerequisites` 只指向編號更小的單元。
- [ ] 章節順序是：學習目標 → 正文 → 重點整理 → 練習題。
- [ ] 至少 2 題練習，每題都有含過程的解答。
- [ ] 補數用 `\inv{}`，化簡結果用 `kmap` 呈現。
- [ ] 專有名詞第一次出現有附英文，用詞符合第 6 節對照表。
- [ ] `npm run check` 通過。
- [ ] 用 `npm run dev` 打開頁面看過，數學式、卡諾圖都正常顯示。

## 11. 擴充新的內容元件

需要新的元件（例如時序圖 `timing`、邏輯電路圖 `circuit`）時：

1. 先問使用者是否要加入。
2. 在 `scripts/lib/` 新增元件模組，並在 `scripts/lib/markdown.mjs` 註冊。
3. 樣式加到 `style.css`，只使用既有 CSS 變數。
4. 在 `scripts/lib/validate.mjs` 加上對應驗證，讓錯誤在 check 階段就被擋下。
5. 在本文件第 7 節新增語法說明與範例。
6. 在至少一個單元實際使用一次，確認 build 結果。

## 12. 部署

- push 到 `main` 後，GitHub Actions（`.github/workflows/deploy.yml`）會執行 `npm ci && npm run build`，把 `dist/` 部署到 GitHub Pages。
- repo 設定：Settings → Pages → Source 選「GitHub Actions」。
- 所有站內連結都用相對路徑，因此不論部署在網域根目錄還是子路徑都能正常運作；不要寫以 `/` 開頭的絕對路徑。
