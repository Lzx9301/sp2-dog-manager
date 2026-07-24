// ==================================================
// Firebase 初始化設定
// ==================================================
// 請將以下設定換成你自己 Firebase 專案的設定值
// (Firebase 主控台 → 專案設定 → 一般 → 你的應用程式 → SDK 設定與程式碼)
//
// 這個檔案是整個系統唯一需要填寫 Firebase 金鑰的地方，
// 其他所有 service / utility 都只從這裡 import 已初始化好的 db / auth 物件。

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBPzbxoy2wWj6yIj8gZH0KIHF3eD0wP2DQ",
  authDomain: "sp2-dog-manager.firebaseapp.com",
  projectId: "sp2-dog-manager",
  storageBucket: "sp2-dog-manager.firebasestorage.app",
  messagingSenderId: "290852803002",
  appId: "1:290852803002:web:4a40ab9df6378cb35a0d83",
  measurementId: "G-VLRK6T3M83",
};

const app = initializeApp(firebaseConfig);

// 提供給整個系統共用的 db 與 auth 實例
export const db = getFirestore(app);
export const auth = getAuth(app);
