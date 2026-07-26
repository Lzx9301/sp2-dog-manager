// ==================================================
// breedingPlanValidation 測試
// ==================================================
// 執行方式：node tests/breedingPlanValidation.test.js
// 這裡只測試「完成配狗計畫是否允許」的純邏輯判斷，不連線 Firestore。

import { canCompleteBreedingPlan } from "../js/utils/breedingPlanValidation.js";

// 模擬 checkPedigreeCompatibility() 的回傳結果
const blockedPedigree = { status: "restricted", explanation: "三代內血緣限制" };
const warningPedigree = { status: "insufficient_data", explanation: "族譜資料不足" };
const warningPedigree2 = { status: "confirmed_related_unknown_distance", explanation: "已確認血緣，距離未知" };
const allowedPedigree = { status: "outside_restricted_generations", explanation: "已離開三代限制" };

// 模擬 predictOffspring() 的回傳結果
const validPrediction = { valid: true, offspringType: "mixed", offspringLevel: 6 };
const invalidPrediction = { valid: false, errorCode: "missing_level", errorMessage: "缺少純度或混度數值，無法預測下一代" };

const testCases = [
  {
    name: "1. restricted -> blocked：直接拒絕，不管有沒有 confirm",
    pedigreeResult: blockedPedigree,
    prediction: validPrediction,
    options: { confirmPedigreeWarning: true },
    expected: { allowed: false, needsConfirmation: false }
  },
  {
    name: "2. outside_restricted_generations -> allowed：預測有效，直接允許完成",
    pedigreeResult: allowedPedigree,
    prediction: validPrediction,
    options: {},
    expected: { allowed: true, needsConfirmation: false }
  },
  {
    name: "3. no_known_relation -> allowed：預測有效，直接允許完成",
    pedigreeResult: { status: "no_known_relation", explanation: "查無關聯" },
    prediction: validPrediction,
    options: {},
    expected: { allowed: true, needsConfirmation: false }
  },
  {
    name: "4. insufficient_data -> warning，沒有 confirm -> 不能完成，且標示需要確認",
    pedigreeResult: warningPedigree,
    prediction: validPrediction,
    options: {},
    expected: { allowed: false, needsConfirmation: true }
  },
  {
    name: "5. confirmed_related_unknown_distance -> warning，沒有 confirm -> 不能完成，且標示需要確認",
    pedigreeResult: warningPedigree2,
    prediction: validPrediction,
    options: {},
    expected: { allowed: false, needsConfirmation: true }
  },
  {
    name: "6. warning + 有 confirm + 預測有效 -> 可以完成",
    pedigreeResult: warningPedigree,
    prediction: validPrediction,
    options: { confirmPedigreeWarning: true },
    expected: { allowed: true, needsConfirmation: false }
  },
  {
    name: "7. warning + 有 confirm，但預測無效（缺少純／混度）-> 仍然阻止完成",
    pedigreeResult: warningPedigree,
    prediction: invalidPrediction,
    options: { confirmPedigreeWarning: true },
    expected: { allowed: false, needsConfirmation: false }
  },
  {
    name: "8. restricted + 有 confirm -> 仍然禁止（confirm 對 blocked 無效）",
    pedigreeResult: blockedPedigree,
    prediction: validPrediction,
    options: { confirmPedigreeWarning: true },
    expected: { allowed: false, needsConfirmation: false }
  },
  {
    name: "額外：allowed 但預測無效 -> 阻止完成",
    pedigreeResult: allowedPedigree,
    prediction: invalidPrediction,
    options: {},
    expected: { allowed: false, needsConfirmation: false }
  }
];

function runTests() {
  console.log("--- canCompleteBreedingPlan 測試 ---");
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = canCompleteBreedingPlan(testCase.pedigreeResult, testCase.prediction, testCase.options);

    const ok =
      result.allowed === testCase.expected.allowed &&
      result.needsConfirmation === testCase.expected.needsConfirmation &&
      (testCase.expected.allowed
        ? result.message === null
        : typeof result.message === "string" && result.message.length > 0);

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
