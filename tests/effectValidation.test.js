// ==================================================
// effectValidation 測試
// ==================================================
// 執行方式：node tests/effectValidation.test.js

import { validateDogEffects, getMaxEffectsForDogType, EFFECT_LIMIT_BY_DOG_TYPE, validateDogEffectsUpdate } from "../js/utils/effectValidation.js";

let failed = 0;

function check(name, condition) {
  if (condition) {
    console.log(`✅ ${name}`);
  } else {
    console.log(`❌ ${name}`);
    failed++;
  }
}

// 1. 純種 0~3 特效 -> 合法
check("1a. 純種 0 特效 -> 合法", validateDogEffects("pure", []).valid === true);
check("1b. 純種 1 特效 -> 合法", validateDogEffects("pure", ["A"]).valid === true);
check("1c. 純種 2 特效 -> 合法", validateDogEffects("pure", ["A", "B"]).valid === true);
check("1d. 純種 3 特效 -> 合法", validateDogEffects("pure", ["A", "B", "C"]).valid === true);

// 2. 純種 4 特效 -> 拒絕
{
  const result = validateDogEffects("pure", ["A", "B", "C", "D"]);
  check("2a. 純種 4 特效 -> 拒絕", result.valid === false);
  check("2b. 純種 4 特效 -> 錯誤訊息存在", typeof result.errorMessage === "string" && result.errorMessage.length > 0);
  check("2c. 純種 4 特效 -> 修正後保留前 3 個", result.correctedEffects.length === 3 && result.correctedEffects.join(",") === "A,B,C");
}

// 3. 混種 0 特效 -> 合法
check("3. 混種 0 特效 -> 合法", validateDogEffects("mixed", []).valid === true);

// 4. 混種 1 特效 -> 合法
check("4. 混種 1 特效 -> 合法", validateDogEffects("mixed", ["A"]).valid === true);

// 5. 混種 2 特效 -> 拒絕
{
  const result = validateDogEffects("mixed", ["A", "B"]);
  check("5a. 混種 2 特效 -> 拒絕", result.valid === false);
  check("5b. 混種 2 特效 -> 修正後只保留第一個", result.correctedEffects.length === 1 && result.correctedEffects[0] === "A");
}

// 6. 純種切混種，保留第一個特效
{
  // 純種原本選了 A、B、C，切成混種後應該只保留 A
  const result = validateDogEffects("mixed", ["A", "B", "C"]);
  check("6a. 純種切混種 -> 不合法（原本 3 個超過混種上限 1 個）", result.valid === false);
  check("6b. 純種切混種 -> 保留第一個特效 A", result.correctedEffects.length === 1 && result.correctedEffects[0] === "A");
}

// 其他邊界情況
check("getMaxEffectsForDogType('pure') === 3", getMaxEffectsForDogType("pure") === 3);
check("getMaxEffectsForDogType('mixed') === 1", getMaxEffectsForDogType("mixed") === 1);
check("getMaxEffectsForDogType('unknown') === 0（保守預設）", getMaxEffectsForDogType("unknown_type") === 0);
check("EFFECT_LIMIT_BY_DOG_TYPE 內容正確", EFFECT_LIMIT_BY_DOG_TYPE.pure === 3 && EFFECT_LIMIT_BY_DOG_TYPE.mixed === 1);

{
  // 空/未定義的 effects 不會噴錯
  const result = validateDogEffects("pure", undefined);
  check("effects 為 undefined 不會崩潰，視為空清單", result.valid === true && result.correctedEffects.length === 0);
}

{
  // 重複 id 會被去重，不因為重複而誤判超過上限
  const result = validateDogEffects("mixed", ["A", "A"]);
  check("重複的特效 id 會先去重再判斷", result.valid === true && result.correctedEffects.length === 1);
}

console.log(`\n共計失敗 ${failed} 筆`);
if (failed) process.exitCode = 1;

// --------------------------------------------------
// validateDogEffectsUpdate（給 updateDog 用的合併驗證，這一輪修正的重點）
// --------------------------------------------------
console.log("\n--- validateDogEffectsUpdate 測試 ---");

// 2. 只改 dogType（純種切混種），現有 3 個特效時應該被拒絕
{
  const currentDog = { dogType: "pure", effects: ["A", "B", "C"] };
  const partialData = { dogType: "mixed" }; // 沒有一併傳 effects
  const result = validateDogEffectsUpdate(currentDog, partialData);
  check("2a. 只改 dogType 為 mixed，沿用現有 3 個特效 -> 拒絕", result.valid === false);
  check("2b. 錯誤訊息存在", typeof result.errorMessage === "string" && result.errorMessage.length > 0);
}

// 3. 只更新 effects，混種傳 2 個時應該被拒絕
{
  const currentDog = { dogType: "mixed", effects: ["A"] };
  const partialData = { effects: ["A", "B"] }; // 沒有一併傳 dogType，沿用現有的 mixed
  const result = validateDogEffectsUpdate(currentDog, partialData);
  check("3. 只改 effects 為 2 個，沿用現有 dogType=mixed -> 拒絕", result.valid === false);
}

// 4. 只更新其他欄位（沒有 dogType、沒有 effects），不應該影響合法的既有特效
{
  const currentDog = { dogType: "pure", effects: ["A", "B", "C"] };
  const partialData = { notes: "備註更新" }; // 完全沒動到 dogType / effects
  const result = validateDogEffectsUpdate(currentDog, partialData);
  check("4. 只改其他欄位，沿用現有合法的 3 個特效 -> 合法", result.valid === true);
}

// 額外：只改 dogType 為 mixed，現有剛好 1 個特效 -> 合法（邊界案例）
{
  const currentDog = { dogType: "pure", effects: ["A"] };
  const partialData = { dogType: "mixed" };
  const result = validateDogEffectsUpdate(currentDog, partialData);
  check("額外：純種切混種，現有剛好 1 個特效 -> 合法", result.valid === true);
}

// 額外：同時改 dogType 與 effects，以這次傳入的新值為準
{
  const currentDog = { dogType: "pure", effects: ["A", "B", "C"] };
  const partialData = { dogType: "mixed", effects: ["A"] };
  const result = validateDogEffectsUpdate(currentDog, partialData);
  check("額外：同時改 dogType 與 effects，以新傳入的值驗證 -> 合法", result.valid === true);
}

console.log(`\n共計失敗 ${failed} 筆`);
if (failed) process.exitCode = 1;
