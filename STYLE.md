# 互動繪本與遊戲：風格指南

這份是「Tap & Learn Picture Books」系列的做法紀錄：做新繪本、新遊戲、新文案時照這份走，系列才會一致。
檔案結構與工具用法看 `README.md`；本檔只記「風格」與「原則」。

---

## 1. 系列定位

- **對象**：5–7 歲孩子，由家長陪著玩。
- **語言**：內容全英文（句子短、白話），每頁有「📖 Read to me」用瀏覽器語音朗讀。
- **調性**：可愛，但不陽春；有科學根據，不誇大。
- **形式**：每本約 7–10 頁互動繪本，可延伸成一個小遊戲（目前：塔防、垂直射擊）。
- **上線**：GitHub Pages（`lioneer32232002-commits/kids-picture-books`），**不用 Cloudflare**。

---

## 2. 美術風格（Gemini 生圖）

### 2.1 固定畫風句（每本第一張圖都貼這段，之後在同一個對話裡說「same style」）

> STYLE: cute children's picture-book illustration, soft gouache and colored-pencil texture on warm paper,
> rounded chubby shapes, friendly kawaii faces with big shiny eyes and rosy cheeks, vibrant but gentle palette,
> soft warm lighting, clean composition.

再加上：`Wide 16:9 landscape. No text, no letters, no words anywhere in the image.`

### 2.2 構圖規則

- **插圖頁**：16:9 橫式；要放文字或互動元件的地方，在提示詞裡指定「左邊 45% 留空」「下方地板留空」。
- **Banner 底圖**：16:9，**左 45% 留給標題**，主角放右邊。
- **素材表（sprites）**：純白底、無陰影、無外框、無文字，`N by M grid`，每格一個物件、周圍大量留白、大小一致。
  之後用 `tools/process_images.py` 依連通區塊自動去背切圖（標籤文字會自動被丟掉）。
- **遊戲直式背景**：9:16，畫面要「平靜」，不能有可碰撞的物件；程式會鏡像拼接成可無限捲動。
- **地圖（塔防）**：俯視、中央平坦、**不要畫路**，路線由程式畫，才能和格位精準對齊。

### 2.3 角色設定（重畫時照抄這些描述）

| 作品 | 角色 | 描述 |
|---|---|---|
| 恐龍 | Pip | tiny round sky-blue bird, orange beak, little tuft of feathers on its head, cream belly |
| 行星 | Nova | cheerful 6-year-old kid astronaut, **short curly brown hair**, round clear bubble helmet, puffy orange-and-white space suit with a star patch |
| 行星 | Bolt | small round silver robot dog with a blue antenna（射擊遊戲中加 tiny jetpack） |
| 免疫 | Neo | small round lilac cell, wavy three-part purple nucleus pattern on its tummy, tiny red sneakers |
| 免疫 | Max | big chubby soft-blue blob with a huge happy mouth |
| 免疫 | Bella | round mint-green cell holding a little Y-shaped toy blaster |
| 免疫 | Captain T | brave orange cell with a small silver knight helmet and a round shield |
| 免疫 | Leo | cheerful 6-year-old, short black hair, yellow hoodie |

### 2.4 一定要檢查的地方（做過的修正）

- **爆炸不能像核爆**：小行星撞擊第一版是蕈狀雲，改成「starburst flash + 圓形塵雲 + 浪」。
- **角色會漂移**：Nova 曾被畫成長髮，要求「exactly like the earlier pages: SHORT curly brown hair」重畫。
- **會被打掉的東西不能有臉**：太空垃圾、隕石、垃圾球魔王都要求 `NO faces, NO eyes`。病毒是例外（塔防裡是擬人角色，但書中註明「真的病毒沒有臉」）。
- Gemini 的 Pro 模型出圖常失敗，改用 Flash。

### 2.5 取圖

Chrome 會擋 Gemini 連續自動下載：
- 重新整理頁面後，通常第一張可以下載；或請使用者在 Chrome 允許 gemini.google.com 自動下載。
- 被擋時改用 `tools/dev/gemini_capture.js`：在頁面內載入原圖、分段截圖，再用 `tools/dev/stitch_tiles.py` 拼回來，約 1550px 寬，網頁用足夠。
- **不要撿下載資料夾裡舊的 `Gemini_Generated_Image_*`**：曾經撿錯一張使用者自己的圖。

---

## 3. 文字風格（繪本內容）

- **英文、短句、白話**，一頁 2–3 句主文；重點字用 `<span class="hl">`（螢光筆）或 `<span class="big">`（大字）。
- 每頁一個 `fact` 小框：補充數字或「真的還是假的？」。
- **數字要有可比較的生活物件**：80 倍噴射機速度、兩台校車長、披薩盒疊成幾棟台北 101。
- **誠實寫限制**：
  - 維生素 C 對大多數人不能預防感冒 → 寫「蔬果幫英雄好好工作」，不寫「吃了就不會生病」。
  - 冷凍睡眠目前做不到。
  - 小行星帶裡的石頭彼此相距約 100 萬公里；在真實太空打碎垃圾會產生更多碎片。
  - 遊戲簡化了生物學 → 都要明寫。
- 頁尾列**資料來源**（NASA、ESA、NIH ODS、Harvard Nutrition Source、CDC、Smithsonian、NHM）。
- 最後一頁：3 題小測驗＋連到其他繪本。
- 敏感內容要溫和：家人變老或「可能已經不在了」用 💐 和溫柔句子，不渲染。

---

## 4. 互動與特效（共用引擎 `assets/book.js`）

- 圖上可點的地方用 `Book.hot()`（白色脈動光圈），點了出現 `Book.bubble()` 對話框。
- 特效：`Book.fx`（火焰、爆炸、閃光、震動、落灰／雪／花粉／星星天氣）；音效 `Book.sfx`（Web Audio 合成，不用音檔）。
- **音效要節制**：連發的動作（射擊、撿星塵）不要每次都響，或要加間隔限制。使用者曾因測試分頁一直有聲音而反映。
- 手機：直式要能翻頁（滑動），遊戲頁在手機橫拿或直拿時要讓畫面最大。

---

## 5. 遊戲設計原則

- **引擎**：Phaser 3（jsDelivr 固定版本 3.88.2），純靜態檔，GitHub Pages 直接跑。
- **不傷害生命**：外星人是生命 → 雷射會穿過去，飛過去打招呼還有獎勵。能被打掉的只有物件或岩石，而且沒有臉。
- **對 5–7 歲友善**：
  - 血量給多一點（射擊遊戲 5 顆心）。
  - 小碎片撞到只會「Bonk!」彈開，只有大東西會扣血。
  - 一定要閃的東西（彗星）會先出現 ⚠ 警告。
- **耐玩**：
  - 8 關＋星等評分，進度存在本機。
  - 永久升級：塔防的記憶細胞、射擊遊戲的火箭機庫。
  - 無限模式、中大型敵人（破損隕石）、魔王。
- **教育連結**：遊戲機制對應真實科學，例如免疫記憶給傷害加成、吃彩虹蔬果觸發彩虹力量、垃圾食物會讓英雄血糖崩盤。
- **難度用自動駕駛實測**：`tools/dev/td_autoplay.js`、`tools/dev/space_autopilot.js` 搭配網址參數 `?unlock=1&timer=1`。目標是前幾關無傷、最後幾關有挑戰但打得過。
- 測試時先 `localStorage.setItem('pb-muted','1')` 靜音；測完關掉測試分頁和伺服器。

---

## 6. Banner（FB 宣傳）

- 每本兩張：`*-fb.jpg` 1200×630（連結貼文、廣告）、`*-square.jpg` 1080×1080（動態貼文）。
- 由 `tools/banners/banner.html` 模板加 `tools/make_banners.py` 產生：左側標題（Baloo 2 字型）＋說明＋3 個標籤＋按鈕，右側是 Gemini 底圖。
- 標題斷行要檢查，例如「Clean‑Up」要用不換行連字號。

---

## 7. FB 宣傳文案

文案寫法另存在本機 `_private/fb-copy-guide.md`（不進 git，因為 repo 和網站都是公開的）。
