// ==================================================
// Firebase 初始化設定
// ==================================================
// 請將以下設定換成你自己 Firebase 專案的設定值
// (Firebase 主控台 → 專案設定 → 一般 → 你的應用程式 → SDK 設定與程式碼)
//
// 這個檔案是整個系統唯一需要填寫 Firebase 金鑰的地方，
// 其他所有 service / utility 都只從這裡 import 已初始化好的 db / auth 物件。

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// TODO: 換成你自己的 Firebase 專案設定
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);

// 提供給整個系統共用的 db 與 auth 實例
export const db = getFirestore(app);
export const auth = getAuth(app);
