// ==================================================
// 狗狗 Service (dogs collection)
// ==================================================
// 封裝所有跟「狗狗」資料有關的 Firestore 存取邏輯。
// UI 層（pages/dogs.js, pages/dogDetail.js）只呼叫這裡的函式，
// 不應該直接寫 Firestore 查詢語法。

import { db } from "../firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { generateDogId } from "../utils/idGenerator.js";
import { validateDogEffects } from "../utils/effectValidation.js";

const COLLECTION_NAME = "dogs";

/** 取得單一狗狗資料，找不到回傳 null（不會 throw） */
export async function getDogById(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, COLLECTION_NAME, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** 取得所有狗狗（私人系統，資料量預期不會大到需要分頁，先簡單全撈） */
export async function getAllDogs() {
  const snap = await getDocs(collection(db, COLLECTION_NAME));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 依帳號 id 取得該帳號底下所有狗狗 */
export async function getDogsByAccountId(accountId) {
  const q = query(collection(db, COLLECTION_NAME), where("accountId", "==", accountId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 依父或母 id 取得子代列表 */
export async function getChildrenOf(dogId) {
  const [asFather, asMother] = await Promise.all([
    getDocs(query(collection(db, COLLECTION_NAME), where("fatherId", "==", dogId))),
    getDocs(query(collection(db, COLLECTION_NAME), where("motherId", "==", dogId)))
  ]);

  const map = new Map();
  [...asFather.docs, ...asMother.docs].forEach((d) => {
    map.set(d.id, { id: d.id, ...d.data() });
  });
  return Array.from(map.values());
}

/**
 * 依一組父母取得兩者共同子代。
 * 先查父方所有子代再以前端過濾 motherId，避免 Firestore 複合索引需求。
 * 用於相容舊版：舊版建立子代時只寫 offspringCreated，沒有保存 offspringId。
 */
export async function getChildrenByParents(fatherId, motherId) {
  if (!fatherId || !motherId) return [];
  const snap = await getDocs(query(collection(db, COLLECTION_NAME), where("fatherId", "==", fatherId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((dog) => dog.motherId === motherId);
}

/**
 * 新增狗狗
 * @param {object} dogData - 不含 id / createdAt / updatedAt，這裡自動處理
 * @throws {Error} 特效數量不符規則時（純種超過 3 個／混種超過 1 個）拋出中文錯誤，
 *   不信任前端傳入的 effects，這裡是第二層防呆
 */
export async function createDog(dogData) {
  const normalized = normalizeDogData(dogData);

  const effectsCheck = validateDogEffects(normalized.dogType, normalized.effects);
  if (!effectsCheck.valid) {
    throw new Error(effectsCheck.errorMessage);
  }
  normalized.effects = effectsCheck.correctedEffects;

  const dogId = await generateDogId();
  const now = new Date().toISOString();

  const docRef = doc(db, COLLECTION_NAME, dogId);
  const fullData = {
    ...normalized,
    createdAt: now,
    updatedAt: now
  };

  await setDoc(docRef, fullData);
  return { id: dogId, ...fullData };
}

/**
 * 更新狗狗資料（局部更新）
 * @throws {Error} 若這次更新同時包含 dogType 與 effects，且不符合特效數量規則，
 *   拋出中文錯誤（只有兩者都出現在這次更新時才驗證，避免單獨更新其他欄位
 *   時因為沒有 dogType 上下文而誤判）
 */
export async function updateDog(id, partialData) {
  const normalized = normalizeDogData(partialData, { partial: true });

  if (normalized.dogType !== undefined && normalized.effects !== undefined) {
    const effectsCheck = validateDogEffects(normalized.dogType, normalized.effects);
    if (!effectsCheck.valid) {
      throw new Error(effectsCheck.errorMessage);
    }
    normalized.effects = effectsCheck.correctedEffects;
  }

  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    ...normalized,
    updatedAt: new Date().toISOString()
  });
}

/** 刪除狗狗（謹慎使用，通常建議用「移動」或標記取代刪除） */
export async function deleteDog(id) {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

/**
 * 將表單資料整理成標準格式，避免 undefined 欄位寫入 Firestore
 */
function normalizeDogData(data, { partial = false } = {}) {
  const result = { ...data };

  // 陣列型欄位如果沒填，預設空陣列（新增時才給預設值，避免 partial update 蓋掉既有資料）
  if (!partial) {
    result.memorialTags = result.memorialTags || [];
    result.effects = result.effects || []; // 純種特效，最多 3 個
    result.notes = result.notes || "";
    result.fatherId = result.fatherId || null;
    result.motherId = result.motherId || null;
    result.birthDate = result.birthDate || null;
    // 來源金額：完整編輯表單新增的欄位，選填，沒填就是 null（不是 0，避免跟「免費取得」混淆）
    result.sourceAmount = result.sourceAmount ?? null;
    // 嘴型來源品種：只有「嘴」圖案的混種狗才需要，其餘一律 null（不是缺欄位，是明確不適用）
    result.mouthSourceBreedId = result.mouthSourceBreedId || null;
  }

  return result;
}

/**
 * 全域狗狗搜尋（第一版：抓全部資料後在前端做關鍵字比對，
 * 私人系統資料量不大，先求正確好維護，之後資料量大了再優化成 Firestore 索引查詢）
 * @param {string} keyword
 * @param {object} filters - { accountId, breedId, gender, dogType, series, memorialTag }
 */
export async function searchDogs(keyword = "", filters = {}) {
  const allDogs = await getAllDogs();
  const lowerKeyword = keyword.trim().toLowerCase();

  return allDogs.filter((dog) => {
    if (filters.accountId && dog.accountId !== filters.accountId) return false;
    if (filters.breedId && dog.breedId !== filters.breedId) return false;
    if (filters.gender && dog.gender !== filters.gender) return false;
    if (filters.dogType && dog.dogType !== filters.dogType) return false;
    if (filters.series && dog.series !== filters.series) return false;
    if (filters.memorialTag && !(dog.memorialTags || []).includes(filters.memorialTag)) return false;

    if (!lowerKeyword) return true;

    const searchableFields = [
      dog.name,
      dog.series,
      dog.sourcePerson,
      dog.notes,
      ...(dog.memorialTags || [])
    ];

    return searchableFields
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(lowerKeyword));
  });
}

/** 彙整目前所有狗狗使用過的系列名稱（給 autocomplete 使用） */
export async function getDistinctSeriesList() {
  const allDogs = await getAllDogs();
  const set = new Set();
  allDogs.forEach((dog) => {
    if (dog.series) set.add(dog.series);
  });
  return Array.from(set).sort();
}

/** 彙整目前所有狗狗使用過的紀念標籤（給 autocomplete 與篩選使用） */
export async function getDistinctMemorialTags() {
  const allDogs = await getAllDogs();
  const set = new Set();
  allDogs.forEach((dog) => {
    (dog.memorialTags || []).forEach((tag) => set.add(tag));
  });
  return Array.from(set).sort();
}

// 注意：狗狗的「伴侶」清單不儲存在 dogs collection 裡，
// 而是由 breedingPlanService.getPartnerIdsOf() 從 breedingPlans 動態推導，
// 因為遊戲存在 bug，一隻狗可能有多個伴侶。請直接呼叫 breedingPlanService，
// 這裡不 re-export，避免兩個 service 互相 import 造成循環相依。
