// ==================================================
// 配狗中心頁面 (breeding.html)
// ==================================================
import { requireLogin } from "../services/authService.js";
import { renderNav } from "../components/nav.js";
import { openModal, confirmModal } from "../components/modal.js";
import { attachAutocomplete, attachTagInput } from "../components/autocomplete.js";
import {
  getAllBreedingPlans,
  updateBreedingPlan,
  completeBreedingPlan,
  BREEDING_PLAN_STATUS,
  BREEDING_PLAN_STATUS_LABELS
} from "../services/breedingPlanService.js";
import { getDogById, createDog, getDistinctSeriesList, getDistinctMemorialTags } from "../services/dogService.js";
import { getActiveAccounts } from "../services/accountService.js";
import { getActiveBreeds } from "../services/breedService.js";
import { getAllEffects, MAX_EFFECTS_PER_DOG } from "../services/effectService.js";
import { getAllPatterns } from "../services/patternService.js";

await requireLogin();
renderNav("breeding.html");

let plans = [];
let accounts = [];
let breeds = [];
let effects = [];
let patterns = [];
let seriesList = [];
let memorialTags = [];

async function loadReferenceData() {
  [accounts, breeds, effects, patterns, seriesList, memorialTags] = await Promise.all([
    getActiveAccounts(),
    getActiveBreeds(),
    getAllEffects(),
    getAllPatterns(),
    getDistinctSeriesList(),
    getDistinctMemorialTags()
  ]);
}

async function loadPlans() {
  plans = await getAllBreedingPlans();
  renderPlanList();
}

function renderPlanList() {
  const statusFilter = document.getElementById("filter-status").value;
  const filtered = statusFilter ? plans.filter((p) => p.status === statusFilter) : plans;

  const listEl = document.getElementById("plan-list");
  listEl.innerHTML = "";

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state">目前沒有配狗計畫</div>`;
    return;
  }

  filtered.forEach((plan) => renderPlanCard(plan, listEl));
}

async function renderPlanCard(plan, listEl) {
  const card = document.createElement("div");
  card.className = "card";
  listEl.appendChild(card);

  const [dogA, dogB] = await Promise.all([getDogById(plan.dogAId), getDogById(plan.dogBId)]);

  const canAddOffspring = plan.status === BREEDING_PLAN_STATUS.COMPLETED && !plan.offspringCreated;

  card.innerHTML = `
    <div class="page-header" style="margin-bottom:8px;">
      <div class="dog-name">${dogA ? dogA.name : "未知"} × ${dogB ? dogB.name : "未知"}</div>
      <span class="tag tag-status-${plan.status}">${BREEDING_PLAN_STATUS_LABELS[plan.status] || plan.status}</span>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>互動進度</label>
        <div style="display:flex; gap:6px;">
          <input type="number" class="plan-progress" value="${plan.interactionProgress ?? 0}" />
          <span style="align-self:center;">/</span>
          <input type="number" class="plan-target" value="${plan.interactionTarget ?? 0}" />
        </div>
      </div>
      <div class="form-group">
        <label>${dogA ? dogA.name : "A"} 等級目標</label>
        <input type="number" class="plan-level-a" value="${plan.dogALevelTarget ?? ""}" />
      </div>
      <div class="form-group">
        <label>${dogB ? dogB.name : "B"} 等級目標</label>
        <input type="number" class="plan-level-b" value="${plan.dogBLevelTarget ?? ""}" />
      </div>
    </div>

    <div class="dog-meta">
      血緣判斷：${plan.pedigreeCheckResult || "（未檢查）"}　
      預計下一代純／混度：${plan.predictedPurityMixDegree ?? "-"}
    </div>

    <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
      <button class="btn btn-secondary btn-small plan-save-btn">儲存進度</button>
      <select class="plan-status-select">
        ${Object.entries(BREEDING_PLAN_STATUS_LABELS)
          .map(([value, label]) => `<option value="${value}" ${plan.status === value ? "selected" : ""}>${label}</option>`)
          .join("")}
      </select>
      ${canAddOffspring ? `<button class="btn btn-primary btn-small plan-add-offspring-btn">新增子代</button>` : ""}
    </div>
  `;

  card.querySelector(".plan-save-btn").addEventListener("click", async () => {
    await updateBreedingPlan(plan.id, {
      interactionProgress: Number(card.querySelector(".plan-progress").value) || 0,
      interactionTarget: Number(card.querySelector(".plan-target").value) || 0,
      dogALevelTarget: card.querySelector(".plan-level-a").value ? Number(card.querySelector(".plan-level-a").value) : null,
      dogBLevelTarget: card.querySelector(".plan-level-b").value ? Number(card.querySelector(".plan-level-b").value) : null
    });
    await loadPlans();
  });

  card.querySelector(".plan-status-select").addEventListener("change", async (e) => {
    const newStatus = e.target.value;
    if (newStatus === BREEDING_PLAN_STATUS.COMPLETED) {
      await completeBreedingPlan(plan.id);
    } else {
      await updateBreedingPlan(plan.id, { status: newStatus });
    }
    await loadPlans();
  });

  const offspringBtn = card.querySelector(".plan-add-offspring-btn");
  if (offspringBtn) {
    offspringBtn.addEventListener("click", () => openAddOffspringModal(plan, dogA, dogB));
  }
}

function openAddOffspringModal(plan, dogA, dogB) {
  const accountOptions = accounts.map((a) => `<option value="${a.id}">${a.accountName}</option>`).join("");
  const breedOptions = breeds.map((b) => `<option value="${b.id}">${b.name}</option>`).join("");
  const effectCheckboxes = effects
    .map((e) => `<label style="margin-right:10px;"><input type="checkbox" class="o-effect" value="${e.id}" />${e.name}</label>`)
    .join("");
  const patternOptions = patterns.map((p) => `<option value="${p.id}">${p.canonicalName}</option>`).join("");
  const today = new Date().toISOString().slice(0, 10);

  const { close, el } = openModal({
    title: "新增子代",
    contentHtml: `
      <div class="dog-meta" style="margin-bottom:10px;">
        父：${dogA ? dogA.name : "未知"}　母：${dogB ? dogB.name : "未知"}<br/>
        自動帶入純／混度：${plan.predictedPurityMixDegree ?? "-"}
      </div>

      <div class="form-row">
        <div class="form-group"><label>名稱</label><input type="text" id="o-name" /></div>
        <div class="form-group"><label>系列</label><input type="text" id="o-series" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>所在帳號</label><select id="o-account"><option value="">（未指定）</option>${accountOptions}</select></div>
        <div class="form-group"><label>品種</label><select id="o-breed"><option value="">（未設定）</option>${breedOptions}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>性別</label>
          <select id="o-gender"><option value="male">公</option><option value="female">母</option></select>
        </div>
        <div class="form-group">
          <label>純種／混種</label>
          <select id="o-dogtype"><option value="pure">純種</option><option value="mixed">混種</option></select>
        </div>
      </div>
      <div class="form-group" id="o-effects-group"><label>特效（最多 ${MAX_EFFECTS_PER_DOG}）</label>${effectCheckboxes}</div>
      <div class="form-group" id="o-pattern-group" style="display:none;"><label>圖案</label><select id="o-pattern"><option value="">（未設定）</option>${patternOptions}</select></div>
      <div class="form-group"><label>生日</label><input type="date" id="o-birthdate" value="${today}" /></div>
      <div class="form-group">
        <label>紀念標籤</label>
        <div id="o-tag-chips"></div>
        <input type="text" id="o-tag-input" placeholder="輸入後按 Enter" />
      </div>
      <div class="form-group"><label>備註</label><textarea id="o-notes"></textarea></div>
      <div id="o-error" style="color:#b3543f; font-size:13px;"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">取消</button>
        <button type="button" class="btn btn-primary" data-action="save">建立子代</button>
      </div>
    `,
    onMount: (modalEl) => {
      attachAutocomplete(modalEl.querySelector("#o-series"), seriesList);
      const tagController = attachTagInput(
        modalEl.querySelector("#o-tag-chips"),
        modalEl.querySelector("#o-tag-input"),
        memorialTags
      );

      const dogTypeSelect = modalEl.querySelector("#o-dogtype");
      const effectsGroup = modalEl.querySelector("#o-effects-group");
      const patternGroup = modalEl.querySelector("#o-pattern-group");
      dogTypeSelect.addEventListener("change", () => {
        const isPure = dogTypeSelect.value === "pure";
        effectsGroup.style.display = isPure ? "block" : "none";
        patternGroup.style.display = isPure ? "none" : "block";
      });

      modalEl.querySelector('[data-action="cancel"]').addEventListener("click", close);
      modalEl.querySelector('[data-action="save"]').addEventListener("click", async () => {
        const errorEl = modalEl.querySelector("#o-error");
        const name = modalEl.querySelector("#o-name").value.trim();
        if (!name) {
          errorEl.textContent = "請輸入名稱";
          return;
        }

        const dogType = dogTypeSelect.value;
        const selectedEffectIds = Array.from(modalEl.querySelectorAll(".o-effect:checked")).map((cb) => cb.value);
        if (dogType === "pure" && selectedEffectIds.length > MAX_EFFECTS_PER_DOG) {
          errorEl.textContent = `特效最多只能選 ${MAX_EFFECTS_PER_DOG} 個`;
          return;
        }

        try {
          await createDog({
            name,
            series: modalEl.querySelector("#o-series").value.trim() || null,
            accountId: modalEl.querySelector("#o-account").value || null,
            breedId: modalEl.querySelector("#o-breed").value || null,
            gender: modalEl.querySelector("#o-gender").value,
            dogType,
            effects: dogType === "pure" ? selectedEffectIds : [],
            patternId: dogType === "mixed" ? modalEl.querySelector("#o-pattern").value || null : null,
            purityMixDegree: plan.predictedPurityMixDegree ?? 0,
            level: 1,
            sourceType: "self_bred",
            sourcePerson: "",
            birthDate: modalEl.querySelector("#o-birthdate").value || today,
            memorialTags: tagController.getSelectedTags(),
            notes: modalEl.querySelector("#o-notes").value.trim(),
            fatherId: plan.dogAId,
            motherId: plan.dogBId
          });

          await updateBreedingPlan(plan.id, { offspringCreated: true });
          close();
          await loadPlans();
        } catch (err) {
          errorEl.textContent = "建立失敗，請稍後再試";
          console.error(err);
        }
      });
    }
  });
}

document.getElementById("filter-status").addEventListener("change", renderPlanList);

await loadReferenceData();
await loadPlans();

// 若從工作台帶 planId 過來，捲動到對應計畫（第一版先不特別做定位滾動，計畫已全部列出）
