// ==================================================
// 認證 Service (Firebase Authentication)
// ==================================================
// 這個網站主要為私人使用，採用 Email/Password 登入方式。
// 使用前請先到 Firebase 主控台 → Authentication → Sign-in method
// 開啟「電子郵件/密碼」登入方式，並手動建立你自己的帳號。

import { auth } from "../firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export async function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  return signOut(auth);
}

/**
 * 監聽登入狀態變化。回傳取消監聽的函式。
 * @param {(user: object|null) => void} callback
 */
export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

/** 取得目前登入使用者（同步，可能在初始化完成前為 null） */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * 頁面保護 helper：如果未登入，導向登入頁。
 * 在每個需要登入才能看的頁面最上面呼叫這個函式。
 */
export function requireLogin(redirectTo = "index.html") {
  return new Promise((resolve) => {
    const unsubscribe = watchAuthState((user) => {
      unsubscribe();
      if (!user) {
        window.location.href = redirectTo;
        resolve(null);
      } else {
        resolve(user);
      }
    });
  });
}
