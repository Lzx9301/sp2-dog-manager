// ==================================================
// 下一代純種／混種預測（breedingPrediction）
// ==================================================
// 這是全站唯一計算「下一代純／混度」的地方。
// dogDetail.js、breeding.js、dashboard.js、breedingPlanService.js
// 都必須呼叫這裡的 predictOffspring()，不可以各自重新計算。
//
// 這個檔案是純函式模組：不寫入 Firestore、不操作 DOM，方便獨立測試
// （見 tests/breedingPrediction.test.js）。
//
// ------------------------------
// SP2 配種規則
// ------------------------------
// A. 純種 × 純種 → 下一代為純種
//    純度 = floor((父方純度 + 母方純度) / 2) + 1
//
// B. 混種 × 混種 → 下一代為混種
//    混度 = floor((父方混度 + 母方混度) / 2) + 1
//
// C. 純種 × 混種（不論誰是父方誰是母方）→ 下一代為混種
//    純種那一方在計算時一律視為「混度 0」，不能直接拿純度數值參與平均。
//    混度 = floor((0 + 對方混度) / 2) + 1
//
// ------------------------------
// 目前系統實際使用的狗狗欄位
// ------------------------------
// 本系統的狗狗文件只有一組欄位在使用（沒有多種舊欄位名稱並存的情況）：
//   dog.dogType         - "pure" | "mixed"
//   dog.purityMixDegree - number（純種時代表純度，混種時代表混度，共用同一個欄位）
// 這個模組的 normalizeParent() 會讀取這兩個欄位，並轉換成內部統一格式：
//   { type: "pure" | "mixed", originalLevel: number }
// 之後如果系統改用其他欄位名稱，只需要修改 normalizeParent()，
// 呼叫端（predictOffspring 的使用者）完全不需要跟著改。

/** 預測失敗時的錯誤代碼常數 */
export const PREDICTION_ERROR_CODES = {
  MISSING_DOG: "missing_dog",
  MISSING_TYPE: "missing_type",
  UNKNOWN_TYPE: "unknown_type",
  MISSING_LEVEL: "missing_level",
  INVALID_LEVEL: "invalid_level"
};

/**
 * 將單一狗狗資料正規化成預測用的內部格式。
 * @param {{dogType?: string, purityMixDegree?: number}|null|undefined} dog
 * @param {string} label - 用於錯誤訊息，例如「狗狗 A」「狗狗 B」（注意：這裡不代表父親／母親，
 *   只是計算用的兩個輸入位置；真正的父母角色判定請用 parentRoleResolver.js 的 resolveParentRoles）
 * @returns {{valid: true, type: "pure"|"mixed", originalLevel: number} | {valid: false, errorCode: string, errorMessage: string}}
 */
function normalizeParent(dog, label) {
  if (!dog) {
    return {
      valid: false,
      errorCode: PREDICTION_ERROR_CODES.MISSING_DOG,
      errorMessage: `${label}資料不存在，無法預測下一代`
    };
  }

  const type = dog.dogType;

  if (!type) {
    return {
      valid: false,
      errorCode: PREDICTION_ERROR_CODES.MISSING_TYPE,
      errorMessage: `${label}尚未設定純種／混種類型，無法預測下一代`
    };
  }

  if (type !== "pure" && type !== "mixed") {
    return {
      valid: false,
      errorCode: PREDICTION_ERROR_CODES.UNKNOWN_TYPE,
      errorMessage: `${label}的純種／混種類型無法識別，無法預測下一代`
    };
  }

  const levelLabel = type === "pure" ? "純度" : "混度";
  const rawLevel = dog.purityMixDegree;

  if (rawLevel === null || rawLevel === undefined || rawLevel === "") {
    return {
      valid: false,
      errorCode: PREDICTION_ERROR_CODES.MISSING_LEVEL,
      errorMessage: `${label}缺少${levelLabel}數值，無法預測下一代`
    };
  }

  const level = Number(rawLevel);

  if (!Number.isFinite(level) || level < 0) {
    return {
      valid: false,
      errorCode: PREDICTION_ERROR_CODES.INVALID_LEVEL,
      errorMessage: `${label}的${levelLabel}數值無效，無法預測下一代`
    };
  }

  return { valid: true, type, originalLevel: level };
}

/**
 * 預測兩隻狗配對後的下一代純種／混種與純／混度。
 *
 * @param {{dogType?: string, purityMixDegree?: number}|null} parentA
 * @param {{dogType?: string, purityMixDegree?: number}|null} parentB
 * @returns 成功時：
 * {
 *   valid: true,
 *   offspringType: "pure" | "mixed",
 *   offspringLevel: number,
 *   offspringLevelLabel: "純度" | "混度",
 *   displayLabel: string,           // 例如 "混種／混度 6"
 *   parents: {
 *     parentA: { type, originalLevel, usedLevel },
 *     parentB: { type, originalLevel, usedLevel }
 *   }
 * }
 * 失敗時：
 * {
 *   valid: false,
 *   errorCode: string,
 *   errorMessage: string
 * }
 */
export function predictOffspring(parentA, parentB) {
  const a = normalizeParent(parentA, "狗狗 A");
  if (!a.valid) return { valid: false, errorCode: a.errorCode, errorMessage: a.errorMessage };

  const b = normalizeParent(parentB, "狗狗 B");
  if (!b.valid) return { valid: false, errorCode: b.errorCode, errorMessage: b.errorMessage };

  const bothPure = a.type === "pure" && b.type === "pure";
  const bothMixed = a.type === "mixed" && b.type === "mixed";

  let usedA;
  let usedB;
  let offspringType;

  if (bothPure) {
    // 純種 × 純種：雙方都用原本的純度計算，下一代仍是純種
    usedA = a.originalLevel;
    usedB = b.originalLevel;
    offspringType = "pure";
  } else if (bothMixed) {
    // 混種 × 混種：雙方都用原本的混度計算，下一代是混種
    usedA = a.originalLevel;
    usedB = b.originalLevel;
    offspringType = "mixed";
  } else {
    // 純種 × 混種（不論順序）：純種那一方計算時視為混度 0，下一代一律是混種
    usedA = a.type === "pure" ? 0 : a.originalLevel;
    usedB = b.type === "pure" ? 0 : b.originalLevel;
    offspringType = "mixed";
  }

  const offspringLevel = Math.floor((usedA + usedB) / 2) + 1;
  const offspringLevelLabel = offspringType === "pure" ? "純度" : "混度";
  const typeLabel = offspringType === "pure" ? "純種" : "混種";

  return {
    valid: true,
    offspringType,
    offspringLevel,
    offspringLevelLabel,
    displayLabel: `${typeLabel}／${offspringLevelLabel} ${offspringLevel}`,
    parents: {
      parentA: { type: a.type, originalLevel: a.originalLevel, usedLevel: usedA },
      parentB: { type: b.type, originalLevel: b.originalLevel, usedLevel: usedB }
    }
  };
}

/**
 * 格式化「某隻狗自己的」純種／混種與數值，供 UI 顯示使用。
 * 例如 formatTypeLevel("mixed", 10) → "混種／混度 10"
 * 型別無法識別或數值缺失時回傳「未設定」，不會顯示 NaN 或 undefined。
 *
 * @param {string|undefined} type
 * @param {number|undefined} level
 */
export function formatTypeLevel(type, level) {
  if (type !== "pure" && type !== "mixed") return "未設定";

  const numLevel = Number(level);
  if (level === null || level === undefined || level === "" || !Number.isFinite(numLevel)) {
    return type === "pure" ? "純種（純度未設定）" : "混種（混度未設定）";
  }

  const typeLabel = type === "pure" ? "純種" : "混種";
  const levelLabel = type === "pure" ? "純度" : "混度";
  return `${typeLabel}／${levelLabel} ${numLevel}`;
}

/**
 * 取得純種／混種數值欄位該用的標籤文字：純種是「純度」、混種是「混度」。
 * 不要在畫面上直接寫死含糊的「純／混度」——那個字眼看不出來是純度還是混度。
 * dogType 還沒選定（例如新增表單初始狀態）時，退回「純度／混度」這種還沒決定的中性字樣。
 *
 * @param {string|undefined} dogType
 */
export function getPurityLevelLabel(dogType) {
  if (dogType === "pure") return "純度";
  if (dogType === "mixed") return "混度";
  return "純度／混度";
}
