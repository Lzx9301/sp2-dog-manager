// ==================================================
// 父母選擇器（共用元件）
// ==================================================
// 新增／編輯狗狗時，「父親」「母親」欄位共用這一組邏輯：
//   - 下拉選單同時列出「我的狗狗」與「外部血統節點」
//   - 依欄位（父親／母親）優先把對應性別的狗排在前面，
//     但不強制限制，因為狗的性別之後可能會被修改
//   - 排除指定的狗（通常是自己，避免選到自己）
//   - 提供「＋ 新增外部血統節點」的小按鈕，建立後立即可選

import { createExternalNode } from "../services/externalPedigreeService.js";

/**
 * 產生父母欄位的 <select> innerHTML
 * @param {object} options
 * @param {Array} options.dogs - 所有狗狗清單（尚未排除自己）
 * @param {Array} options.externalNodes - 所有外部血統節點清單
 * @param {"male"|"female"} options.preferredGender - 這個欄位優先顯示的性別（父親→male，母親→female）
 * @param {string|null} options.excludeDogId - 要排除的狗 id（通常是自己）
 * @param {string|null} options.selectedId - 目前已選的值（編輯時用來預先選取）
 */
export function buildParentOptionsHtml({ dogs, externalNodes, preferredGender, excludeDogId, selectedId }) {
  const candidateDogs = dogs.filter((d) => d.id !== excludeDogId);
  const preferred = candidateDogs.filter((d) => d.gender === preferredGender);
  const others = candidateDogs.filter((d) => d.gender !== preferredGender);

  const dogOptionsHtml = [...preferred, ...others]
    .map((d) => {
      const mismatchNote = d.gender && d.gender !== preferredGender ? "（性別可能不符）" : "";
      const selected = d.id === selectedId ? "selected" : "";
      return `<option value="${d.id}" ${selected}>${d.name}${mismatchNote}</option>`;
    })
    .join("");

  const externalOptionsHtml = externalNodes
    .map((n) => {
      const selected = n.id === selectedId ? "selected" : "";
      return `<option value="${n.id}" ${selected}>${n.name}（外部血統）</option>`;
    })
    .join("");

  return `
    <option value="">（未知／不指定）</option>
    <optgroup label="我的狗狗">${dogOptionsHtml}</optgroup>
    <optgroup label="外部血統節點">${externalOptionsHtml || ""}</optgroup>
  `;
}

/**
 * 幫「父親」「母親」<select> 掛上「＋ 新增外部血統節點」按鈕的行為。
 * 建立後會把新節點加進 externalNodes 陣列（呼叫端傳入，會被就地修改），
 * 並自動加入到對應的 <select> 選單裡、選取它。
 *
 * @param {HTMLButtonElement} buttonEl
 * @param {HTMLSelectElement} selectEl
 * @param {Array} externalNodes - 外部血統節點陣列（會被就地 push 新節點）
 */
export function attachAddExternalNodeButton(buttonEl, selectEl, externalNodes) {
  buttonEl.addEventListener("click", async () => {
    const name = prompt("輸入外部血統節點名稱（例如：來源玩家的狗、無法追溯的舊狗名稱）：");
    if (!name || !name.trim()) return;

    try {
      const newNode = await createExternalNode({ name: name.trim() });
      externalNodes.push(newNode);

      const optgroup = selectEl.querySelector('optgroup[label="外部血統節點"]');
      const option = document.createElement("option");
      option.value = newNode.id;
      option.textContent = `${newNode.name}（外部血統）`;
      option.selected = true;
      if (optgroup) {
        optgroup.appendChild(option);
      } else {
        selectEl.appendChild(option);
      }
    } catch (err) {
      alert("建立外部血統節點失敗，請稍後再試");
      console.error(err);
    }
  });
}

/**
 * 幫父親／母親 <select> 掛上「選到性別不符的對象時顯示警告」的行為。
 * 不禁止選擇，只顯示提醒文字（因為狗的性別之後可能會被修改）。
 *
 * @param {HTMLSelectElement} selectEl
 * @param {HTMLElement} warningEl - 用來顯示警告文字的元素
 * @param {Array} dogs - 所有狗狗清單，用來查詢選到的狗的性別
 * @param {"male"|"female"} preferredGender
 */
export function attachGenderMismatchWarning(selectEl, warningEl, dogs, preferredGender) {
  function updateWarning() {
    const selectedDog = dogs.find((d) => d.id === selectEl.value);
    if (selectedDog && selectedDog.gender && selectedDog.gender !== preferredGender) {
      warningEl.textContent = "⚠ 所選狗狗目前登記的性別與此欄位不符，請確認是否正確（狗的性別可隨時修改，不影響選擇）";
    } else {
      warningEl.textContent = "";
    }
  }
  selectEl.addEventListener("change", updateWarning);
  updateWarning();
}
