// ==================================================
// 品種 Service (breeds collection)
// ==================================================
// 目前遊戲約有 21 種品種，第一版不寫死名稱，
// 全部透過這個 service + 系統設定頁面管理。

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
  orderBy,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const COLLECTION_NAME = "breeds";

export async function getBreedById(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, COLLECTION_NAME, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** 取得全部品種（依 sortOrder 排序） */
export async function getAllBreeds() {
  const q = query(collection(db, COLLECTION_NAME), orderBy("sortOrder", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 取得啟用中的品種（給新增／編輯狗狗的選單使用） */
export async function getActiveBreeds() {
  const all = await getAllBreeds();
  return all.filter((b) => b.isActive !== false);
}

export async function createBreed({ name, sortOrder }) {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    name,
    sortOrder: sortOrder ?? 999,
    isActive: true,
    createdAt: now,
    updatedAt: now
  });
  return { id: docRef.id, name, sortOrder, isActive: true };
}

export async function updateBreed(id, partialData) {
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    ...partialData,
    updatedAt: new Date().toISOString()
  });
}

export async function deactivateBreed(id) {
  await updateBreed(id, { isActive: false });
}

export async function deleteBreed(id) {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}
