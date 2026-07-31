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
// resolveEffectiveOffspringIds
// --------------------------------------------------
// 回傳格式：{ ids, legacyCandidateIds, backfillableIds }
//   ids              - 明確歸屬（sourceBreedingPlanId / offspringIds / offspringId）
//   legacyCandidateIds - 僅靠父母反查得到、尚未能確認歸屬的舊資料（一律不算已確認子代）
//   backfillableIds  - 只有 sourceBreedingPlanId 明確指向此計畫、但還沒寫入 offspringIds 的狗
console.log("\n--- resolveEffectiveOffspringIds 測試 ---");

const parentRolesValid = {
  valid: true,
  father: { id: "FATHER1" },
  mother: { id: "MOTHER1" }
};

function expectSet(name, actualIds, expectedIds) {
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

// 1. sourceBreedingPlanId 對應本計畫 -> ids、backfillableIds
{
  const plan = { id: "PLAN_A", status: "completed" };
  const allDogs = [{ id: "CHILD_A", fatherId: "FATHER1", motherId: "MOTHER1", sourceBreedingPlanId: "PLAN_A" }];
  const result = resolveEffectiveOffspringIds(plan, null, allDogs);
  expectSet("1a. sourceBreedingPlanId 對應本計畫 -> 進入 ids", result.ids, ["CHILD_A"]);
  expectSet("1b. 尚未寫入 offspringIds -> 進入 backfillableIds", result.backfillableIds, ["CHILD_A"]);
  expectSet("1c. 不應該有 legacyCandidateIds", result.legacyCandidateIds, []);
}

// 2. offspringIds -> ids（且已記錄的不需要再回填）
{
  const plan = { id: "PLAN_B", status: "completed", offspringIds: ["id1", "id2"] };
  const result = resolveEffectiveOffspringIds(plan, null, []);
  expectSet("2a. offspringIds 陣列 -> 進入 ids", result.ids, ["id1", "id2"]);
  expectSet("2b. 已記錄的 id 不需要回填", result.backfillableIds, []);
  expectSet("2c. 不應該有 legacyCandidateIds", result.legacyCandidateIds, []);
}

// 3. 唯一父母反查候選 -> 只進 legacyCandidateIds，不進 ids/backfillableIds
{
  const plan = { id: "PLAN_OLD", status: "completed", offspringCreated: true };
  const allDogs = [{ id: "LEGACY_CHILD", fatherId: "FATHER1", motherId: "MOTHER1" }];
  const result = resolveEffectiveOffspringIds(plan, parentRolesValid, allDogs);
  expectSet("3a. 唯一父母反查候選 -> 不進 ids", result.ids, []);
  expectSet("3b. 唯一父母反查候選 -> 進 legacyCandidateIds", result.legacyCandidateIds, ["LEGACY_CHILD"]);
  expectSet("3c. 唯一父母反查候選 -> 不進 backfillableIds（即使只有一隻也不可回填）", result.backfillableIds, []);
}

// 4. 多筆父母反查候選 -> 只進 legacyCandidateIds
{
  const plan = { id: "PLAN_AMBIGUOUS", status: "completed", offspringCreated: true };
  const allDogs = [
    { id: "CANDIDATE_1", fatherId: "FATHER1", motherId: "MOTHER1" },
    { id: "CANDIDATE_2", fatherId: "FATHER1", motherId: "MOTHER1" }
  ];
  const result = resolveEffectiveOffspringIds(plan, parentRolesValid, allDogs);
  expectSet("4a. 多筆候選 -> 不進 ids", result.ids, []);
  expectSet("4b. 多筆候選 -> 進 legacyCandidateIds", result.legacyCandidateIds, ["CANDIDATE_1", "CANDIDATE_2"]);
  expectSet("4c. 多筆候選 -> 不進 backfillableIds", result.backfillableIds, []);
}

// 同一對父母兩筆舊計畫：sourceBreedingPlanId 指向 A 的狗不得被 B 的父母反查納入
{
  const allDogs = [{ id: "CHILD_OF_A", fatherId: "FATHER1", motherId: "MOTHER1", sourceBreedingPlanId: "PLAN_A" }];
  const planB = { id: "PLAN_B", status: "completed", offspringCreated: true };
  const resultB = resolveEffectiveOffspringIds(planB, parentRolesValid, allDogs);
  expectSet("7a. 已指向其他計畫的狗不得被另一筆計畫的父母反查納入 ids", resultB.ids, []);
  expectSet("7b. 也不得納入 legacyCandidateIds", resultB.legacyCandidateIds, []);
  expectSet("7c. 更不得回填", resultB.backfillableIds, []);
}

// 額外：父母角色無法判定時，只採用已記錄的 offspringIds，不會因此報錯
{
  const result = resolveEffectiveOffspringIds(
    { status: "completed", offspringIds: ["id1"] },
    { valid: false },
    [{ id: "OTHER_DOG", fatherId: "X", motherId: "Y" }]
  );
  expectSet("額外：父母角色無法判定時，只採用已記錄的 offspringIds", result.ids, ["id1"]);
}

// --------------------------------------------------
// Dashboard「是否已有子代」判斷
// --------------------------------------------------
// 依需求建議寫法：
//   const hasConfirmedOffspring = result.ids.length > 0 || plan.offspringCreated === true;
console.log("\n--- Dashboard hasConfirmedOffspring 判斷 ---");

function hasConfirmedOffspring(plan, parentRoles, allDogs) {
  const result = resolveEffectiveOffspringIds(plan, parentRoles, allDogs);
  return result.ids.length > 0 || plan.offspringCreated === true;
}

// 5. offspringCreated=true、無明確 ID -> Dashboard 不列為待新增子代（即 hasConfirmedOffspring 為 true）
{
  const plan = { id: "PLAN_OLD", status: "completed", offspringCreated: true };
  const allDogs = [{ id: "LEGACY_CHILD", fatherId: "FATHER1", motherId: "MOTHER1" }];
  const result = hasConfirmedOffspring(plan, parentRolesValid, allDogs);
  if (result === true) {
    console.log("✅ 5. offspringCreated=true、無明確 ID -> 視為已確認過建立子代，不列為待新增子代");
  } else {
    console.log("❌ 5. offspringCreated=true 應視為已確認過建立子代");
    failed++;
  }
}

// 6. offspringCreated=false（或未設定）、只有同父母狗 -> 仍列為待新增子代
{
  const plan = { id: "PLAN_NEW", status: "completed" }; // 沒有 offspringCreated，也沒有明確 ID
  const allDogs = [{ id: "SIBLING_CHILD", fatherId: "FATHER1", motherId: "MOTHER1" }]; // 只是剛好同父母
  const result = hasConfirmedOffspring(plan, parentRolesValid, allDogs);
  if (result === false) {
    console.log("✅ 6. offspringCreated 不為 true、只有同父母狗 -> 仍列為待新增子代");
  } else {
    console.log("❌ 6. 不應該只因為同父母有狗就判定已有子代");
    failed++;
  }
}

console.log(`\n共計失敗 ${failed} 筆`);
if (failed) process.exitCode = 1;
