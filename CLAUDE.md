# kids-picture-books 專案說明

做新繪本、新遊戲前，**先讀 `STYLE.md`**（畫風提示詞、角色設定、文字與科學查核原則、遊戲設計原則）。
寫 FB 宣傳文案前，先讀本機的 `_private/fb-copy-guide.md`（不進 git）。
檔案結構與工具看 `README.md`。

- 上線：push 到 `main` 就由 GitHub Pages 發布（https://lioneer32232002-commits.github.io/kids-picture-books/），不用 Cloudflare。
  push 後等 Pages build 完成，再用 curl 確認新檔案是 200 才回報。
- `_raw/` 放 Gemini 原圖，不進 git；`python tools/process_images.py` 轉成 WebP 和去背素材，`python tools/make_banners.py` 產生 FB Banner（需先開 `python -m http.server 8080`）。
- 輔助腳本在 `tools/dev/`：Gemini 截圖取圖、拼圖、塔防與射擊遊戲的自動駕駛測試。
- 測試遊戲前先靜音（`localStorage.setItem('pb-muted','1')`），測完關掉測試分頁與伺服器。
- 使用者不打終端指令，需要執行的都自己跑。
