// ==================================================
// 帳號詳細頁 (account-detail.html)
// ==================================================
import { requireLogin } from "../services/authService.js";
import { renderNav } from "../components/nav.js";
import { openModal, confirmModal } from "../components/modal.js";
import { getAccountById, updateAccount, deactivateAccount, reactivateAccount } from "../services/accountService.js";
import { getDogsByAccountId } from "../services/dogService.js";
import { getMovementLogsOfAccount } from "../services/movementLogService.js";
import { GENDER_LABELS } from "../utils/constants.js";

await requireLogin();
renderNav("accounts.html");

const params = new URLSearchParams(window.location.search);
const accountId = params.get("id");

let account = null;
let dogsInAccount = [];

async function loadAccount() {
  account = await getAccountById(accountId);
  if (!account) {
    document.getElementById("account-title").textContent = "找不到這個帳號";
    return;
  }

  document.getElementById("account-title").textContent = account.accountName || "（未命名帳號）";
  document.getElementById("toggle-active-btn").textContent = account.isActive === false ? "重新啟用" : "停用";

  renderBasicSection();
  await loadDogs();
  await renderMovementLogsSection();
}

function renderBasicSection() {
  document.getElementById("section-basic").innerHTML = `
    <div><strong>顯示名稱：</strong>${account.accountName || "（無）"}</div>
    <div><strong>登入帳號：</strong>${account.loginAccount || "（無）"}</div>
    <div><strong>登入密碼：</strong>${account.password || "（無）"}</div>
    <div><strong>門號：</strong>${account.phone || "（無）"}</div>
    <div><strong>錢：</strong>${account.money ?? "（無）"}</div>
    <div><strong>骨：</strong>${account.bones ?? "（無）"}</div>
    <div><strong>備註：</strong>${account.notes || "（無）"}</div>
    <div><strong>狀態：</strong>${account.isActive === false ? "已停用" : "啟用中"}</div>
  `;
}

async function loadDogs() {
  dogsInAccount = await getDogsByAccountId(accountId);
  document.getElementById("dog-count").textContent = dogsInAccount.length;
  renderDogList(dogsInAccount);
}

function renderDogList(dogs) {
  const listEl = document.getElementById("section-dogs");
  listEl.innerHTML = "";

  if (dogs.length === 0) {
    listEl.innerHTML = `<div class="empty-state">這個帳號目前沒有狗</div>`;
    return;
  }

  dogs.forEach((dog) => {
    const card = document.createElement("div");
    card.className = "card dog-card";
    card.innerHTML = `
      <div class="dog-name">${dog.name}</div>
      <div class="dog-meta">
        <span class="tag tag-gender-${dog.gender}">${GENDER_LABELS[dog.gender] || "未設定"}</span>
        Lv.${dog.level ?? "-"}
      </div>
    `;
    card.addEventListener("click", () => (window.location.href = `dog-detail.html?id=${dog.id}`));
    listEl.appendChild(card);
  });
}

async function renderMovementLogsSection() {
  const logs = await getMovementLogsOfAccount(accountId);
  const el = document.getElementById("section-movement-logs");

  if (logs.length === 0) {
    el.innerHTML = `<div class="empty-state">目前沒有移動紀錄</div>`;
    return;
  }

  el.innerHTML = logs
    .map(
      (log) => `
      <div style="padding:6px 0; border-bottom:1px solid var(--color-border);">
        ${new Date(log.movedAt).toLocaleString("zh-TW")}：
        ${log.toAccountId === accountId ? "移入" : "移出"}
        ${log.notes ? `<div class="dog-meta">${log.notes}</div>` : ""}
      </div>
    `
    )
    .join("");
}

function openEditModal() {
  const { close, el } = openModal({
    title: "編輯帳號資料",
    contentHtml: `
      <div class="form-group"><label>顯示名稱</label><input type="text" id="e-name" value="${account.accountName || ""}" /></div>
      <div class="form-group"><label>登入帳號</label><input type="text" id="e-login-account" value="${account.loginAccount || ""}" /></div>
      <div class="form-group"><label>登入密碼</label><input type="text" id="e-password" value="${account.password || ""}" /></div>
      <div class="form-group"><label>門號</label><input type="text" id="e-phone" value="${account.phone || ""}" /></div>
      <div class="form-row">
        <div class="form-group"><label>錢</label><input type="number" id="e-money" value="${account.money ?? ""}" /></div>
        <div class="form-group"><label>骨</label><input type="number" id="e-bones" value="${account.bones ?? ""}" /></div>
      </div>
      <div class="form-group"><label>備註</label><textarea id="e-notes">${account.notes || ""}</textarea></div>
      <div id="e-error" style="color:#b3543f; font-size:13px;"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">取消</button>
        <button type="button" class="btn btn-primary" data-action="save">儲存</button>
      </div>
    `,
    onMount: (modalEl, close) => {
      modalEl.querySelector('[data-action="cancel"]').addEventListener("click", close);
      modalEl.querySelector('[data-action="save"]').addEventListener("click", async () => {
        const password = modalEl.querySelector("#e-password").value.trim();
        if (!password) {
          modalEl.querySelector("#e-error").textContent = "登入密碼為必填欄位";
          return;
        }
        try {
          await updateAccount(accountId, {
            accountName: modalEl.querySelector("#e-name").value.trim(),
            loginAccount: modalEl.querySelector("#e-login-account").value.trim(),
            password,
            phone: modalEl.querySelector("#e-phone").value.trim(),
            money: modalEl.querySelector("#e-money").value ? Number(modalEl.querySelector("#e-money").value) : null,
            bones: modalEl.querySelector("#e-bones").value ? Number(modalEl.querySelector("#e-bones").value) : null,
            notes: modalEl.querySelector("#e-notes").value.trim()
          });
          close();
          await loadAccount();
        } catch (err) {
          modalEl.querySelector("#e-error").textContent = "儲存失敗，請稍後再試";
          console.error(err);
        }
      });
    }
  });
}

document.getElementById("edit-btn").addEventListener("click", openEditModal);

document.getElementById("toggle-active-btn").addEventListener("click", async () => {
  const isCurrentlyActive = account.isActive !== false;
  const message = isCurrentlyActive
    ? "停用後，此帳號不會出現在新增／移動狗狗的選單中，但會保留所有歷史資料。確定要停用嗎？"
    : "確定要重新啟用這個帳號嗎？";
  const confirmed = await confirmModal(message);
  if (!confirmed) return;

  if (isCurrentlyActive) {
    await deactivateAccount(accountId);
  } else {
    await reactivateAccount(accountId);
  }
  await loadAccount();
});

document.getElementById("dog-search-input").addEventListener("input", (e) => {
  const keyword = e.target.value.trim().toLowerCase();
  const filtered = keyword
    ? dogsInAccount.filter((d) => (d.name || "").toLowerCase().includes(keyword))
    : dogsInAccount;
  renderDogList(filtered);
});

await loadAccount();
