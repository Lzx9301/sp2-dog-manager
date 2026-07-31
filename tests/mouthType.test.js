// ==================================================
// mouthType 測試
// ==================================================
// 執行方式：node tests/mouthType.test.js

import { isMouthPattern, formatMouthDogLabel, isValidMouthSourceBreedId } from "../js/utils/mouthType.js";

const testCases = [];

function test(name, fn) {
  testCases.push({ name, fn });
}

// ---------- isMouthPattern ----------

test("isMouthPattern: isMouthPattern=true -> true", () => {
  return isMouthPattern({ id: "p1", canonicalName: "嘴", isMouthPattern: true }) === true;
});

test("isMouthPattern: isMouthPattern=false -> false", () => {
  return isMouthPattern({ id: "p2", canonicalName: "花紋", isMouthPattern: false }) === false;
});

test("isMouthPattern: 沒有 isMouthPattern 欄位（舊資料）-> false，不會崩潰", () => {
  return isMouthPattern({ id: "p3", canonicalName: "花紋" }) === false;
});

test("isMouthPattern: pattern 為 null -> false，不會崩潰", () => {
  return isMouthPattern(null) === false;
});

test("isMouthPattern: pattern 為 undefined -> false，不會崩潰", () => {
  return isMouthPattern(undefined) === false;
});

test("isMouthPattern: 不會用 canonicalName 字串判斷（就算名稱叫「嘴」但沒有旗標也是 false）", () => {
  return isMouthPattern({ id: "p4", canonicalName: "嘴" }) === false;
});

// ---------- formatMouthDogLabel ----------

test("formatMouthDogLabel: 有嘴型來源 -> 熊嘴薩摩", () => {
  return formatMouthDogLabel("薩摩", "熊") === "熊嘴薩摩";
});

test("formatMouthDogLabel: 沒有嘴型來源（舊資料）-> 未設定嘴型的嘴薩摩", () => {
  return formatMouthDogLabel("薩摩", null) === "未設定嘴型的嘴薩摩";
});

test("formatMouthDogLabel: 嘴型來源是 undefined -> 未設定嘴型的嘴薩摩", () => {
  return formatMouthDogLabel("薩摩", undefined) === "未設定嘴型的嘴薩摩";
});

test("formatMouthDogLabel: 連自身品種都不知道 -> 回傳 null，不猜測、不編造文字", () => {
  return formatMouthDogLabel(null, "熊") === null;
});

test("formatMouthDogLabel: 自身品種與嘴型來源可以相同 -> 熊嘴熊", () => {
  return formatMouthDogLabel("熊", "熊") === "熊嘴熊";
});

// ---------- isValidMouthSourceBreedId ----------

const validBreedIds = ["samoyed", "bear", "husky"];

test("isValidMouthSourceBreedId: 在允許清單內 -> true", () => {
  return isValidMouthSourceBreedId("bear", validBreedIds) === true;
});

test("isValidMouthSourceBreedId: 不在允許清單內 -> false", () => {
  return isValidMouthSourceBreedId("unknown_breed", validBreedIds) === false;
});

test("isValidMouthSourceBreedId: 空值 -> false", () => {
  return isValidMouthSourceBreedId(null, validBreedIds) === false && isValidMouthSourceBreedId("", validBreedIds) === false;
});

test("isValidMouthSourceBreedId: 允許清單不是陣列 -> false，不會崩潰", () => {
  return isValidMouthSourceBreedId("bear", null) === false && isValidMouthSourceBreedId("bear", undefined) === false;
});

// ---------- runner ----------

function runTests() {
  console.log("--- mouthType 測試 ---");
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    let ok = false;
    try {
      ok = testCase.fn() === true;
    } catch (err) {
      ok = false;
      console.log(`   丟出例外: ${err.message}`);
    }

    if (ok) {
      console.log(`✅ ${testCase.name}`);
      passed++;
    } else {
      console.log(`❌ ${testCase.name}`);
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
