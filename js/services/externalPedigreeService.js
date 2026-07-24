// ==================================================
// 外部血統節點 Service (externalPedigreeNodes collection)
// ==================================================
// 用於記錄「不屬於我帳號」但需要被血緣追蹤的狗（買來/換來/別人贈送，父母未知的上層來源）。
// 這些節點：
//   - 不屬於任何帳號
//   - 不出現在「我的狗狗」列表
//   - 只供血統追蹤使用（pedigreeService 會一併查詢這個 collection）

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

const COLLECTION_NAME = "externalPedigreeNodes";

export async function getExternalNodeById(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, COLLECTION_NAME, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllExternalNodes() {
  const snap = await getDocs(collection(db, COLLECTION_NAME));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * 建立外部血統節點
 * @param {{name: string, fatherId?: string|null, motherId?: string|null, notes?: string}} data
 */
export async function createExternalNode({ name, fatherId = null, motherId = null, notes = "" }) {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    name,
    fatherId,
    motherId,
    notes,
    createdAt: now,
    updatedAt: now
  });
  return { id: docRef.id, name, fatherId, motherId, notes };
}

export async function updateExternalNode(id, partialData) {
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    ...partialData,
    updatedAt: new Date().toISOString()
  });
}

export async function deleteExternalNode(id) {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}
