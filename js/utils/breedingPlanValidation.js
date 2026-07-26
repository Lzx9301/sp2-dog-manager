// ==================================================
// 配狗計畫完成條件判斷（breedingPlanValidation）
// ==================================================
// 把「完成配狗計畫是否允許」這個判斷拆成純函式，
// 方便獨立測試，不需要連線 Firestore。
// breedingPlanService.js 的 completeBreedingPlan() 會呼叫這裡的函式。
//
// 重要（這一輪修正的核心）：
// 血緣狀態不是只有「允許」「不允許」兩種。insufficient_data（資料不足）跟
// confirmed_related_unknown_distance（確認有親屬但不知道距離）都只是「目前不知道」，
// 不等於「確認三代內有血緣」。「不知道」不代表「不能」，所以這兩種狀態不應該
// 直接被當成跟 restricted 一樣的失敗，而是「warning：需要人工確認」。
//
// 只有 restricted（level === "blocked"）才是遊戲規則明確禁止、永遠不能完成。

import { getPedigreePermission, PEDIGREE_LEVEL } from "./pedigreeService.js";

/**
 * 判斷配狗計畫是否可以標記完成。
 *
 * 三種結果：
 *   1. 血緣狀態是 blocked（restricted）→ 直接拒絕，不管有沒有 confirm
 *   2. 血緣狀態是 warning（insufficient_data / confirmed_related_unknown_distance）
 *      → 沒有 confirmPedigreeWarning 就拒絕並要求確認；有的話才繼續往下檢查
 *   3. 血緣狀態是 allowed，或 warning 已確認 → 再檢查純種／混種預測資料是否有效，
 *      有效才真的允許完成
 *
 * @param {{status: string, explanation: string}} pedigreeResult - checkPedigreeCompatibility() 的回傳結果
 * @param {{valid: boolean, errorMessage?: string}} prediction - predictOffspring() 的回傳結果
 * @param {{confirmPedigreeWarning?: boolean}} options - 呼叫端是否已經確認過血緣警示
 * @returns {{allowed: boolean, needsConfirmation: boolean, message: string|null}}
 */
export function canCompleteBreedingPlan(pedigreeResult, prediction, options = {}) {
  const { confirmPedigreeWarning = false } = options;
  const permission = getPedigreePermission(pedigreeResult.status);

  if (permission.level === PEDIGREE_LEVEL.BLOCKED) {
    return {
      allowed: false,
      needsConfirmation: false,
      message: `${permission.message}這筆配狗計畫的血緣狀態不允許配狗，請改為取消或刪除這筆計畫。`
    };
  }

  if (permission.level === PEDIGREE_LEVEL.WARNING && !confirmPedigreeWarning) {
    return {
      allowed: false,
      needsConfirmation: true,
      message: `${permission.message}請再次確認後完成。`
    };
  }

  // 走到這裡代表：allowed，或 warning 且已經確認過 —— 接著檢查純種／混種預測資料
  if (!prediction.valid) {
    return {
      allowed: false,
      needsConfirmation: false,
      message: prediction.errorMessage
    };
  }

  return { allowed: true, needsConfirmation: false, message: null };
}
