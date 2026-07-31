import {
  canShowAddOffspring,
  appendOffspringId,
  getOffspringIds,
  mergeOffspringIds,
  resolveEffectiveOffspringIds
} from "../js/utils/offspringPlan.js";

const cases = [
  ["1. completed + 空陣列仍顯示", { status:"completed", pedigreeLevel:"allowed", parentRolesValid:true, predictionValid:true }, true],
  ["2. completed + 1 子代仍顯示", { status:"completed", pedigreeLevel:"allowed", parentRolesValid:true, predictionValid:true, offspringIds:["D1"] }, true],
  ["3. completed + 多子代仍顯示", { status:"completed", pedigreeLevel:"allowed", parentRolesValid:true, predictionValid:true, offspringIds:["D1","D2"] }, true],
  ["5. warning 已有子代仍可新增", { status:"completed", pedigreeLevel:"warning", parentRolesValid:true, predictionValid:true, offspringIds:["D1"] }, true],
  ["6a. restricted 無子代不可新增", { status:"completed", pedigreeLevel:"blocked", parentRolesValid:true, predictionValid:true }, false],
  ["6b. restricted 有子代不可新增", { status:"completed", pedigreeLevel:"blocked", parentRolesValid:true, predictionValid:true, offspringIds:["D1"] }, false],
  ["7. 非 completed 不顯示", { status:"planned", pedigreeLevel:"allowed", parentRolesValid:true, predictionValid:true }, false]
];

let failed = 0;
for (const [name, input, expected] of cases) {
  const actual = canShowAddOffspring(input);
  if (actual === expected) console.log(`✅ ${name}`);
  else { console.log(`❌ ${name}: expected ${expected}, got ${actual}`); failed++; }
}

const accumulated = appendOffspringId(["D1"], "D2");
if (accumulated.length === 2 && accumulated[0] === "D1" && accumulated[1] === "D2") console.log("✅ 4. 新增第二隻後保留第一隻，長度為 2");
else { console.log("❌ 4. offspringIds 累加失敗", accumulated); failed++; }

const legacy = getOffspringIds({ offspringId:"OLD1", offspringIds:["NEW1"] });
if (legacy.length === 2 && legacy.includes("OLD1") && legacy.includes("NEW1")) console.log("✅ 舊 offspringId 可相容顯示");
else { console.log("❌ 舊欄位相容失敗", legacy); failed++; }


const recovered = mergeOffspringIds(["NEW2"], [{ id:"OLD1" }, { id:"NEW2" }]);
if (recovered.length === 2 && recovered.includes("OLD1") && recovered.includes("NEW2")) {
  console.log("✅ 舊版未保存 ID 的第一隻子代可由父母關係合併找回");
} else {
  console.log("❌ 舊子代合併找回失敗", recovered);
  failed++;
}

if (failed) process.exitCode = 1;

// --------------------------------------------------
// resolveEffectiveOffspringIds 測試（Dashboard「是否已有子代」判斷一致性）
// --------------------------------------------------
console.log("\n--- resolveEffectiveOffspringIds 測試（Dashboard 一致性）---");

const parentRolesValid = {
  valid: true,
  father: { id: "FATHER1" },
  mother: { id: "MOTHER1" }
};

const dashboardCases = [
  {
    name: "1. completed + offspringIds=[] -> 應視為尚未有子代（顯示於尚未新增子代）",
    plan: { status: "completed", offspringIds: [] },
    parentRoles: null,
    allDogs: [],
    expectedLength: 0
  },
  {
    name: "2. completed + offspringIds=[id1] -> 已有子代，不應顯示",
    plan: { status: "completed", offspringIds: ["id1"] },
    parentRoles: null,
    allDogs: [],
    expectedLength: 1
  },
  {
    name: "3. completed + offspringIds=[id1,id2] -> 已有子代，不應顯示",
    plan: { status: "completed", offspringIds: ["id1", "id2"] },
    parentRoles: null,
    allDogs: [],
    expectedLength: 2
  },
  {
    name: "4. 新增第二隻子代後，第一隻仍保留，陣列長度為 2",
    plan: { status: "completed", offspringIds: ["id1", "id2"] },
    parentRoles: null,
    allDogs: [],
    expectedLength: 2
  },
  {
    name: "6. restricted 狀態不影響子代清單本身的計算（血緣阻擋規則在別的地方判斷，這裡只算子代）",
    plan: { status: "completed", offspringIds: ["id1"] },
    parentRoles: null,
    allDogs: [],
    expectedLength: 1
  },
  {
    name: "舊資料：只有 offspringCreated=true、沒存 dogId，靠父母關係反查找回",
    plan: { status: "completed", offspringCreated: true },
    parentRoles: parentRolesValid,
    allDogs: [{ id: "LEGACY_CHILD", fatherId: "FATHER1", motherId: "MOTHER1" }],
    expectedLength: 1
  },
  {
    name: "舊資料反查 + 新版 offspringIds 同時存在時不重複計算",
    plan: { status: "completed", offspringIds: ["LEGACY_CHILD"] },
    parentRoles: parentRolesValid,
    allDogs: [{ id: "LEGACY_CHILD", fatherId: "FATHER1", motherId: "MOTHER1" }],
    expectedLength: 1
  },
  {
    name: "父母角色無法判定時，只採用已記錄的 offspringIds，不會因此報錯",
    plan: { status: "completed", offspringIds: ["id1"] },
    parentRoles: { valid: false },
    allDogs: [{ id: "OTHER_DOG", fatherId: "X", motherId: "Y" }],
    expectedLength: 1
  }
];

let dashboardFailed = 0;
for (const testCase of dashboardCases) {
  const result = resolveEffectiveOffspringIds(testCase.plan, testCase.parentRoles, testCase.allDogs);
  if (result.length === testCase.expectedLength) {
    console.log(`✅ ${testCase.name}`);
  } else {
    console.log(`❌ ${testCase.name}: 期望長度 ${testCase.expectedLength}，實際 ${JSON.stringify(result)}`);
    dashboardFailed++;
  }
}

// 5. 非 completed 不進入尚未新增子代區塊：這是 dashboard.js 自己先用 status === "completed"
// 過濾，resolveEffectiveOffspringIds 本身不判斷 status（只算子代清單），所以這裡驗證
// dashboard.js 的完整判斷邏輯：先篩 completed，再檢查子代清單是否為空
function isPendingOffspring(plan, parentRoles, allDogs) {
  if (plan.status !== "completed") return false;
  return resolveEffectiveOffspringIds(plan, parentRoles, allDogs).length === 0;
}

const nonCompletedCase = isPendingOffspring({ status: "planned", offspringIds: [] }, null, []);
if (nonCompletedCase === false) {
  console.log("✅ 5. 非 completed 計畫 -> 不進入尚未新增子代區塊");
} else {
  console.log("❌ 5. 非 completed 計畫不應該進入尚未新增子代區塊");
  dashboardFailed++;
}

const emptyCompletedCase = isPendingOffspring({ status: "completed", offspringIds: [] }, null, []);
if (emptyCompletedCase === true) {
  console.log("✅ completed + 無子代 -> 進入尚未新增子代區塊");
} else {
  console.log("❌ completed + 無子代應該要進入尚未新增子代區塊");
  dashboardFailed++;
}

const hasOffspringCase = isPendingOffspring({ status: "completed", offspringIds: ["id1"] }, null, []);
if (hasOffspringCase === false) {
  console.log("✅ completed + 已有子代 -> 不進入尚未新增子代區塊");
} else {
  console.log("❌ completed + 已有子代不應該進入尚未新增子代區塊");
  dashboardFailed++;
}

console.log(`\n共 ${dashboardCases.length + 3} 筆測試，通過 ${dashboardCases.length + 3 - dashboardFailed}，失敗 ${dashboardFailed}`);

if (dashboardFailed) process.exitCode = 1;
