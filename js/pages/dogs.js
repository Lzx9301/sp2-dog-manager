// ==================================================
// 狗狗管理頁面 (dogs.html)
// ==================================================
import { requireLogin } from "../services/authService.js";
import { renderNav } from "../components/nav.js";
import { openModal } from "../components/modal.js";
import { attachAutocomplete, attachTagInput } from "../components/autocomplete.js";
import { buildParentOptionsHtml, attachAddExternalNodeButton, attachGenderMismatchWarning } from "../components/parentPicker.js";
import {
  searchDogs,
  createDog,
  updateDog,
  getAllDogs,
  getDistinctSeriesList,
  getDistinctMemorialTags
} from "../services/dogService.js";
import { getActiveAccounts } from "../services/accountService.js";
import { getActiveBreeds } from "../services/breedService.js";
import { getAllEffects, MAX_EFFECTS_PER_DOG } from "../services/effectService.js";
import { getAllPatterns } from "../services/patternService.js";
import { getAllExternalNodes } from "../services/externalPedigreeService.js";
import { GENDER_LABELS, DOG_TYPE_LABELS, SOURCE_TYPE_LABELS } from "../utils/constants.js";
import { isMouthPattern, formatMouthDogLabel, isValidMouthSourceBreedId } from "../utils/mouthType.js";

await requireLogin();
renderNav("dogs.html");

// ---------- 共用參考資料（先載入一次，表單與篩選都會用到） ----------
let accounts = [];
let breeds = [];
let effects = [];
let patterns = [];
let seriesList = [];
let memorialTags = [];
let allDogs = [];
let externalNodes = [];

async function loadReferenceData() {
  [accounts, breeds, effects, patterns, seriesList, memorialTags, allDogs, externalNodes] = await Promise.all([
    getActiveAccounts(),
    getActiveBreeds(),
    getAllEffects(),
    getAllPatterns(),
    getDistinctSeriesList(),
    getDistinctMemorialTags(),
    getAllDogs(),
    getAllExternalNodes()
  ]);
}

function populateFilterSelects() {
  fillSelect("filter-account", accounts, (a) => a.id, (a) => a.accountName || a.id);
  fillSelect("filter-breed", breeds, (b) => b.id, (b) => b.name);
  fillSelect("filter-series", seriesList.map((s) => ({ id: s, name: s })), (s) => s.id, (s) => s.name);
  fillSelect("filter-memorial-tag", memorialTags.map((t) => ({ id: t, name: t })), (t) => t.id, (t) => t.name);
}

function fillSelect(selectId, items, getValue, getLabel, { keepFirst = true } = {}) {
  const el = document.getElementById(selectId);
  const firstOption = keepFirst ? el.querySelector("option") : null;
  el.innerHTML = "";
  if (firstOption) el.appendChild(firstOption);
  items.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = getValue(item);
    opt.textContent = getLabel(item);
    el.appendChild(opt);
  });
}

// ---------- 列表渲染 ----------

function getCurrentFilters() {
  return {
    accountId: document.getElementById("filter-account").value,
    breedId: document.getElementById("filter-breed").value,
    gender: document.getElementById("filter-gender").value,
    dogType: document.getElementById("filter-dogtype").value,
    series: document.getElementById("filter-series").value,
    memorialTag: document.getElementById("filter-memorial-tag").value
  };
}

async function refreshDogList() {
  const keyword = document.getElementById("search-input").value;
  const filters = getCurrentFilters();
  const dogs = await searchDogs(keyword, filters);
  renderDogList(dogs);
}

function accountName(accountId) {
  const found = accounts.find((a) => a.id === accountId);
  return found ? found.accountName : "（未設定帳號）";
}

function breedName(breedId) {
  const found = breeds.find((b) => b.id === breedId);
  return found ? found.name : "（未設定品種）";
}

function patternById(patternId) {
  return patterns.find((p) => p.id === patternId) || null;
}

/**
 * 計算狗狗的「外觀顯示文字」。
 * 如果是嘴狗（混種 + 圖案為嘴），顯示「熊嘴薩摩」這種組合文字；
 * 沒有嘴型來源就顯示「未設定嘴型的嘴薩摩」。
 * 不是嘴狗就回傳 null，交給呼叫端用原本的方式顯示（品種／圖案名稱）。
 */
function mouthDogDisplayLabel(dog) {
  if (dog.dogType !== "mixed") return null;
  const pattern = patternById(dog.patternId);
  if (!isMouthPattern(pattern)) return null;

  const selfBreedName = breeds.find((b) => b.id === dog.breedId)?.name || null;
  const mouthSourceBreedName = breeds.find((b) => b.id === dog.mouthSourceBreedId)?.name || null;
  return formatMouthDogLabel(selfBreedName, mouthSourceBreedName);
}

function renderDogList(dogs) {
  const listEl = document.getElementById("dog-list");
  listEl.innerHTML = "";

  if (dogs.length === 0) {
    listEl.innerHTML = `<div class="empty-state">沒有符合條件的狗狗</div>`;
    return;
  }

  dogs.forEach((dog) => {
    const mouthLabel = mouthDogDisplayLabel(dog);
    const card = document.createElement("div");
    card.className = "card dog-card";
    card.innerHTML = `
      <div class="dog-name">${dog.name || "（未命名）"}</div>
      <div class="dog-meta">
        ${dog.series ? `<span class="tag">${dog.series}</span>` : ""}
        <span class="tag tag-gender-${dog.gender}">${GENDER_LABELS[dog.gender] || dog.gender || "未設定"}</span>
        <span class="tag">${DOG_TYPE_LABELS[dog.dogType] || dog.dogType || "未設定"}</span>
      </div>
      <div class="dog-meta" style="margin-top:6px;">
        ${mouthLabel ? `外觀：${mouthLabel}<br/>` : `品種：${breedName(dog.breedId)}<br/>`}
        帳號：${accountName(dog.accountId)}<br/>
        等級：Lv.${dog.level ?? "-"}　純／混度：${dog.purityMixDegree ?? "-"}
      </div>
    `;
    card.addEventListener("click", () => {
      window.location.href = `dog-detail.html?id=${dog.id}`;
    });
    listEl.appendChild(card);
  });
}

// ---------- 新增狗狗表單 ----------

function accountOptionsHtml() {
  return accounts.map((a) => `<option value="${a.id}">${a.accountName}</option>`).join("");
}

function breedOptionsHtml() {
  return breeds.map((b) => `<option value="${b.id}">${b.name}</option>`).join("");
}

function effectCheckboxesHtml() {
  return effects
    .map(
      (e) => `
      <label style="display:inline-flex; align-items:center; gap:4px; margin-right:10px;">
        <input type="checkbox" class="effect-checkbox" value="${e.id}" />${e.name}
      </label>`
    )
    .join("");
}

function patternOptionsHtml() {
  return patterns.map((p) => `<option value="${p.id}">${p.canonicalName}</option>`).join("");
}

function openAddDogModal() {
  const { close, el } = openModal({
    title: "新增狗狗",
    contentHtml: `
      <div class="form-row">
        <div class="form-group">
          <label>名稱</label>
          <input type="text" id="f-name" />
        </div>
        <div class="form-group">
          <label>系列（可自由輸入新系列）</label>
          <input type="text" id="f-series" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>所在帳號</label>
          <select id="f-account"><option value="">（未指定）</option>${accountOptionsHtml()}</select>
        </div>
        <div class="form-group">
          <label>品種</label>
          <select id="f-breed"><option value="">（未設定）</option>${breedOptionsHtml()}</select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>性別</label>
          <select id="f-gender">
            <option value="male">公</option>
            <option value="female">母</option>
          </select>
        </div>
        <div class="form-group">
          <label>純種／混種</label>
          <select id="f-dogtype">
            <option value="pure">純種</option>
            <option value="mixed">混種</option>
          </select>
        </div>
      </div>

      <div class="form-group" id="f-pure-effects-group">
        <label>特效（純種，最多 ${MAX_EFFECTS_PER_DOG} 個）</label>
        <div>${effectCheckboxesHtml() || "尚未建立任何特效，請先到系統設定新增"}</div>
      </div>

      <div class="form-group" id="f-mixed-pattern-group" style="display:none;">
        <label>圖案（混種）</label>
        <select id="f-pattern"><option value="">（未設定）</option>${patternOptionsHtml()}</select>
      </div>

      <div class="form-group" id="f-mouth-source-group" style="display:none;">
        <label>嘴型來源／這是什麼嘴</label>
        <select id="f-mouth-source"><option value="">（請選擇）</option>${breedOptionsHtml()}</select>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>父親（選填）</label>
          <select id="f-father">${buildParentOptionsHtml({
            dogs: allDogs,
            externalNodes,
            preferredGender: "male",
            excludeDogId: null,
            selectedId: null
          })}</select>
          <button type="button" class="btn btn-secondary btn-small" id="f-add-external-father" style="margin-top:4px;">＋ 新增外部血統節點</button>
          <div id="f-father-warning" style="color:var(--color-warning); font-size:12px; margin-top:2px;"></div>
        </div>
        <div class="form-group">
          <label>母親（選填）</label>
          <select id="f-mother">${buildParentOptionsHtml({
            dogs: allDogs,
            externalNodes,
            preferredGender: "female",
            excludeDogId: null,
            selectedId: null
          })}</select>
          <button type="button" class="btn btn-secondary btn-small" id="f-add-external-mother" style="margin-top:4px;">＋ 新增外部血統節點</button>
          <div id="f-mother-warning" style="color:var(--color-warning); font-size:12px; margin-top:2px;"></div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>純／混度</label>
          <input type="number" id="f-purity" value="1" />
        </div>
        <div class="form-group">
          <label>等級</label>
          <input type="number" id="f-level" value="1" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>取得方式</label>
          <select id="f-source-type">
            <option value="purchase">購買</option>
            <option value="exchange">交換</option>
            <option value="gift">贈送</option>
            <option value="self_bred">自己接生</option>
            <option value="other">其他</option>
          </select>
        </div>
        <div class="form-group">
          <label>來源對象</label>
          <input type="text" id="f-source-person" />
        </div>
      </div>

      <div class="form-group">
        <label>生日（選填）</label>
        <input type="date" id="f-birthdate" />
      </div>

      <div class="form-group">
        <label>紀念標籤（可多個，按 Enter 新增）</label>
        <div id="f-tag-chips"></div>
        <input type="text" id="f-tag-input" placeholder="輸入後按 Enter" />
      </div>

      <div class="form-group">
        <label>備註</label>
        <textarea id="f-notes"></textarea>
      </div>

      <div id="f-error" style="color:#b3543f; font-size:13px;"></div>

      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">取消</button>
        <button type="button" class="btn btn-primary" data-action="save">儲存</button>
      </div>
    `,
    onMount: (modalEl, close) => {
      // 系列 autocomplete
      attachAutocomplete(modalEl.querySelector("#f-series"), seriesList);

      // 紀念標籤 tag input
      const tagInputController = attachTagInput(
        modalEl.querySelector("#f-tag-chips"),
        modalEl.querySelector("#f-tag-input"),
        memorialTags
      );

      // dogType 切換顯示特效／圖案
      const dogTypeSelect = modalEl.querySelector("#f-dogtype");
      const effectsGroup = modalEl.querySelector("#f-pure-effects-group");
      const patternGroup = modalEl.querySelector("#f-mixed-pattern-group");
      const patternSelect = modalEl.querySelector("#f-pattern");
      const mouthSourceGroup = modalEl.querySelector("#f-mouth-source-group");

      function syncMouthSourceVisibility() {
        const isMixed = dogTypeSelect.value === "mixed";
        const selectedPattern = patternById(patternSelect.value);
        const showMouthField = isMixed && isMouthPattern(selectedPattern);
        mouthSourceGroup.style.display = showMouthField ? "block" : "none";
        if (!showMouthField) {
          modalEl.querySelector("#f-mouth-source").value = "";
        }
      }

      dogTypeSelect.addEventListener("change", () => {
        if (dogTypeSelect.value === "pure") {
          effectsGroup.style.display = "block";
          patternGroup.style.display = "none";
        } else {
          effectsGroup.style.display = "none";
          patternGroup.style.display = "block";
        }
        syncMouthSourceVisibility();
      });
      patternSelect.addEventListener("change", syncMouthSourceVisibility);

      // 父母欄位：新增外部血統節點按鈕 + 性別不符警告
      const fatherSelect = modalEl.querySelector("#f-father");
      const motherSelect = modalEl.querySelector("#f-mother");
      attachAddExternalNodeButton(modalEl.querySelector("#f-add-external-father"), fatherSelect, externalNodes);
      attachAddExternalNodeButton(modalEl.querySelector("#f-add-external-mother"), motherSelect, externalNodes);
      attachGenderMismatchWarning(fatherSelect, modalEl.querySelector("#f-father-warning"), allDogs, "male");
      attachGenderMismatchWarning(motherSelect, modalEl.querySelector("#f-mother-warning"), allDogs, "female");

      modalEl.querySelector('[data-action="cancel"]').addEventListener("click", close);

      modalEl.querySelector('[data-action="save"]').addEventListener("click", async () => {
        const errorEl = modalEl.querySelector("#f-error");
        errorEl.textContent = "";

        const dogType = dogTypeSelect.value;
        const selectedEffectIds = Array.from(
          modalEl.querySelectorAll(".effect-checkbox:checked")
        ).map((cb) => cb.value);

        if (dogType === "pure" && selectedEffectIds.length > MAX_EFFECTS_PER_DOG) {
          errorEl.textContent = `特效最多只能選 ${MAX_EFFECTS_PER_DOG} 個`;
          return;
        }

        const name = modalEl.querySelector("#f-name").value.trim();
        if (!name) {
          errorEl.textContent = "請輸入名稱";
          return;
        }

        // 嘴型驗證：圖案是嘴的話，一定要選嘴型來源品種，且必須是允許清單裡的品種
        const selectedPatternId = dogType === "mixed" ? modalEl.querySelector("#f-pattern").value || null : null;
        const selectedPattern = patternById(selectedPatternId);
        const isMouthDog = dogType === "mixed" && isMouthPattern(selectedPattern);
        const mouthSourceBreedId = modalEl.querySelector("#f-mouth-source").value || null;
        const validBreedIds = breeds.map((b) => b.id);

        if (isMouthDog && !isValidMouthSourceBreedId(mouthSourceBreedId, validBreedIds)) {
          errorEl.textContent = "這是嘴圖案，請選擇嘴型來源品種";
          return;
        }

        const dogData = {
          name,
          series: modalEl.querySelector("#f-series").value.trim() || null,
          accountId: modalEl.querySelector("#f-account").value || null,
          breedId: modalEl.querySelector("#f-breed").value || null,
          gender: modalEl.querySelector("#f-gender").value,
          dogType,
          effects: dogType === "pure" ? selectedEffectIds : [],
          patternId: selectedPatternId,
          mouthSourceBreedId: isMouthDog ? mouthSourceBreedId : null,
          purityMixDegree: Number(modalEl.querySelector("#f-purity").value) || 0,
          level: Number(modalEl.querySelector("#f-level").value) || 1,
          sourceType: modalEl.querySelector("#f-source-type").value,
          sourcePerson: modalEl.querySelector("#f-source-person").value.trim(),
          birthDate: modalEl.querySelector("#f-birthdate").value || null,
          memorialTags: tagInputController.getSelectedTags(),
          notes: modalEl.querySelector("#f-notes").value.trim(),
          fatherId: modalEl.querySelector("#f-father").value || null,
          motherId: modalEl.querySelector("#f-mother").value || null
        };

        try {
          await createDog(dogData);
          close();
          await loadReferenceData(); // 系列/標籤可能有新增，重新整理建議清單
          populateFilterSelects();
          await refreshDogList();
        } catch (err) {
          errorEl.textContent = "儲存失敗，請稍後再試";
          console.error(err);
        }
      });
    }
  });
}

// ---------- 待補嘴型清單 ----------

/** 找出「圖案是嘴，但 mouthSourceBreedId 缺失」的狗 */
function findDogsMissingMouthSource() {
  return allDogs.filter((dog) => {
    if (dog.dogType !== "mixed") return false;
    const pattern = patternById(dog.patternId);
    if (!isMouthPattern(pattern)) return false;
    return !dog.mouthSourceBreedId;
  });
}

function openPendingMouthModal() {
  const missingDogs = findDogsMissingMouthSource();

  const { close, el } = openModal({
    title: `待補嘴型清單（${missingDogs.length}）`,
    contentHtml: `
      <div id="pending-mouth-list"></div>
    `,
    onMount: (modalEl) => {
      renderPendingMouthList(modalEl.querySelector("#pending-mouth-list"), missingDogs);
    }
  });
}

function renderPendingMouthList(container, missingDogs) {
  if (missingDogs.length === 0) {
    container.innerHTML = `<div class="empty-state">目前沒有待補嘴型的狗</div>`;
    return;
  }

  container.innerHTML = missingDogs
    .map(
      (dog) => `
      <div style="padding:8px 0; border-bottom:1px solid var(--color-border);" data-dog-row="${dog.id}">
        <div><strong>${dog.name}</strong>　自身品種：${breedName(dog.breedId)}　帳號：${accountName(dog.accountId)}</div>
        <div style="display:flex; gap:6px; margin-top:6px; align-items:center;">
          <select class="pending-mouth-select" data-dog-id="${dog.id}"><option value="">（選擇嘴型來源）</option>${breedOptionsHtml()}</select>
          <button class="btn btn-primary btn-small pending-mouth-save-btn" data-dog-id="${dog.id}">快速設定</button>
        </div>
      </div>
    `
    )
    .join("");

  container.querySelectorAll(".pending-mouth-save-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const dogId = btn.dataset.dogId;
      const select = container.querySelector(`.pending-mouth-select[data-dog-id="${dogId}"]`);
      const mouthSourceBreedId = select.value;
      const validBreedIds = breeds.map((b) => b.id);

      if (!isValidMouthSourceBreedId(mouthSourceBreedId, validBreedIds)) {
        alert("請選擇嘴型來源品種");
        return;
      }

      try {
        await updateDog(dogId, { mouthSourceBreedId });
        await loadReferenceData();
        const remaining = findDogsMissingMouthSource();
        renderPendingMouthList(container, remaining);
        await refreshDogList();
      } catch (err) {
        alert("設定失敗，請稍後再試");
        console.error(err);
      }
    });
  });
}

// ---------- 事件綁定 ----------

document.getElementById("add-dog-btn").addEventListener("click", openAddDogModal);
document.getElementById("pending-mouth-btn").addEventListener("click", openPendingMouthModal);
document.getElementById("search-input").addEventListener("input", debounce(refreshDogList, 250));
["filter-account", "filter-breed", "filter-gender", "filter-dogtype", "filter-series", "filter-memorial-tag"].forEach(
  (id) => document.getElementById(id).addEventListener("change", refreshDogList)
);

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ---------- 初始化 ----------

await loadReferenceData();
populateFilterSelects();
await refreshDogList();
