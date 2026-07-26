// ==================================================
// 配狗計畫完成條件判斷（breedingPlanValidation）
// ==================================================
// 把「完成配狗計畫是否允許」這個判斷拆成純函式，
// 方便獨立測試，不需要連線 Firestore。
// breedingPlanService.js 的 completeBreedingPlan() 會呼叫這裡的函式。

import { isPedigreeStatusAllowed, PEDIGREE_STATUS_LABELS } from "./pedigreeService.js";

/**
 * 判斷配狗計畫是否可以標記完成。
 * 必須同時滿足：
 *   1. 血緣檢查結果允許配狗（restricted / insufficient_data 等一律不允許）
 *   2. 純種／混種預測資料有效
 *
 * @param {{status: string, explanation: string}} pedigreeResult - checkPedigreeCompatibility() 的回傳結果
 * @param {{valid: boolean, errorMessage?: string}} prediction - predictOffspring() 的回傳結果
 * @returns {{allowed: boolean, reason: string|null}}
 */
export function canCompleteBreedingPlan(pedigreeResult, prediction) {
  if (!isPedigreeStatusAllowed(pedigreeResult.status)) {
    const label = PEDIGREE_STATUS_LABELS[pedigreeResult.status] || pedigreeResult.status;
    return {
      allowed: false,
      reason: `${label}。這筆配狗計畫的血緣狀態不允許配狗，請改為取消或刪除這筆計畫。`
    };
  }

  if (!prediction.valid) {
    return {
      allowed: false,
      reason: prediction.errorMessage
    };
  }

  return { allowed: true, reason: null };
}
