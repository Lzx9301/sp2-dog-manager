// ==================================================
// ID 產生器
// ==================================================
// 負責產生「永久唯一」的編號，例如 Dog ID： DOG-000001
// 使用 Firestore 的 counters collection 記錄目前流水號，
// 用 transaction 確保多次新增不會撞號。

import { db } from "../firebase-config.js";
import {
  doc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * 產生下一個流水號並回傳格式化後的 ID 字串
 * @param {string} counterName - counters collection 中的文件 id，例如 "dog"
 * @param {string} prefix - ID 前綴，例如 "DOG"
 * @param {number} padLength - 數字補零長度，預設 6
 * @returns {Promise<string>} 例如 "DOG-000001"
 */
export async function generateSequentialId(counterName, prefix, padLength = 6) {
  const counterRef = doc(db, "counters", counterName);

  const nextValue = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    let current = 0;
    if (counterSnap.exists()) {
      current = counterSnap.data().value || 0;
    }
    const next = current + 1;
    transaction.set(counterRef, { value: next }, { merge: true });
    return next;
  });

  const padded = String(nextValue).padStart(padLength, "0");
  return `${prefix}-${padded}`;
}

/** 產生下一個 Dog ID，例如 DOG-000001 */
export function generateDogId() {
  return generateSequentialId("dog", "DOG", 6);
}

/** 產生一般文件用的隨機字串 ID（給不需要人類可讀編號的 collection 使用，例如 log、plan） */
export function generateRandomId(prefixLength = 8) {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 2 + prefixLength)
  );
}
