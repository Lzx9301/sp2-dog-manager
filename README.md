# 遊戲狗狗資源管理系統（第一版）

私人使用的遊戲狗狗收藏／帳號管理／血統族譜／配狗計畫工作台。

---

## 1. 專案檔案結構

```
/
├── index.html              # 登入 + 工作台
├── dogs.html                # 狗狗管理（列表/搜尋/篩選/新增）
├── dog-detail.html          # 狗狗詳細頁
├── accounts.html            # 帳號管理
├── account-detail.html      # 帳號詳細頁
├── breeding.html             # 配狗中心
├── pedigree-check.html       # 血緣檢查 + 可回配候選掃描
├── settings.html             # 系統設定（品種/特效/圖案）
├── css/
│   └── style.css             # 全站共用樣式
├── js/
│   ├── firebase-config.js    # Firebase 初始化（★需要填入你自己的專案金鑰）
│   ├── services/             # 所有 Firestore 存取邏輯，UI 不直接寫查詢
│   │   ├── authService.js
│   │   ├── dogService.js
│   │   ├── accountService.js
│   │   ├── breedService.js
│   │   ├── effectService.js
│   │   ├── patternService.js
│   │   ├── externalPedigreeService.js
│   │   ├── confirmedRelationService.js
│   │   ├── breedingPlanService.js
│   │   ├── movementLogService.js
│   │   └── settingsService.js
│   ├── utils/                # 純邏輯運算，不直接碰 Firestore（除了 pedigreeService 的 Firebase 版本入口）
│   │   ├── idGenerator.js
│   │   ├── purityCalculator.js
│   │   ├── pedigreeService.js    # ★核心：血緣判斷演算法
│   │   └── constants.js
│   ├── components/           # 共用 UI 元件（無框架，純 DOM）
│   │   ├── autocomplete.js
│   │   ├── modal.js
│   │   └── nav.js
│   └── pages/                 # 每個 html 對應的頁面邏輯
│       ├── dashboard.js
│       ├── dogs.js
│       ├── dogDetail.js
│       ├── accounts.js
│       ├── accountDetail.js
│       ├── breeding.js
│       ├── pedigreeCheck.js
│       └── settings.js
└── tests/
    └── pedigreeService.test.js   # 血緣演算法測試案例（可用 node 直接跑）
```

---

## 2. 部署方式

1. 到 [Firebase Console](https://console.firebase.google.com/) 建立一個新專案。
2. 啟用 **Firestore Database**（正式環境或測試環境皆可，私人使用建議搭配下方安全規則）。
3. 啟用 **Authentication → Sign-in method → 電子郵件/密碼**，並手動建立你自己的帳號（Authentication → Users → 新增使用者）。
4. 到「專案設定 → 一般 → 你的應用程式」建立一個 Web App，複製 SDK 設定值。
5. 打開 `js/firebase-config.js`，把 `firebaseConfig` 換成你自己的設定值。
6. 建議設定 Firestore 安全規則，限制只有登入使用者能讀寫（範例）：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

7. 把整個資料夾內容 push 到 GitHub repository，到 repository 設定開啟 **GitHub Pages**（通常指到根目錄或 `main` branch）。
8. 開啟部署後的網址，用剛剛建立的 Email/密碼登入即可使用。

> 首次使用請先到「系統設定」新增品種、特效、圖案（21 種品種名稱之後由你提供，逐一新增即可，不需要改程式碼）。

---

## 3. Firestore Schema

### `dogs`（文件 ID：DOG-000001 格式）
| 欄位 | 型別 | 說明 |
|---|---|---|
| name | string | 名稱 |
| series | string\|null | 系列，自由輸入 |
| accountId | string\|null | 所在帳號 |
| breedId | string\|null | 品種 id |
| gender | "male"\|"female" | 性別，可隨時修改，不記錄歷史 |
| dogType | "pure"\|"mixed" | 純種／混種 |
| effects | string[] | 純種特效 id，最多 3 個 |
| patternId | string\|null | 混種圖案 id |
| purityMixDegree | number | 純／混度 |
| level | number | 等級 |
| sourceType | "purchase"\|"exchange"\|"gift"\|"self_bred"\|"other" | 取得方式 |
| sourcePerson | string | 來源對象 |
| birthDate | string\|null | 生日，選填 |
| memorialTags | string[] | 紀念標籤 |
| fatherId | string\|null | 父親（可能是 dogs 或 externalPedigreeNodes 的 id）|
| motherId | string\|null | 母親（同上）|
| notes | string | 備註 |
| createdAt / updatedAt | string (ISO) | |

### `accounts`
accountName（顯示名稱）, loginAccount（登入帳號，選填，舊資料可能沒有這個欄位）, password（登入密碼，必填）, phone, money, bones, notes, isActive, createdAt, updatedAt

### `breeds`
name, sortOrder, isActive, createdAt, updatedAt

### `effects`
name, createdAt, updatedAt

### `patterns`
canonicalName, aliases[], blessing（預留，第一版不使用）, createdAt, updatedAt

### `externalPedigreeNodes`
name, fatherId, motherId, notes, createdAt, updatedAt
> 不屬於任何帳號，不出現在「我的狗狗」列表，只供血統追蹤使用。

### `confirmedRelations`
dogAId, dogBId, relationType（固定為 "confirmed_related"）, source, notes, createdAt
> 雙向關係；只對這一對狗生效，不延伸判斷子代。

### `breedingPlans`
dogAId, dogBId, status, interactionProgress, interactionTarget, dogALevelTarget, dogBLevelTarget, predictedPurityMixDegree, pedigreeCheckResult, notes, offspringCreated（第一版新增，標記是否已經走過新增子代流程）, createdAt, updatedAt, completedAt

狀態常數（`breedingPlanService.BREEDING_PLAN_STATUS`）：
`planned` 預計配 / `interacting` 互動中 / `leveling` 等待升級 / `ready` 準備完成 / `completed` 已完成 / `paused` 暫停 / `cancelled` 取消

### `movementLogs`
dogId, fromAccountId, toAccountId, movedAt, notes

### `settings`
通用 key-value（`settingsService.getSetting/setSetting`），目前系統本身沒有強制使用，保留給未來擴充。

### `counters`
內部使用，記錄 Dog ID 流水號，不需要手動管理。

---

## 4. 每個頁面功能

| 頁面 | 功能 |
|---|---|
| `index.html`（工作台） | 未登入顯示登入表單；登入後顯示：待互動配狗計畫、待練等的狗、準備完成的組合、最近完成的配狗、已完成但尚未新增子代的紀錄 |
| `dogs.html` | 狗狗列表、全域搜尋（名稱/系列/來源/備註/紀念標籤）、篩選（帳號/品種/性別/純混種/系列/紀念標籤）、新增狗狗 |
| `dog-detail.html` | 基本資料、外觀（特效或圖案）、來源、血統（父母）、伴侶（從配狗計畫推導）、子代（數量+查看全部）、配狗紀錄、移動紀錄；可編輯、移動帳號、加入配狗計畫（含即時血緣檢查與純／混度預覽）|
| `accounts.html` | 帳號列表、搜尋、顯示/隱藏已停用、新增帳號 |
| `account-detail.html` | 帳號基本資料、底下狗狗列表（可搜尋）、最近移入移出紀錄、編輯、停用/重新啟用 |
| `breeding.html`（配狗中心） | 所有配狗計畫、依狀態篩選、編輯互動進度與等級目標、變更狀態、已完成且未新增子代時可直接「新增子代」（自動帶入父母/生日/純混度）|
| `pedigree-check.html` | 雙狗血緣檢查（顯示狀態、距離、路徑）；可回配候選掃描（掃描全部狗狗，分類為：可回配／三代限制內／未知）|
| `settings.html` | 品種（新增/改名/排序/停用）、特效（新增/改名/刪除）、圖案（新增/改名/新增別名/刪除）|

---

## 5. 血緣 Service 設計（`js/utils/pedigreeService.js`）

**核心規則**：不是「有血緣就不能配」，而是「血緣距離超過三代限制就可以配」。

- `PEDIGREE_RESTRICTED_GENERATIONS = 3`：三代限制常數，可調整。
- `MAX_SEARCH_DEPTH`：祖先搜尋深度，目前設為限制代數 +1，留一代 buffer。
- **距離定義**（第一版假設，之後可用實際案例調整）：
  `distance = A 往上到共同祖先的代數 + B 往上到共同祖先的代數`
  例如親兄弟姊妹（共同父母）distance = 2；父女關係 distance = 1。
- 演算法會分別建立 A、B 雙方的祖先 map（含外部血統節點），找出距離最小的共同祖先。
- 回傳 5 種狀態之一：
  - `restricted`：距離 ≤ 3，限制內
  - `outside_restricted_generations`：有共同血緣但距離 > 3，可以配
  - `no_known_relation`：搜尋範圍內資料完整，查無關聯
  - `insufficient_data`：搜尋範圍內有父母未知，無法確定
  - `confirmed_related_unknown_distance`：族譜查無關聯，但有人工確認血緣紀錄
- 演算法核心 `checkPedigreeCompatibilityCore()` 刻意設計成**不依賴 Firebase**（透過注入 resolver function），對外的 `checkPedigreeCompatibility()` 才是連線 Firestore 的正式版本。這樣可以直接用 `node tests/pedigreeService.test.js` 在本機驗證邏輯，不需要连线測試環境。
- `scanRebreedCandidates(targetDogId, candidateDogIds)`：可回配候選掃描，UI 骨架見 `pedigree-check.html`。
- `wouldCreateCycle(dogId, candidateParentId)` / `wouldCreateCycleCore(...)`：設定父母時的循環防呆檢查。原理是把「設 candidateParentId 為 dogId 的父/母」視為新增一條邊，只要 candidateParentId 現有的祖先鏈中已經包含 dogId（也就是 dogId 已經是 candidateParentId 的祖先），就代表這條邊會形成循環，直接擋下不儲存。這個檢查沿用同一套祖先搜尋邏輯，同樣拆成不依賴 Firebase 的 Core 版本方便測試。

**測試驗證**：`tests/pedigreeService.test.js` 目前涵蓋：
- 血緣距離判斷 5 種案例（親兄弟姊妹、父女、完全無關聯、共同曾祖父母超過三代、父母皆未知）
- 循環防呆 6 種案例（自己設自己、直接循環、間接循環、更深層循環、無關狗允許設定、正常設定允許）

全部通過。之後你提供實際族譜案例時，可以直接依照現有格式加入新的測試案例來驗證三代邊界是否符合遊戲實際規則。

## 5.1 父母選擇器（`js/components/parentPicker.js`）

新增／編輯狗狗表單的「父親」「母親」欄位共用這個元件：

- `buildParentOptionsHtml()`：組合「我的狗狗」＋「外部血統節點」成下拉選單 HTML。父親欄位會把公狗排在前面、母親欄位把母狗排在前面，但**不強制限制**——所有狗都可以被選，因為狗的性別之後可能會被修改。
- `attachGenderMismatchWarning()`：選到性別不符的對象時，在欄位下方顯示提醒文字，但不會阻止選擇或儲存。
- `attachAddExternalNodeButton()`：欄位旁邊的「＋ 新增外部血統節點」按鈕，用 `prompt()` 快速建立一個外部血統節點（不屬於任何帳號、只用於血統追蹤），建立後立即出現在下拉選單並自動選取。

**外部父母的資料設計**：父親／母親欄位使用同一個 `fatherId` / `motherId` 欄位，值可能是「我的狗」的 document id，也可能是 `externalPedigreeNodes` 的 document id——由 `pedigreeService` 在查詢時同時檢查兩個 collection 來判斷是哪一種。這是原本架構就已經支援的設計（`getNodeByIdFromFirebase` 本來就會依序查 `dogs` 再查 `externalPedigreeNodes`），所以這次沒有另外新增 `fatherExternalId` / `motherExternalId` 欄位——那樣會造成兩套 ID 系統要同步維護，增加不必要的複雜度。單一 `fatherId` / `motherId` 欄位配合「查兩個 collection」的解析邏輯，已經能達到「父母可以是我的狗、也可以是外部節點、也可以清空」的完整需求。

**循環防呆**：編輯狗狗儲存時，會先呼叫 `wouldCreateCycle()` 檢查新選的父親／母親是否會形成循環（包含直接循環、多代循環），偵測到就阻擋儲存並顯示錯誤訊息，不會刪除或覆蓋任何既有資料。



---

## 5.2 配狗血緣防呆（兩層防護）

遊戲規則明確禁止「三代限制內」配狗，所以配狗計畫的建立與後續操作有兩層防呆，**不只依賴 UI 按鈕禁用**：

**第一層：UI 防呆**（`dogDetail.js` 的「加入配狗計畫」預覽）
- 選定配對對象後即時顯示血緣檢查結果的中文說明（`PEDIGREE_STATUS_LABELS`）
- 只有 `outside_restricted_generations`（已離開三代限制）與 `no_known_relation`（查無關聯）才會啟用「建立配狗計畫」按鈕
- `restricted`（三代內）與 `insufficient_data`（資料不足）一律禁用按鈕，並顯示紅字說明原因，不能提交

**第二層：Service 層強制驗證**（`breedingPlanService.js` 的 `createBreedingPlan` / `completeBreedingPlan`）
- `createBreedingPlan` 在真正寫入 Firestore 之前，會**重新**呼叫一次 `checkPedigreeCompatibility`，不信任呼叫端傳來的任何血緣資訊。只有允許的狀態才會建立文件，否則直接 `throw` 中文錯誤訊息，Firestore 不會新增任何資料。
- `completeBreedingPlan`（標記完成）也會重新檢查一次血緣狀態，避免「建立當下合法、但父母族譜後來變更導致現在其實不合法」的計畫被標記完成。
- 這一層即使 UI 被繞過（例如直接呼叫 API、或未來換一個前端）也一樣會擋下不合法的資料。

`isPedigreeStatusAllowed(status)` 是這兩層共用的判斷依據（定義在 `pedigreeService.js`），只有 `outside_restricted_generations`、`no_known_relation` 回傳 `true`；`restricted`、`insufficient_data`、`confirmed_related_unknown_distance` 一律 `false`，寫死在同一個地方，UI 與 Service 不會各自判斷出不一致的結果。這組分類邏輯也寫了測試（見 `tests/pedigreeService.test.js`）。

**既有的 restricted 舊配狗計畫怎麼處理**：不會自動刪除或修改。配狗中心（`breeding.html`）與工作台（`index.html`）每次載入時，都會對「進行中」的計畫（預計配／互動中／等待升級／準備完成／暫停）即時重新檢查一次血緣狀態（不相信建立當下存的舊快照）：
- 工作台：血緣狀態不允許的計畫直接從「待互動」「待練等」「準備完成」等區塊隱藏，不會出現在正常工作台畫面。
- 配狗中心：血緣狀態不允許的計畫會顯示醒目的紅色「⚠ 無效配狗計畫」橫幅，互動進度輸入框、等級目標、「儲存進度」按鈕、狀態下拉選單全部禁用，改為顯示「取消計畫」與「刪除測試資料」兩個按鈕，讓你可以選擇保留紀錄（取消）或直接清掉（刪除），不會被卡住也不會被系統自動處理掉。
- 已經是「已完成」或「已取消」狀態的計畫視為歷史紀錄，不會被重新檢查或動搖（避免already-產生的子代資料受到影響）。

配狗計畫建立時會存一份血緣檢查快照（`pedigreeStatus`／`pedigreeReason`／`pedigreeDistance`／`pedigreeCheckedAt`），純粹作為「當初建立時的紀錄」參考用；只要計畫還在進行中，畫面上實際顯示與是否允許操作，一律以即時重新檢查的結果為準。

## 6. 純／混度計算（`js/utils/purityCalculator.js`）



```js
calculateOffspringPurityDegree(parentA, parentB)
// = Math.floor((parentA + parentB) / 2) + 1
```

配狗計畫預覽與新增子代流程都呼叫這個函式，不會把公式寫死在 UI 裡。

---

## 7. 第一版尚未完成、留待後續的項目

以下項目依照你提出的規格，第一版刻意先不做或只做骨架，避免過早引入未討論過的複雜度：

- **圖案祝福系統**：`patterns` collection 已預留 `blessing` 欄位，尚未實作任何邏輯或 UI。
- **可回配候選掃描的效能優化**：目前是全量掃描所有狗狗並逐一呼叫血緣檢查，狗狗數量變多後可能需要優化（例如快取祖先 map、分批處理）。
- **血緣路徑的視覺化呈現**：目前「查看血緣路徑」只用文字 `A → B → C` 呈現，尚未做成圖形化族譜樹。
- **三代限制邊界的最終驗證**：目前的「距離」定義是第一版假設，需要你提供更多實際族譜案例來驗證是否符合遊戲真實規則，這也是刻意把 `pedigreeService` 獨立封裝+寫測試案例的原因。
- **21 種品種名稱**：目前只有品種管理介面，實際名稱需要你透過「系統設定」頁面自行新增（或提供清單後我幫你寫一次性匯入 script）。
- **帳號密碼等敏感欄位的加密／遮罩顯示**：目前帳號密碼是明碼儲存與顯示，如果之後需要加強保護可以再討論。
- **狗狗列表/搜尋的效能優化**：目前是「抓全部資料後在前端過濾」，資料量大時建議改成 Firestore 索引查詢＋分頁。
- **Storage / 圖片上傳**：目前沒有狗狗照片上傳功能，如果需要可以之後加入 Firebase Storage。

---

## 8. 開發慣例（給未來擴充參考）

- 所有 Firestore 存取都封裝在 `js/services/*.js`，頁面邏輯只呼叫 service，不直接寫查詢語法。
- 遊戲規則相關的計算（血緣、純混度）都封裝在 `js/utils/*.js`，並盡量做到不寫死、可測試。
- 固定不變的小型列舉（性別、來源方式）放 `js/utils/constants.js`；會持續擴充的清單（品種、特效、圖案、帳號、系列）一律走 Firestore collection。
- 沒有使用任何前端框架或建置工具，純 ES Module + `<script type="module">`，可以直接部署到 GitHub Pages。
