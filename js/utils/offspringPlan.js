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
 * 計算某個配狗計畫的子代歸屬狀況。
 *
 * 這是全站唯一判斷「這個計畫是否已經有子代」「子代有哪些」的地方。
 * `dashboard.js`／`breeding.js` 都呼叫這裡，不要各自重寫一套。
 *
 * 重要（這一輪修正的核心）：**只靠 fatherId+motherId 反查到的舊資料，不論找到
 * 一隻還是多隻候選，都不算「確認歸屬」**。原因是同一對父母可能同時有好幾筆
 * 配狗計畫，光憑這一筆 plan 本身的資料，沒辦法證明反查到的狗就是「這一筆」計畫
 * 生出來的，而不是同父母另一筆計畫生出來的——就算剛好只找到一隻候選，也只是
 * 「目前只看到一隻」，不是「證明只有一隻」。所以父母反查的結果一律只能放進
 * `legacyCandidateIds`（僅供舊資料顯示參考），絕對不會出現在 `ids` 或
 * `backfillableIds`，也絕對不會被自動寫回 Firestore。
 *
 * 明確歸屬只有三種來源（可信，才會出現在 `ids` 裡）：
 *   1. `dogs` 中 `sourceBreedingPlanId === plan.id` 的狗
 *      —— 新增子代流程一定會寫入這個欄位，這是最明確的歸屬依據。
 *   2. `plan.offspringIds` 陣列
 *   3. 舊版單一 `plan.offspringId`
 *  （2、3 由 `getOffspringIds` 處理）
 *
 * 父母反查（`fatherId`/`motherId` 都對得上）只在「明確歸屬完全沒有任何記錄」
 * 且 `plan.offspringCreated === true`（代表這是連 `offspringIds` 都沒有的更早期
 * 舊資料）時才會執行，純粹是「让舊資料在畫面上不要完全消失」的顯示輔助，
 * 不參與「是否已有子代」的判斷，也不能被回填。
 *
 * 反查時也會排除「已經有 sourceBreedingPlanId 且指向『其他』計畫」的狗——
 * 那些狗已經有明確歸屬，不能因為父母組合剛好相同就被這筆計畫搶過來當候選。
 *
 * 純函式，不做任何 Firestore 讀寫；呼叫端要不要把 `backfillableIds` 寫回
 * Firestore 自行決定（例如 breeding.js 會呼叫 addOffspringToBreedingPlan）。
 *
 * @param {object} plan
 * @param {{valid: boolean, father?: object, mother?: object}|null} parentRoles - resolveParentRoles() 的結果，無法判定父母就傳 null
 * @param {object[]} allDogs - 目前已載入的所有狗狗資料，用來反查歸屬
 * @returns {{ids: string[], legacyCandidateIds: string[], backfillableIds: string[]}}
 *   ids              - 明確屬於此計畫的子代 id（sourceBreedingPlanId + offspringIds/offspringId）
 *   legacyCandidateIds - 僅靠父母反查得到、尚未能確認歸屬的舊資料，只能用於顯示，不算已確認子代
 *   backfillableIds  - 其中「新發現且來源明確可信」、建議可以安全回填進 Firestore 的 id
 *                      （只會來自 sourceBreedingPlanId，絕不包含父母反查結果）
 */
export function resolveEffectiveOffspringIds(plan, parentRoles, allDogs = []) {
  const recordedIds = getOffspringIds(plan); // 來源 2、3：offspringIds / offspringId
  const recordedSet = new Set(recordedIds);

  // 來源 1：sourceBreedingPlanId === plan.id 的狗，一律視為這個計畫的子代
  // 注意：兩邊都必須是「明確存在的值」才算相符，避免 plan.id 與 dog.sourceBreedingPlanId
  // 都剛好是 undefined 時被誤判成相符。
  const sourcePlanDogs = (allDogs || []).filter(
    (dog) => dog && plan?.id && dog.sourceBreedingPlanId && dog.sourceBreedingPlanId === plan.id
  );

  const hasConfirmedAttribution = recordedIds.length > 0 || sourcePlanDogs.length > 0;

  // 父母反查：只有明確歸屬完全是空的，且舊版明確設過 offspringCreated=true，
  // 才會執行；結果一律只進 legacyCandidateIds，不論找到幾隻都不算「確認歸屬」。
  let legacyCandidates = [];
  if (!hasConfirmedAttribution && plan.offspringCreated === true && parentRoles?.valid) {
    legacyCandidates = (allDogs || []).filter((dog) => {
      if (!dog) return false;
      if (dog.fatherId !== parentRoles.father.id || dog.motherId !== parentRoles.mother.id) return false;
      // 已經明確歸屬給「其他」計畫的狗，不能因為父母組合相同就被搶過來當候選
      if (dog.sourceBreedingPlanId && dog.sourceBreedingPlanId !== plan.id) return false;
      return true;
    });

    if (legacyCandidates.length > 0) {
      console.warn(
        `[resolveEffectiveOffspringIds] 配狗計畫 ${plan.id} 用父母關係反查到 ${legacyCandidates.length} 隻可能的舊子代，` +
          `無法證明歸屬（同一對父母可能有多筆配狗計畫，即使只找到一隻候選也無法排除歸屬別筆計畫的可能）。` +
          `這些結果只會列為 legacyCandidateIds 供顯示參考，不會算作已確認子代，也不會自動回填 offspringIds。`
      );
    }
  }

  const ids = mergeOffspringIds(recordedIds, sourcePlanDogs);
  const legacyCandidateIds = legacyCandidates.map((dog) => dog.id);

  // 可安全回填的 id：只有 sourceBreedingPlanId 明確指向這個計畫、但還沒寫進
  // offspringIds 的狗才算數。父母反查的結果永遠不會出現在這裡。
  const backfillableIds = [];
  sourcePlanDogs.forEach((dog) => {
    if (!recordedSet.has(dog.id)) backfillableIds.push(dog.id);
  });

  return { ids, legacyCandidateIds, backfillableIds };
}
