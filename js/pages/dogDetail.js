// ==================================================
// 狗狗詳細頁 (dog-detail.html)
// ==================================================
import { requireLogin } from "../services/authService.js";
import { renderNav } from "../components/nav.js";
import { openModal, confirmModal } from "../components/modal.js";
import { attachAutocomplete, attachTagInput } from "../components/autocomplete.js";
import {
  getDogById,
  updateDog,
  getChildrenOf,
  searchDogs,
  getDistinctSeriesList,
  getDistinctMemorialTags
} from "../services/dogService.js";
import { getAccountById, getActiveAccounts } from "../services/accountService.js";
import { getActiveBreeds, getBreedById } from "../services/breedService.js";
import { getAllEffects, getEffectById, MAX_EFFECTS_PER_DOG } from "../services/effectService.js";
import { getAllPatterns, getPatternById } from "../services/patternService.js";
import { getExternalNodeById } from "../services/externalPedigreeService.js";
import {
  getPartnerIdsOf,
  getBreedingPlansOfDog,
  createBreedingPlan,
  BREEDING_PLAN_STATUS,
  BREEDING_PLAN_STATUS_LABELS
} from "../services/breedingPlanService.js";
import { moveDogToAccount, getMovementLogsOfDog } from "../services/movementLogService.js";
import { checkPedigreeCompatibility } from "../utils/pedigreeService.js";
import { calculateOffspringPurityDegree } from "../utils/purityCalculator.js";
import { GENDER_LABELS, DOG_TYPE_LABELS, SOURCE_TYPE_LABELS } from "../utils/constants.js";

await requireLogin();
renderNav("dogs.html");

const params = new URLSearchParams(window.location.search);
const dogId = params.get("id");

let dog = null;
let accounts = [];
let breeds = [];
let effects = [];
let patterns = [];

async function loadReferenceData() {
  [accounts, breeds, effects, patterns] = await Promise.all([
    getActiveAccounts(),
    getActiveBreeds(),
    getAllEffects(),
    getAllPatterns()
  ]);
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
      <div><strong>純／混度：</strong>${dog.purityMixDegree ?? "-"}</div>
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
    el.innerHTML = `
      <div><strong>類型：</strong>${DOG_TYPE_LABELS.mixed}</div>
      <div><strong>圖案：</strong>${pattern ? pattern.canonicalName : "（未設定）"}</div>
    `;
  } else {
    el.innerHTML = `<div>尚未設定純種／混種</div>`;
  }
}

// ---------- 來源 ----------

function renderSourceSection() {
  document.getElementById("section-source").innerHTML = `
    <div><strong>取得方式：</strong>${SOURCE_TYPE_LABELS[dog.sourceType] || "（未設定）"}</div>
    <div><strong>來源對象：</strong>${dog.sourcePerson || "（無）"}</div>
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
  const { close, el } = openModal({
    title: "編輯狗狗資料",
    contentHtml: `
      <div class="form-row">
        <div class="form-group"><label>名稱</label><input type="text" id="e-name" value="${dog.name || ""}" /></div>
        <div class="form-group"><label>系列</label><input type="text" id="e-series" value="${dog.series || ""}" /></div>
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
          <label>等級</label>
          <input type="number" id="e-level" value="${dog.level ?? 1}" />
        </div>
      </div>
      <div class="form-group"><label>純／混度</label><input type="number" id="e-purity" value="${dog.purityMixDegree ?? 0}" /></div>
      <div class="form-group"><label>備註</label><textarea id="e-notes">${dog.notes || ""}</textarea></div>
      <div id="e-error" style="color:#b3543f; font-size:13px;"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">取消</button>
        <button type="button" class="btn btn-primary" data-action="save">儲存</button>
      </div>
    `,
    onMount: (modalEl) => {
      attachAutocomplete(modalEl.querySelector("#e-series"), []);
      modalEl.querySelector('[data-action="cancel"]').addEventListener("click", close);
      modalEl.querySelector('[data-action="save"]').addEventListener("click", async () => {
        try {
          await updateDog(dogId, {
            name: modalEl.querySelector("#e-name").value.trim(),
            series: modalEl.querySelector("#e-series").value.trim() || null,
            gender: modalEl.querySelector("#e-gender").value,
            level: Number(modalEl.querySelector("#e-level").value) || 0,
            purityMixDegree: Number(modalEl.querySelector("#e-purity").value) || 0,
            notes: modalEl.querySelector("#e-notes").value.trim()
          });
          close();
          await loadDog();
        } catch (err) {
          modalEl.querySelector("#e-error").textContent = "儲存失敗，請稍後再試";
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
    onMount: (modalEl) => {
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
    onMount: (modalEl) => {
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

        const [pedigreeResult] = await Promise.all([checkPedigreeCompatibility(dogId, partnerId)]);

        let predictedPurity = null;
        try {
          predictedPurity = calculateOffspringPurityDegree(dog.purityMixDegree, partner.purityMixDegree);
        } catch (e) {
          predictedPurity = null;
        }

        const genderWarning =
          dog.gender && partner.gender && dog.gender === partner.gender
            ? `<div style="color:var(--color-warning);">⚠ 兩隻狗性別相同，請確認是否正確</div>`
            : "";

        previewEl.style.display = "block";
        previewEl.innerHTML = `
          <div><strong>配對：</strong>${dog.name} × ${partner.name}</div>
          <div><strong>血緣檢查：</strong>${pedigreeResult.explanation}</div>
          <div><strong>父方純／混度：</strong>${dog.purityMixDegree ?? "-"}　<strong>母方純／混度：</strong>${partner.purityMixDegree ?? "-"}</div>
          <div><strong>預計下一代純／混度：</strong>${predictedPurity ?? "無法計算"}</div>
          ${genderWarning}
        `;
        previewEl.dataset.pedigreeStatus = pedigreeResult.status;
        previewEl.dataset.predictedPurity = predictedPurity ?? "";
        saveBtn.style.display = "inline-block";
      }

      saveBtn.addEventListener("click", async () => {
        if (!selectedPartnerId) {
          modalEl.querySelector("#b-error").textContent = "請先選擇配對對象";
          return;
        }
        try {
          await createBreedingPlan({
            dogAId: dogId,
            dogBId: selectedPartnerId,
            status: BREEDING_PLAN_STATUS.PLANNED,
            predictedPurityMixDegree: previewEl.dataset.predictedPurity
              ? Number(previewEl.dataset.predictedPurity)
              : null,
            pedigreeCheckResult: previewEl.dataset.pedigreeStatus
          });
          close();
          await loadDog();
        } catch (err) {
          modalEl.querySelector("#b-error").textContent = "建立失敗，請稍後再試";
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
