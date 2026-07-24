// ==================================================
// 帳號管理頁面 (accounts.html)
// ==================================================
import { requireLogin } from "../services/authService.js";
import { renderNav } from "../components/nav.js";
import { openModal } from "../components/modal.js";
import { getAllDogs } from "../services/dogService.js";
import { getAllAccounts, createAccount } from "../services/accountService.js";

await requireLogin();
renderNav("accounts.html");

let accounts = [];
let dogCountByAccount = new Map();

async function loadAccounts() {
  const [allAccounts, allDogs] = await Promise.all([getAllAccounts(), getAllDogs()]);
  accounts = allAccounts;

  dogCountByAccount = new Map();
  allDogs.forEach((dog) => {
    if (!dog.accountId) return;
    dogCountByAccount.set(dog.accountId, (dogCountByAccount.get(dog.accountId) || 0) + 1);
  });

  renderAccountList();
}

function renderAccountList() {
  const keyword = document.getElementById("search-input").value.trim().toLowerCase();
  const showInactive = document.getElementById("show-inactive").checked;

  const filtered = accounts.filter((a) => {
    if (!showInactive && a.isActive === false) return false;
    if (!keyword) return true;
    return [a.accountName, a.loginAccount, a.phone, a.notes]
      .filter(Boolean)
      .some((f) => String(f).toLowerCase().includes(keyword));
  });

  const listEl = document.getElementById("account-list");
  listEl.innerHTML = "";

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state">沒有符合條件的帳號</div>`;
    return;
  }

  filtered.forEach((account) => {
    const card = document.createElement("div");
    card.className = "card dog-card";
    card.innerHTML = `
      <div class="dog-name">${account.accountName || "（未命名帳號）"} ${
        account.isActive === false ? '<span class="tag" style="background:#eee;">已停用</span>' : ""
      }</div>
      <div class="dog-meta">
        登入帳號：${account.loginAccount || "（無）"}<br/>
        門號：${account.phone || "（無）"}<br/>
        狗狗數量：${dogCountByAccount.get(account.id) || 0}
      </div>
    `;
    card.addEventListener("click", () => {
      window.location.href = `account-detail.html?id=${account.id}`;
    });
    listEl.appendChild(card);
  });
}

function openAddAccountModal() {
  const { close, el } = openModal({
    title: "新增帳號",
    contentHtml: `
      <div class="form-group"><label>顯示名稱</label><input type="text" id="a-name" /></div>
      <div class="form-group"><label>登入帳號（選填）</label><input type="text" id="a-login-account" /></div>
      <div class="form-group"><label>登入密碼（必填）</label><input type="text" id="a-password" /></div>
      <div class="form-row">
        <div class="form-group"><label>門號（選填）</label><input type="text" id="a-phone" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>錢（選填）</label><input type="number" id="a-money" /></div>
        <div class="form-group"><label>骨（選填）</label><input type="number" id="a-bones" /></div>
      </div>
      <div class="form-group"><label>備註</label><textarea id="a-notes"></textarea></div>
      <div id="a-error" style="color:#b3543f; font-size:13px;"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">取消</button>
        <button type="button" class="btn btn-primary" data-action="save">儲存</button>
      </div>
    `,
    onMount: (modalEl, close) => {
      modalEl.querySelector('[data-action="cancel"]').addEventListener("click", close);
      modalEl.querySelector('[data-action="save"]').addEventListener("click", async () => {
        const errorEl = modalEl.querySelector("#a-error");
        const password = modalEl.querySelector("#a-password").value.trim();
        if (!password) {
          errorEl.textContent = "登入密碼為必填欄位";
          return;
        }
        try {
          await createAccount({
            accountName: modalEl.querySelector("#a-name").value.trim(),
            loginAccount: modalEl.querySelector("#a-login-account").value.trim(),
            password,
            phone: modalEl.querySelector("#a-phone").value.trim(),
            money: modalEl.querySelector("#a-money").value ? Number(modalEl.querySelector("#a-money").value) : null,
            bones: modalEl.querySelector("#a-bones").value ? Number(modalEl.querySelector("#a-bones").value) : null,
            notes: modalEl.querySelector("#a-notes").value.trim(),
            isActive: true
          });
          close();
          await loadAccounts();
        } catch (err) {
          errorEl.textContent = "儲存失敗，請稍後再試";
          console.error(err);
        }
      });
    }
  });
}

document.getElementById("add-account-btn").addEventListener("click", openAddAccountModal);
document.getElementById("search-input").addEventListener("input", renderAccountList);
document.getElementById("show-inactive").addEventListener("change", renderAccountList);

await loadAccounts();
