// ==================================================
// 血緣判斷 Service（pedigreeService）
// ==================================================
//
// 核心規則（重要，請勿誤解）：
//   遊戲規則不是「有血緣就不能配」。
//   真正規則是「只要血緣關係已經離開三代限制範圍，就可以重新配」。
//
// 這代表：
//   - 即使兩隻狗很久以前有共同血統，只要距離超過三代限制，仍然可以配。
//   - 三代限制的實際邊界目前尚未 100% 確認，因此做成常數＋可調整搜尋深度，
//     方便之後用實際族譜案例持續驗證修正。
//
// 「距離」定義（第一版採用的假設，之後可依實際驗證案例調整）：
//   distance = 從 A 往上到共同祖先的代數 + 從 B 往上到共同祖先的代數
//   例如：A、B 是親兄弟姊妹（共同父母）→ distance = 1 + 1 = 2
//   例如：A 是 B 的父親 → 共同祖先就是 A 本身 → distance = 0 + 1 = 1
//
// 這個檔案不依賴 UI，可單獨被測試（見 tests/pedigreeService.test.js）。

// 注意：這裡刻意不在檔案頂端 import dogService / externalPedigreeService /
// confirmedRelationService，而是在實際呼叫 Firebase 版本函式時才動態 import。
// 原因：這幾個 service 會連帶載入 firebase-config.js（從 CDN 載入 Firebase SDK），
// 若寫在頂端 import，會導致 tests/pedigreeService.test.js 在 Node 環境下
// 無法單獨測試核心演算法（因為 Node 預設不支援 https:// 開頭的 import）。
// 這樣拆開後，核心演算法（checkPedigreeCompatibilityCore）可以完全不碰 Firebase。

// ------------------------------
// 可調整常數
// ------------------------------

/** 三代限制：血緣距離小於等於此值視為「限制內」 */
export const PEDIGREE_RESTRICTED_GENERATIONS = 3;

/**
 * 搜尋祖先時最多往上追溯幾代。
 * 需要 >= PEDIGREE_RESTRICTED_GENERATIONS 才能正確判斷是否落在限制範圍內。
 * 多留一代 buffer，方便未來驗證邊界時比對。
 */
export const MAX_SEARCH_DEPTH = PEDIGREE_RESTRICTED_GENERATIONS + 1;

// ------------------------------
// 狀態顯示與分類（給 UI 與 service 層共用，避免各處重複判斷、避免顯示英文 enum）
// ------------------------------

/** 血緣檢查狀態的中文顯示文字（舊版簡短標籤，保留給尚未改用 getPedigreePermission 的地方使用） */
export const PEDIGREE_STATUS_LABELS = {
  restricted: "三代內血緣限制，不可配",
  outside_restricted_generations: "已離開三代限制，可以配",
  no_known_relation: "查無已知血緣關聯，可以配",
  insufficient_data: "族譜資料不足，無法判定",
  confirmed_related_unknown_distance: "已人工確認有血緣，距離未知，需人工複核"
};

/**
 * 血緣權限的三種層級：
 *   blocked  - 禁止：確認三代內有血緣，遊戲規則明確禁止配狗
 *   warning  - 警告：不知道／無法完全確認，但「不知道」不代表「不能」，
 *              允許繼續操作，只是關鍵動作（完成配狗、建立子代）需要人工確認
 *   allowed  - 允許：血緣狀態明確沒有問題，全部正常
 */
export const PEDIGREE_LEVEL = {
  BLOCKED: "blocked",
  WARNING: "warning",
  ALLOWED: "allowed"
};

/**
 * 每個血緣檢查狀態對應的完整權限定義。
 *
 * 三種狀態的分類依據：
 *   restricted                          -> blocked：已確認三代內有血緣，遊戲規則禁止
 *   outside_restricted_generations       -> allowed：已離開三代限制，全部正常
 *   no_known_relation                    -> allowed：查無關聯，全部正常
 *   insufficient_data                    -> warning：祖先資料不足，「目前不知道」，不是「確認有血緣」
 *   confirmed_related_unknown_distance    -> warning：確認有親屬但不知道距離是否超過三代
 */
const PEDIGREE_PERMISSIONS = {
  restricted: {
    level: PEDIGREE_LEVEL.BLOCKED,
    canCreatePlan: false,
    canEditPlan: false,
    canSaveProgress: false,
    canCompletePlan: false,
    canCreateOffspring: false,
    requiresConfirmation: false,
    message: "三代內血緣限制，不可配",
    color: "red"
  },
  outside_restricted_generations: {
    level: PEDIGREE_LEVEL.ALLOWED,
    canCreatePlan: true,
    canEditPlan: true,
    canSaveProgress: true,
    canCompletePlan: true,
    canCreateOffspring: true,
    requiresConfirmation: false,
    message: "已離開三代限制，可以配",
    color: "green"
  },
  no_known_relation: {
    level: PEDIGREE_LEVEL.ALLOWED,
    canCreatePlan: true,
    canEditPlan: true,
    canSaveProgress: true,
    canCompletePlan: true,
    canCreateOffspring: true,
    requiresConfirmation: false,
    message: "查無已知血緣關聯，可以配",
    color: "green"
  },
  insufficient_data: {
    level: PEDIGREE_LEVEL.WARNING,
    canCreatePlan: true,
    canEditPlan: true,
    canSaveProgress: true,
    canCompletePlan: true,
    canCreateOffspring: true,
    requiresConfirmation: true,
    message: "⚠ 血緣資料不足，目前無法確認是否存在三代內血緣。",
    color: "yellow"
  },
  confirmed_related_unknown_distance: {
    level: PEDIGREE_LEVEL.WARNING,
    canCreatePlan: true,
    canEditPlan: true,
    canSaveProgress: true,
    canCompletePlan: true,
    canCreateOffspring: true,
    requiresConfirmation: true,
    message: "⚠ 已確認存在血緣關係，但目前無法判定是否超過限制代數。",
    color: "orange"
  }
};

/** 無法識別的狀態時的保守預設值（一律視為 blocked，避免未知狀態意外放行） */
const FALLBACK_PEDIGREE_PERMISSION = {
  level: PEDIGREE_LEVEL.BLOCKED,
  canCreatePlan: false,
  canEditPlan: false,
  canSaveProgress: false,
  canCompletePlan: false,
  canCreateOffspring: false,
  requiresConfirmation: false,
  message: "無法識別的血緣狀態，請重新檢查",
  color: "red"
};

/**
 * 取得某個血緣檢查狀態的完整權限物件。
 * 這是全站唯一判斷「這個血緣狀態可以做什麼」的地方，
 * UI 與 Service 都應該呼叫這裡，不要自己各自判斷 true/false。
 *
 * @param {string} status - checkPedigreeCompatibility() 回傳的 status
 * @returns {{
 *   status: string,
 *   level: "blocked"|"warning"|"allowed",
 *   canCreatePlan: boolean,
 *   canEditPlan: boolean,
 *   canSaveProgress: boolean,
 *   canCompletePlan: boolean,
 *   canCreateOffspring: boolean,
 *   requiresConfirmation: boolean,
 *   message: string,
 *   color: "green"|"yellow"|"orange"|"red"
 * }}
 */
export function getPedigreePermission(status) {
  const permission = PEDIGREE_PERMISSIONS[status] || FALLBACK_PEDIGREE_PERMISSION;
  return { status, ...permission };
}

/**
 * 這個血緣檢查狀態是否「完全允許」（不需要任何人工確認）。
 * 只有 level === "allowed" 才會是 true；warning 與 blocked 都是 false。
 *
 * @deprecated 大部分情境請改用 getPedigreePermission()，可以拿到更完整的
 *   warning / blocked 分級資訊。這個函式保留給只需要單純 true/false 判斷、
 *   且不需要區分 warning 的地方使用（維持與舊版相同的行為）。
 */
export function isPedigreeStatusAllowed(status) {
  return getPedigreePermission(status).level === PEDIGREE_LEVEL.ALLOWED;
}

// ------------------------------
// 內部工具：統一存取「狗」或「外部血統節點」
// ------------------------------

/**
 * 依 id 取得節點資料，不管是我的狗還是外部血統節點。
 * 回傳統一格式： { id, fatherId, motherId, isExternal }
 *
 * 這個函式被獨立出來（而不是寫死呼叫 Firebase），
 * 是為了讓核心演算法可以在測試時注入假資料，不需要真的連線 Firestore。
 */
async function getNodeByIdFromFirebase(id) {
  if (!id) return null;

  const { getDogById } = await import("../services/dogService.js");
  const { getExternalNodeById } = await import("../services/externalPedigreeService.js");

  const dog = await getDogById(id);
  if (dog) {
    return {
      id: dog.id,
      fatherId: dog.fatherId || null,
      motherId: dog.motherId || null,
      isExternal: false
    };
  }

  const externalNode = await getExternalNodeById(id);
  if (externalNode) {
    return {
      id: externalNode.id,
      fatherId: externalNode.fatherId || null,
      motherId: externalNode.motherId || null,
      isExternal: true
    };
  }

  return null;
}

/** Firebase 版本的人工確認血緣查詢（動態 import，理由同上） */
async function getConfirmedRelationFromFirebase(dogAId, dogBId) {
  const { getConfirmedRelationBetween } = await import("../services/confirmedRelationService.js");
  return getConfirmedRelationBetween(dogAId, dogBId);
}

/**
 * 從某隻狗開始，往上搜尋祖先，建立 { ancestorId: { depth, path } } 的 map。
 * depth 1 = 父母，depth 2 = 祖父母，以此類推。
 * 同時回傳 hasUnknown：搜尋範圍內是否有因父母未知而中斷的分支
 *（用來分辨「確定無關聯」跟「資料不足無法確定」）。
 */
async function buildAncestorMap(rootId, maxDepth, resolveNode) {
  const ancestorMap = new Map(); // ancestorId -> { depth, path: [rootId, ..., ancestorId] }
  let hasUnknown = false;

  async function walk(currentId, depth, path) {
    if (depth > maxDepth) return;

    const node = await resolveNode(currentId);
    if (!node) {
      hasUnknown = true;
      return;
    }

    const parentIds = [node.fatherId, node.motherId];

    for (const parentId of parentIds) {
      if (!parentId) {
        // 父或母未知，此分支無法再往上追溯
        hasUnknown = true;
        continue;
      }

      const parentDepth = depth + 1;
      const parentPath = [...path, parentId];

      // 記錄目前找到最短距離的路徑
      const existing = ancestorMap.get(parentId);
      if (!existing || parentDepth < existing.depth) {
        ancestorMap.set(parentId, { depth: parentDepth, path: parentPath });
      }

      if (parentDepth < maxDepth) {
        await walk(parentId, parentDepth, parentPath);
      }
    }
  }

  await walk(rootId, 0, [rootId]);

  return { ancestorMap, hasUnknown };
}

// ------------------------------
// 主要函式
// ------------------------------

/**
 * 血緣相容性檢查核心演算法（不依賴 Firebase，方便單元測試）
 * @param {string} dogAId
 * @param {string} dogBId
 * @param {(id: string) => Promise<{id, fatherId, motherId, isExternal}|null>} resolveNode - 節點解析函式
 * @param {(dogAId: string, dogBId: string) => Promise<object|null>} resolveConfirmedRelation - 人工確認血緣查詢函式
 * @returns {Promise<{status: string, distance: number|null, path: array|null, explanation: string}>}
 *
 * status 可能為：
 *   "restricted"                          - 血緣在三代限制內
 *   "outside_restricted_generations"       - 有血緣但已離開三代限制，可以配
 *   "no_known_relation"                    - 搜尋範圍內查無任何血緣關聯
 *   "insufficient_data"                    - 資料不足（父母未知），無法完全確定
 *   "confirmed_related_unknown_distance"   - 人工確認有血緣，但距離未知
 */
export async function checkPedigreeCompatibilityCore(dogAId, dogBId, resolveNode, resolveConfirmedRelation) {
  if (!dogAId || !dogBId) {
    return {
      status: "insufficient_data",
      distance: null,
      path: null,
      explanation: "缺少狗狗 ID，無法進行血緣檢查"
    };
  }

  if (dogAId === dogBId) {
    return {
      status: "restricted",
      distance: 0,
      path: [dogAId],
      explanation: "同一隻狗，無法與自己配對"
    };
  }

  // 1. 建立雙方祖先 map（含自己本身作為 depth 0，方便偵測直系關係）
  const [{ ancestorMap: mapA, hasUnknown: unknownA }, { ancestorMap: mapB, hasUnknown: unknownB }] =
    await Promise.all([
      buildAncestorMap(dogAId, MAX_SEARCH_DEPTH, resolveNode),
      buildAncestorMap(dogBId, MAX_SEARCH_DEPTH, resolveNode)
    ]);

  // 把自己也算進 map，這樣「A 是 B 的父母」這種直系狀況也能被找到共同節點
  mapA.set(dogAId, { depth: 0, path: [dogAId] });
  mapB.set(dogBId, { depth: 0, path: [dogBId] });

  // 2. 找出雙方共同的祖先節點，取距離最小的一個
  let closest = null; // { ancestorId, distance, pathA, pathB }

  for (const [ancestorId, infoA] of mapA.entries()) {
    if (mapB.has(ancestorId)) {
      const infoB = mapB.get(ancestorId);
      const distance = infoA.depth + infoB.depth;
      if (!closest || distance < closest.distance) {
        closest = {
          ancestorId,
          distance,
          pathA: infoA.path,
          pathB: infoB.path
        };
      }
    }
  }

  // 3. 同時查詢是否有人工確認的血緣關係
  const confirmedRelation = await resolveConfirmedRelation(dogAId, dogBId);

  if (closest) {
    const path = buildReadablePath(closest.pathA, closest.pathB);
    if (closest.distance <= PEDIGREE_RESTRICTED_GENERATIONS) {
      return {
        status: "restricted",
        distance: closest.distance,
        path,
        explanation: `找到共同血緣節點，距離為 ${closest.distance} 代，在三代限制範圍內`
      };
    }
    return {
      status: "outside_restricted_generations",
      distance: closest.distance,
      path,
      explanation: `找到共同血緣節點，距離為 ${closest.distance} 代，已離開三代限制範圍，可以配`
    };
  }

  // 4. 沒有從族譜找到共同祖先，但有人工確認血緣關係
  if (confirmedRelation) {
    return {
      status: "confirmed_related_unknown_distance",
      distance: null,
      path: null,
      explanation:
        "已人工確認此二隻狗存在血緣關係，但實際血統位置未知，僅針對這一對狗提示，不代表會延伸到子代"
    };
  }

  // 5. 沒找到共同祖先，且搜尋過程中有父母未知的情況 → 無法完全確定
  if (unknownA || unknownB) {
    return {
      status: "insufficient_data",
      distance: null,
      path: null,
      explanation: "搜尋範圍內部分祖先資料未知，無法完全確認是否有血緣關聯"
    };
  }

  // 6. 資料完整且搜尋範圍內查無任何關聯
  return {
    status: "no_known_relation",
    distance: null,
    path: null,
    explanation: "搜尋範圍內查無任何已知血緣關聯"
  };
}

/** 把兩條路徑合併成一條「A → ... → 共同祖先 → ... → B」的可讀路徑 */
function buildReadablePath(pathA, pathB) {
  const aToAncestor = [...pathA]; // [A, ..., ancestor]
  const ancestorToB = [...pathB].reverse().slice(1); // [ancestor(去掉重複), ..., B] -> 去掉 ancestor 重複
  return [...aToAncestor, ...ancestorToB];
}

/**
 * 檢查兩隻狗的血緣相容性（正式對外使用版本，直接連線 Firestore）
 * @param {string} dogAId
 * @param {string} dogBId
 */
export async function checkPedigreeCompatibility(dogAId, dogBId) {
  return checkPedigreeCompatibilityCore(
    dogAId,
    dogBId,
    getNodeByIdFromFirebase,
    getConfirmedRelationFromFirebase
  );
}

/**
 * 掃描指定的候選狗狗清單，回傳每隻狗與目標狗的血緣分類。
 * 用於「可回配提示」功能（第一版先提供 service，UI 骨架見 pages/pedigreeCheck.js）
 *
 * @param {string} targetDogId
 * @param {string[]} candidateDogIds
 */
export async function scanRebreedCandidates(targetDogId, candidateDogIds) {
  const results = [];
  for (const candidateId of candidateDogIds) {
    if (candidateId === targetDogId) continue;
    const result = await checkPedigreeCompatibility(targetDogId, candidateId);
    results.push({ candidateId, ...result });
  }
  return results;
}

/**
 * 循環檢查核心演算法（不依賴 Firebase，方便單元測試）
 * 詳細原理說明見下方 wouldCreateCycle。
 *
 * @param {string} dogId
 * @param {string} candidateParentId
 * @param {(id: string) => Promise<{id, fatherId, motherId}|null>} resolveNode
 * @param {number} maxDepth
 * @returns {Promise<boolean>}
 */
export async function wouldCreateCycleCore(dogId, candidateParentId, resolveNode, maxDepth = 20) {
  if (!dogId || !candidateParentId) return false;
  if (dogId === candidateParentId) return true; // 不能把自己設成自己的父母

  const { ancestorMap } = await buildAncestorMap(candidateParentId, maxDepth, resolveNode);
  return ancestorMap.has(dogId);
}

/**
 * 檢查「把 candidateParentId 設為 dogId 的父親／母親」是否會形成血緣循環（正式對外使用版本，直接連線 Firestore）。
 *
 * 原理：這個操作等於新增一條邊 candidateParentId → dogId（candidateParentId 是 dogId 的父/母）。
 * 如果 candidateParentId 本身已經是 dogId 的後代（也就是說，dogId 已經是 candidateParentId
 * 往上追溯的祖先之一），那麼加上這條邊就會形成循環（例如 A 的子代 B，若把 B 設為 A 的父親，
 * 等於 A 的祖先鏈裡有 B，而 B 的祖先鏈裡又有 A，兩者互為祖先，矛盾）。
 *
 * 這個檢查會沿著 candidateParentId 現有的父母鏈往上找最多 maxDepth 代，
 * 只要找到 dogId 就代表會形成循環。
 *
 * @param {string} dogId - 要被設定父母的狗（若是新增中、尚未存在的狗，可以傳 null，一定回傳 false）
 * @param {string} candidateParentId - 打算設為父親或母親的對象 id（狗或外部血統節點）
 * @param {number} maxDepth - 最多往上追溯幾代，預設 20（私人系統資料量不大，足夠涵蓋絕大多數情境）
 * @returns {Promise<boolean>} true 代表會形成循環，不應該允許這個設定
 */
export async function wouldCreateCycle(dogId, candidateParentId, maxDepth = 20) {
  return wouldCreateCycleCore(dogId, candidateParentId, getNodeByIdFromFirebase, maxDepth);
}
