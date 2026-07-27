import { canShowAddOffspring, appendOffspringId, getOffspringIds, mergeOffspringIds } from "../js/utils/offspringPlan.js";

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
