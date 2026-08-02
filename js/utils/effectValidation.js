// ==================================================
// 狗狗特效規則驗證（effectValidation）
// ==================================================
// 這是全站唯一定義「特效數量規則」的地方：
//   純種：最多 3 個特效
//   混種：最多 1 個特效
// 新增狗狗、編輯狗狗、建立子代、dogService 的第二層防呆都呼叫這裡，
// 不要各自重寫一套規則（之前就是因為各頁面各寫一套，才會出現
// 「混種一律清空特效」這種錯誤規則）。
//
// 這個檔案是純函式模組：不寫入 Firestore、不操作 DOM，方便獨立測試
//（見 tests/effectValidation.test.js）。

/** 每種狗狗類型可以選幾個特效 */
export const EFFECT_LIMIT_BY_DOG_TYPE = {
  pure: 3,
  mixed: 1
};

/**
 * 取得某個 dogType 可以選的最大特效數量。
 * 無法識別的類型回傳 0（保守起見，不知道就當作不能選）。
 * @param {string} dogType
 */
export function getMaxEffectsForDogType(dogType) {
  return EFFECT_LIMIT_BY_DOG_TYPE[dogType] ?? 0;
}

/**
 * 驗證狗狗的特效選擇是否符合規則。
 *
 * @param {string} dogType - "pure" | "mixed"
 * @param {string[]} effects - 目前選擇的特效 id 清單
 * @returns {{
 *   valid: boolean,
 *   correctedEffects: string[],
 *   errorMessage: string|null
 * }}
 *   valid            - 原本的選擇是否已經符合規則
 *   correctedEffects - 去重、且不超過上限的修正後清單（合法時等於原本的清單去重結果；
 *                      超過上限時保留前面 max 個，多的截掉，供呼叫端需要自動修正時使用）
 *   errorMessage     - 不合法時的中文錯誤說明；合法時為 null
 */
export function validateDogEffects(dogType, effects) {
  const max = getMaxEffectsForDogType(dogType);
  const list = Array.isArray(effects) ? effects.filter(Boolean) : [];
  const dedup = Array.from(new Set(list));
  const valid = dedup.length <= max;

  const typeLabel = dogType === "pure" ? "純種" : dogType === "mixed" ? "混種" : "這個類型";

  return {
    valid,
    correctedEffects: valid ? dedup : dedup.slice(0, max),
    errorMessage: valid ? null : `${typeLabel}最多只能選 ${max} 個特效`
  };
}

/**
 * 給 updateDog() 用的合併驗證：不能只在 partialData 同時包含 dogType 與 effects
 * 時才驗證——只改其中一個也要用「合併目前資料後的結果」驗證，避免繞過規則
 *（例如把已經有 3 個特效的純種狗改成混種，卻沒有一併修改 effects）。
 *
 * 純函式，不做任何 Firestore 讀寫，方便獨立測試；dogService.js 的 updateDog()
 * 會先自己讀出 currentDog，再呼叫這裡驗證。
 *
 * @param {{dogType？: string, effects?: string[]}|null} currentDog - 目前已經存在的狗狗資料
 * @param {{dogType?: string, effects?: string[]}} partialData - 這次要更新的內容（可能沒有 dogType／effects）
 * @returns {{valid: boolean, correctedEffects: string[], errorMessage: string|null}}
 */
export function validateDogEffectsUpdate(currentDog, partialData) {
  const finalDogType = partialData?.dogType !== undefined ? partialData.dogType : currentDog?.dogType;
  const finalEffects = partialData?.effects !== undefined ? partialData.effects : currentDog?.effects;
  return validateDogEffects(finalDogType, finalEffects);
}
