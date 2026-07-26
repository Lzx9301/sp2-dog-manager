// ==================================================
// parentRoleResolver 測試
// ==================================================
// 執行方式：node tests/parentRoleResolver.test.js

import { resolveParentRoles } from "../js/utils/parentRoleResolver.js";

const testCases = [
  {
    name: "1. dogA 是公狗、dogB 是母狗 -> fatherId=dogA.id、motherId=dogB.id",
    dogA: { id: "A", gender: "male" },
    dogB: { id: "B", gender: "female" },
    expected: { valid: true, fatherId: "A", motherId: "B" }
  },
  {
    name: "2. dogA 是母狗、dogB 是公狗 -> fatherId=dogB.id、motherId=dogA.id",
    dogA: { id: "A", gender: "female" },
    dogB: { id: "B", gender: "male" },
    expected: { valid: true, fatherId: "B", motherId: "A" }
  },
  {
    name: "3. 兩隻都是公狗 -> 禁止建立子代",
    dogA: { id: "A", gender: "male" },
    dogB: { id: "B", gender: "male" },
    expected: { valid: false }
  },
  {
    name: "4. 兩隻都是母狗 -> 禁止建立子代",
    dogA: { id: "A", gender: "female" },
    dogB: { id: "B", gender: "female" },
    expected: { valid: false }
  },
  {
    name: "5. 有一隻缺少 gender -> 禁止建立子代",
    dogA: { id: "A", gender: "male" },
    dogB: { id: "B" }, // 沒有 gender
    expected: { valid: false }
  },
  {
    name: "額外：兩隻都缺少 gender -> 禁止建立子代",
    dogA: { id: "A" },
    dogB: { id: "B" },
    expected: { valid: false }
  },
  {
    name: "額外：其中一隻資料不存在（null）-> 禁止建立子代",
    dogA: { id: "A", gender: "male" },
    dogB: null,
    expected: { valid: false }
  },
  {
    name: "額外：同一隻狗（id 相同）-> 禁止建立子代",
    dogA: { id: "A", gender: "male" },
    dogB: { id: "A", gender: "female" },
    expected: { valid: false }
  }
];

function runTests() {
  console.log("--- resolveParentRoles 測試 ---");
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = resolveParentRoles(testCase.dogA, testCase.dogB);

    let ok;
    if (testCase.expected.valid === false) {
      ok = result.valid === false && typeof result.errorMessage === "string" && result.errorMessage.length > 0;
    } else {
      ok =
        result.valid === true &&
        result.father.id === testCase.expected.fatherId &&
        result.mother.id === testCase.expected.motherId;
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
