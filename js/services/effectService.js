// ==================================================
// 特效 Service (effects collection)
// ==================================================
// 特效清單（有哪些特效可選）不寫死，透過這個 service 管理。
//
// 特效「數量規則」（純種最多幾個、混種最多幾個）統一定義在
// js/utils/effectValidation.js，這裡只 re-export 方便既有程式碼引用，
// 不要在這裡重複定義規則。

import { db } from "../firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { EFFECT_LIMIT_BY_DOG_TYPE, getMaxEffectsForDogType, validateDogEffects } from "../utils/effectValidation.js";

const COLLECTION_NAME = "effects";

// 特效數量規則的唯一事實來源在 effectValidation.js，這裡只轉出給既有呼叫端使用
export { EFFECT_LIMIT_BY_DOG_TYPE, getMaxEffectsForDogType, validateDogEffects };

/**
 * @deprecated 特效數量規則現在依 dogType 而不同（純種 3 個、混種 1 個），
 *   不再是單一常數。請改用 getMaxEffectsForDogType(dogType) 或
 *   validateDogEffects(dogType, effects)。這裡保留純種的上限值，
 *   避免尚未更新的舊程式碼直接報錯。
 */
export const MAX_EFFECTS_PER_DOG = EFFECT_LIMIT_BY_DOG_TYPE.pure;

export async function getEffectById(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, COLLECTION_NAME, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllEffects() {
  const snap = await getDocs(collection(db, COLLECTION_NAME));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createEffect({ name }) {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    name,
    createdAt: now,
    updatedAt: now
  });
  return { id: docRef.id, name };
}

export async function updateEffect(id, partialData) {
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    ...partialData,
    updatedAt: new Date().toISOString()
  });
}

export async function deleteEffect(id) {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

/**
 * @deprecated 沒有考慮 dogType，會誤用純種的上限判斷混種。
 *   請改用 validateDogEffects(dogType, effectIds).valid。
 */
export function isValidEffectSelection(effectIds) {
  return Array.isArray(effectIds) && effectIds.length <= MAX_EFFECTS_PER_DOG;
}
