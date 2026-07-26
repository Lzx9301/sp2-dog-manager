// ==================================================
// pedigreeService 測試
// ==================================================
// 這不是完整測試框架（第一版沒有導入 Jest 等工具，避免增加建置複雜度），
// 而是一組「可直接用 node 執行」的測試案例 + 簡易 assert，
// 方便之後持續加入真實族譜案例來驗證三代邊界是否正確。
//
// 執行方式（本機 Node 環境，需支援 ES Module）：
//   node tests/pedigreeService.test.js
//
// 之後若要加入新案例，只需要在 fixtures 裡新增節點，
// 並在 testCases 陣列加入一筆 { dogAId, dogBId, expectedStatus, expectedDistance }

import {
  checkPedigreeCompatibilityCore,
  wouldCreateCycleCore,
  isPedigreeStatusAllowed,
  getPedigreePermission,
  PEDIGREE_RESTRICTED_GENERATIONS
} from "../js/utils/pedigreeService.js";

// --------------------------------------------------
// 假資料（不連線 Firebase）
// --------------------------------------------------
// 節點格式： { id, fatherId, motherId }
const fixtureNodes = {
  // 案例 1：親兄弟姊妹（共同父母 P1, P2）→ distance 應為 2 → 限制內
  A1: { id: "A1", fatherId: "P1", motherId: "P2" },
  B1: { id: "B1", fatherId: "P1", motherId: "P2" },
  P1: { id: "P1", fatherId: null, motherId: null },
  P2: { id: "P2", fatherId: null, motherId: null },

  // 案例 2：父女關係 → distance 應為 1 → 限制內
  FATHER2: { id: "FATHER2", fatherId: null, motherId: null },
  CHILD2: { id: "CHILD2", fatherId: "FATHER2", motherId: null },

  // 案例 3：完全沒有血緣關係，且雙方祖先鏈在搜尋深度內（MAX_SEARCH_DEPTH=4）都是已知資料
  // → no_known_relation
  // 注意：depth 4 的節點本身資料是否已知不影響結果，因為演算法只會搜尋到 depth 4，
  // 不會再往上追溯 depth 4 節點的父母，所以 depth4 節點的 father/motherId 設什麼都可以。
  A3: { id: "A3", fatherId: "PA3", motherId: "MA3" },
  PA3: { id: "PA3", fatherId: "GPA3", motherId: "GMA3" },
  MA3: { id: "MA3", fatherId: "GPA3_2", motherId: "GMA3_2" },
  GPA3: { id: "GPA3", fatherId: "D4_A1", motherId: "D4_A2" },
  GMA3: { id: "GMA3", fatherId: "D4_A3", motherId: "D4_A4" },
  GPA3_2: { id: "GPA3_2", fatherId: "D4_A5", motherId: "D4_A6" },
  GMA3_2: { id: "GMA3_2", fatherId: "D4_A7", motherId: "D4_A8" },
  D4_A1: { id: "D4_A1", fatherId: "D5_dummy", motherId: "D5_dummy" },
  D4_A2: { id: "D4_A2", fatherId: "D5_dummy", motherId: "D5_dummy" },
  D4_A3: { id: "D4_A3", fatherId: "D5_dummy", motherId: "D5_dummy" },
  D4_A4: { id: "D4_A4", fatherId: "D5_dummy", motherId: "D5_dummy" },
  D4_A5: { id: "D4_A5", fatherId: "D5_dummy", motherId: "D5_dummy" },
  D4_A6: { id: "D4_A6", fatherId: "D5_dummy", motherId: "D5_dummy" },
  D4_A7: { id: "D4_A7", fatherId: "D5_dummy", motherId: "D5_dummy" },
  D4_A8: { id: "D4_A8", fatherId: "D5_dummy", motherId: "D5_dummy" },

  B3: { id: "B3", fatherId: "PB3", motherId: "MB3" },
  PB3: { id: "PB3", fatherId: "GPB3", motherId: "GMB3" },
  MB3: { id: "MB3", fatherId: "GPB3_2", motherId: "GMB3_2" },
  GPB3: { id: "GPB3", fatherId: "D4_B1", motherId: "D4_B2" },
  GMB3: { id: "GMB3", fatherId: "D4_B3", motherId: "D4_B4" },
  GPB3_2: { id: "GPB3_2", fatherId: "D4_B5", motherId: "D4_B6" },
  GMB3_2: { id: "GMB3_2", fatherId: "D4_B7", motherId: "D4_B8" },
  D4_B1: { id: "D4_B1", fatherId: "D5_dummy_B", motherId: "D5_dummy_B" },
  D4_B2: { id: "D4_B2", fatherId: "D5_dummy_B", motherId: "D5_dummy_B" },
  D4_B3: { id: "D4_B3", fatherId: "D5_dummy_B", motherId: "D5_dummy_B" },
  D4_B4: { id: "D4_B4", fatherId: "D5_dummy_B", motherId: "D5_dummy_B" },
  D4_B5: { id: "D4_B5", fatherId: "D5_dummy_B", motherId: "D5_dummy_B" },
  D4_B6: { id: "D4_B6", fatherId: "D5_dummy_B", motherId: "D5_dummy_B" },
  D4_B7: { id: "D4_B7", fatherId: "D5_dummy_B", motherId: "D5_dummy_B" },
  D4_B8: { id: "D4_B8", fatherId: "D5_dummy_B", motherId: "D5_dummy_B" },

  // 案例 4：共同曾祖父母，距離超過三代限制 → outside_restricted_generations
  // A4 -> P4a -> GP4a -> GGP4 (distance 3 from A4)
  // B4 -> P4b -> GP4b -> GGP4 (distance 3 from B4)  => 總距離 6，超過限制
  A4: { id: "A4", fatherId: "P4a", motherId: null },
  P4a: { id: "P4a", fatherId: "GP4a", motherId: null },
  GP4a: { id: "GP4a", fatherId: "GGP4", motherId: null },
  B4: { id: "B4", fatherId: "P4b", motherId: null },
  P4b: { id: "P4b", fatherId: "GP4b", motherId: null },
  GP4b: { id: "GP4b", fatherId: "GGP4", motherId: null },
  GGP4: { id: "GGP4", fatherId: null, motherId: null },

  // 案例 5：父母未知，資料不足
  A5: { id: "A5", fatherId: null, motherId: null },
  B5: { id: "B5", fatherId: null, motherId: null }
};

async function resolveNodeFromFixture(id) {
  return fixtureNodes[id] ? { ...fixtureNodes[id], isExternal: false } : null;
}

// 假設沒有任何人工確認血緣關係（可依需要在個別測試中覆寫）
async function resolveNoConfirmedRelation() {
  return null;
}

// --------------------------------------------------
// 測試案例
// --------------------------------------------------
const testCases = [
  {
    name: "親兄弟姊妹 -> 限制內",
    dogAId: "A1",
    dogBId: "B1",
    expectedStatus: "restricted",
    expectedDistance: 2
  },
  {
    name: "父女關係 -> 限制內",
    dogAId: "FATHER2",
    dogBId: "CHILD2",
    expectedStatus: "restricted",
    expectedDistance: 1
  },
  {
    name: "完全無關聯（資料完整）-> no_known_relation",
    dogAId: "A3",
    dogBId: "B3",
    expectedStatus: "no_known_relation",
    expectedDistance: null
  },
  {
    name: "共同曾祖父母，距離 6 -> 離開三代限制，可以配",
    dogAId: "A4",
    dogBId: "B4",
    expectedStatus: "outside_restricted_generations",
    expectedDistance: 6
  },
  {
    name: "父母皆未知 -> insufficient_data",
    dogAId: "A5",
    dogBId: "B5",
    expectedStatus: "insufficient_data",
    expectedDistance: null
  }
];

// --------------------------------------------------
// 簡易 test runner
// --------------------------------------------------
async function runTests() {
  console.log(`PEDIGREE_RESTRICTED_GENERATIONS = ${PEDIGREE_RESTRICTED_GENERATIONS}`);
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = await checkPedigreeCompatibilityCore(
      testCase.dogAId,
      testCase.dogBId,
      resolveNodeFromFixture,
      resolveNoConfirmedRelation
    );

    const statusOk = result.status === testCase.expectedStatus;
    const distanceOk = result.distance === testCase.expectedDistance;

    if (statusOk && distanceOk) {
      console.log(`✅ ${testCase.name}`);
      passed++;
    } else {
      console.log(`❌ ${testCase.name}`);
      console.log(`   期望: status=${testCase.expectedStatus}, distance=${testCase.expectedDistance}`);
      console.log(`   實際: status=${result.status}, distance=${result.distance}`);
      console.log(`   說明: ${result.explanation}`);
      failed++;
    }
  }

  console.log(`\n共 ${testCases.length} 筆測試，通過 ${passed}，失敗 ${failed}`);
}

await runTests();

// --------------------------------------------------
// wouldCreateCycleCore 測試（父母設定循環防呆）
// --------------------------------------------------
// 使用族譜：A -> B（A 是 B 的父親）-> C（B 是 C 的父親）-> D（C 是 D 的父親）
const cycleFixtureNodes = {
  A: { id: "A", fatherId: null, motherId: null },
  B: { id: "B", fatherId: "A", motherId: null },
  C: { id: "C", fatherId: "B", motherId: null },
  D: { id: "D", fatherId: "C", motherId: null },
  X: { id: "X", fatherId: null, motherId: null } // 完全無關的狗
};

async function resolveCycleFixtureNode(id) {
  return cycleFixtureNodes[id] ? { ...cycleFixtureNodes[id] } : null;
}

const cycleTestCases = [
  {
    name: "把自己設成自己的父母 -> 應偵測為循環",
    dogId: "A",
    candidateParentId: "A",
    expected: true
  },
  {
    name: "把子代 B 設成祖先 A 的父親 -> 應偵測為循環（直接循環）",
    dogId: "A",
    candidateParentId: "B",
    expected: true
  },
  {
    name: "把孫代 C 設成祖先 A 的父親 -> 應偵測為循環（間接循環）",
    dogId: "A",
    candidateParentId: "C",
    expected: true
  },
  {
    name: "把曾孫代 D 設成祖先 A 的父親 -> 應偵測為循環（更深層循環）",
    dogId: "A",
    candidateParentId: "D",
    expected: true
  },
  {
    name: "把完全無關的狗 X 設成 D 的父親 -> 不是循環，應允許",
    dogId: "D",
    candidateParentId: "X",
    expected: false
  },
  {
    name: "正常設定：把 A 設成 B 的父親（B 原本就沒有父親）-> 不是循環",
    dogId: "B",
    candidateParentId: "A",
    expected: false
  }
];

async function runCycleTests() {
  console.log("\n--- wouldCreateCycleCore 測試 ---");
  let passed = 0;
  let failed = 0;

  for (const testCase of cycleTestCases) {
    const result = await wouldCreateCycleCore(testCase.dogId, testCase.candidateParentId, resolveCycleFixtureNode);

    if (result === testCase.expected) {
      console.log(`✅ ${testCase.name}`);
      passed++;
    } else {
      console.log(`❌ ${testCase.name}`);
      console.log(`   期望: ${testCase.expected}，實際: ${result}`);
      failed++;
    }
  }

  console.log(`\n共 ${cycleTestCases.length} 筆測試，通過 ${passed}，失敗 ${failed}`);
}

await runCycleTests();

// --------------------------------------------------
// isPedigreeStatusAllowed 測試（配狗防呆的分類依據）
// --------------------------------------------------
// 這組測試直接對應「配狗系統血緣防呆」的規則：
// 只有 outside_restricted_generations / no_known_relation 允許建立配狗計畫，
// 其餘一律預設不允許（restricted 是遊戲規則明確禁止；insufficient_data 與
// confirmed_related_unknown_distance 則是資料不夠明確，保守起見一律擋下）。
const allowStatusTestCases = [
  { status: "restricted", expected: false },
  { status: "outside_restricted_generations", expected: true },
  { status: "no_known_relation", expected: true },
  { status: "insufficient_data", expected: false },
  { status: "confirmed_related_unknown_distance", expected: false }
];

function runAllowStatusTests() {
  console.log("\n--- isPedigreeStatusAllowed 測試 ---");
  let passed = 0;
  let failed = 0;

  for (const testCase of allowStatusTestCases) {
    const result = isPedigreeStatusAllowed(testCase.status);
    if (result === testCase.expected) {
      console.log(`✅ ${testCase.status} -> allowed=${result}`);
      passed++;
    } else {
      console.log(`❌ ${testCase.status} -> 期望 allowed=${testCase.expected}，實際 allowed=${result}`);
      failed++;
    }
  }

  console.log(`\n共 ${allowStatusTestCases.length} 筆測試，通過 ${passed}，失敗 ${failed}`);
}

runAllowStatusTests();

// --------------------------------------------------
// getPedigreePermission 測試（血緣權限三層級：blocked / warning / allowed）
// --------------------------------------------------
const permissionTestCases = [
  {
    name: "1. restricted -> blocked",
    status: "restricted",
    expectedLevel: "blocked",
    expectedColor: "red"
  },
  {
    name: "2. outside_restricted_generations -> allowed",
    status: "outside_restricted_generations",
    expectedLevel: "allowed",
    expectedColor: "green"
  },
  {
    name: "3. no_known_relation -> allowed",
    status: "no_known_relation",
    expectedLevel: "allowed",
    expectedColor: "green"
  },
  {
    name: "4. insufficient_data -> warning（黃色）",
    status: "insufficient_data",
    expectedLevel: "warning",
    expectedColor: "yellow"
  },
  {
    name: "5. confirmed_related_unknown_distance -> warning（橘色）",
    status: "confirmed_related_unknown_distance",
    expectedLevel: "warning",
    expectedColor: "orange"
  }
];

function runPermissionTests() {
  console.log("\n--- getPedigreePermission 測試 ---");
  let passed = 0;
  let failed = 0;

  for (const testCase of permissionTestCases) {
    const permission = getPedigreePermission(testCase.status);
    const ok = permission.level === testCase.expectedLevel && permission.color === testCase.expectedColor;

    if (ok) {
      console.log(`✅ ${testCase.name}`);
      passed++;
    } else {
      console.log(`❌ ${testCase.name}`);
      console.log(`   實際回傳:`, JSON.stringify(permission));
      failed++;
    }
  }

  // warning 狀態必須允許保留計畫/編輯/保存進度（只有關鍵動作需要確認）
  const warningPermission = getPedigreePermission("insufficient_data");
  const warningChecksOk =
    warningPermission.canCreatePlan === true &&
    warningPermission.canEditPlan === true &&
    warningPermission.canSaveProgress === true &&
    warningPermission.canCompletePlan === true &&
    warningPermission.canCreateOffspring === true &&
    warningPermission.requiresConfirmation === true;

  if (warningChecksOk) {
    console.log("✅ warning 狀態允許保留計畫/編輯/保存進度，但 requiresConfirmation 為 true");
    passed++;
  } else {
    console.log("❌ warning 狀態的權限欄位不符預期");
    console.log("   實際回傳:", JSON.stringify(warningPermission));
    failed++;
  }

  // blocked 狀態必須全部禁止
  const blockedPermission = getPedigreePermission("restricted");
  const blockedChecksOk =
    blockedPermission.canCreatePlan === false &&
    blockedPermission.canEditPlan === false &&
    blockedPermission.canSaveProgress === false &&
    blockedPermission.canCompletePlan === false &&
    blockedPermission.canCreateOffspring === false;

  if (blockedChecksOk) {
    console.log("✅ blocked 狀態全部禁止");
    passed++;
  } else {
    console.log("❌ blocked 狀態的權限欄位不符預期");
    console.log("   實際回傳:", JSON.stringify(blockedPermission));
    failed++;
  }

  const total = permissionTestCases.length + 2;
  console.log(`\n共 ${total} 筆測試，通過 ${passed}，失敗 ${failed}`);
}

runPermissionTests();
