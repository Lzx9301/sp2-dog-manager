// ==================================================
// 父母角色判定（parentRoleResolver）
// ==================================================
// 這是全站唯一「依性別判定父親／母親」的地方。
//
// 重要：配狗計畫的 dogAId / dogBId 只代表「配對的兩隻狗」，
// 不代表誰是父親、誰是母親。使用者可能從母狗的詳情頁發起配對，
// 這時候 dogA 反而是母狗。任何需要判斷「誰是父親、誰是母親」
// 的地方（例如新增子代、決定 fatherId/motherId）都必須呼叫這裡的
// resolveParentRoles()，不可以直接假設 dogA = 父方、dogB = 母方。
//
// 這個檔案是純函式模組：不寫入 Firestore、不操作 DOM，方便獨立測試
//（見 tests/parentRoleResolver.test.js）。
//
// ------------------------------
// 目前系統實際使用的性別欄位
// ------------------------------
// dog.gender 只會是 "male" 或 "female"（見 js/utils/constants.js 的 GENDER_LABELS）。

/** 判定失敗時的錯誤代碼常數 */
export const PARENT_ROLE_ERROR_CODES = {
  MISSING_DOG: "missing_dog",
  SAME_DOG: "same_dog",
  MISSING_GENDER: "missing_gender",
  SAME_GENDER: "same_gender"
};

const VALID_GENDERS = new Set(["male", "female"]);

/**
 * 依性別判定兩隻狗誰是父親、誰是母親。
 *
 * @param {{id?: string, gender?: string}|null} dogA
 * @param {{id?: string, gender?: string}|null} dogB
 * @returns 成功時：{ valid: true, father: dogA或dogB, mother: 另一隻 }
 *          失敗時：{ valid: false, errorCode: string, errorMessage: string }
 *
 * 失敗情況：
 *   - 缺少任一隻狗的資料
 *   - 兩隻狗是同一隻（id 相同）
 *   - 任一隻狗尚未設定性別，或性別值無法識別
 *   - 兩隻狗性別相同（都是公狗或都是母狗）
 */
export function resolveParentRoles(dogA, dogB) {
  if (!dogA || !dogB) {
    return {
      valid: false,
      errorCode: PARENT_ROLE_ERROR_CODES.MISSING_DOG,
      errorMessage: "無法建立子代：找不到配對雙方的狗狗資料。"
    };
  }

  if (dogA.id && dogB.id && dogA.id === dogB.id) {
    return {
      valid: false,
      errorCode: PARENT_ROLE_ERROR_CODES.SAME_DOG,
      errorMessage: "無法建立子代：配對雙方不能是同一隻狗。"
    };
  }

  const genderA = dogA.gender;
  const genderB = dogB.gender;

  if (!VALID_GENDERS.has(genderA) || !VALID_GENDERS.has(genderB)) {
    return {
      valid: false,
      errorCode: PARENT_ROLE_ERROR_CODES.MISSING_GENDER,
      errorMessage: "無法建立子代：此配狗計畫必須包含一隻公狗與一隻母狗（其中一隻尚未設定性別）。"
    };
  }

  if (genderA === genderB) {
    return {
      valid: false,
      errorCode: PARENT_ROLE_ERROR_CODES.SAME_GENDER,
      errorMessage: "無法建立子代：此配狗計畫必須包含一隻公狗與一隻母狗。"
    };
  }

  const father = genderA === "male" ? dogA : dogB;
  const mother = genderA === "female" ? dogA : dogB;

  return { valid: true, father, mother };
}
