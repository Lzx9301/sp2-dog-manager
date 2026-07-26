// ==================================================
// 配狗計畫 Service (breedingPlans collection)
// ==================================================

import { db } from "../firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  checkPedigreeCompatibility,
  getPedigreePermission,
  PEDIGREE_LEVEL
} from "../utils/pedigreeService.js";
import { predictOffspring } from "../utils/breedingPrediction.js";
import { canCompleteBreedingPlan } from "../utils/breedingPlanValidation.js";
import { getDogById } from "./dogService.js";

const COLLECTION_NAME = "breedingPlans";

/** 配狗計畫狀態常數（不要在 UI 寫死英文字串，一律從這裡取得對應中文） */
export const BREEDING_PLAN_STATUS = {
  PLANNED: "planned",
  INTERACTING: "interacting",
  LEVELING: "leveling",
  READY: "ready",
  COMPLETED: "completed",
  PAUSED: "paused",
  CANCELLED: "cancelled"
};

export const BREEDING_PLAN_STATUS_LABELS = {
  [BREEDING_PLAN_STATUS.PLANNED]: "預計配",
  [BREEDING_PLAN_STATUS.INTERACTING]: "互動中",
  [BREEDING_PLAN_STATUS.LEVELING]: "等待升級",
  [BREEDING_PLAN_STATUS.READY]: "準備完成",
  [BREEDING_PLAN_STATUS.COMPLETED]: "已完成",
  [BREEDING_PLAN_STATUS.PAUSED]: "暫停",
  [BREEDING_PLAN_STATUS.CANCELLED]: "取消"
};

export async function getBreedingPlanById(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, COLLECTION_NAME, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllBreedingPlans() {
  const snap = await getDocs(collection(db, COLLECTION_NAME));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getBreedingPlansByStatus(status) {
  const q = query(collection(db, COLLECTION_NAME), where("status", "==", status));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 取得某隻狗參與過的所有配狗計畫（用來推導伴侶、顯示配狗紀錄） */
export async function getBreedingPlansOfDog(dogId) {
  const [asA, asB] = await Promise.all([
    getDocs(query(collection(db, COLLECTION_NAME), where("dogAId", "==", dogId))),
    getDocs(query(collection(db, COLLECTION_NAME), where("dogBId", "==", dogId)))
  ]);

  const map = new Map();
  [...asA.docs, ...asB.docs].forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
  return Array.from(map.values());
}

/**
 * 推導某隻狗的伴侶清單（不儲存 partnerId，因為遊戲 bug 可能造成一狗多伴侶，這是正常情況）
 * @param {string} dogId
 * @returns {Promise<string[]>} 伴侶的 dogId 清單（不重複）
 */
export async function getPartnerIdsOf(dogId) {
  const plans = await getBreedingPlansOfDog(dogId);
  const partnerIds = new Set();

  plans.forEach((plan) => {
    if (plan.dogAId === dogId && plan.dogBId) partnerIds.add(plan.dogBId);
    if (plan.dogBId === dogId && plan.dogAId) partnerIds.add(plan.dogAId);
  });

  return Array.from(partnerIds);
}

/**
 * 建立新的配狗計畫
 *
 * 重要（血緣防呆，第二道防線）：
 * 即使呼叫端（UI）已經檢查過血緣、甚至按鈕本身被繞過，這裡都會「重新」執行一次
 * 血緣檢查。只有 blocked（restricted，已確認三代內有血緣）才會擋下、不寫入 Firestore。
 * warning（insufficient_data 資料不足 / confirmed_related_unknown_distance 確認有親屬
 * 但不知道距離）代表「目前不知道」，不等於「確認有血緣」，允許建立計畫（UI 端會在建立前
 * 跳一次警示讓使用者確認，但這裡的 Service 層本身不會因為 warning 狀態擋下建立）。
 * 不要只依賴 UI 的按鈕 disabled，那只是第一道防線（避免使用者誤按），
 * 真正擋住不合法資料的關卡在這裡。
 *
 * 重要（純種／混種預測防呆，同樣不信任前端）：
 * 這裡會重新從 Firestore 載入 dogA、dogB 的目前資料，重新呼叫全站共用的
 * predictOffspring()。即使呼叫端在 planData 裡傳了 offspringType / offspringLevel /
 * predictedPurity / prediction 之類的欄位，一律忽略，只採用這裡重新計算的結果。
 * 如果兩隻狗的純種／混種資料不完整或無效，直接擋下，不會建立任何資料。
 *
 * @throws {Error} 當血緣狀態是 blocked，或純種／混種預測無效時，錯誤訊息為中文，可直接顯示給使用者
 */
export async function createBreedingPlan(planData) {
  const pedigreeResult = await checkPedigreeCompatibility(planData.dogAId, planData.dogBId);
  const pedigreePermission = getPedigreePermission(pedigreeResult.status);

  if (pedigreePermission.level === PEDIGREE_LEVEL.BLOCKED) {
    const error = new Error(`無法建立配狗計畫：${pedigreePermission.message}${pedigreeResult.explanation}`);
    error.pedigreeStatus = pedigreeResult.status;
    throw error;
  }

  // 重新載入雙親目前的資料，重新呼叫共用預測函式（不信任 planData 裡任何預測相關欄位）
  const [dogA, dogB] = await Promise.all([getDogById(planData.dogAId), getDogById(planData.dogBId)]);
  const prediction = predictOffspring(dogA, dogB);

  if (!prediction.valid) {
    const error = new Error(`無法建立配狗計畫：${prediction.errorMessage}`);
    error.predictionErrorCode = prediction.errorCode;
    throw error;
  }

  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    dogAId: planData.dogAId,
    dogBId: planData.dogBId,
    status: planData.status || BREEDING_PLAN_STATUS.PLANNED,
    interactionProgress: planData.interactionProgress ?? 0,
    interactionTarget: planData.interactionTarget ?? null,
    dogALevelTarget: planData.dogALevelTarget ?? null,
    dogBLevelTarget: planData.dogBLevelTarget ?? null,
    // 相容欄位：舊架構讀取 predictedPurityMixDegree 的地方仍然能正常運作，
    // 但值一律來自這裡重新計算的結果，不使用前端傳入的舊欄位。
    predictedPurityMixDegree: prediction.offspringLevel,
    // 純種／混種預測快照：只作為「建立當下」的紀錄／顯示參考。
    // 配狗中心顯示時，仍會視需要用目前狗狗資料重新計算最新結果，不會永久相信這份舊快照。
    prediction: {
      offspringType: prediction.offspringType,
      offspringLevel: prediction.offspringLevel,
      calculation: {
        parentAType: prediction.parents.parentA.type,
        parentAOriginalLevel: prediction.parents.parentA.originalLevel,
        parentAUsedLevel: prediction.parents.parentA.usedLevel,
        parentBType: prediction.parents.parentB.type,
        parentBOriginalLevel: prediction.parents.parentB.originalLevel,
        parentBUsedLevel: prediction.parents.parentB.usedLevel
      },
      calculatedAt: now
    },
    // 血緣檢查快照：建立當下的檢查結果，只作為紀錄／顯示參考。
    // 注意：配狗中心與工作台顯示時，仍會針對進行中的計畫「即時重新檢查」，
    // 不會永久相信這裡存的舊快照（避免父母族譜之後變更導致誤判）。
    pedigreeStatus: pedigreeResult.status,
    pedigreeReason: pedigreeResult.explanation,
    pedigreeDistance: pedigreeResult.distance,
    pedigreeCheckedAt: now,
    notes: planData.notes || "",
    offspringCreated: false,
    createdAt: now,
    updatedAt: now,
    completedAt: null
  });

  return { id: docRef.id, ...planData, pedigreeStatus: pedigreeResult.status, prediction };
}

export async function updateBreedingPlan(id, partialData) {
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    ...partialData,
    updatedAt: new Date().toISOString()
  });
}

/**
 * 標記配狗計畫完成
 *
 * 血緣防呆（第二道防線，三層權限）：
 *   - blocked（restricted）：永遠擋下，不管有沒有傳 confirmPedigreeWarning
 *   - warning（insufficient_data / confirmed_related_unknown_distance）：
 *     必須明確傳入 { confirmPedigreeWarning: true } 才會繼續往下走；
 *     沒有傳的話會擋下並拋出「請再次確認後完成」的中文錯誤，讓 UI 端可以
 *     跳出確認對話框，使用者確認後再用 confirmPedigreeWarning: true 重新呼叫一次。
 *     這裡刻意不自己彈出確認視窗——Service 層不做 UI 互動，跳確認是 UI 的責任，
 *     Service 只負責「沒有明確確認就不能通過」。
 *   - allowed：直接繼續，不需要任何確認
 *
 * 純種／混種預測防呆（同樣不信任任何舊快照）：完成計畫前會重新從 Firestore
 * 載入 dogA、dogB「目前」的資料，重新呼叫 predictOffspring()。如果預測資料
 * 無效（型別缺失、數值缺失或無效），一樣擋下並拋出中文錯誤，不會標記完成。
 * 所有檢查都通過後，才會真的標記完成，並同步把最新的 prediction 快照存回去
 * （predictedPurityMixDegree 等相容欄位也一併更新，來源是同一個新計算結果）。
 *
 * @param {string} id
 * @param {{confirmPedigreeWarning?: boolean}} options
 * @throws {Error} 未通過檢查時拋出中文錯誤；err.needsConfirmation === true 代表
 *   這是「warning 需要使用者確認」，而不是真的失敗，UI 可以依此決定要跳確認對話框
 *   還是單純顯示錯誤。
 */
export async function completeBreedingPlan(id, options = {}) {
  const { confirmPedigreeWarning = false } = options;

  const plan = await getBreedingPlanById(id);
  if (!plan) throw new Error("找不到指定的配狗計畫");

  const [pedigreeResult, dogA, dogB] = await Promise.all([
    checkPedigreeCompatibility(plan.dogAId, plan.dogBId),
    getDogById(plan.dogAId),
    getDogById(plan.dogBId)
  ]);
  const prediction = predictOffspring(dogA, dogB);

  const decision = canCompleteBreedingPlan(pedigreeResult, prediction, { confirmPedigreeWarning });
  if (!decision.allowed) {
    const error = new Error(
      decision.needsConfirmation ? decision.message : `無法標記完成：${decision.message}`
    );
    error.needsConfirmation = decision.needsConfirmation;
    throw error;
  }

  const now = new Date().toISOString();
  await updateBreedingPlan(id, {
    status: BREEDING_PLAN_STATUS.COMPLETED,
    completedAt: now,
    // 完成時同步更新最新預測快照，不相信計畫建立當下的舊快照
    predictedPurityMixDegree: prediction.offspringLevel,
    prediction: {
      offspringType: prediction.offspringType,
      offspringLevel: prediction.offspringLevel,
      calculation: {
        parentAType: prediction.parents.parentA.type,
        parentAOriginalLevel: prediction.parents.parentA.originalLevel,
        parentAUsedLevel: prediction.parents.parentA.usedLevel,
        parentBType: prediction.parents.parentB.type,
        parentBOriginalLevel: prediction.parents.parentB.originalLevel,
        parentBUsedLevel: prediction.parents.parentB.usedLevel
      },
      calculatedAt: now
    },
    pedigreeStatus: pedigreeResult.status,
    pedigreeReason: pedigreeResult.explanation,
    pedigreeDistance: pedigreeResult.distance,
    pedigreeCheckedAt: now
  });
}

export async function deleteBreedingPlan(id) {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}
