// ==================================================
// 血緣檢查頁面 (pedigree-check.html)
// ==================================================
import { requireLogin } from "../services/authService.js";
import { renderNav } from "../components/nav.js";
import { searchDogs, getAllDogs, getDogById } from "../services/dogService.js";
import { checkPedigreeCompatibility, scanRebreedCandidates } from "../utils/pedigreeService.js";
import { predictOffspring } from "../utils/breedingPrediction.js";
import { getAccountById } from "../services/accountService.js";

await requireLogin();
renderNav("pedigree-check.html");

let selectedDogAId = null;
let selectedDogBId = null;
let selectedTargetId = null;

function setupSearchPicker(inputId, resultsId, onSelect) {
  const input = document.getElementById(inputId);
  const resultsEl = document.getElementById(resultsId);

  input.addEventListener("input", debounce(async () => {
    const keyword = input.value.trim();
    if (!keyword) {
      resultsEl.innerHTML = "";
      return;
    }
    const results = (await searchDogs(keyword)).slice(0, 8);
    resultsEl.innerHTML = results
      .map((d) => `<span class="tag" style="cursor:pointer;" data-id="${d.id}">${d.name}</span>`)
      .join(" ");
    resultsEl.querySelectorAll("[data-id]").forEach((el) => {
      el.addEventListener("click", () => {
        input.value = el.textContent;
        resultsEl.innerHTML = "";
        onSelect(el.dataset.id);
      });
    });
  }, 250));
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

setupSearchPicker("dog-a-search", "dog-a-results", (id) => (selectedDogAId = id));
setupSearchPicker("dog-b-search", "dog-b-results", (id) => (selectedDogBId = id));
setupSearchPicker("target-search", "target-results", (id) => (selectedTargetId = id));

const STATUS_LABELS = {
  restricted: "三代限制內",
  outside_restricted_generations: "已離開三代限制，可回配",
  no_known_relation: "查無已知血緣關聯",
  insufficient_data: "資料不足，無法完全確定",
  confirmed_related_unknown_distance: "人工確認有血緣（距離未知）"
};

document.getElementById("check-btn").addEventListener("click", async () => {
  const resultEl = document.getElementById("check-result");
  if (!selectedDogAId || !selectedDogBId) {
    resultEl.innerHTML = `<div style="color:#b3543f;">請先從搜尋結果中選擇狗 A 與狗 B</div>`;
    return;
  }

  resultEl.innerHTML = "檢查中...";

  const [dogA, dogB, result] = await Promise.all([
    getDogById(selectedDogAId),
    getDogById(selectedDogBId),
    checkPedigreeCompatibility(selectedDogAId, selectedDogBId)
  ]);

  const prediction = predictOffspring(dogA, dogB);
  const predictionLine = prediction.valid
    ? `<div><strong>預計下一代：</strong>${prediction.displayLabel}</div>`
    : `<div style="color:var(--color-danger);"><strong>預計下一代：</strong>${prediction.errorMessage}</div>`;

  resultEl.innerHTML = `
    <div><strong>結果：</strong>${STATUS_LABELS[result.status] || result.status}</div>
    <div><strong>說明：</strong>${result.explanation}</div>
    ${result.distance !== null ? `<div><strong>血緣距離：</strong>${result.distance} 代</div>` : ""}
    ${
      result.path
        ? `<div><strong>血緣路徑：</strong>${result.path
            .map((id) => id)
            .join(" → ")}</div>`
        : ""
    }
    ${predictionLine}
  `;
});

document.getElementById("scan-btn").addEventListener("click", async () => {
  const resultEl = document.getElementById("scan-result");
  if (!selectedTargetId) {
    resultEl.innerHTML = `<div style="color:#b3543f;">請先選擇目標狗</div>`;
    return;
  }

  resultEl.innerHTML = "掃描中，資料量大時可能需要一點時間...";

  const targetDog = await getDogById(selectedTargetId);
  const allDogs = await getAllDogs();
  const candidateIds = allDogs.filter((d) => d.id !== selectedTargetId).map((d) => d.id);

  const scanResults = await scanRebreedCandidates(selectedTargetId, candidateIds);

  const groups = {
    outside_restricted_generations: [],
    restricted: [],
    unknown: []
  };

  for (const item of scanResults) {
    if (item.status === "outside_restricted_generations") groups.outside_restricted_generations.push(item);
    else if (item.status === "restricted") groups.restricted.push(item);
    else groups.unknown.push(item);
  }

  async function renderGroup(title, items) {
    if (items.length === 0) return `<h3 style="font-size:14px; margin-top:12px;">${title}（0）</h3>`;

    const rows = await Promise.all(
      items.map(async (item) => {
        const candidate = await getDogById(item.candidateId);
        const account = candidate ? await getAccountById(candidate.accountId) : null;
        const prediction = predictOffspring(targetDog, candidate);
        const predictionText = prediction.valid ? prediction.displayLabel : "資料不足，無法預測";

        return `
          <div style="padding:6px 0; border-bottom:1px solid var(--color-border);">
            <a href="dog-detail.html?id=${item.candidateId}">${candidate ? candidate.name : "未知"}</a>
            　帳號：${account ? account.accountName : "（無）"}
            　血緣狀態：${STATUS_LABELS[item.status] || item.status}
            　預計下一代：${predictionText}
          </div>
        `;
      })
    );

    return `<h3 style="font-size:14px; margin-top:12px;">${title}（${items.length}）</h3>${rows.join("")}`;
  }

  resultEl.innerHTML =
    (await renderGroup("已離開三代限制，可回配", groups.outside_restricted_generations)) +
    (await renderGroup("三代限制內", groups.restricted)) +
    (await renderGroup("未知／資料不足", groups.unknown));
});
