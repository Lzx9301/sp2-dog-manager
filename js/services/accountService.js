// ==================================================
// 帳號 Service (accounts collection)
// ==================================================
// 帳號是「資源容器」，與狗狗資料完全分開。
// 只有 password 是必填欄位。

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

const COLLECTION_NAME = "accounts";

export async function getAccountById(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, COLLECTION_NAME, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllAccounts() {
  const snap = await getDocs(collection(db, COLLECTION_NAME));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 取得目前啟用中的帳號（給新增／移動狗狗的下拉選單使用） */
export async function getActiveAccounts() {
  const q = query(collection(db, COLLECTION_NAME), where("isActive", "==", true));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createAccount(accountData) {
  if (!accountData.password) {
    throw new Error("帳號密碼為必填欄位");
  }

  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    accountName: accountData.accountName || "",
    password: accountData.password,
    phone: accountData.phone || "",
    money: accountData.money ?? null,
    bones: accountData.bones ?? null,
    notes: accountData.notes || "",
    isActive: accountData.isActive ?? true,
    createdAt: now,
    updatedAt: now
  });

  return { id: docRef.id, ...accountData };
}

export async function updateAccount(id, partialData) {
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    ...partialData,
    updatedAt: new Date().toISOString()
  });
}

/** 停用帳號（建議用這個取代刪除，保留歷史資料與狗狗移動紀錄） */
export async function deactivateAccount(id) {
  await updateAccount(id, { isActive: false });
}

export async function reactivateAccount(id) {
  await updateAccount(id, { isActive: true });
}

/** 真的刪除帳號文件（謹慎使用；一般情境建議用停用） */
export async function deleteAccount(id) {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}
