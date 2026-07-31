// ==================================================
// 配狗計畫子代顯示／累加純邏輯
// ==================================================

/**
 * 相容舊資料：新版以 offspringIds 陣列為準；若舊資料只有 offspringId，仍納入顯示。
 */
export function getOffspringIds(plan = {}) {
  const ids = Array.isArray(plan.offspringIds) ? plan.offspringIds.filter(Boolean) : [];
  if (plan.offspringId && !ids.includes(plan.offspringId)) ids.push(plan.offspringId);
  return ids;
}

/**
 * 是否應顯示「新增子代」。已有多少子代完全不影響判斷。
 */
export function canShowAddOffspring({ status, pedigreeLevel, parentRolesValid, predictionValid }) {
  return (
    status === "completed" &&
    pedigreeLevel !== "blocked" &&
    parentRolesValid === true &&
    predictionValid === true
  );
}

/**
 * 模擬 Firestore arrayUnion 的純函式版本，供測試使用。
 */
export function appendOffspringId(existingIds, dogId) {
  const result = Array.isArray(existingIds) ? [...existingIds] : [];
  if (dogId && !result.includes(dogId)) result.push(dogId);
  return result;
}

/** 合併計畫已記錄 ID 與從父母關係找回的舊子代，並去除重複。 */
export function mergeOffspringIds(recordedIds = [], recoveredDogs = []) {
  const ids = new Set((recordedIds || []).filter(Boolean));
  (recoveredDogs || []).forEach((dog) => {
    if (dog?.id) ids.add(dog.id);
  });
  return Array.from(ids);
}

/**
 * 計算某個配狗計畫「實際」的子代 id 清單。
 *
 * 這是全站唯一判斷「這個計畫是否已經有子代」的地方，合併三種來源：
 *   1. 新版 offspringIds 陣列
 *   2. 舊版單一 offspringId（getOffspringIds 已處理）
 *   3. 舊版只設定 offspringCreated=true、沒有保存任何 dogId 的計畫，
 *      靠正確的父母組合（resolveParentRoles 判定後的 father/mother）
 *      反查目前所有狗狗資料，找出 fatherId/motherId 都對得上的子代
 *
 * 純函式，不做任何 Firestore 讀寫；呼叫端（breeding.js／dashboard.js）
 * 只需要傳入已經載入好的 plan、parentRoles、allDogs，不用各自重寫比對邏輯。
 * 呼叫端如果想把「找回的舊子代」回填進 Firestore（例如 breeding.js 會這麼做），
 * 自行比對回傳結果跟 getOffspringIds(plan) 的差異即可，這裡不處理寫入。
 *
 * @param {object} plan
 * @param {{valid: boolean, father?: object, mother?: object}|null} parentRoles - resolveParentRoles() 的結果，無法判定父母就傳 null
 * @param {object[]} allDogs - 目前已載入的所有狗狗資料，用來反查父母關係
 * @returns {string[]} 去重後的子代 dogId 清單
 */
export function resolveEffectiveOffspringIds(plan, parentRoles, allDogs = []) {
  const recordedIds = getOffspringIds(plan);

  const legacyOffspringDogs = parentRoles?.valid
    ? allDogs.filter(
        (dog) => dog.fatherId === parentRoles.father.id && dog.motherId === parentRoles.mother.id
      )
    : [];

  return mergeOffspringIds(recordedIds, legacyOffspringDogs);
}
