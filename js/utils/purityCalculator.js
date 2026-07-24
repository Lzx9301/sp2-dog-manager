// ==================================================
// 純／混度計算 utility
// ==================================================
// 核心規則（請勿寫死在 UI，一律透過這個函式計算）：
//
//   下一代純／混度 = floor((父方純／混度 + 母方純／混度) / 2) + 1
//
// 之後如果遊戲規則有調整，只需要修改這個檔案，
// 所有呼叫端（配狗計畫預覽、新增子代流程）都會自動套用新規則。

/**
 * 計算子代預計純／混度
 * @param {number} parentAPurityMixDegree - 父方（或母方）純／混度
 * @param {number} parentBPurityMixDegree - 母方（或父方）純／混度
 * @returns {number} 計算後的子代純／混度（整數）
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
