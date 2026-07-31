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
import { getDogById, getAllDogs } from "../services/dogService.js";
import { checkPedigreeCompatibility, getPedigreePermission, PEDIGREE_LEVEL } from "../utils/pedigreeService.js";
import { predictOffspring } from "../utils/breedingPrediction.js";
import { resolveParentRoles } from "../utils/parentRoleResolver.js";
import { resolveEffectiveOffspringIds } from "../utils/offspringPlan.js";

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

  // 「進行中」的計畫（尚未完成也尚未取消）在顯示於工作台前，一律即時重新檢查血緣狀態。
  // 重要：只有 blocked（restricted，已確認三代內有血緣）才會從工作台隱藏。
  // warning（insufficient_data 資料不足 / confirmed_related_unknown_distance 確認有親屬
  // 但不知道距離）代表「目前不知道」，不等於「確認有血緣」，這種計畫仍然正常顯示在工作台，
  // 只是會附上一個小提示，讓你知道之後完成/新增子代時需要人工確認。
  const activeStatusSet = new Set([
    BREEDING_PLAN_STATUS.PLANNED,
    BREEDING_PLAN_STATUS.INTERACTING,
    BREEDING_PLAN_STATUS.LEVELING,
    BREEDING_PLAN_STATUS.READY,
    BREEDING_PLAN_STATUS.PAUSED
  ]);
  const activePlans = plans.filter((p) => activeStatusSet.has(p.status));

  const pedigreePermissionByPlanId = new Map();
  const validActivePlans = [];
  for (const plan of activePlans) {
    const pedigreeResult = await checkPedigreeCompatibility(plan.dogAId, plan.dogBId);
    const permission = getPedigreePermission(pedigreeResult.status);
    pedigreePermissionByPlanId.set(plan.id, permission);
    if (permission.level !== PEDIGREE_LEVEL.BLOCKED) {
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

  // 已完成但還沒新增子代：completed 狀態，且「實際子代清單」為空。
  // 重要：不能只看 offspringCreated 這個舊版布林欄位——同一個已完成計畫現在可以
  // 建立多隻子代，offspringIds 才是主要依據；且必須沿用跟 breeding.js 完全相同的
  // 舊資料恢復邏輯（resolveEffectiveOffspringIds），否則舊計畫（只有 offspringCreated=true、
  // 沒存過 dogId）會被誤判成「還沒有子代」而重複出現在這個區塊。
  const allDogs = await getAllDogs();
  const pendingOffspringPlans = [];
  for (const plan of plans.filter((p) => p.status === BREEDING_PLAN_STATUS.COMPLETED)) {
    const [dogA, dogB] = await Promise.all([getDogById(plan.dogAId), getDogById(plan.dogBId)]);
    const parentRoles = resolveParentRoles(dogA, dogB);
    const effectiveOffspringIds = resolveEffectiveOffspringIds(plan, parentRoles, allDogs);
    if (effectiveOffspringIds.length === 0) {
      pendingOffspringPlans.push(plan);
    }
  }

  await renderPlanCards("dashboard-interacting", interactingPlans, renderInteractingCard, pedigreePermissionByPlanId);
  await renderPlanCards("dashboard-leveling", levelingPlans, renderLevelingCard, pedigreePermissionByPlanId);
  await renderPlanCards("dashboard-ready", readyPlans, renderReadyCard, pedigreePermissionByPlanId);
  await renderPlanCards("dashboard-completed", completedPlans, renderSimplePlanCard);
  await renderPlanCards("dashboard-pending-offspring", pendingOffspringPlans, renderSimplePlanCard);
}

/** 血緣 warning 狀態的小提示（黃色／橘色文字），level 是 allowed 或未提供時不顯示任何東西 */
function renderPedigreeWarningNote(permission) {
  if (!permission || permission.level !== PEDIGREE_LEVEL.WARNING) return "";
  return `<div class="pedigree-warning-note pedigree-warning-note-${permission.color}">${permission.message}</div>`;
}

async function renderPlanCards(containerId, plans, cardRenderer, pedigreePermissionByPlanId = null) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (plans.length === 0) {
    container.innerHTML = `<div class="empty-state">目前沒有項目</div>`;
    return;
  }

  for (const plan of plans) {
    const [dogA, dogB] = await Promise.all([getDogById(plan.dogAId), getDogById(plan.dogBId)]);
    const permission = pedigreePermissionByPlanId ? pedigreePermissionByPlanId.get(plan.id) : null;
    const cardEl = document.createElement("div");
    cardEl.className = "card";
    cardEl.innerHTML = await cardRenderer(plan, dogA, dogB, permission);
    container.appendChild(cardEl);
  }
}

function pairLabel(dogA, dogB) {
  return `${dogA ? dogA.name : "未知"} × ${dogB ? dogB.name : "未知"}`;
}

async function renderInteractingCard(plan, dogA, dogB, permission) {
  const progress = plan.interactionProgress || 0;
  const target = plan.interactionTarget || 0;
  const percent = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0;

  return `
    <div class="dog-name">${pairLabel(dogA, dogB)}</div>
    <div class="dog-meta">互動 ${progress} / ${target}</div>
    <div class="progress-bar"><div class="progress-bar-fill" style="width:${percent}%"></div></div>
    ${renderPedigreeWarningNote(permission)}
  `;
}

async function renderLevelingCard(plan, dogA, dogB, permission) {
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
    ${renderPedigreeWarningNote(permission)}
  `;
}

async function renderReadyCard(plan, dogA, dogB, permission) {
  const prediction = predictOffspring(dogA, dogB);
  const predictionLine = prediction.valid
    ? `下一代：${prediction.displayLabel}`
    : `純種／混種資料不足，無法預測`;
  const pedigreeLine = permission && permission.level === PEDIGREE_LEVEL.WARNING ? permission.message : "血緣：通過";

  return `
    <div class="dog-name">${pairLabel(dogA, dogB)}</div>
    <div class="dog-meta">
      ${pedigreeLine}<br/>
      互動：完成<br/>
      等級：完成<br/>
      ${predictionLine}
    </div>
    <a class="btn btn-primary btn-small" href="breeding.html?planId=${plan.id}" style="margin-top:8px; display:inline-block;">前往配狗中心</a>
  `;
}

async function renderSimplePlanCard(plan, dogA, dogB) {
  return `
    <div class="dog-name">${pairLabel(dogA, dogB)}</div>
    <div class="dog-meta"><span class="tag tag-status-${plan.status}">${BREEDING_PLAN_STATUS_LABELS[plan.status] || plan.status}</span></div>
  `;
}
