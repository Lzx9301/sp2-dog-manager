// ==================================================
// 嘴型（mouthSourceBreedId）共用純函式
// ==================================================
// 這是全站唯一處理「這是什麼嘴」相關邏輯的地方：
//   - 判斷某個圖案是不是「嘴」圖案
//   - 把「自身品種 + 嘴型來源品種」組合成正確的顯示文字（例如「熊嘴薩摩」）
//   - 驗證 mouthSourceBreedId 是否存在於目前允許的品種清單
//
// 這個檔案是純函式模組：不寫入 Firestore、不操作 DOM，方便獨立測試
//（見 tests/mouthType.test.js）。

/**
 * 判斷某個圖案（patterns collection 的文件）是不是「嘴」圖案。
 * 用明確的 isMouthPattern 旗標判斷，不用 canonicalName／別名字串比對
 *（名稱可能有多種寫法或之後改名，字串比對不可靠）。
 *
 * @param {{isMouthPattern?: boolean}|null|undefined} pattern
 */
export function isMouthPattern(pattern) {
  return !!pattern && pattern.isMouthPattern === true;
}

/**
 * 組合「嘴狗」的顯示名稱。
 *
 * 規則：
 *   - 有嘴型來源品種名稱 -> "{嘴型來源品種}嘴{自身品種}"，例如熊 + 薩摩 -> "熊嘴薩摩"
 *   - 沒有嘴型來源品種（舊資料尚未補登）-> "未設定嘴型的嘴{自身品種}"
 *   - 連自身品種都不知道 -> 回傳 null，交給呼叫端決定怎麼顯示（不要在這裡猜測或編造文字）
 *
 * @param {string|null|undefined} selfBreedName - 狗自己的品種名稱
 * @param {string|null|undefined} mouthSourceBreedName - 嘴型來源品種名稱
 * @returns {string|null}
 */
export function formatMouthDogLabel(selfBreedName, mouthSourceBreedName) {
  if (!selfBreedName) return null;

  if (mouthSourceBreedName) {
    return `${mouthSourceBreedName}嘴${selfBreedName}`;
  }

  return `未設定嘴型的嘴${selfBreedName}`;
}

/**
 * 驗證 mouthSourceBreedId 是否存在於目前允許的品種清單。
 * @param {string|null|undefined} mouthSourceBreedId
 * @param {string[]} validBreedIds - 目前允許選擇的品種 id 清單（例如 20 種嘴型來源品種）
 * @returns {boolean}
 */
export function isValidMouthSourceBreedId(mouthSourceBreedId, validBreedIds) {
  if (!mouthSourceBreedId) return false;
  return Array.isArray(validBreedIds) && validBreedIds.includes(mouthSourceBreedId);
}
