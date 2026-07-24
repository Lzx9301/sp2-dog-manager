// ==================================================
// 特效 Service (effects collection)
// ==================================================
// 純種狗 (dogType === "pure") 可以選最多 3 個特效。
// 特效清單不寫死，透過這個 service 管理。

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

const COLLECTION_NAME = "effects";

/** 純種狗最多可選特效數量（獨立常數，不寫死在 UI） */
export const MAX_EFFECTS_PER_DOG = 3;

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

/** 驗證選擇的特效數量是否合法（給表單驗證使用） */
export function isValidEffectSelection(effectIds) {
  return Array.isArray(effectIds) && effectIds.length <= MAX_EFFECTS_PER_DOG;
}
