# 互動繪本與遊戲：風格指南

這份是「Tap & Learn Picture Books」系列的做法紀錄：做新繪本、新遊戲、新文案時照這份走，系列才會一致。
檔案結構與工具用法看 `README.md`；本檔只記「風格」與「原則」。

---

## 1. 系列定位

- **對象**：5–7 歲孩子，由家長陪著玩。
- **語言**：內容全英文（句子短、白話），每頁有「📖 Read to me」用瀏覽器語音朗讀。
- **調性**：可愛，但不陽春；有科學根據，不誇大。
- **形式**：每本約 7–10 頁互動繪本，可延伸成一個小遊戲（目前：塔防、垂直射擊、洋流游泳、氣動賽車、駕駛艙模擬飛行、蓋大教堂）。
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
- **Banner 底圖**：16:9。舊版排版是**左 45% 留給標題**、主角放右邊；從火衛一這本開始用海報式排版（見第 6 節），底圖改成**上方 30% 留天空**、主角放中間偏右下。
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
| 洋流 | Kai | cheerful 6-year-old Taiwanese kid, short straight black hair, teal-and-white striped swim shirt, red swim shorts, small yellow snorkel mask pushed up on the forehead |
| 氣動車 | Zip | small chubby mint-green toy race car seen from the side facing right, friendly face on its front (big shiny eyes, little smile), rosy cheeks, round clear bubble windshield, chunky dark tires, three small round silver air nozzles |
| 氣動車 | Dash | the same kind of chubby toy race car but bright orange with white racing stripes, friendly face（遊戲裡的對手，不會被撞壞） |
| 氣動車 | Rio | cheerful 6-year-old kid, short messy dark-brown hair, orange racing jacket with a white star, blue jeans, red sneakers |
| 飛機 | Lin | cheerful 6-year-old Taiwanese kid pilot, short black bob hair, brown leather aviator cap with round goggles pushed up on the forehead, red scarf, sky-blue pilot jumpsuit with a little gold wing badge, white sneakers |
| 飛機 | Poppy | small chubby sunny-yellow propeller airplane, friendly face on its nose (big shiny eyes, little smile, rosy cheeks), round bubble cockpit window, white wings with a red stripe, red propeller |
| 巴黎 | Lea | cheerful 6-year-old Parisian girl, wavy chestnut-brown hair in a short ponytail, red beret, navy-and-white striped long-sleeve shirt, yellow overalls, red sneakers |
| 巴黎 | Gus | small chubby friendly pale-gray stone gargoyle, tiny bat wings, two little round horns, big shiny eyes, rosy cheeks, wide happy open mouth（遊戲裡的排水石獸用 side view facing RIGHT, mouth wide open like a water spout） |
| 松山機場 | An-An | cheerful 6-year-old Taiwanese kid plane spotter, very short black hair with straight bangs, round binoculars around the neck, mint-green hoodie with a little white airplane on the chest, navy shorts, yellow sneakers |
| 松山機場 | Jetty | small chubby white business jet, friendly face on its nose (big shiny eyes, little smile, rosy cheeks), teal stripe along its side, round windows, two small engines at the back next to a T-shaped tail with a little red heart（遊戲用 top-down 圖：nose pointing UP） |
| 松山機場 | Whirly | chubby bright orange rescue helicopter, friendly face on its nose, white stripe, round bubble window, gray rotor blades, landing skids（top-down 圖 nose UP；旋翼由程式加一層轉動的圓盤） |
| 颱風 | Mei | cheerful 6-year-old Taiwanese girl, short black hair in two small round buns on top of her head, bright yellow raincoat, red rain boots, small blue flashlight（晚上穿星星睡衣） |
| 颱風 | Swoop | small chubby sky-blue jet plane, friendly face on its nose (big shiny eyes, little smile, rosy cheeks), white belly, yellow stripe along its side, round windows, two small engines at the back, T-shaped tail（遊戲 top-down 圖 nose UP；真的追風機沒有臉） |
| 颱風 | Grandpa | kind Taiwanese grandpa, short gray hair, round glasses, green cardigan |
| 水星 | Bepi | chubby box-shaped spacecraft covered in shiny silver-white blankets, one long dark-blue solar panel wing, round white antenna dish, friendly face（ESA 的水星行星軌道器 MPO；書裡是姊姊） |
| 水星 | Mio | small chubby eight-sided drum-shaped spacecraft with dark-blue solar cells, silver stripes, two thin antenna sticks, friendly face（JAXA；書裡是弟弟，航行時躲在白色圓錐遮陽帽裡） |
| 水星 | Engine module | silver cylinder with two very long dark-blue solar panel wings and soft glowing blue engine beams, NO face（疊在最下面：引擎模組、Bepi、白色圓錐帽裡的 Mio） |
| 黑琵 | Bomi | cute chubby black-faced spoonbill: white feathers, a long flat black bill that widens into a round spoon at the tip, bare black skin around the eyes, big shiny eyes, rosy cheeks, long black legs, one small plain green leg ring（春天：只有後頭的冠羽和胸前一塊是黃色，身體仍是白的） |
| 黑琵 | Ting | cheerful 6-year-old Taiwanese girl birdwatcher, short black hair with a side clip, green bucket hat, binoculars, orange vest with many pockets, khaki shorts, white sneakers |
| 黑琵 | A-gong | kind Taiwanese fish-farmer grandpa, tanned face, conical straw hat, light blue shirt, dark rubber boots up to the knees |
| 火衛一 | Emmy | cute chubby box-shaped spacecraft wrapped in shiny crinkled GOLD foil, a cream-white face panel on the front (big shiny eyes, rosy cheeks, smile), two dark-blue solar panel wings, a round white antenna dish on top, four short landing legs with round feet, one thin robot arm with a small scoop（MMX；暱稱是書裡取的） |
| 火衛一 | Idefix | small four-wheeled silver-gray rover, a little dark-blue solar panel on its back, a head on a neck with two round camera eyes, a small smile（法德合作的真實探測車，書裡有表情） |
| 火衛一 | Riku | cheerful 5-year-old Japanese boy, spiky black hair, red T-shirt with a yellow star, navy shorts, green sneakers |
| 台北 101 | Bao | GIANT shiny golden ball with a friendly face (big shiny eyes, rosy cheeks, little smile) and thin horizontal lines of stacked steel plates, hanging from thick steel cables（真的阻尼器沒有臉；台北 101 自己的吉祥物「阻尼器寶寶」是三麗鷗設計的，不要照抄它的樣子） |
| 台北 101 | Yuyu | cheerful 6-year-old Taiwanese girl, black hair in one high ponytail with a yellow bow, light-purple T-shirt with a little white star, denim shorts, orange sneakers, small blue backpack（跨年夜穿紅外套） |
| 台北 101 | Dad | kind Taiwanese dad, short black hair, glasses, green polo shirt, khaki pants |
| 明治橋 | Hao | cheerful 6-year-old Taiwanese boy, short black hair with a little cowlick, orange T-shirt, navy shorts, green sneakers, small sketchbook |
| 明治橋 | A-ma | kind Taiwanese grandma, short wavy gray hair, round glasses, lavender cardigan, dark pants |
| 明治橋 | 明治橋 | elegant 1930s light-gray reinforced-concrete arch bridge, open arches under the road, stone railing, two pairs of tall bronze lamp posts with round glass lanterns（真的橋沒有臉；1968 年後的畫面不畫燈柱） |
| 洋流 | Mo | tiny baby green sea turtle, rounded olive-green shell with a soft hexagon pattern, cream-yellow belly, chubby flippers, big shiny eyes and rosy cheeks（遊戲用 top-down 圖：head pointing UP） |

### 2.4 一定要檢查的地方（做過的修正）

- **爆炸不能像核爆**：小行星撞擊第一版是蕈狀雲，改成「starburst flash + 圓形塵雲 + 浪」。
- **角色會漂移**：Nova 曾被畫成長髮，要求「exactly like the earlier pages: SHORT curly brown hair」重畫。
- **會被打掉的東西不能有臉**：太空垃圾、隕石、垃圾球魔王都要求 `NO faces, NO eyes`。病毒是例外（塔防裡是擬人角色，但書中註明「真的病毒沒有臉」）。
- Gemini 的 Pro 模型出圖常失敗，改用 Flash。
- Gemini 會自己決定飛機朝左或朝右，畫好後再對照：朝向和互動箭頭不合時用 CSS `scaleX(-1)` 翻圖，不必重畫。
- **噴氣要畫得酷**：只寫 puff of air 會畫成一團圓圓的雲，使用者說像放屁。提示詞要寫「a sharp, powerful jet of glowing blue-white air ... like a rocket thruster: crisp straight streaks, speed lines and a bright shimmering cyan glow, NOT a round puffy cloud」。遊戲裡的噴氣也用青色細長光束，不用白色圓點。
- **吸氣不要畫成噴氣**：要明寫 air is SUCKED IN / pulled out of the gap，並寫清楚風扇在車和路面之間，否則 Gemini 會畫成往下噴。
- Gemini 近期的圖常帶米色紙框，進 `process_images.py` 前要先裁掉（氣動車書左右各裁約 4.6%、上 4.8%）。
- **提示詞不要有換行**：在輸入框打 `
` 會直接送出前半段，Gemini 會照半段提示亂畫（曾畫出熊和兔子野餐）。整段寫成一行。
- **地圖不要叫 Gemini 畫**：地理位置一定會錯。洋流書的地圖是 `currents/geo.js` 用經緯度手動簡化海岸線，再用 SVG／Phaser 畫，洋流箭頭才對得準。
- **要會動的地標另外畫**：巴黎書第 7 頁的艾菲爾鐵塔要隨太陽傾斜，插圖明寫「NO Eiffel Tower in this picture」，鐵塔另畫一張 9:16 白底單張素材（`SPRITES` 裡的 `tower`）再疊上去。
- **新舊對照要同角度**：羅浮宮「城堡 → 博物館」兩張圖，第二張提示詞寫「same camera angle and composition as the castle picture」，切換時才對得上。
- 歷史頁的提示詞要寫「no signs with writing, no flags with writing」，不然招牌、旗子會冒出亂碼字。
- **颱風不是龍捲風**：只寫 typhoon cloud 會畫成細長漏斗。要寫「GIANT WIDE FLAT spiral of clouds ... many times wider than it is tall ... NOT a funnel, NOT a tornado」。從上往下看的颱風要檢查旋臂：北半球往外是**順時針捲出去**（風逆時針吹），畫反了就左右翻圖。
- 颱風季不要畫山頂積雪；颱風前後的畫面，陽台和院子不能還擺著盆栽（跟「收進屋」的教學矛盾），要明寫 the balcony must be EMPTY。
- **水星沒有岩漿**：只寫 day side hot 會畫出發光的橘色隕石坑。要寫「Mercury has NO lava, craters must NOT glow」，白天是曬得發白的灰色岩石加熱浪。
- 整顆星球的素材（`mercury_big`）用 `process_images.py` 的 `CIRCLE`：亮的邊緣會被白底 flood fill 吃掉一塊，改用圓形遮罩。也要請 Gemini「the WHOLE ball fits with white space all around」，第一次常被切掉下半。
- **繁殖羽不是全身黃**：寫「spring yellow feathers」會畫成整隻黃鳥。要寫「body, neck and wings WHITE, only a fluffy yellow crest on the back of the head and one yellow patch on the chest」。雛鳥的嘴是粉紅色。
- 被吃的魚、蝦寫 NO face（跟免疫書的食物一樣）。腳環上的編號不要讓 Gemini 畫，由 HTML 標籤疊上去。
- 白底素材表裡「白色或透明」的東西（塑膠袋、寶特瓶）要指定淡紫灰、淡藍等顏色，不然去背會被吃掉；網子這類有破洞的東西在 `process_images.py` 的 `HOLES` 加名字，會把洞裡的白色一起去掉。

### 2.5 取圖

Chrome 會擋 Gemini 連續自動下載：
- 重新整理頁面後，通常第一張可以下載；或請使用者在 Chrome 允許 gemini.google.com 自動下載。
- 被擋時改用 `tools/dev/gemini_capture.js`：在頁面內載入原圖、分段截圖，再用 `tools/dev/stitch_tiles.py` 拼回來，約 1550px 寬，網頁用足夠。
- **不要撿下載資料夾裡舊的 `Gemini_Generated_Image_*`**：曾經撿錯一張使用者自己的圖。
- 不按下載鈕的取圖法（洋流書用這個）：頁面裡的預覽圖是 1024 px 的 blob，在頁面內用全螢幕 overlay 以 1:1 顯示，再用 zoom 截圖（`scale: 1`、`save_to_disk`）存下來，直式圖分兩段截再拼。網頁用夠了，也不會觸發瀏覽器下載。
- 醫療主題：病人一律微笑、蓋毯子，提示詞寫 `calm, caring, not scary, no blood, no needles, no red cross symbols`（紅十字是受保護的標誌）。真的飛機（1936 年老客機、1970 年代噴射機）寫 `real plane, NO face`，只有主角有臉。
- 颱風書時 data URL 下載只成功第一張，第二張起 Chrome 擋自動下載：改用「頁面內 canvas 全螢幕 overlay（CSS 寬 = naturalWidth / devicePixelRatio）→ `zoom` 截 region `scale: 1`、`save_to_disk`」，存下來剛好 1024×572 原尺寸。截圖前先 `hover` 到畫面右下角，避免游標入鏡。
- **最快的取圖法（飛機書用這個，連續 8 張以上沒被擋）**：在 Gemini 頁面內把 1024 px 預覽 blob 畫到 canvas → `toDataURL('image/jpeg', .93)` → 用 `<a download="flight_p05.jpg">` 觸發「data URL 下載」，檔名自己取，再從下載資料夾搬到 `_raw/`。不經過下載鈕，不會撿錯舊檔。
  輸入框用 `document.querySelector('rich-textarea .ql-editor').focus()` 對焦再打字，比點座標可靠（視窗大小一變，座標就點不到）。

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
- **會被打掉／撈走的只有垃圾**：洋流遊戲裡塑膠袋、寶特瓶點一下用 Kai 的網子撈走，漁網要點三下；海龜、飛魚、海豚、烏魚都是朋友，游過去打招呼。救援關是「剪斷漁網救海龜」，不是打倒魔王。
- **一定要閃的東西要能閃**：洋流遊戲的船一開始是橫向穿越，但 Mo 在強流裡停不下來，等於閃不掉；改成沿著紅色警示直線開過來，往旁邊游就能閃（跟太空遊戲的彗星同一招）。
- **耐玩**：
  - 8 關＋星等評分，進度存在本機。
  - 永久升級：塔防的記憶細胞、射擊遊戲的火箭機庫。
  - 無限模式、中大型敵人（破損隕石）、魔王。
- **原理要對到真實的東西**：氣動車書照特斯拉 Roadster 的兩個原理走：推進器＝作用力與反作用力（書和遊戲都用 Action / Reaction 這組詞），吸地風扇＝氣壓（明寫這是另一個原理）。廠商說的數字（0.6 秒、600 公升）一律寫「Tesla says」。
- **教育連結**：遊戲機制對應真實科學，例如免疫記憶給傷害加成、吃彩虹蔬果觸發彩虹力量、垃圾食物會讓英雄血糖崩盤、順著洋流游超快而逆流幾乎游不動、冬天和夏天台灣海峽的流向相反。
- **模擬器要讓真的飛行員也服氣**（飛機遊戲，使用者要求）：儀表板照真實小飛機配置——六大儀表（空速、姿態、高度／轉彎協調、航向、升降速度）、轉速表、STALL／GEAR 警告燈、MASTER 開關＋鑰匙啟動、襟翼分段手柄（UP／10°／30°）、輪子形把手的起落架手柄＋三顆綠燈（收放中亮紅燈、約 4 秒、地面鎖住不能收）、油門、煞車、GPS 洋紅色航線。空速表的白／綠／黃弧與紅線要和物理模型的失速速度一致。單位用 km/h 和公尺（書裡一致），頁面註明很多飛機用節和英尺。
  簡化但不亂做：搖桿是有防失速保護的 fly-by-wire（放手＝平飛），太慢只會下沉並亮 STALL；這點在頁面明寫。
- **敏感時事只帶到能懂的程度**：巴黎書遇到暴動新聞，書裡不談暴動原因，只在法國大革命那頁寫「人們會為不公平發聲，最好的工具是說話、傾聽、投票」，畫面用 7 月 14 日的煙火，不畫衝突。
- **蓋東西的遊戲不讓東西壞掉**（Cathedral Builders!）：石頭沒對準只會「Bonk!」滑掉再來一顆，沒有飛扶壁的牆只會搖晃，鴿子下雨時自己飛走再飛回來。
- **追風遊戲**（颱風書）：風場逆時針、眼裡無風、眼牆最強（遊戲裡眼牆外一圈紅色虛線不能飛，進去只會被彈出來、扣一個 bump，不會失敗）；順著旋轉飛會有順風，逆著飛會很慢，這是遊戲的核心教學。雷雨胞沒有臉。準備關不是「點一下就收好」，而是美美走過去搬（重的東西走比較慢），陽台交給爺爺，所以要先救搖晃的東西；機器人用「亂序慢慢點」測試，第 6 關亂點會丟東西。
- **借力飛行遊戲**（水星書）：能量守恆 E = v²/2 − G/r，越靠近太陽越快，FLYBY 和 BRAKE 都是拿走能量。速度只決定「到水星時抓不抓得住」，移動速度有下限（不然一早煞車會在外圈慢到爬）。太快就多繞一圈再飛掠，繞 3 圈後控制中心自動幫忙，所以一定能過關。轉向煞車時太空船掉頭、引擎朝前，跟真的一樣。
- **覓食遊戲**（黑琵書）：側面看魚塭，背景用 Gemini 的遠景圖，水和泥底用程式畫在下半部，水位才能動（阿公放水、漲潮）。水太深的地方鳥走不過去（「too deep」標示）。走太快會嚇跑魚，被嚇到的魚 2.5 秒內抓不到，教「慢慢走、左右掃」。夜晚的魚只看得到漣漪，嘴靠近才看得清楚。
- **遷徙遊戲**：東亞海岸線用經緯度手畫簡化（`spoonbill/sim.js` 的 `COAST`），繪本地圖頁和遊戲共用。秋天東北季風往西南吹，春天換成往北的弱風。中途濕地每處只休息一次（休息完還在光圈裡會一直重新休息，曾經卡住），累了會自動滑翔到最近的濕地。
- **Phaser 效能**：Graphics 裡上千個小圓點（星空、虛線航線）每一格都會重畫，水星遊戲一度只有每秒 10 格。星空改成一張 512 px 的 tileSprite，航線改成一條 strokePoints，之後的遊戲照這樣做。
- Windows 10 的 canvas 字型畫不出 🪂（emoji 12），遊戲裡改用 📡；HTML 文字可以用。🪶 也一樣畫不出來。
- **降落遊戲**（火衛一書）：側面看火衛一，重力很弱，按住 UP 推、◀ ▶ 平移；落地太快或碰到大石頭會「慢慢彈很高」，不會壞；停在發光點上放開推進器就自動進入挖土。燃料用完給一次小備用油箱，再用完又沒停在發光點才算失敗（結果頁教「小小點一下」）。最後一次挖完 Emmy 自己起飛，不用孩子再操作。按鈕是「按住」型，觸控可同時按多顆（`input.addPointer`）。
- **探測車遊戲**：地面下降得比重力能拉下來的還快，車就會飛起來（跳躍判定），落地後要花 1.5 秒翻正，所以開快反而比較慢；速度表綠區安全、紅區會跳。停在發亮的石頭旁邊才出現 SCAN 鍵。
- **穩住大樓遊戲**（台北 101 書）：塔的擺動是「彈簧＋阻尼」，陣風用同樣的節奏推（共振才看得出晃），地震是幾個頻率混在一起的短暫搖晃。孩子按 ◀ ▶ 的規則是「往塔『正在移動』的反方向擺 Bao」才會減少晃動（看位置不看速度在物理上沒用，所以畫面上用塔頂的移動箭頭，第一關讓該按的鍵發光）。真的阻尼器不用人推，play 頁面要明寫。會輸的只有 89 樓咖啡廳的珍奶（灑掉 3 杯也會打完，只是 1 星）。
- **電梯遊戲**：快的電梯要很早放開才停得住，畫面上的 🛑 標記和面板文字「現在放開會停在幾樓」是這關的核心；靠近樓層又夠慢時電梯自己平層（真的電梯也會）。數字照真的：最快 60.6 km/h，5 樓到 89 樓機器人剛好 37 秒。
- Windows 10 也畫不出 🧋 🛗 🫸 🫨（emoji 13 以後），HTML 也一樣：珍奶用 🥤、電梯用 ⬆️、推用 🤜🤛。
- **拼橋遊戲**（明治橋書）：拱石只能「從兩邊往上」放、拱心石最後，放錯號碼或順序只會滑回托盤；可以拖曳，也可以先點石頭再點位置（5–7 歲拖不準）。防洪關的正確範圍要寬（至少 4 種高度可過），一次測試最多說出兩個問題，不然孩子要多測好幾次才知道還有別的錯。河岸要比洪水高，不然畫面上水會像一道牆浮在草地上。
- **有爭議的城市議題**（明治橋要不要重建、放哪裡）：不寫政治人物、不選邊，只列每個想法的好處和難處，說「大家說想法、互相聽、再一起決定」。
- **按鈕直接呼叫 sim 會吃掉事件**：sim 每一步開頭會清空 events，所以按鈕的動作要排進下一步再執行（`acts` 佇列），不然提示和畫面不會更新（曾經發生「拆支架」按鈕按了還在）。給孩子的回饋（放錯、測試失敗）要立刻顯示（`toastNow`），不能排在別的訊息後面。
- Windows 10 畫不出 🪵，換成 👷。
- 素材表 Gemini 會自己在每格下方加名字標籤：`SHEETS_BY_BOOK` 的框高設到標籤上方就好，不必重畫。
- **救護遊戲**（松山機場書，使用者要求「私人飛機與醫療後送」）：地圖用 `currents/geo.js` 真實經緯度，跑道方向和編號照真實（松山 10/28、金門 06/24、馬祖 03/21、澎湖 02/20、台東 04/22），飛機一定逆風起降；噴射機要放輪（三綠燈）＋SLOW 才會被進場漏斗接手自動落地，直升機在 H 上減速按 LAND。病人舒適度取代血量：亂流、靠近鳥群、忘了回應護理師都只扣舒適度，不會失敗；鳥一定安全飛走。氣象雷達（小地圖紫色）讓孩子學繞過雷雨。島和機場畫得比實際大，頁面明寫。
- **難度用自動駕駛實測**：`tools/dev/td_autoplay.js`、`tools/dev/space_autopilot.js` 搭配網址參數 `?unlock=1&timer=1`。目標是前幾關無傷、最後幾關有挑戰但打得過。
  - 預覽分頁被藏起來時瀏覽器會把 setTimeout／rAF 降到每秒一次，遊戲幾乎不動。`tools/dev/current_autopilot.js` 的 `simBot()` 改成自己呼叫 `game.step()` 一格一格跑，一關約 4 秒，不受影響；之後的新遊戲建議都用這招。
- 測試時先 `localStorage.setItem('pb-muted','1')` 靜音；測完關掉測試分頁和伺服器。

---

## 6. Banner（FB 宣傳）

- 每本兩張：`*-fb.jpg` 1200×630（連結貼文、廣告）、`*-square.jpg` 1080×1080（動態貼文）。
- 由 `tools/banners/banner.html` 模板加 `tools/make_banners.py` 產生。
  - 舊版（黑琵以前）：左側標題（Baloo 2 字型）＋說明＋3 個標籤＋按鈕，右側是 Gemini 底圖。
  - **v2 海報式（火衛一起，使用者要求換排版）**：圖滿版，上方深色漸層裡置中放標籤、標題、說明，底部一列放 3 個標籤（左）和按鈕（右）；方形版標籤和按鈕置中疊在底部。在 `banner.html` 的書目資料加 `layout: "v2"` 就會套用，CSS 放在 `<style>` 最後（要壓過舊版的 wide／square 規則）。
- 標題斷行要檢查，例如「Clean‑Up」要用不換行連字號。

---

## 7. FB 宣傳文案

文案寫法另存在本機 `_private/fb-copy-guide.md`（不進 git，因為 repo 和網站都是公開的）。
