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
dogAId, dogBId, status, interactionProgress, interactionTarget, dogALevelTarget, dogBLevelTarget, notes, offspringCreated, createdAt, updatedAt, completedAt

血緣檢查快照：pedigreeStatus, pedigreeReason, pedigreeDistance, pedigreeCheckedAt（`createBreedingPlan` 建立時重新檢查後存下，僅供顯示參考，實際判斷一律以配狗中心／工作台即時重新檢查為準）

純種／混種預測快照：predictedPurityMixDegree（相容欄位）, prediction: { offspringType, offspringLevel, calculation: { parentAType, parentAOriginalLevel, parentAUsedLevel, parentBType, parentBOriginalLevel, parentBUsedLevel }, calculatedAt }（同樣由 `createBreedingPlan` 重新計算後存下，不信任前端傳入的任何預測欄位）

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

## 5.2 血緣權限系統（`getPedigreePermission`）—— blocked / warning / allowed 三層

**這一輪的核心修正**：血緣狀態不是只有「允許」「不允許」兩種。原本 `insufficient_data`（族譜資料不足）與 `confirmed_related_unknown_distance`（已確認有親屬但不知道距離）都被當成跟 `restricted` 一樣的「無效配狗計畫」，導致 Dashboard 隱藏、配狗中心標紅、無法完成、無法新增子代——但「不知道」不代表「不能」，這樣太嚴格了。

`getPedigreePermission(status)`（`js/utils/pedigreeService.js`）是全站唯一判斷「這個血緣狀態可以做什麼」的地方，回傳：

```js
{
  status,
  level: "blocked" | "warning" | "allowed",
  canCreatePlan, canEditPlan, canSaveProgress, canCompletePlan, canCreateOffspring, // boolean
  requiresConfirmation: boolean,
  message: "中文說明文字",
  color: "green" | "yellow" | "orange" | "red"
}
```

五種狀態的分級：

| 狀態 | level | color | 說明 |
|---|---|---|---|
| `restricted` | blocked | red | 已確認三代內有血緣，遊戲規則明確禁止，永遠禁止建立計畫／完成／新增子代 |
| `outside_restricted_generations` | allowed | green | 已離開三代限制，全部正常 |
| `no_known_relation` | allowed | green | 查無關聯，全部正常 |
| `insufficient_data` | warning | yellow | 祖先資料不足，「目前不知道」，不等於「確認有血緣」 |
| `confirmed_related_unknown_distance` | warning | orange | 確認有親屬但不知道距離是否超過三代 |

`isPedigreeStatusAllowed(status)` 保留（`getPedigreePermission(status).level === "allowed"`），行為跟舊版完全一致，避免破壞尚未升級的呼叫端；但新程式碼請一律改用 `getPedigreePermission`，可以拿到 warning／blocked 的完整分級資訊。

**warning 如何流到 UI**：`warning` 狀態下 `canCreatePlan`／`canEditPlan`／`canSaveProgress`／`canCompletePlan`／`canCreateOffspring` 全部是 `true`（可以繼續操作），只有 `requiresConfirmation: true`——代表「完成配狗」「新增子代」這兩個關鍵動作需要跳一次確認對話框，其餘操作（保存進度、編輯、計畫本身的存在）完全不受影響，卡片也不會變灰、不會被當成無效計畫。

**畫面顏色對應**：
- **黃色**（`insufficient_data`）：配狗中心的黃色警示橫幅（`.pedigree-warning-banner-yellow`）、工作台卡片的黃色小提示（`.pedigree-warning-note-yellow`）、`dogDetail.js` 預覽的黃色狀態文字
- **橘色**（`confirmed_related_unknown_distance`）：同上，class 換成 `-orange`，`dogDetail.js` 用 `var(--color-warning)`
- **紅色**（`restricted`，即 blocked）：沿用原本的 `.invalid-plan-banner`，唯一會整張卡標紅、禁用所有操作的狀態

**血緣防呆現在分兩層**（延續上一輪的「不只依賴 UI」原則，只是判斷邏輯從二元改成三層）：

**第一層：UI 防呆**
- `dogDetail.js`「加入配狗計畫」：只有 `blocked`（restricted）才會禁用「建立配狗計畫」按鈕；`warning` 不禁用，但按鈕文字會提示「需確認血緣警示」，點擊時先跳 `confirmModal` 讓使用者確認，取消就不繼續
- `breeding.js` 配狗中心：`blocked` 才會整張卡標紅（`.invalid-plan-banner`）、禁用互動進度／等級目標輸入框／儲存進度／狀態下拉，並提供「取消計畫」「刪除測試資料」兩個按鈕；`warning` 只顯示黃／橘色橫幅，其餘操作完全不受影響。「完成」計畫（狀態下拉選到已完成）與「新增子代」按鈕都會依 `warning`／`blocked` 分別跳確認或禁用
- `dashboard.js`：只有 `blocked` 的計畫會從「待互動／待練等／準備完成」隱藏；`warning` 的計畫正常顯示，額外附上一行黃／橘色小提示文字

**第二層：Service 層強制驗證，且不會自己跳確認**
- `createBreedingPlan`（`breedingPlanService.js`）：重新呼叫 `checkPedigreeCompatibility`，只有 `blocked` 才會擋下、`throw` 中文錯誤；`warning` 允許建立（UI 端已經在建立前跳過一次確認，Service 這裡不重複要求）
- `completeBreedingPlan(id, { confirmPedigreeWarning })`（`breedingPlanService.js`）：這是這一輪修改的重點。流程是：
  1. 重新抓 dogA、dogB 最新資料
  2. 重新呼叫 `checkPedigreeCompatibility`
  3. 重新呼叫 `predictOffspring`
  4. 三者交給純函式 `canCompleteBreedingPlan(pedigreeResult, prediction, { confirmPedigreeWarning })`（`breedingPlanValidation.js`）判斷：
     - `blocked` → 直接拒絕，`confirmPedigreeWarning` 是 `true` 也沒用
     - `warning` 且沒有傳 `confirmPedigreeWarning: true` → 拒絕，錯誤訊息是「請再次確認後完成」，並在 `Error` 物件上標記 `err.needsConfirmation = true`
     - `warning` 且有傳 `confirmPedigreeWarning: true`，或 `allowed` → 繼續檢查 `prediction.valid`，無效一樣拒絕
     - 都通過才真的標記完成，並同步更新最新的 `prediction`／`pedigreeStatus` 等快照

  **Service 本身不會跳出確認視窗**——它只負責「沒有明確的 `confirmPedigreeWarning: true` 就不能通過 warning」，讓 UI（`breeding.js` 的 `attemptCompleteBreedingPlan()`）攔截 `err.needsConfirmation`，跳一次 `confirmModal(err.message)`，使用者確認後才用 `{ confirmPedigreeWarning: true }` 重新呼叫一次。這樣即使有人繞過 UI 直接呼叫 `completeBreedingPlan(id)`，沒有明確帶上確認旗標，一樣會被擋下，不會被自動放行。

**既有 restricted 舊計畫怎麼處理**：跟上一輪一樣，不會自動刪除或修改，只在配狗中心顯示紅色無效橫幅並提供取消／刪除操作。

**測試**：
- `tests/pedigreeService.test.js` 新增 7 筆 `getPedigreePermission` 測試（5 種狀態分級 + warning 允許操作 + blocked 全部禁止）
- `tests/breedingPlanValidation.test.js` 重寫為 9 筆案例，涵蓋 blocked／warning 未確認／warning 已確認／allowed 各種組合

---

## 6. 下一代純種／混種預測（`js/utils/breedingPrediction.js`）

全站唯一計算「下一代純種／混種與數值」的地方，`predictOffspring(parentA, parentB)` 是純函式（不寫入 Firestore、不操作 DOM），dogDetail.js、breeding.js、dashboard.js、pedigreeCheck.js、`breedingPlanService.js` 全部共用同一套。

**SP2 配種規則**：
- 純種 × 純種 → 下一代純種，`floor((父方純度 + 母方純度) / 2) + 1`
- 混種 × 混種 → 下一代混種，`floor((父方混度 + 母方混度) / 2) + 1`
- 純種 × 混種（不論順序）→ 下一代一律混種，**純種那一方計算時視為混度 0**，不能直接拿純度數值參與平均：`floor((0 + 對方混度) / 2) + 1`

**目前系統實際使用的欄位**：狗狗文件只有一組欄位在用，沒有多種舊欄位名稱並存的情況：
- `dog.dogType`：`"pure"` 或 `"mixed"`
- `dog.purityMixDegree`：number（純種時代表純度，混種時代表混度，共用同一欄位）

`predictOffspring()` 內部的 `normalizeParent()` 只認這兩個欄位；以後如果欄位名稱要調整，只需要改這一個函式，呼叫端完全不用動。

**回傳格式**：

成功時：
```js
{
  valid: true,
  offspringType: "pure" | "mixed",
  offspringLevel: number,
  offspringLevelLabel: "純度" | "混度",
  displayLabel: "混種／混度 6",   // 直接可以顯示的文字
  parents: {
    parentA: { type, originalLevel, usedLevel },
    parentB: { type, originalLevel, usedLevel }
  }
}
```

失敗時（類型缺失／無法識別／數值缺失／數值為 NaN 或負數，一律不會默默當成 0）：
```js
{ valid: false, errorCode: "...", errorMessage: "中文錯誤說明" }
```

另外提供 `formatTypeLevel(type, level)`，把單一狗狗自己的類型與數值格式化成「混種／混度 10」這種清楚文字，畫面上不會再出現「純／混度」這種無法判斷類型的字眼。

**測試**：`tests/breedingPrediction.test.js`（14 筆案例，涵蓋 6 種正常規則組合＋型別缺失／無法識別／NaN／負數／null 等異常情況，全數通過）。

舊的 `js/utils/purityCalculator.js` 已標記為棄用（保留檔案避免意外破壞尚未發現的引用，但確認全站已經沒有任何地方呼叫它），不要在新程式碼中使用。

---

## 6.1 Service 層如何防止前端偽造預測結果（`breedingPlanService.js`）

`createBreedingPlan()` 寫入 Firestore 前，會重新從 Firestore 載入 dogA、dogB「目前」的資料，重新呼叫 `predictOffspring()`。即使呼叫端在參數裡塞了 `offspringType`／`predictedPurity`／`prediction` 之類的欄位，一律忽略，只採用這裡重新算出來的結果。預測無效（型別缺失、數值缺失或無效）時直接 `throw` 中文錯誤，不會建立任何資料——這跟血緣防呆是同一層、同一個函式裡一起做的兩個獨立檢查（先檢查血緣，再檢查預測，兩者都通過才會真的寫入）。

寫入的 Firestore 欄位：
```js
{
  // 相容欄位：值來自這裡重新計算的結果，不是前端傳來的
  predictedPurityMixDegree: number,

  // 純種／混種預測快照，只作為「建立當下」的紀錄／顯示參考
  prediction: {
    offspringType: "pure" | "mixed",
    offspringLevel: number,
    calculation: {
      parentAType: "pure" | "mixed",
      parentAOriginalLevel: number,
      parentAUsedLevel: number,
      parentBType: "pure" | "mixed",
      parentBOriginalLevel: number,
      parentBUsedLevel: number
    },
    calculatedAt: "ISO timestamp"
  },

  // 血緣檢查快照（上一輪已完成，這次沒有更動格式）
  pedigreeStatus, pedigreeReason, pedigreeDistance, pedigreeCheckedAt
}
```

配狗中心（`breeding.js`）顯示時，會拿這個 `prediction` 快照當作「建立時預測」的歷史資訊，同時用目前兩隻狗的資料即時重新計算一次；如果兩者不同（代表父母資料在計畫建立後被修改過），會額外顯示「目前資料重新計算」的最新結果。沒有 `prediction` 快照的舊計畫（這次修改之前建立的），會直接用目前資料即時計算，算不出來就顯示「純種／混種資料不足，無法預測」，不會因此刪除舊計畫。

---

## 6.2 父母角色判定（`js/utils/parentRoleResolver.js`）與完成計畫的預測再驗證

**問題背景**：配狗計畫的 `dogAId`／`dogBId` 只代表「配對的兩隻狗」，不代表誰是父親、誰是母親。使用者可能從母狗的詳情頁發起配對，這時候 `dogA` 反而是母狗。之前的程式碼在部分畫面直接假設 `dogA = 父方`、`dogB = 母方`，這是不正確的。

**`resolveParentRoles(dogA, dogB)`**：全站唯一「依性別判定父親／母親」的地方，純函式，不寫 Firestore、不碰 DOM。系統的 `dog.gender` 欄位只會是 `"male"` 或 `"female"`。判定規則：
- 兩隻狗剛好一公一母 → 回傳 `{ valid: true, father, mother }`
- 兩隻都是公狗、都是母狗、任一隻缺少性別、其中一隻資料不存在、或兩隻是同一隻狗 → 回傳 `{ valid: false, errorCode, errorMessage }`，錯誤訊息是中文，可直接顯示

**移除了哪些「dogA = 父方」的假設**：
- `breeding.js` 的「新增子代」流程：按鈕點擊時先呼叫 `resolveParentRoles`，只有判定成功才會開啟新增子代表單；`fatherId`/`motherId` 一律用判定後的 `father.id`/`mother.id`，不再直接寫 `plan.dogAId`/`plan.dogBId`。判定失敗時按鈕本身就是 disabled 狀態（滑鼠移上去會顯示原因），就算被繞過點擊，click handler 也會再檢查一次並用 `alert` 顯示中文錯誤，不會開啟表單。
- `dogDetail.js` 的「加入配狗計畫」預覽：顯示文字不再固定寫「父方」「母方」，只有依性別成功判定出一公一母時才顯示「父親」「母親」，否則顯示中性的「狗狗 A」「狗狗 B」。這裡只影響**顯示文字**，不影響能不能建立配狗計畫本身（配狗計畫允許任兩隻狗配對，血緣與純種／混種預測才是真正的建立條件；父母性別判定只在「要生子代」的那一刻才重要）。
- `breedingPrediction.js` 內部的錯誤訊息標籤，原本寫死「父方」「母方」，改成中性的「狗狗 A」「狗狗 B」（`predictOffspring` 的 `parentA`/`parentB` 本來就只是計算用的兩個輸入位置，不代表真實親子關係）。
- `dashboard.js`、`pedigreeCheck.js` 檢查後**沒有**發現固定標示父方/母方的文字（本來就是用狗狗名稱或中性的 `狗狗 A × 狗狗 B` 呈現），不需要修改。

**完成配狗計畫時重新驗證預測**：`breedingPlanService.js` 的 `completeBreedingPlan()` 除了原本就有的血緣重新檢查，這次加上重新呼叫 `predictOffspring()`。兩項檢查合併判斷放在獨立的純函式 `canCompleteBreedingPlan(pedigreeResult, prediction)`（`js/utils/breedingPlanValidation.js`），只有血緣允許**且**預測有效才會真的標記完成；任一項不通過就 `throw` 中文錯誤，不會標記完成。完成成功時，會同步把最新的 `prediction` 快照（與 `predictedPurityMixDegree` 相容欄位）寫回 Firestore，不會沿用計畫建立當下的舊快照。

**測試**：
- `tests/parentRoleResolver.test.js`：8 筆案例（一公一母兩種順序、都公、都母、缺性別、都缺性別、狗不存在、同一隻狗）
- `tests/breedingPlanValidation.test.js`：4 筆案例（血緣允許+預測有效才允許完成，其餘組合都阻止）

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
