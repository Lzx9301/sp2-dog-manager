// ==================================================
// 共用常數
// ==================================================
// 這裡放的是「規則穩定、選項固定」的小型列舉。
// 品種、特效、圖案、帳號、系列這種會持續擴充的資料，
// 一律走 Firestore collection + service，不要放在這裡。

export const GENDER_LABELS = {
  male: "公",
  female: "母"
};

export const DOG_TYPE_LABELS = {
  pure: "純種",
  mixed: "混種"
};

export const SOURCE_TYPE_LABELS = {
  purchase: "購買",
  exchange: "交換",
  gift: "贈送",
  self_bred: "自己接生",
  other: "其他"
};
