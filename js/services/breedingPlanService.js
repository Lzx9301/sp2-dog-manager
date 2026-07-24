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
 * 呼叫端應先做過血緣檢查與純／混度計算，這裡只負責儲存結果
 */
export async function createBreedingPlan(planData) {
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
    pedigreeCheckResult: planData.pedigreeCheckResult ?? null,
    notes: planData.notes || "",
    createdAt: now,
    updatedAt: now,
    completedAt: null
  });

  return { id: docRef.id, ...planData };
}

export async function updateBreedingPlan(id, partialData) {
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    ...partialData,
    updatedAt: new Date().toISOString()
  });
}

/** 標記配狗計畫完成 */
export async function completeBreedingPlan(id) {
  await updateBreedingPlan(id, {
    status: BREEDING_PLAN_STATUS.COMPLETED,
    completedAt: new Date().toISOString()
  });
}

export async function deleteBreedingPlan(id) {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}
