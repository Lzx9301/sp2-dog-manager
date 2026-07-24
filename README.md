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

**測試驗證**：`tests/pedigreeService.test.js` 目前涵蓋 5 種案例（親兄弟姊妹、父女、完全無關聯、共同曾祖父母超過三代、父母皆未知），全部通過。之後你提供實際族譜案例時，可以直接依照現有格式加入新的測試案例來驗證三代邊界是否符合遊戲實際規則。

---

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
