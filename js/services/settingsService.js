// ==================================================
// 系統設定 Service (settings collection)
// ==================================================
// 用於存放不屬於品種／特效／圖案的其他系統設定值。
// 目前先提供通用 get/set，之後有新設定需求可以直接沿用，不需要改架構。

import { db } from "../firebase-config.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const COLLECTION_NAME = "settings";

/** 取得指定設定值，例如 getSetting("pedigreeRestrictedGenerations") */
export async function getSetting(key, defaultValue = null) {
  const snap = await getDoc(doc(db, COLLECTION_NAME, key));
  return snap.exists() ? snap.data().value : defaultValue;
}

/** 寫入指定設定值 */
export async function setSetting(key, value) {
  await setDoc(doc(db, COLLECTION_NAME, key), {
    value,
    updatedAt: new Date().toISOString()
  });
}
