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
 * 這是全站唯一判斷「這個計畫是否已經有子代」「子代有哪些」的地方。
 * `dashboard.js`／`breeding.js` 都呼叫這裡，不要各自重寫一套。
 *
 * 歸屬依據依優先順序（找到就用，不再往下一步退）：
 *   A. dogs 中 sourceBreedingPlanId === plan.id 的狗
 *      —— 這是最明確的歸屬依據，新增子代流程一定會寫入這個欄位。
 *   B. plan.offspringIds 陣列／舊版單一 plan.offspringId（getOffspringIds 已處理）
 *   C. 只有在 A、B 都完全沒有任何記錄，且 plan.offspringCreated === true
 *      （代表這是更早期、連 offspringIds 都沒有的舊資料）時，才退而求其次，
 *      用「正確的父母組合」（fatherId/motherId 都對得上）反查目前所有狗狗資料。
 *
 * 重要（這一輪修正的核心）：同一對父母可能同時有好幾筆配狗計畫，如果只憑
 * fatherId+motherId 相同就把所有同父母的狗都歸給每一筆計畫，子代會被歸到錯誤的計畫。
 * 所以：
 *   - 只有 A、B 都是空的時候才會啟用 C（父母反查），不會因為同父母已經有其他
 *     子代，就誤判「這筆計畫也已經有子代」（那應該交給那筆狗自己的 sourceBreedingPlanId
 *     或它所屬計畫的 offspringIds 去認領，不會因為血緣父母相同就被搶走或誤植）。
 *   - 父母反查時，會排除掉「已經有 sourceBreedingPlanId 且指向『其他』計畫」的狗——
 *     那些狗已經有明確歸屬了，不能因為父母組合剛好相同就被這筆計畫搶過來。
 *   - 父母反查如果找到超過一隻候選狗，代表無法精確判斷這些狗到底屬於同父母的哪一筆
 *     舊計畫：這種情況只能「顯示」（納入回傳的 ids，供畫面上不要漏顯示舊資料），
 *     但**不會自動回填**到 Firestore 的 offspringIds（避免把猜測寫成既定事實），
 *     並且會 console.warn 說明無法精確歸屬。只有唯一候選時才視為安全、可以回填。
 *
 * 純函式，不做任何 Firestore 讀寫；呼叫端要不要把「可回填」的 id 寫回 Firestore
 * 自行決定（例如 breeding.js 會呼叫 addOffspringToBreedingPlan）。
 *
 * @param {object} plan
 * @param {{valid: boolean, father?: object, mother?: object}|null} parentRoles - resolveParentRoles() 的結果，無法判定父母就傳 null
 * @param {object[]} allDogs - 目前已載入的所有狗狗資料，用來反查歸屬
 * @returns {{ids: string[], backfillableIds: string[]}}
 *   ids            - 去重後、供顯示與計數用的完整子代 id 清單
 *   backfillableIds - 其中「新發現且來源明確可信」、建議可以安全回填進 Firestore 的 id
 */
export function resolveEffectiveOffspringIds(plan, parentRoles, allDogs = []) {
  const recordedIds = getOffspringIds(plan); // B：offspringIds / offspringId
  const recordedSet = new Set(recordedIds);

  // A：sourceBreedingPlanId === plan.id 的狗，一律視為這個計畫的子代
  // 注意：兩邊都必須是「明確存在的值」才算相符，避免 plan.id 與 dog.sourceBreedingPlanId
  // 都剛好是 undefined 時被誤判成相符。
  const sourcePlanDogs = (allDogs || []).filter(
    (dog) => dog && plan?.id && dog.sourceBreedingPlanId && dog.sourceBreedingPlanId === plan.id
  );

  const hasAnyRecordedAttribution = recordedIds.length > 0 || sourcePlanDogs.length > 0;

  // C：只有 A、B 都空，且舊版明確設過 offspringCreated=true，才允許父母反查（最後手段）
  let legacyCandidates = [];
  if (!hasAnyRecordedAttribution && plan.offspringCreated === true && parentRoles?.valid) {
    legacyCandidates = (allDogs || []).filter((dog) => {
      if (!dog) return false;
      if (dog.fatherId !== parentRoles.father.id || dog.motherId !== parentRoles.mother.id) return false;
      // 已經明確歸屬給「其他」計畫的狗，不能因為父母組合相同就被搶過來
      if (dog.sourceBreedingPlanId && dog.sourceBreedingPlanId !== plan.id) return false;
      return true;
    });

    if (legacyCandidates.length > 1) {
      console.warn(
        `[resolveEffectiveOffspringIds] 配狗計畫 ${plan.id} 用父母關係反查到 ${legacyCandidates.length} 隻可能的舊子代，` +
          `無法精確歸屬給單一計畫（同一對父母可能有多筆配狗計畫）。這些結果僅用於舊資料相容顯示，` +
          `不會自動回填 offspringIds，請視需要人工確認後手動處理。`
      );
    }
  }

  const ids = mergeOffspringIds(recordedIds, [...sourcePlanDogs, ...legacyCandidates]);

  // 可安全回填的 id：
  //   - sourceBreedingPlanId 對應的狗，歸屬明確，可以回填
  //   - 父母反查「只有唯一候選」時才可以回填；出現多筆候選（無法精確歸屬）一律不回填
  const backfillableIds = [];
  sourcePlanDogs.forEach((dog) => {
    if (!recordedSet.has(dog.id)) backfillableIds.push(dog.id);
  });
  if (legacyCandidates.length === 1 && !recordedSet.has(legacyCandidates[0].id)) {
    backfillableIds.push(legacyCandidates[0].id);
  }

  return { ids, backfillableIds };
}
