// ==================================================
// 圖案 Service (patterns collection)
// ==================================================
// 混種狗 (dogType === "mixed") 使用「圖案」欄位。
// 因為原始資料中，相同圖案可能有不同名稱，
// 所以每個圖案都有：
//   canonicalName - 正式名稱
//   aliases[]     - 別名清單
// 搜尋任何 alias 都要能找到對應的正式圖案。
//
// 祝福系統第一版不實作，這裡只預留欄位結構，不影響現有邏輯。

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

const COLLECTION_NAME = "patterns";

export async function getPatternById(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, COLLECTION_NAME, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllPatterns() {
  const snap = await getDocs(collection(db, COLLECTION_NAME));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * 建立新圖案
 * @param {{canonicalName: string, aliases?: string[]}} data
 */
export async function createPattern({ canonicalName, aliases = [] }) {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    canonicalName,
    aliases,
    // 祝福系統欄位預留，第一版不使用，未來擴充用
    blessing: null,
    createdAt: now,
    updatedAt: now
  });
  return { id: docRef.id, canonicalName, aliases };
}

export async function updatePattern(id, partialData) {
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    ...partialData,
    updatedAt: new Date().toISOString()
  });
}

export async function deletePattern(id) {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

/** 新增別名到現有圖案（合併別名時使用） */
export async function addAliasToPattern(id, newAlias) {
  const pattern = await getPatternById(id);
  if (!pattern) throw new Error("找不到指定圖案");

  const aliases = new Set(pattern.aliases || []);
  aliases.add(newAlias);

  await updatePattern(id, { aliases: Array.from(aliases) });
}

/**
 * 依關鍵字搜尋圖案（同時比對正式名稱與所有別名）
 * @param {string} keyword
 */
export async function searchPatterns(keyword) {
  const all = await getAllPatterns();
  const lower = keyword.trim().toLowerCase();
  if (!lower) return all;

  return all.filter((pattern) => {
    const names = [pattern.canonicalName, ...(pattern.aliases || [])];
    return names.some((name) => String(name).toLowerCase().includes(lower));
  });
}
