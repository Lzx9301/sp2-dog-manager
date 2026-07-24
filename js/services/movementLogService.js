// ==================================================
// 狗狗移動紀錄 Service (movementLogs collection)
// ==================================================
// 狗狗在帳號之間移動時，除了更新 dogs.accountId，
// 還要建立一筆 movementLogs 紀錄，保留完整歷史。

import { db } from "../firebase-config.js";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDogById, updateDog } from "./dogService.js";

const COLLECTION_NAME = "movementLogs";

/**
 * 將狗狗移動到另一個帳號（會同時更新 dogs.accountId 並建立 movementLogs）
 * @param {string} dogId
 * @param {string} toAccountId
 * @param {string} notes
 */
export async function moveDogToAccount(dogId, toAccountId, notes = "") {
  const dog = await getDogById(dogId);
  if (!dog) throw new Error("找不到指定狗狗");

  const fromAccountId = dog.accountId || null;
  const now = new Date().toISOString();

  await updateDog(dogId, { accountId: toAccountId });

  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    dogId,
    fromAccountId,
    toAccountId,
    movedAt: now,
    notes
  });

  return { id: docRef.id, dogId, fromAccountId, toAccountId, movedAt: now, notes };
}

/** 取得某隻狗的完整移動歷史（狗狗詳細頁使用） */
export async function getMovementLogsOfDog(dogId) {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("dogId", "==", dogId),
    orderBy("movedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 取得某帳號最近的移入／移出紀錄（帳號詳細頁使用） */
export async function getMovementLogsOfAccount(accountId, limitCount = 20) {
  const [inLogs, outLogs] = await Promise.all([
    getDocs(query(collection(db, COLLECTION_NAME), where("toAccountId", "==", accountId))),
    getDocs(query(collection(db, COLLECTION_NAME), where("fromAccountId", "==", accountId)))
  ]);

  const all = [...inLogs.docs, ...outLogs.docs].map((d) => ({ id: d.id, ...d.data() }));
  all.sort((a, b) => new Date(b.movedAt) - new Date(a.movedAt));
  return all.slice(0, limitCount);
}
