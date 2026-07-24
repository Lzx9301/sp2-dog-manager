// ==================================================
// 共用導覽列元件
// ==================================================
import { logout } from "../services/authService.js";

const NAV_ITEMS = [
  { href: "index.html", label: "工作台" },
  { href: "dogs.html", label: "狗狗管理" },
  { href: "accounts.html", label: "帳號管理" },
  { href: "breeding.html", label: "配狗中心" },
  { href: "pedigree-check.html", label: "血緣檢查" },
  { href: "settings.html", label: "系統設定" }
];

/**
 * 渲染頂部導覽列
 * @param {string} activeHref - 目前頁面的檔名，用來標示 active 樣式
 */
export function renderNav(activeHref) {
  const navEl = document.getElementById("app-nav");
  if (!navEl) return;

  const linksHtml = NAV_ITEMS.map(
    (item) =>
      `<a href="${item.href}" class="${item.href === activeHref ? "active" : ""}">${item.label}</a>`
  ).join("");

  navEl.innerHTML = `
    <span class="brand">🐕 狗狗資源管理</span>
    ${linksHtml}
    <button class="logout-btn" id="nav-logout-btn">登出</button>
  `;

  const logoutBtn = document.getElementById("nav-logout-btn");
  logoutBtn.addEventListener("click", async () => {
    await logout();
    window.location.href = "index.html";
  });
}
