// ==================================================
// 純／混度計算 utility（已棄用，請勿再使用）
// ==================================================
// ⚠ 這個檔案的公式沒有區分純種／混種配對規則，
// 純種 × 混種時會錯誤地直接拿純度數值參與平均，不符合遊戲實際規則。
//
// 全站唯一正確的下一代純種／混種預測函式在：
//   js/utils/breedingPrediction.js（predictOffspring）
//
// 這個檔案保留只是避免刪除後意外造成尚未發現的舊引用出錯，
// 目前系統中已經沒有任何地方呼叫這裡的函式了（dogDetail.js、breeding.js、
// dashboard.js、pedigreeCheck.js、breedingPlanService.js 都已改用
// breedingPrediction.js 的 predictOffspring）。請不要在新程式碼中使用這個檔案。

/**
 * @deprecated 請改用 js/utils/breedingPrediction.js 的 predictOffspring()
 */
export function calculateOffspringPurityDegree(parentAPurityMixDegree, parentBPurityMixDegree) {
  const a = Number(parentAPurityMixDegree);
  const b = Number(parentBPurityMixDegree);

  if (Number.isNaN(a) || Number.isNaN(b)) {
    throw new Error("純／混度必須為數字，無法計算子代純／混度");
  }

  return Math.floor((a + b) / 2) + 1;
}

/**
 * 是否為有效的純／混度數值（給表單驗證使用）
 */
export function isValidPurityMixDegree(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0;
}
