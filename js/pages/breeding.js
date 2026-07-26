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
  deleteBreedingPlan,
  BREEDING_PLAN_STATUS,
  BREEDING_PLAN_STATUS_LABELS
} from "../services/breedingPlanService.js";
import { getDogById, createDog, getDistinctSeriesList, getDistinctMemorialTags } from "../services/dogService.js";
import { getActiveAccounts } from "../services/accountService.js";
import { getActiveBreeds } from "../services/breedService.js";
import { getAllEffects, MAX_EFFECTS_PER_DOG } from "../services/effectService.js";
import { getAllPatterns } from "../services/patternService.js";
import { checkPedigreeCompatibility, isPedigreeStatusAllowed, PEDIGREE_STATUS_LABELS } from "../utils/pedigreeService.js";
import { predictOffspring, formatTypeLevel } from "../utils/breedingPrediction.js";
import { resolveParentRoles } from "../utils/parentRoleResolver.js";

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

  // 父母角色判定：dogA / dogB 只是「配對的兩隻狗」，不代表誰是父親、誰是母親
  // （使用者可能從母狗詳情頁發起配對，這時候 dogA 反而是母狗）。
  // 只有在需要新增子代時才需要判定角色，判定失敗就不能開啟新增子代表單。
  const parentRoles = canAddOffspring ? resolveParentRoles(dogA, dogB) : null;

  // 血緣狀態即時重新檢查（不相信舊快照）：
  // 已完成／已取消的計畫是歷史紀錄，不需要（也不應該）重新檢查而動搖既有結果；
  // 其餘「進行中」的計畫（預計配/互動中/等待升級/準備完成/暫停）每次顯示都重新檢查一次，
  // 確保父母族譜之後若有變更，能即時反映在配狗中心。
  const isHistorical =
    plan.status === BREEDING_PLAN_STATUS.COMPLETED || plan.status === BREEDING_PLAN_STATUS.CANCELLED;

  let livePedigreeResult = null;
  if (!isHistorical) {
    livePedigreeResult = await checkPedigreeCompatibility(plan.dogAId, plan.dogBId);
  }
  const isInvalid = !isHistorical && !isPedigreeStatusAllowed(livePedigreeResult.status);
  const pedigreeStatusLabel = livePedigreeResult
    ? PEDIGREE_STATUS_LABELS[livePedigreeResult.status] || livePedigreeResult.status
    : PEDIGREE_STATUS_LABELS[plan.pedigreeStatus] || plan.pedigreeCheckResult || "（未檢查）";

  const invalidBanner = isInvalid
    ? `<div class="invalid-plan-banner">⚠ 無效配狗計畫：${pedigreeStatusLabel}（${livePedigreeResult.explanation}）</div>`
    : "";

  // 純種／混種預測顯示：
  // - 如果計畫有存 prediction 快照（新版 createBreedingPlan 建立的），顯示「建立時預測」；
  //   同時用目前兩隻狗的資料即時重算一次，如果結果跟快照不同（表示父母資料事後被修改過），
  //   額外顯示「目前重新計算」讓你知道結果已經變了。
  // - 如果是舊資料、沒有 prediction 快照，直接用目前資料即時計算，不會顯示 NaN，
  //   算不出來就顯示「純種／混種資料不足，無法預測」，不會刪除這筆舊計畫。
  const livePrediction = predictOffspring(dogA, dogB);
  let predictionHtml;
  if (plan.prediction && plan.prediction.offspringType) {
    const snapshotLabel = formatTypeLevel(plan.prediction.offspringType, plan.prediction.offspringLevel);
    predictionHtml = `建立時預測：${snapshotLabel}`;
    if (livePrediction.valid) {
      if (livePrediction.displayLabel !== snapshotLabel) {
        predictionHtml += `<br/>目前資料重新計算：${livePrediction.displayLabel}`;
      }
    } else {
      predictionHtml += `<br/>⚠ 目前資料重新計算失敗：${livePrediction.errorMessage}`;
    }
  } else if (livePrediction.valid) {
    predictionHtml = `預計下一代：${livePrediction.displayLabel}`;
  } else {
    predictionHtml = `純種／混種資料不足，無法預測`;
  }

  card.innerHTML = `
    ${invalidBanner}
    <div class="page-header" style="margin-bottom:8px;">
      <div class="dog-name">${dogA ? dogA.name : "未知"} × ${dogB ? dogB.name : "未知"}</div>
      <span class="tag tag-status-${plan.status}">${BREEDING_PLAN_STATUS_LABELS[plan.status] || plan.status}</span>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>互動進度</label>
        <div style="display:flex; gap:6px;">
          <input type="number" class="plan-progress" value="${plan.interactionProgress ?? 0}" ${isInvalid ? "disabled" : ""} />
          <span style="align-self:center;">/</span>
          <input type="number" class="plan-target" value="${plan.interactionTarget ?? 0}" ${isInvalid ? "disabled" : ""} />
        </div>
      </div>
      <div class="form-group">
        <label>${dogA ? dogA.name : "A"} 等級目標</label>
        <input type="number" class="plan-level-a" value="${plan.dogALevelTarget ?? ""}" ${isInvalid ? "disabled" : ""} />
      </div>
      <div class="form-group">
        <label>${dogB ? dogB.name : "B"} 等級目標</label>
        <input type="number" class="plan-level-b" value="${plan.dogBLevelTarget ?? ""}" ${isInvalid ? "disabled" : ""} />
      </div>
    </div>

    <div class="dog-meta">
      血緣判斷：${pedigreeStatusLabel}　
      ${predictionHtml}
    </div>

    <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
      <button class="btn btn-secondary btn-small plan-save-btn" ${isInvalid ? "disabled" : ""}>儲存進度</button>
      <select class="plan-status-select" ${isInvalid ? "disabled" : ""}>
        ${Object.entries(BREEDING_PLAN_STATUS_LABELS)
          .map(([value, label]) => `<option value="${value}" ${plan.status === value ? "selected" : ""}>${label}</option>`)
          .join("")}
      </select>
      ${
        canAddOffspring
          ? `<button class="btn btn-primary btn-small plan-add-offspring-btn" ${parentRoles.valid ? "" : "disabled"} title="${parentRoles.valid ? "" : parentRoles.errorMessage}">新增子代</button>`
          : ""
      }
      ${
        isInvalid
          ? `
        <button class="btn btn-secondary btn-small plan-cancel-btn">取消計畫</button>
        <button class="btn btn-danger btn-small plan-delete-btn">刪除測試資料</button>
      `
          : ""
      }
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
    try {
      if (newStatus === BREEDING_PLAN_STATUS.COMPLETED) {
        await completeBreedingPlan(plan.id);
      } else {
        await updateBreedingPlan(plan.id, { status: newStatus });
      }
    } catch (err) {
      alert(err.message || "更新失敗，請稍後再試");
      console.error(err);
    }
    await loadPlans();
  });

  const offspringBtn = card.querySelector(".plan-add-offspring-btn");
  if (offspringBtn) {
    offspringBtn.addEventListener("click", () => {
      // 防禦性再檢查一次（即使按鈕理論上已經是 disabled，避免萬一被繞過）
      if (!parentRoles || !parentRoles.valid) {
        alert((parentRoles && parentRoles.errorMessage) || "無法建立子代：此配狗計畫必須包含一隻公狗與一隻母狗。");
        return;
      }
      openAddOffspringModal(plan, parentRoles.father, parentRoles.mother);
    });
  }

  const cancelBtn = card.querySelector(".plan-cancel-btn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", async () => {
      const confirmed = await confirmModal("確定要取消這筆無效的配狗計畫嗎？取消後仍會保留紀錄，只是狀態會標示為「取消」。");
      if (!confirmed) return;
      await updateBreedingPlan(plan.id, { status: BREEDING_PLAN_STATUS.CANCELLED });
      await loadPlans();
    });
  }

  const deleteBtn = card.querySelector(".plan-delete-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      const confirmed = await confirmModal("確定要刪除這筆配狗計畫嗎？此操作無法復原（通常用於清除測試資料）。");
      if (!confirmed) return;
      await deleteBreedingPlan(plan.id);
      await loadPlans();
    });
  }
}

function openAddOffspringModal(plan, father, mother) {
  const accountOptions = accounts.map((a) => `<option value="${a.id}">${a.accountName}</option>`).join("");
  const breedOptions = breeds.map((b) => `<option value="${b.id}">${b.name}</option>`).join("");
  const effectCheckboxes = effects
    .map((e) => `<label style="margin-right:10px;"><input type="checkbox" class="o-effect" value="${e.id}" />${e.name}</label>`)
    .join("");
  const patternOptions = patterns.map((p) => `<option value="${p.id}">${p.canonicalName}</option>`).join("");
  const today = new Date().toISOString().slice(0, 10);

  // 用「目前」父母的資料重新計算一次預測（不要相信計畫建立當下的舊快照），
  // 這樣即使父母資料在配狗計畫建立後有被修改過，新增子代時也會用最新資料計算。
  // 注意：father/mother 已經由 resolveParentRoles() 依性別正確判定，
  // 不再假設 plan.dogAId = 父方。
  const prediction = predictOffspring(father, mother);
  const predictionInfoHtml = prediction.valid
    ? `父：${father.name}　母：${mother.name}<br/>自動帶入：${prediction.displayLabel}`
    : `父：${father.name}　母：${mother.name}<br/><span style="color:var(--color-danger);">⚠ ${prediction.errorMessage}</span>`;

  const { close, el } = openModal({
    title: "新增子代",
    contentHtml: `
      <div class="dog-meta" style="margin-bottom:10px;">
        ${predictionInfoHtml}
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
          <select id="o-dogtype">
            <option value="pure" ${prediction.valid && prediction.offspringType === "pure" ? "selected" : ""}>純種</option>
            <option value="mixed" ${prediction.valid && prediction.offspringType === "mixed" ? "selected" : ""}>混種</option>
          </select>
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
        <button type="button" class="btn btn-primary" data-action="save" ${prediction.valid ? "" : "disabled"}>建立子代</button>
      </div>
    `,
    onMount: (modalEl, close) => {
      attachAutocomplete(modalEl.querySelector("#o-series"), seriesList);
      const tagController = attachTagInput(
        modalEl.querySelector("#o-tag-chips"),
        modalEl.querySelector("#o-tag-input"),
        memorialTags
      );

      const dogTypeSelect = modalEl.querySelector("#o-dogtype");
      const effectsGroup = modalEl.querySelector("#o-effects-group");
      const patternGroup = modalEl.querySelector("#o-pattern-group");
      function syncEffectsPatternVisibility() {
        const isPure = dogTypeSelect.value === "pure";
        effectsGroup.style.display = isPure ? "block" : "none";
        patternGroup.style.display = isPure ? "none" : "block";
      }
      dogTypeSelect.addEventListener("change", syncEffectsPatternVisibility);
      syncEffectsPatternVisibility(); // 依預測結果預選的類型，一開始就要同步顯示對應區塊

      modalEl.querySelector('[data-action="cancel"]').addEventListener("click", close);
      modalEl.querySelector('[data-action="save"]').addEventListener("click", async () => {
        const errorEl = modalEl.querySelector("#o-error");

        if (!prediction.valid) {
          errorEl.textContent = prediction.errorMessage;
          return;
        }

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
            purityMixDegree: prediction.offspringLevel,
            level: 1,
            sourceType: "self_bred",
            sourcePerson: "",
            birthDate: modalEl.querySelector("#o-birthdate").value || today,
            memorialTags: tagController.getSelectedTags(),
            notes: modalEl.querySelector("#o-notes").value.trim(),
            fatherId: father.id,
            motherId: mother.id
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
