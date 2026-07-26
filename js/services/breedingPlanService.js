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
  isPedigreeStatusAllowed,
  PEDIGREE_STATUS_LABELS
} from "../utils/pedigreeService.js";

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
 * 血緣檢查，只有 outside_restricted_generations / no_known_relation 這類允許配狗的
 * 狀態才會真的寫入 Firestore。restricted（三代內）與 insufficient_data（資料不足）
 * 一律擋下並拋出錯誤，不會建立任何資料。
 * 不要只依賴 UI 的按鈕 disabled，那只是第一道防線（避免使用者誤按），
 * 真正擋住不合法資料的關卡在這裡。
 *
 * @throws {Error} 當血緣檢查結果不允許配狗時，錯誤訊息為中文，可直接顯示給使用者
 */
export async function createBreedingPlan(planData) {
  const pedigreeResult = await checkPedigreeCompatibility(planData.dogAId, planData.dogBId);

  if (!isPedigreeStatusAllowed(pedigreeResult.status)) {
    const label = PEDIGREE_STATUS_LABELS[pedigreeResult.status] || pedigreeResult.status;
    const error = new Error(`無法建立配狗計畫：${label}。${pedigreeResult.explanation}`);
    error.pedigreeStatus = pedigreeResult.status;
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
    predictedPurityMixDegree: planData.predictedPurityMixDegree ?? null,
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

  return { id: docRef.id, ...planData, pedigreeStatus: pedigreeResult.status };
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
 * 同樣加上血緣防呆（第二道防線）：即使計畫先前建立時是合法的，
 * 如果父母族譜後來有變化導致現在重新檢查變成不允許配狗的狀態，
 * 這裡會擋下「標記完成」這個動作，避免產生不合法的完成紀錄。
 */
export async function completeBreedingPlan(id) {
  const plan = await getBreedingPlanById(id);
  if (!plan) throw new Error("找不到指定的配狗計畫");

  const pedigreeResult = await checkPedigreeCompatibility(plan.dogAId, plan.dogBId);
  if (!isPedigreeStatusAllowed(pedigreeResult.status)) {
    const label = PEDIGREE_STATUS_LABELS[pedigreeResult.status] || pedigreeResult.status;
    throw new Error(`無法標記完成：${label}。這筆配狗計畫的血緣狀態不允許配狗，請改為取消或刪除這筆計畫。`);
  }

  await updateBreedingPlan(id, {
    status: BREEDING_PLAN_STATUS.COMPLETED,
    completedAt: new Date().toISOString()
  });
}

export async function deleteBreedingPlan(id) {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}
