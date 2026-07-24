// ==================================================
// 人工確認血緣 Service (confirmedRelations collection)
// ==================================================
// 用於記錄「父母未知，但事後透過遊戲測試等方式人工確認有血緣關係」的兩隻狗。
// 這個關係是雙向的：A-B 與 B-A 視為同一筆關係。
// 注意：只對這一對狗本身生效，不會自動延伸判斷到牠們的子代。

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

const COLLECTION_NAME = "confirmedRelations";

export async function getAllConfirmedRelations() {
  const snap = await getDocs(collection(db, COLLECTION_NAME));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * 查詢 A、B 之間是否已有人工確認的血緣關係（雙向比對）
 * @returns {Promise<object|null>}
 */
export async function getConfirmedRelationBetween(dogAId, dogBId) {
  if (!dogAId || !dogBId) return null;

  const q1 = query(
    collection(db, COLLECTION_NAME),
    where("dogAId", "==", dogAId),
    where("dogBId", "==", dogBId)
  );
  const q2 = query(
    collection(db, COLLECTION_NAME),
    where("dogAId", "==", dogBId),
    where("dogBId", "==", dogAId)
  );

  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

  const doc1 = snap1.docs[0];
  const doc2 = snap2.docs[0];
  const found = doc1 || doc2;

  return found ? { id: found.id, ...found.data() } : null;
}

/**
 * 新增人工確認血緣關係
 * @param {{dogAId: string, dogBId: string, source?: string, notes?: string}} data
 */
export async function createConfirmedRelation({ dogAId, dogBId, source = "", notes = "" }) {
  // 避免重複建立同一對關係
  const existing = await getConfirmedRelationBetween(dogAId, dogBId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    dogAId,
    dogBId,
    relationType: "confirmed_related",
    source,
    notes,
    createdAt: now
  });

  return { id: docRef.id, dogAId, dogBId, relationType: "confirmed_related", source, notes };
}

export async function deleteConfirmedRelation(id) {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}
