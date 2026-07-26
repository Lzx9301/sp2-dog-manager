// ==================================================
// breedingPrediction 測試
// ==================================================
// 執行方式：node tests/breedingPrediction.test.js
// 這個模組不依賴 Firebase，可以直接用 node 執行。

import { predictOffspring } from "../js/utils/breedingPrediction.js";

const testCases = [
  {
    name: "1. 純10 × 純14 -> 純種／純度13",
    parentA: { dogType: "pure", purityMixDegree: 10 },
    parentB: { dogType: "pure", purityMixDegree: 14 },
    expected: { valid: true, offspringType: "pure", offspringLevel: 13 }
  },
  {
    name: "2. 混8 × 混12 -> 混種／混度11",
    parentA: { dogType: "mixed", purityMixDegree: 8 },
    parentB: { dogType: "mixed", purityMixDegree: 12 },
    expected: { valid: true, offspringType: "mixed", offspringLevel: 11 }
  },
  {
    name: "3. 純20 × 混10 -> 混種／混度6（純種端視為混度0）",
    parentA: { dogType: "pure", purityMixDegree: 20 },
    parentB: { dogType: "mixed", purityMixDegree: 10 },
    expected: { valid: true, offspringType: "mixed", offspringLevel: 6 }
  },
  {
    name: "4. 混10 × 純20 -> 混種／混度6（順序相反，結果應相同）",
    parentA: { dogType: "mixed", purityMixDegree: 10 },
    parentB: { dogType: "pure", purityMixDegree: 20 },
    expected: { valid: true, offspringType: "mixed", offspringLevel: 6 }
  },
  {
    name: "5. 純1 × 混0 -> 混種／混度1",
    parentA: { dogType: "pure", purityMixDegree: 1 },
    parentB: { dogType: "mixed", purityMixDegree: 0 },
    expected: { valid: true, offspringType: "mixed", offspringLevel: 1 }
  },
  {
    name: "6. 純30 × 純30 -> 純種／純度31",
    parentA: { dogType: "pure", purityMixDegree: 30 },
    parentB: { dogType: "pure", purityMixDegree: 30 },
    expected: { valid: true, offspringType: "pure", offspringLevel: 31 }
  },
  {
    name: "7. 純種缺少純度 -> valid false",
    parentA: { dogType: "pure" }, // 沒有 purityMixDegree
    parentB: { dogType: "mixed", purityMixDegree: 10 },
    expected: { valid: false }
  },
  {
    name: "8. 混種缺少混度 -> valid false",
    parentA: { dogType: "mixed" }, // 沒有 purityMixDegree
    parentB: { dogType: "pure", purityMixDegree: 10 },
    expected: { valid: false }
  },
  {
    name: "9. 無法識別的類型 -> valid false",
    parentA: { dogType: "unknown_type", purityMixDegree: 10 },
    parentB: { dogType: "pure", purityMixDegree: 10 },
    expected: { valid: false }
  },
  {
    name: "10a. 數值為 NaN -> valid false",
    parentA: { dogType: "pure", purityMixDegree: NaN },
    parentB: { dogType: "pure", purityMixDegree: 10 },
    expected: { valid: false }
  },
  {
    name: "10b. 數值為負數 -> valid false",
    parentA: { dogType: "pure", purityMixDegree: -5 },
    parentB: { dogType: "pure", purityMixDegree: 10 },
    expected: { valid: false }
  },
  {
    name: "10c. 數值為非數字字串 -> valid false",
    parentA: { dogType: "pure", purityMixDegree: "abc" },
    parentB: { dogType: "pure", purityMixDegree: 10 },
    expected: { valid: false }
  },
  {
    name: "額外案例：完全沒有提供狗狗資料（null）-> valid false",
    parentA: null,
    parentB: { dogType: "pure", purityMixDegree: 10 },
    expected: { valid: false }
  },
  {
    name: "額外案例：不會把缺少的數值默默當成 0（純度 0 跟缺少純度必須不同結果）",
    parentA: { dogType: "pure", purityMixDegree: 0 },
    parentB: { dogType: "pure", purityMixDegree: 10 },
    // 純度 0 是合法數值（不是缺少），floor((0+10)/2)+1 = 6
    expected: { valid: true, offspringType: "pure", offspringLevel: 6 }
  }
];

function runTests() {
  console.log("--- predictOffspring 測試 ---");
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = predictOffspring(testCase.parentA, testCase.parentB);

    let ok;
    if (testCase.expected.valid === false) {
      ok = result.valid === false && typeof result.errorMessage === "string" && result.errorMessage.length > 0;
    } else {
      ok =
        result.valid === true &&
        result.offspringType === testCase.expected.offspringType &&
        result.offspringLevel === testCase.expected.offspringLevel &&
        !Number.isNaN(result.offspringLevel);
    }

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
