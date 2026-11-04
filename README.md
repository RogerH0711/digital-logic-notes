# 數位邏輯講義 Digital Logic Notes

以「單元」為單位的數位邏輯複習講義網站，章節對應 Mano & Ciletti《Digital Design》（6th ed.）第 1–6 章與 Verilog 補充。內容只用 Markdown 撰寫，build script 會驗證格式、渲染數學式與卡諾圖，再輸出成靜態網站部署到 GitHub Pages。

- 網站：<https://rogerh0711.github.io/digital-logic-notes/>
- 專案規則：[AGENTS.md](AGENTS.md)（AI 與人類協作者都照這份文件工作；Claude Code 透過 [CLAUDE.md](CLAUDE.md) 自動載入）

## 特色

- **一個單元＝一個 Markdown 檔**：新增內容不需要碰 HTML／CSS。
- **固定的單元骨架**：學習目標 → 正文 → 重點整理 → 練習題（附可展開的解答）。
- **會自己驗算的卡諾圖**：在 ```` ```kmap ```` 區塊寫最小項與圈法，build 會檢查圈得合不合法、有沒有漏圈，並自動產生化簡結果。
- **規則由程式強制**：`npm run check` 會擋下格式錯誤、不合法的圈、缺少解答的練習題等問題，GitHub Actions 驗證沒過就不部署。

## 使用方式

```bash
npm ci
npm run dev     # http://localhost:4173
npm run check   # 只驗證內容
```

## 新增一個單元

1. 在 `content/syllabus.yml` 確認或新增單元條目。
2. 複製 `content/units/_template.md` 成 `content/units/<id>.md` 並撰寫。若是從投影片整理，把 PDF 放在 `sources/`（不會被 commit），照 AGENTS.md 第 4.1 節做。
3. `npm run check` 通過後 push。

詳細格式見 [AGENTS.md](AGENTS.md)。

## 目錄

| 路徑 | 用途 |
| --- | --- |
| `content/syllabus.yml` | 課程大綱與允許的 tags |
| `content/units/` | 各單元 Markdown |
| `templates/` | 頁面樣板 |
| `assets/` | 樣式、腳本、圖片 |
| `scripts/` | build、驗證、本機預覽 |
