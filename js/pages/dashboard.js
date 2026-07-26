// ==================================================
// 工作台頁面 (index.html)
// ==================================================
import { watchAuthState, login } from "../services/authService.js";
import { renderNav } from "../components/nav.js";
import {
  getAllBreedingPlans,
  BREEDING_PLAN_STATUS,
  BREEDING_PLAN_STATUS_LABELS
} from "../services/breedingPlanService.js";
import { getDogById } from "../services/dogService.js";
import { checkPedigreeCompatibility, isPedigreeStatusAllowed } from "../utils/pedigreeService.js";

const loginScreen = document.getElementById("login-screen");
const mainScreen = document.getElementById("main-screen");

// ---------- 登入流程 ----------

watchAuthState((user) => {
  if (user) {
    loginScreen.style.display = "none";
    mainScreen.style.display = "block";
    renderNav("index.html");
    loadDashboard();
  } else {
    loginScreen.style.display = "block";
    mainScreen.style.display = "none";
  }
});

document.getElementById("login-btn").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  errorEl.textContent = "";

  try {
    await login(email, password);
  } catch (err) {
    errorEl.textContent = "登入失敗，請確認帳號密碼是否正確";
    console.error(err);
  }
});

// ---------- 工作台資料彙整 ----------

async function loadDashboard() {
  const plans = await getAllBreedingPlans();

  // 「進行中」的計畫（尚未完成也尚未取消）在顯示於工作台前，
  // 一律即時重新檢查血緣狀態，restricted / insufficient_data 等不允許配狗的
  // 計畫直接從工作台隱藏（不出現在待互動/待練等/準備完成任何區塊），
  // 只會出現在「配狗中心」並標示為無效計畫，讓你去處理（取消或刪除）。
  const activeStatusSet = new Set([
    BREEDING_PLAN_STATUS.PLANNED,
    BREEDING_PLAN_STATUS.INTERACTING,
    BREEDING_PLAN_STATUS.LEVELING,
    BREEDING_PLAN_STATUS.READY,
    BREEDING_PLAN_STATUS.PAUSED
  ]);
  const activePlans = plans.filter((p) => activeStatusSet.has(p.status));

  const validActivePlans = [];
  for (const plan of activePlans) {
    const pedigreeResult = await checkPedigreeCompatibility(plan.dogAId, plan.dogBId);
    if (isPedigreeStatusAllowed(pedigreeResult.status)) {
      validActivePlans.push(plan);
    }
  }

  const interactingPlans = validActivePlans.filter((p) => p.status === BREEDING_PLAN_STATUS.INTERACTING);
  const levelingPlans = validActivePlans.filter((p) => p.status === BREEDING_PLAN_STATUS.LEVELING);
  const readyPlans = validActivePlans.filter((p) => p.status === BREEDING_PLAN_STATUS.READY);
  const completedPlans = plans
    .filter((p) => p.status === BREEDING_PLAN_STATUS.COMPLETED)
    .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0))
    .slice(0, 6);
  // 已完成但還沒新增子代：completed 狀態，且沒有任何狗的 fatherId/motherId 對應此配對
  // 第一版先用簡單標記：plan.offspringCreated 欄位（新增子代流程完成後應設為 true）
  const pendingOffspringPlans = plans.filter(
    (p) => p.status === BREEDING_PLAN_STATUS.COMPLETED && !p.offspringCreated
  );

  await renderPlanCards("dashboard-interacting", interactingPlans, renderInteractingCard);
  await renderPlanCards("dashboard-leveling", levelingPlans, renderLevelingCard);
  await renderPlanCards("dashboard-ready", readyPlans, renderReadyCard);
  await renderPlanCards("dashboard-completed", completedPlans, renderSimplePlanCard);
  await renderPlanCards("dashboard-pending-offspring", pendingOffspringPlans, renderSimplePlanCard);
}

async function renderPlanCards(containerId, plans, cardRenderer) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (plans.length === 0) {
    container.innerHTML = `<div class="empty-state">目前沒有項目</div>`;
    return;
  }

  for (const plan of plans) {
    const [dogA, dogB] = await Promise.all([getDogById(plan.dogAId), getDogById(plan.dogBId)]);
    const cardEl = document.createElement("div");
    cardEl.className = "card";
    cardEl.innerHTML = await cardRenderer(plan, dogA, dogB);
    container.appendChild(cardEl);
  }
}

function pairLabel(dogA, dogB) {
  return `${dogA ? dogA.name : "未知"} × ${dogB ? dogB.name : "未知"}`;
}

async function renderInteractingCard(plan) {
  const [dogA, dogB] = await Promise.all([getDogById(plan.dogAId), getDogById(plan.dogBId)]);
  const progress = plan.interactionProgress || 0;
  const target = plan.interactionTarget || 0;
  const percent = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0;

  return `
    <div class="dog-name">${pairLabel(dogA, dogB)}</div>
    <div class="dog-meta">互動 ${progress} / ${target}</div>
    <div class="progress-bar"><div class="progress-bar-fill" style="width:${percent}%"></div></div>
  `;
}

async function renderLevelingCard(plan) {
  const [dogA, dogB] = await Promise.all([getDogById(plan.dogAId), getDogById(plan.dogBId)]);
  const lines = [];
  if (plan.dogALevelTarget) {
    lines.push(`${dogA ? dogA.name : "未知"}：Lv.${dogA?.level ?? "?"} / Lv.${plan.dogALevelTarget}`);
  }
  if (plan.dogBLevelTarget) {
    lines.push(`${dogB ? dogB.name : "未知"}：Lv.${dogB?.level ?? "?"} / Lv.${plan.dogBLevelTarget}`);
  }
  return `
    <div class="dog-name">${pairLabel(dogA, dogB)}</div>
    <div class="dog-meta">${lines.join("<br/>") || "尚未設定等級目標"}</div>
  `;
}

async function renderReadyCard(plan) {
  const [dogA, dogB] = await Promise.all([getDogById(plan.dogAId), getDogById(plan.dogBId)]);
  return `
    <div class="dog-name">${pairLabel(dogA, dogB)}</div>
    <div class="dog-meta">
      血緣：通過<br/>
      互動：完成<br/>
      等級：完成
    </div>
    <a class="btn btn-primary btn-small" href="breeding.html?planId=${plan.id}" style="margin-top:8px; display:inline-block;">前往配狗中心</a>
  `;
}

async function renderSimplePlanCard(plan) {
  const [dogA, dogB] = await Promise.all([getDogById(plan.dogAId), getDogById(plan.dogBId)]);
  return `
    <div class="dog-name">${pairLabel(dogA, dogB)}</div>
    <div class="dog-meta"><span class="tag tag-status-${plan.status}">${BREEDING_PLAN_STATUS_LABELS[plan.status] || plan.status}</span></div>
  `;
}
