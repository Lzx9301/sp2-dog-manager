// ==================================================
// 狗狗詳細頁 (dog-detail.html)
// ==================================================
import { requireLogin } from "../services/authService.js";
import { renderNav } from "../components/nav.js";
import { openModal, confirmModal } from "../components/modal.js";
import { attachAutocomplete, attachTagInput } from "../components/autocomplete.js";
import { buildParentOptionsHtml, attachAddExternalNodeButton, attachGenderMismatchWarning } from "../components/parentPicker.js";
import { buildEffectCheckboxesHtml, attachEffectEnforcement } from "../components/effectPicker.js";
import {
  getDogById,
  updateDog,
  getChildrenOf,
  getAllDogs,
  searchDogs,
  getDistinctSeriesList,
  getDistinctMemorialTags
} from "../services/dogService.js";
import { getAccountById, getActiveAccounts } from "../services/accountService.js";
import { getActiveBreeds, getBreedById } from "../services/breedService.js";
import { getAllEffects, getEffectById } from "../services/effectService.js";
import { getAllPatterns, getPatternById } from "../services/patternService.js";
import { getExternalNodeById, getAllExternalNodes } from "../services/externalPedigreeService.js";
import {
  getPartnerIdsOf,
  getBreedingPlansOfDog,
  createBreedingPlan,
  BREEDING_PLAN_STATUS,
  BREEDING_PLAN_STATUS_LABELS
} from "../services/breedingPlanService.js";
import { moveDogToAccount, getMovementLogsOfDog } from "../services/movementLogService.js";
import { checkPedigreeCompatibility, wouldCreateCycle, getPedigreePermission, PEDIGREE_LEVEL } from "../utils/pedigreeService.js";
import { predictOffspring, formatTypeLevel, getPurityLevelLabel } from "../utils/breedingPrediction.js";
import { resolveParentRoles } from "../utils/parentRoleResolver.js";
import { validateDogEffects, getMaxEffectsForDogType } from "../utils/effectValidation.js";
import { GENDER_LABELS, DOG_TYPE_LABELS, SOURCE_TYPE_LABELS } from "../utils/constants.js";
import { isMouthPattern, formatMouthDogLabel, isValidMouthSourceBreedId } from "../utils/mouthType.js";

await requireLogin();
renderNav("dogs.html");

const params = new URLSearchParams(window.location.search);
const dogId = params.get("id");

let dog = null;
let accounts = [];
let breeds = [];
let effects = [];
let patterns = [];
let allDogs = [];
let externalNodes = [];

async function loadReferenceData() {
  [accounts, breeds, effects, patterns, allDogs, externalNodes] = await Promise.all([
    getActiveAccounts(),
    getActiveBreeds(),
    getAllEffects(),
    getAllPatterns(),
    getAllDogs(),
    getAllExternalNodes()
  ]);
}

/** 從已載入的 patterns 陣列同步查找（不打 Firestore），供表單即時互動使用 */
function patternById(patternId) {
  return patterns.find((p) => p.id === patternId) || null;
}

async function loadDog() {
  dog = await getDogById(dogId);
  if (!dog) {
    document.getElementById("dog-title").textContent = "找不到這隻狗";
    return;
  }
  document.getElementById("dog-title").textContent = dog.name;
  await Promise.all([
    renderBasicSection(),
    renderAppearanceSection(),
    renderSourceSection(),
    renderPedigreeSection(),
    renderPartnersSection(),
    renderChildrenSection(),
    renderBreedingRecordsSection(),
    renderMovementLogsSection()
  ]);
}

// ---------- 基本資料 ----------

async function renderBasicSection() {
  const account = await getAccountById(dog.accountId);
  const breed = await getBreedById(dog.breedId);

  document.getElementById("section-basic").innerHTML = `
    <div class="form-row">
      <div><strong>名稱：</strong>${dog.name}</div>
      <div><strong>系列：</strong>${dog.series || "（無）"}</div>
      <div><strong>性別：</strong><span class="tag tag-gender-${dog.gender}">${GENDER_LABELS[dog.gender] || "未設定"}</span></div>
      <div><strong>所在帳號：</strong>${account ? account.accountName : "（未指定）"}</div>
      <div><strong>品種：</strong>${breed ? breed.name : "（未設定）"}</div>
      <div><strong>等級：</strong>Lv.${dog.level ?? "-"}</div>
      <div><strong>${getPurityLevelLabel(dog.dogType)}：</strong>${dog.purityMixDegree ?? "-"}</div>
    </div>
    <div style="margin-top:8px;"><strong>備註：</strong>${dog.notes || "（無）"}</div>
  `;
}

// ---------- 外觀 ----------

async function renderAppearanceSection() {
  const el = document.getElementById("section-appearance");

  if (dog.dogType === "pure") {
    const effectNames = await Promise.all((dog.effects || []).map((id) => getEffectById(id)));
    el.innerHTML = `
      <div><strong>類型：</strong>${DOG_TYPE_LABELS.pure}</div>
      <div><strong>特效：</strong>${
        effectNames.filter(Boolean).map((e) => `<span class="tag">${e.name}</span>`).join("") || "（無）"
      }</div>
    `;
  } else if (dog.dogType === "mixed") {
    const pattern = dog.patternId ? await getPatternById(dog.patternId) : null;

    if (isMouthPattern(pattern)) {
      const selfBreed = await getBreedById(dog.breedId);
      const mouthSourceBreed = dog.mouthSourceBreedId ? await getBreedById(dog.mouthSourceBreedId) : null;
      const mouthLabel = formatMouthDogLabel(selfBreed?.name || null, mouthSourceBreed?.name || null);

      el.innerHTML = `
        <div><strong>類型：</strong>${DOG_TYPE_LABELS.mixed}</div>
        <div><strong>圖案：</strong>${pattern.canonicalName}</div>
        <div><strong>外觀：</strong>${mouthLabel || "（缺少自身品種，無法顯示）"}</div>
        <button class="btn btn-secondary btn-small" id="edit-mouth-source-btn" style="margin-top:6px;">
          ${dog.mouthSourceBreedId ? "編輯嘴型" : "設定嘴型"}
        </button>
      `;
      document.getElementById("edit-mouth-source-btn").addEventListener("click", openMouthSourceModal);
    } else {
      el.innerHTML = `
        <div><strong>類型：</strong>${DOG_TYPE_LABELS.mixed}</div>
        <div><strong>圖案：</strong>${pattern ? pattern.canonicalName : "（未設定）"}</div>
      `;
    }
  } else {
    el.innerHTML = `<div>尚未設定純種／混種</div>`;
  }
}

/** 快速設定／編輯嘴型來源品種（不動 dogType／patternId，只改 mouthSourceBreedId） */
function openMouthSourceModal() {
  const breedOptions = breeds.map((b) => `<option value="${b.id}" ${b.id === dog.mouthSourceBreedId ? "selected" : ""}>${b.name}</option>`).join("");

  const { close, el } = openModal({
    title: "設定嘴型來源",
    contentHtml: `
      <div class="form-group">
        <label>嘴型來源／這是什麼嘴</label>
        <select id="m-mouth-source"><option value="">${dog.mouthSourceBreedId ? "（清空）" : "尚未設定"}</option>${breedOptions}</select>
      </div>
      <div id="m-mouth-error" style="color:#b3543f; font-size:13px;"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">取消</button>
        <button type="button" class="btn btn-primary" data-action="save">儲存</button>
      </div>
    `,
    onMount: (modalEl, close) => {
      modalEl.querySelector('[data-action="cancel"]').addEventListener("click", close);
      modalEl.querySelector('[data-action="save"]').addEventListener("click", async () => {
        const value = modalEl.querySelector("#m-mouth-source").value || null;
        const validBreedIds = breeds.map((b) => b.id);

        if (value && !isValidMouthSourceBreedId(value, validBreedIds)) {
          modalEl.querySelector("#m-mouth-error").textContent = "請選擇有效的嘴型來源品種";
          return;
        }

        try {
          await updateDog(dogId, { mouthSourceBreedId: value });
          close();
          await renderAppearanceSection();
        } catch (err) {
          modalEl.querySelector("#m-mouth-error").textContent = "儲存失敗，請稍後再試";
          console.error(err);
        }
      });
    }
  });
}

// ---------- 來源 ----------

function renderSourceSection() {
  document.getElementById("section-source").innerHTML = `
    <div><strong>取得方式：</strong>${SOURCE_TYPE_LABELS[dog.sourceType] || "（未設定）"}</div>
    <div><strong>來源對象：</strong>${dog.sourcePerson || "（無）"}</div>
    <div><strong>金額：</strong>${dog.sourceAmount ?? "（未填）"}</div>
    <div><strong>生日：</strong>${dog.birthDate || "（未填）"}</div>
    <div><strong>紀念標籤：</strong>${
      (dog.memorialTags || []).map((t) => `<span class="tag">${t}</span>`).join("") || "（無）"
    }</div>
  `;
}

// ---------- 血統 ----------

async function resolveParentDisplay(parentId) {
  if (!parentId) return "未知";
  const asDog = await getDogById(parentId);
  if (asDog) return `<a href="dog-detail.html?id=${asDog.id}">${asDog.name}</a>`;
  const asExternal = await getExternalNodeById(parentId);
  if (asExternal) return `${asExternal.name}（外部血統）`;
  return "未知";
}

async function renderPedigreeSection() {
  const [fatherHtml, motherHtml] = await Promise.all([
    resolveParentDisplay(dog.fatherId),
    resolveParentDisplay(dog.motherId)
  ]);

  document.getElementById("section-pedigree").innerHTML = `
    <div><strong>父親：</strong>${fatherHtml}</div>
    <div><strong>母親：</strong>${motherHtml}</div>
  `;
}

// ---------- 伴侶 ----------

async function renderPartnersSection() {
  const partnerIds = await getPartnerIdsOf(dogId);
  const el = document.getElementById("section-partners");

  if (partnerIds.length === 0) {
    el.innerHTML = `<div class="empty-state">目前沒有配對紀錄</div>`;
    return;
  }

  const partners = await Promise.all(partnerIds.map((id) => getDogById(id)));
  el.innerHTML = partners
    .filter(Boolean)
    .map((p) => `<a href="dog-detail.html?id=${p.id}" class="tag">${p.name}</a>`)
    .join(" ");
}

// ---------- 子代 ----------

async function renderChildrenSection() {
  const children = await getChildrenOf(dogId);
  document.getElementById("children-count").textContent = children.length;

  const summaryEl = document.getElementById("section-children-summary");
  const fullEl = document.getElementById("section-children-full");

  if (children.length === 0) {
    summaryEl.innerHTML = `<div class="empty-state">目前沒有子代</div>`;
    return;
  }

  summaryEl.innerHTML = `<button class="btn btn-secondary btn-small" id="toggle-children-btn">查看全部</button>`;
  fullEl.innerHTML = children
    .map((c) => `<a href="dog-detail.html?id=${c.id}" class="tag">${c.name}</a>`)
    .join(" ");

  document.getElementById("toggle-children-btn").addEventListener("click", () => {
    const isHidden = fullEl.style.display === "none";
    fullEl.style.display = isHidden ? "block" : "none";
    document.getElementById("toggle-children-btn").textContent = isHidden ? "收合" : "查看全部";
  });
}

// ---------- 配狗紀錄 ----------

async function renderBreedingRecordsSection() {
  const plans = await getBreedingPlansOfDog(dogId);
  const el = document.getElementById("section-breeding-records");

  if (plans.length === 0) {
    el.innerHTML = `<div class="empty-state">目前沒有配狗紀錄</div>`;
    return;
  }

  const rows = await Promise.all(
    plans.map(async (plan) => {
      const partnerId = plan.dogAId === dogId ? plan.dogBId : plan.dogAId;
      const partner = await getDogById(partnerId);
      return `
        <div style="padding:6px 0; border-bottom:1px solid var(--color-border);">
          <span class="tag tag-status-${plan.status}">${BREEDING_PLAN_STATUS_LABELS[plan.status] || plan.status}</span>
          與 ${partner ? `<a href="dog-detail.html?id=${partner.id}">${partner.name}</a>` : "未知"}
        </div>
      `;
    })
  );

  el.innerHTML = rows.join("");
}

// ---------- 移動紀錄 ----------

async function renderMovementLogsSection() {
  const logs = await getMovementLogsOfDog(dogId);
  const el = document.getElementById("section-movement-logs");

  if (logs.length === 0) {
    el.innerHTML = `<div class="empty-state">目前沒有移動紀錄</div>`;
    return;
  }

  const rows = await Promise.all(
    logs.map(async (log) => {
      const [fromAcc, toAcc] = await Promise.all([
        getAccountById(log.fromAccountId),
        getAccountById(log.toAccountId)
      ]);
      return `
        <div style="padding:6px 0; border-bottom:1px solid var(--color-border);">
          ${new Date(log.movedAt).toLocaleString("zh-TW")}：
          ${fromAcc ? fromAcc.accountName : "（無）"} → ${toAcc ? toAcc.accountName : "（無）"}
          ${log.notes ? `<div class="dog-meta">${log.notes}</div>` : ""}
        </div>
      `;
    })
  );
  el.innerHTML = rows.join("");
}

// ---------- 編輯 ----------

function openEditModal() {
  const accountOptionsHtml = accounts
    .map((a) => `<option value="${a.id}" ${a.id === dog.accountId ? "selected" : ""}>${a.accountName}</option>`)
    .join("");
  const breedOptionsHtml = breeds
    .map((b) => `<option value="${b.id}" ${b.id === dog.breedId ? "selected" : ""}>${b.name}</option>`)
    .join("");
  const patternOptionsHtml = patterns
    .map((p) => `<option value="${p.id}" ${p.id === dog.patternId ? "selected" : ""}>${p.canonicalName}</option>`)
    .join("");
  const mouthSourceOptionsHtml = breeds
    .map((b) => `<option value="${b.id}" ${b.id === dog.mouthSourceBreedId ? "selected" : ""}>${b.name}</option>`)
    .join("");
  const initialDogType = dog.dogType === "mixed" ? "mixed" : "pure"; // 舊資料若完全沒設定，先當純種處理，讓表單有預設值可操作
  const initialPattern = patternById(dog.patternId);
  const initialIsMouthDog = initialDogType === "mixed" && isMouthPattern(initialPattern);

  const { close, el } = openModal({
    title: "編輯狗狗資料",
    contentHtml: `
      <h4 style="margin:4px 0 8px;">基本資料</h4>
      <div class="form-row">
        <div class="form-group"><label>名稱</label><input type="text" id="e-name" value="${dog.name || ""}" /></div>
        <div class="form-group"><label>系列</label><input type="text" id="e-series" value="${dog.series || ""}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>品種</label>
          <select id="e-breed"><option value="">（未設定）</option>${breedOptionsHtml}</select>
        </div>
        <div class="form-group">
          <label>所屬帳號</label>
          <select id="e-account"><option value="">（未指定）</option>${accountOptionsHtml}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>性別</label>
          <select id="e-gender">
            <option value="male" ${dog.gender === "male" ? "selected" : ""}>公</option>
            <option value="female" ${dog.gender === "female" ? "selected" : ""}>母</option>
          </select>
        </div>
        <div class="form-group">
          <label>純種／混種</label>
          <select id="e-dogtype">
            <option value="pure" ${initialDogType === "pure" ? "selected" : ""}>純種</option>
            <option value="mixed" ${initialDogType === "mixed" ? "selected" : ""}>混種</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label id="e-purity-label">${getPurityLevelLabel(initialDogType)}</label>
          <input type="number" id="e-purity" value="${dog.purityMixDegree ?? 0}" />
        </div>
        <div class="form-group">
          <label>等級</label>
          <input type="number" id="e-level" value="${dog.level ?? 1}" />
        </div>
      </div>

      <div class="form-group" id="e-pattern-group" style="display:${initialDogType === "mixed" ? "block" : "none"};">
        <label>圖案（混種）</label>
        <select id="e-pattern"><option value="">（未設定）</option>${patternOptionsHtml}</select>
      </div>
      <div class="form-group" id="e-mouth-source-group" style="display:${initialIsMouthDog ? "block" : "none"};">
        <label>嘴型來源／這是什麼嘴</label>
        <select id="e-mouth-source"><option value="">${dog.mouthSourceBreedId ? "（清空）" : "尚未設定"}</option>${mouthSourceOptionsHtml}</select>
      </div>

      <div class="form-group" id="e-effects-group">
        <label id="e-effects-label">特效（${initialDogType === "pure" ? "純種" : "混種"}最多 ${getMaxEffectsForDogType(initialDogType)} 個）</label>
        ${buildEffectCheckboxesHtml(effects, dog.effects || [], "e-effect")}
        <div id="e-effects-warning" style="color:var(--color-warning); font-size:12px; margin-top:2px;"></div>
      </div>

      <h4 style="margin:16px 0 8px;">來源資訊</h4>
      <div class="form-row">
        <div class="form-group">
          <label>來源類型</label>
          <select id="e-source-type">
            <option value="purchase" ${dog.sourceType === "purchase" ? "selected" : ""}>購買</option>
            <option value="exchange" ${dog.sourceType === "exchange" ? "selected" : ""}>交換</option>
            <option value="gift" ${dog.sourceType === "gift" ? "selected" : ""}>贈送</option>
            <option value="self_bred" ${dog.sourceType === "self_bred" ? "selected" : ""}>自己接生</option>
            <option value="other" ${dog.sourceType === "other" ? "selected" : ""}>其他</option>
          </select>
        </div>
        <div class="form-group">
          <label>來源對象</label>
          <input type="text" id="e-source-person" value="${dog.sourcePerson || ""}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>金額（選填）</label>
          <input type="number" id="e-source-amount" value="${dog.sourceAmount ?? ""}" />
        </div>
        <div class="form-group">
          <label>出生日（選填）</label>
          <input type="date" id="e-birthdate" value="${dog.birthDate || ""}" />
        </div>
      </div>
      <div class="form-group">
        <label>紀念日（可多個，按 Enter 新增）</label>
        <div id="e-tag-chips"></div>
        <input type="text" id="e-tag-input" placeholder="輸入後按 Enter" />
      </div>

      <h4 style="margin:16px 0 8px;">父母</h4>
      <div class="form-row">
        <div class="form-group">
          <label>父親（選填）</label>
          <select id="e-father">${buildParentOptionsHtml({
            dogs: allDogs,
            externalNodes,
            preferredGender: "male",
            excludeDogId: dogId,
            selectedId: dog.fatherId || null
          })}</select>
          <button type="button" class="btn btn-secondary btn-small" id="e-add-external-father" style="margin-top:4px;">＋ 新增外部血統節點</button>
          <div id="e-father-warning" style="color:var(--color-warning); font-size:12px; margin-top:2px;"></div>
        </div>
        <div class="form-group">
          <label>母親（選填）</label>
          <select id="e-mother">${buildParentOptionsHtml({
            dogs: allDogs,
            externalNodes,
            preferredGender: "female",
            excludeDogId: dogId,
            selectedId: dog.motherId || null
          })}</select>
          <button type="button" class="btn btn-secondary btn-small" id="e-add-external-mother" style="margin-top:4px;">＋ 新增外部血統節點</button>
          <div id="e-mother-warning" style="color:var(--color-warning); font-size:12px; margin-top:2px;"></div>
        </div>
      </div>

      <div class="form-group"><label>備註</label><textarea id="e-notes">${dog.notes || ""}</textarea></div>
      <div id="e-error" style="color:#b3543f; font-size:13px;"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">取消</button>
        <button type="button" class="btn btn-primary" data-action="save">儲存</button>
      </div>
    `,
    onMount: (modalEl, close) => {
      attachAutocomplete(modalEl.querySelector("#e-series"), []);

      const tagController = attachTagInput(
        modalEl.querySelector("#e-tag-chips"),
        modalEl.querySelector("#e-tag-input"),
        [],
        dog.memorialTags || []
      );

      const fatherSelect = modalEl.querySelector("#e-father");
      const motherSelect = modalEl.querySelector("#e-mother");
      attachAddExternalNodeButton(modalEl.querySelector("#e-add-external-father"), fatherSelect, externalNodes);
      attachAddExternalNodeButton(modalEl.querySelector("#e-add-external-mother"), motherSelect, externalNodes);
      attachGenderMismatchWarning(fatherSelect, modalEl.querySelector("#e-father-warning"), allDogs, "male");
      attachGenderMismatchWarning(motherSelect, modalEl.querySelector("#e-mother-warning"), allDogs, "female");

      // 純種／混種切換：圖案／嘴型來源顯示切換、特效上限即時更新、純度標籤動態更新
      const dogTypeSelect = modalEl.querySelector("#e-dogtype");
      const patternGroup = modalEl.querySelector("#e-pattern-group");
      const patternSelect = modalEl.querySelector("#e-pattern");
      const mouthSourceGroup = modalEl.querySelector("#e-mouth-source-group");
      const effectsLabel = modalEl.querySelector("#e-effects-label");
      const purityLabel = modalEl.querySelector("#e-purity-label");

      const effectEnforcement = attachEffectEnforcement({
        containerEl: modalEl,
        checkboxSelector: ".e-effect",
        getDogType: () => dogTypeSelect.value,
        warningEl: modalEl.querySelector("#e-effects-warning")
      });

      function syncMouthSourceVisibility() {
        const isMixed = dogTypeSelect.value === "mixed";
        const selectedPattern = patternById(patternSelect.value);
        const showMouthField = isMixed && isMouthPattern(selectedPattern);
        mouthSourceGroup.style.display = showMouthField ? "block" : "none";
        if (!showMouthField) {
          modalEl.querySelector("#e-mouth-source").value = "";
        }
      }

      function syncDogTypeDependentUI() {
        const dogType = dogTypeSelect.value;
        patternGroup.style.display = dogType === "mixed" ? "block" : "none";
        effectsLabel.textContent = `特效（${dogType === "pure" ? "純種" : "混種"}最多 ${getMaxEffectsForDogType(dogType)} 個）`;
        purityLabel.textContent = getPurityLevelLabel(dogType);
        // 切換類型時：不直接清空已勾選的特效，保留前面的合法數量，超過的部分才移除
        effectEnforcement.enforceOnTypeChange();
        syncMouthSourceVisibility();
      }

      dogTypeSelect.addEventListener("change", syncDogTypeDependentUI);
      patternSelect.addEventListener("change", syncMouthSourceVisibility);

      modalEl.querySelector('[data-action="cancel"]').addEventListener("click", close);
      modalEl.querySelector('[data-action="save"]').addEventListener("click", async () => {
        const errorEl = modalEl.querySelector("#e-error");
        errorEl.textContent = "";

        const newFatherId = fatherSelect.value || null;
        const newMotherId = motherSelect.value || null;

        // 循環防呆：不能把自己的後代（或自己）設成自己的父母
        if (newFatherId) {
          const fatherCycle = await wouldCreateCycle(dogId, newFatherId);
          if (fatherCycle) {
            errorEl.textContent = "無法設定：這個選擇會形成血緣循環（例如把自己的子代或孫代設成父親），請重新選擇";
            return;
          }
        }
        if (newMotherId) {
          const motherCycle = await wouldCreateCycle(dogId, newMotherId);
          if (motherCycle) {
            errorEl.textContent = "無法設定：這個選擇會形成血緣循環（例如把自己的子代或孫代設成母親），請重新選擇";
            return;
          }
        }

        const newDogType = dogTypeSelect.value;
        const selectedEffectIds = effectEnforcement.getCheckedIds();
        const effectsCheck = validateDogEffects(newDogType, selectedEffectIds);
        if (!effectsCheck.valid) {
          errorEl.textContent = effectsCheck.errorMessage;
          return;
        }

        const selectedPatternId = newDogType === "mixed" ? patternSelect.value || null : null;
        const selectedPattern = patternById(selectedPatternId);
        const isMouthDog = newDogType === "mixed" && isMouthPattern(selectedPattern);
        const mouthSourceBreedId = modalEl.querySelector("#e-mouth-source").value || null;
        const validBreedIds = breeds.map((b) => b.id);

        if (isMouthDog && !isValidMouthSourceBreedId(mouthSourceBreedId, validBreedIds)) {
          errorEl.textContent = "這是嘴圖案，請選擇嘴型來源品種";
          return;
        }

        try {
          await updateDog(dogId, {
            name: modalEl.querySelector("#e-name").value.trim(),
            series: modalEl.querySelector("#e-series").value.trim() || null,
            breedId: modalEl.querySelector("#e-breed").value || null,
            accountId: modalEl.querySelector("#e-account").value || null,
            gender: modalEl.querySelector("#e-gender").value,
            dogType: newDogType,
            level: Number(modalEl.querySelector("#e-level").value) || 0,
            purityMixDegree: Number(modalEl.querySelector("#e-purity").value) || 0,
            effects: effectsCheck.correctedEffects,
            patternId: selectedPatternId,
            mouthSourceBreedId: isMouthDog ? mouthSourceBreedId : null,
            sourceType: modalEl.querySelector("#e-source-type").value,
            sourcePerson: modalEl.querySelector("#e-source-person").value.trim(),
            sourceAmount: modalEl.querySelector("#e-source-amount").value
              ? Number(modalEl.querySelector("#e-source-amount").value)
              : null,
            birthDate: modalEl.querySelector("#e-birthdate").value || null,
            memorialTags: tagController.getSelectedTags(),
            fatherId: newFatherId,
            motherId: newMotherId,
            notes: modalEl.querySelector("#e-notes").value.trim()
          });
          close();
          await loadReferenceData(); // 父母關係／品種等可能改變，重新整理狗狗清單快取
          await loadDog();
        } catch (err) {
          errorEl.textContent = err.message || "儲存失敗，請稍後再試";
          console.error(err);
        }
      });
    }
  });
}

// ---------- 移動帳號 ----------

function openMoveModal() {
  const accountOptions = accounts
    .filter((a) => a.id !== dog.accountId)
    .map((a) => `<option value="${a.id}">${a.accountName}</option>`)
    .join("");

  const { close, el } = openModal({
    title: "移動狗狗到其他帳號",
    contentHtml: `
      <div class="form-group">
        <label>目的帳號</label>
        <select id="m-account">${accountOptions}</select>
      </div>
      <div class="form-group"><label>備註</label><textarea id="m-notes"></textarea></div>
      <div id="m-error" style="color:#b3543f; font-size:13px;"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">取消</button>
        <button type="button" class="btn btn-primary" data-action="save">移動</button>
      </div>
    `,
    onMount: (modalEl, close) => {
      modalEl.querySelector('[data-action="cancel"]').addEventListener("click", close);
      modalEl.querySelector('[data-action="save"]').addEventListener("click", async () => {
        const toAccountId = modalEl.querySelector("#m-account").value;
        if (!toAccountId) {
          modalEl.querySelector("#m-error").textContent = "請選擇目的帳號";
          return;
        }
        try {
          await moveDogToAccount(dogId, toAccountId, modalEl.querySelector("#m-notes").value.trim());
          close();
          await loadDog();
        } catch (err) {
          modalEl.querySelector("#m-error").textContent = "移動失敗，請稍後再試";
          console.error(err);
        }
      });
    }
  });
}

// ---------- 加入配狗計畫 ----------

function openAddBreedingModal() {
  const { close, el } = openModal({
    title: "加入配狗計畫",
    contentHtml: `
      <div class="form-group">
        <label>搜尋另一隻狗</label>
        <input type="text" id="b-search" placeholder="輸入名稱關鍵字" />
        <div id="b-search-results" style="margin-top:6px;"></div>
      </div>
      <div id="b-preview" style="display:none; margin-top:12px;"></div>
      <div id="b-error" style="color:#b3543f; font-size:13px;"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">取消</button>
        <button type="button" class="btn btn-primary" data-action="save" style="display:none;">建立配狗計畫</button>
      </div>
    `,
    onMount: (modalEl, close) => {
      let selectedPartnerId = null;

      modalEl.querySelector('[data-action="cancel"]').addEventListener("click", close);

      const searchInput = modalEl.querySelector("#b-search");
      const resultsEl = modalEl.querySelector("#b-search-results");
      const previewEl = modalEl.querySelector("#b-preview");
      const saveBtn = modalEl.querySelector('[data-action="save"]');

      searchInput.addEventListener("input", debounce(async () => {
        const keyword = searchInput.value.trim();
        if (!keyword) {
          resultsEl.innerHTML = "";
          return;
        }
        const results = (await searchDogs(keyword)).filter((d) => d.id !== dogId).slice(0, 8);
        resultsEl.innerHTML = results
          .map((d) => `<div class="tag" style="cursor:pointer;" data-id="${d.id}">${d.name}</div>`)
          .join(" ");

        resultsEl.querySelectorAll("[data-id]").forEach((tagEl) => {
          tagEl.addEventListener("click", async () => {
            selectedPartnerId = tagEl.dataset.id;
            await showPreview(selectedPartnerId);
          });
        });
      }, 250));

      async function showPreview(partnerId) {
        const partner = await getDogById(partnerId);
        if (!partner) return;

        const pedigreeResult = await checkPedigreeCompatibility(dogId, partnerId);
        const pedigreePermission = getPedigreePermission(pedigreeResult.status);
        const pedigreeStatusLabel = pedigreePermission.message;
        const pedigreeColor =
          pedigreePermission.level === PEDIGREE_LEVEL.BLOCKED
            ? "var(--color-danger)"
            : pedigreePermission.level === PEDIGREE_LEVEL.WARNING
              ? pedigreePermission.color === "orange"
                ? "var(--color-warning)"
                : "#8a6d1a"
              : "var(--color-primary-dark)";

        // 注意：predictOffspring 的 parentA/parentB 只是計算用的兩個輸入位置，
        // 不代表誰是父親、誰是母親（真正的父母角色判定在下面用 resolveParentRoles）
        const prediction = predictOffspring(dog, partner);

        const genderWarning =
          dog.gender && partner.gender && dog.gender === partner.gender
            ? `<div style="color:var(--color-warning);">⚠ 兩隻狗性別相同，請確認是否正確</div>`
            : "";

        // 父方／母方是不正確的假設：dogA/dogB 只是「配對的兩隻狗」，
        // 使用者可能從母狗詳情頁發起配對，這時候「這隻狗」反而是母狗。
        // 只有依性別成功判定出一公一母，才顯示「父親」「母親」，否則用中性的「狗狗 A」「狗狗 B」。
        const roles = resolveParentRoles(dog, partner);
        const selfLabel = roles.valid ? (roles.father.id === dog.id ? "父親" : "母親") : "狗狗 A";
        const partnerLabel = roles.valid ? (roles.father.id === partner.id ? "父親" : "母親") : "狗狗 B";

        const predictionHtml = prediction.valid
          ? `
            <div class="dog-meta" style="margin-top:4px;">計算使用：${selfLabel} ${prediction.parents.parentA.usedLevel}、${partnerLabel} ${prediction.parents.parentB.usedLevel}</div>
            <div style="margin-top:2px;"><strong>預計下一代：</strong>${prediction.displayLabel}</div>
          `
          : `<div style="color:var(--color-danger); font-weight:700; margin-top:4px;">⚠ ${prediction.errorMessage}</div>`;

        previewEl.style.display = "block";
        previewEl.innerHTML = `
          <div><strong>配對：</strong>${dog.name} × ${partner.name}</div>
          <div>
            <strong>血緣檢查：</strong>
            <span style="font-weight:700; color:${pedigreeColor};">${pedigreeStatusLabel}</span>
          </div>
          <div class="dog-meta">${pedigreeResult.explanation}</div>

          <div style="margin-top:8px;">
            <div><strong>${selfLabel}：</strong>${dog.name}　${formatTypeLevel(dog.dogType, dog.purityMixDegree)}</div>
            <div><strong>${partnerLabel}：</strong>${partner.name}　${formatTypeLevel(partner.dogType, partner.purityMixDegree)}</div>
          </div>
          ${predictionHtml}
          ${genderWarning}
          ${
            pedigreePermission.level === PEDIGREE_LEVEL.BLOCKED
              ? `<div style="color:var(--color-danger); font-weight:700; margin-top:6px;">⚠ ${pedigreeStatusLabel}，不可建立配狗計畫</div>`
              : ""
          }
        `;

        // 三層邏輯：只有 blocked（restricted）才真正禁用按鈕。
        // warning（資料不足／確認有血緣但距離未知）不禁用按鈕，只是點擊建立時會先跳一次確認。
        const predictionOk = prediction.valid;
        const canCreate = pedigreePermission.level !== PEDIGREE_LEVEL.BLOCKED && predictionOk;
        saveBtn.style.display = "inline-block";
        saveBtn.disabled = !canCreate;

        if (pedigreePermission.level === PEDIGREE_LEVEL.BLOCKED) {
          saveBtn.textContent = `${pedigreeStatusLabel}，不可建立`;
        } else if (!predictionOk) {
          saveBtn.textContent = "純種／混種資料不足，不可建立";
        } else if (pedigreePermission.level === PEDIGREE_LEVEL.WARNING) {
          saveBtn.textContent = "建立配狗計畫（需確認血緣警示）";
        } else {
          saveBtn.textContent = "建立配狗計畫";
        }

        // 存起來給 save 按鈕的 click handler 用，判斷是否需要先跳確認
        saveBtn.dataset.pedigreeLevel = pedigreePermission.level;
        saveBtn.dataset.pedigreeMessage = pedigreePermission.message;
      }

      saveBtn.addEventListener("click", async () => {
        if (!selectedPartnerId) {
          modalEl.querySelector("#b-error").textContent = "請先選擇配對對象";
          return;
        }
        modalEl.querySelector("#b-error").textContent = "";

        // warning 狀態：建立前先跳一次確認，使用者取消就不繼續（restricted 已經在按鈕
        // disabled 擋掉，走不到這裡；allowed 不需要確認，直接往下建立）
        if (saveBtn.dataset.pedigreeLevel === PEDIGREE_LEVEL.WARNING) {
          const confirmed = await confirmModal(`${saveBtn.dataset.pedigreeMessage}\n\n是否仍要建立配狗計畫？`);
          if (!confirmed) return;
        }

        try {
          // 注意：這裡不再傳任何預測相關欄位（offspringType / predictedPurityMixDegree 等）。
          // createBreedingPlan 會自己重新載入雙方資料、重新計算，不信任前端傳入的預測結果。
          await createBreedingPlan({
            dogAId: dogId,
            dogBId: selectedPartnerId,
            status: BREEDING_PLAN_STATUS.PLANNED
          });
          close();
          await loadDog();
        } catch (err) {
          modalEl.querySelector("#b-error").textContent = err.message || "建立失敗，請稍後再試";
          console.error(err);
        }
      });
    }
  });
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ---------- 事件綁定 ----------

document.getElementById("edit-btn").addEventListener("click", openEditModal);
document.getElementById("move-btn").addEventListener("click", openMoveModal);
document.getElementById("add-breeding-btn").addEventListener("click", openAddBreedingModal);

// ---------- 初始化 ----------

await loadReferenceData();
await loadDog();
