// ==================================================
// offspringPlan 測試
// ==================================================
// 執行方式：node tests/offspringPlan.test.js

import {
  canShowAddOffspring,
  appendOffspringId,
  getOffspringIds,
  mergeOffspringIds,
  resolveEffectiveOffspringIds
} from "../js/utils/offspringPlan.js";

let failed = 0;

// --------------------------------------------------
// canShowAddOffspring
// --------------------------------------------------
const cases = [
  ["1. completed + 空陣列仍顯示", { status:"completed", pedigreeLevel:"allowed", parentRolesValid:true, predictionValid:true }, true],
  ["2. completed + 1 子代仍顯示", { status:"completed", pedigreeLevel:"allowed", parentRolesValid:true, predictionValid:true, offspringIds:["D1"] }, true],
  ["3. completed + 多子代仍顯示", { status:"completed", pedigreeLevel:"allowed", parentRolesValid:true, predictionValid:true, offspringIds:["D1","D2"] }, true],
  ["5. warning 已有子代仍可新增", { status:"completed", pedigreeLevel:"warning", parentRolesValid:true, predictionValid:true, offspringIds:["D1"] }, true],
  ["6a. restricted 無子代不可新增", { status:"completed", pedigreeLevel:"blocked", parentRolesValid:true, predictionValid:true }, false],
  ["6b. restricted 有子代不可新增", { status:"completed", pedigreeLevel:"blocked", parentRolesValid:true, predictionValid:true, offspringIds:["D1"] }, false],
  ["7. 非 completed 不顯示", { status:"planned", pedigreeLevel:"allowed", parentRolesValid:true, predictionValid:true }, false]
];

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

// --------------------------------------------------
// resolveEffectiveOffspringIds（Dashboard「是否已有子代」判斷一致性）
// --------------------------------------------------
console.log("\n--- resolveEffectiveOffspringIds 測試（Dashboard 一致性）---");

const parentRolesValid = {
  valid: true,
  father: { id: "FATHER1" },
  mother: { id: "MOTHER1" }
};

function expectIds(name, actualIds, expectedIds) {
  const sortedActual = [...actualIds].sort();
  const sortedExpected = [...expectedIds].sort();
  const ok =
    sortedActual.length === sortedExpected.length &&
    sortedActual.every((id, i) => id === sortedExpected[i]);
  if (ok) {
    console.log(`✅ ${name}`);
  } else {
    console.log(`❌ ${name}: 期望 ${JSON.stringify(sortedExpected)}，實際 ${JSON.stringify(sortedActual)}`);
    failed++;
  }
}

// 基本案例：純新版 offspringIds
{
  const { ids } = resolveEffectiveOffspringIds({ status: "completed", offspringIds: [] }, null, []);
  expectIds("1. completed + offspringIds=[] -> 應視為尚未有子代", ids, []);
}
{
  const { ids } = resolveEffectiveOffspringIds({ status: "completed", offspringIds: ["id1"] }, null, []);
  expectIds("2. completed + offspringIds=[id1] -> 已有子代", ids, ["id1"]);
}
{
  const { ids } = resolveEffectiveOffspringIds({ status: "completed", offspringIds: ["id1", "id2"] }, null, []);
  expectIds("3. completed + offspringIds=[id1,id2] -> 已有子代", ids, ["id1", "id2"]);
}
{
  // 5. 新版 offspringIds 正常合併且不重複（含與 sourceBreedingPlanId 找到的狗重疊時去重）
  const plan = { id: "PLAN_X", status: "completed", offspringIds: ["id1"] };
  const allDogs = [{ id: "id1", sourceBreedingPlanId: "PLAN_X" }, { id: "id2", sourceBreedingPlanId: "PLAN_X" }];
  const { ids, backfillableIds } = resolveEffectiveOffspringIds(plan, null, allDogs);
  expectIds("5a. offspringIds 與 sourceBreedingPlanId 合併且不重複", ids, ["id1", "id2"]);
  expectIds("5b. 已記錄的 id1 不會被當成新回填項目，只有新發現的 id2 需要回填", backfillableIds, ["id2"]);
}

// --------------------------------------------------
// 1. 同一父母有計畫 A、B，子代 sourceBreedingPlanId=A -> 只屬於 A
// --------------------------------------------------
{
  const allDogs = [
    { id: "CHILD_OF_A", fatherId: "FATHER1", motherId: "MOTHER1", sourceBreedingPlanId: "PLAN_A" }
  ];
  const planA = { id: "PLAN_A", status: "completed", offspringCreated: true };
  const planB = { id: "PLAN_B", status: "completed", offspringCreated: true };

  const resultA = resolveEffectiveOffspringIds(planA, parentRolesValid, allDogs);
  expectIds("1a. 計畫 A：sourceBreedingPlanId 對應的狗屬於 A", resultA.ids, ["CHILD_OF_A"]);

  const resultB = resolveEffectiveOffspringIds(planB, parentRolesValid, allDogs);
  expectIds("1b. 計畫 B：同父母但 sourceBreedingPlanId 指向 A 的狗不得納入 B", resultB.ids, []);
}

// --------------------------------------------------
// 2. 計畫 B 無 offspringCreated、無 offspringIds -> 不得因同父母子代而被判定已有子代
// --------------------------------------------------
{
  const allDogs = [
    { id: "CHILD_OF_A", fatherId: "FATHER1", motherId: "MOTHER1", sourceBreedingPlanId: "PLAN_A" }
  ];
  const planBNoFlag = { id: "PLAN_B", status: "completed" }; // 沒有 offspringCreated，也沒有 offspringIds
  const { ids } = resolveEffectiveOffspringIds(planBNoFlag, parentRolesValid, allDogs);
  expectIds("2. 新版計畫（無 offspringCreated、無 offspringIds）不得因同父母子代誤判已有子代", ids, []);
}

// --------------------------------------------------
// 3. 舊計畫 offspringCreated=true、無任何 ID -> 可由父母反查（唯一候選，且可回填）
// --------------------------------------------------
{
  const plan = { id: "PLAN_OLD", status: "completed", offspringCreated: true };
  const allDogs = [{ id: "LEGACY_CHILD", fatherId: "FATHER1", motherId: "MOTHER1" }];
  const { ids, backfillableIds } = resolveEffectiveOffspringIds(plan, parentRolesValid, allDogs);
  expectIds("3a. 舊計畫 offspringCreated=true 無任何 ID -> 由父母反查找回", ids, ["LEGACY_CHILD"]);
  expectIds("3b. 唯一候選時視為安全，建議回填", backfillableIds, ["LEGACY_CHILD"]);
}

// --------------------------------------------------
// 4. 舊計畫反查到的狗已指向其他 sourceBreedingPlanId -> 不得納入
// --------------------------------------------------
{
  const plan = { id: "PLAN_OLD", status: "completed", offspringCreated: true };
  const allDogs = [
    { id: "BELONGS_ELSEWHERE", fatherId: "FATHER1", motherId: "MOTHER1", sourceBreedingPlanId: "OTHER_PLAN" }
  ];
  const { ids, backfillableIds } = resolveEffectiveOffspringIds(plan, parentRolesValid, allDogs);
  expectIds("4. 已指向其他 sourceBreedingPlanId 的狗不得被舊計畫的父母反查納入", ids, []);
  expectIds("4b. 對應的回填清單也應為空", backfillableIds, []);
}

// --------------------------------------------------
// 6. 不得自動把無法精確歸屬的多筆舊子代全部回填 Firestore（但仍可顯示）
// --------------------------------------------------
{
  const plan = { id: "PLAN_AMBIGUOUS", status: "completed", offspringCreated: true };
  const allDogs = [
    { id: "CANDIDATE_1", fatherId: "FATHER1", motherId: "MOTHER1" },
    { id: "CANDIDATE_2", fatherId: "FATHER1", motherId: "MOTHER1" }
  ];
  const { ids, backfillableIds } = resolveEffectiveOffspringIds(plan, parentRolesValid, allDogs);
  expectIds("6a. 多筆候選時仍可用於顯示（不隱藏舊資料）", ids, ["CANDIDATE_1", "CANDIDATE_2"]);
  expectIds("6b. 多筆候選（無法精確歸屬）不得自動回填", backfillableIds, []);
}

// --------------------------------------------------
// 額外：父母角色無法判定時，只採用已記錄的 offspringIds，不會因此報錯
// --------------------------------------------------
{
  const { ids } = resolveEffectiveOffspringIds(
    { status: "completed", offspringIds: ["id1"] },
    { valid: false },
    [{ id: "OTHER_DOG", fatherId: "X", motherId: "Y" }]
  );
  expectIds("額外：父母角色無法判定時，只採用已記錄的 offspringIds", ids, ["id1"]);
}

// --------------------------------------------------
// dashboard.js 的完整判斷邏輯（先篩 completed，再檢查子代清單是否為空）
// --------------------------------------------------
function isPendingOffspring(plan, parentRoles, allDogs) {
  if (plan.status !== "completed") return false;
  return resolveEffectiveOffspringIds(plan, parentRoles, allDogs).ids.length === 0;
}

const nonCompletedCase = isPendingOffspring({ status: "planned", offspringIds: [] }, null, []);
if (nonCompletedCase === false) {
  console.log("✅ 非 completed 計畫 -> 不進入尚未新增子代區塊");
} else {
  console.log("❌ 非 completed 計畫不應該進入尚未新增子代區塊");
  failed++;
}

const emptyCompletedCase = isPendingOffspring({ status: "completed", offspringIds: [] }, null, []);
if (emptyCompletedCase === true) {
  console.log("✅ completed + 無子代 -> 進入尚未新增子代區塊");
} else {
  console.log("❌ completed + 無子代應該要進入尚未新增子代區塊");
  failed++;
}

const hasOffspringCase = isPendingOffspring({ status: "completed", offspringIds: ["id1"] }, null, []);
if (hasOffspringCase === false) {
  console.log("✅ completed + 已有子代 -> 不進入尚未新增子代區塊");
} else {
  console.log("❌ completed + 已有子代不應該進入尚未新增子代區塊");
  failed++;
}

console.log(`\n共計失敗 ${failed} 筆`);
if (failed) process.exitCode = 1;
