// ==================================================
// breedingPlanValidation 測試
// ==================================================
// 執行方式：node tests/breedingPlanValidation.test.js
// 這裡只測試「完成配狗計畫是否允許」的純邏輯判斷，不連線 Firestore。

import { canCompleteBreedingPlan } from "../js/utils/breedingPlanValidation.js";

// 模擬 checkPedigreeCompatibility() 的回傳結果
const allowedPedigree = { status: "outside_restricted_generations", explanation: "已離開三代限制" };
const restrictedPedigree = { status: "restricted", explanation: "三代內血緣限制" };

// 模擬 predictOffspring() 的回傳結果
const validPrediction = { valid: true, offspringType: "mixed", offspringLevel: 6 };
const invalidPrediction = { valid: false, errorCode: "missing_level", errorMessage: "缺少純度或混度數值，無法預測下一代" };

const testCases = [
  {
    name: "6. 血緣允許 + 預測有效 -> 可以完成",
    pedigreeResult: allowedPedigree,
    prediction: validPrediction,
    expectedAllowed: true
  },
  {
    name: "7. 血緣允許 + 其中一隻缺少純／混度（預測無效）-> 阻止完成",
    pedigreeResult: allowedPedigree,
    prediction: invalidPrediction,
    expectedAllowed: false
  },
  {
    name: "額外：血緣不允許（restricted）+ 預測有效 -> 仍然阻止完成",
    pedigreeResult: restrictedPedigree,
    prediction: validPrediction,
    expectedAllowed: false
  },
  {
    name: "額外：血緣不允許 + 預測也無效 -> 阻止完成",
    pedigreeResult: restrictedPedigree,
    prediction: invalidPrediction,
    expectedAllowed: false
  }
];

function runTests() {
  console.log("--- canCompleteBreedingPlan 測試 ---");
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = canCompleteBreedingPlan(testCase.pedigreeResult, testCase.prediction);

    const ok =
      result.allowed === testCase.expectedAllowed &&
      (testCase.expectedAllowed ? result.reason === null : typeof result.reason === "string" && result.reason.length > 0);

    if (ok) {
      console.log(`✅ ${testCase.name}`);
      passed++;
    } else {
      console.log(`❌ ${testCase.name}`);
      console.log(`   實際回傳:`, JSON.stringify(result));
      failed++;
    }
  }

  console.log(`\n共 ${testCases.length} 筆測試，通過 ${passed}，失敗 ${failed}`);
  return failed === 0;
}

const success = runTests();
if (!success) {
  process.exitCode = 1;
}
