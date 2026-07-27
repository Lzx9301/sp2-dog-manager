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
