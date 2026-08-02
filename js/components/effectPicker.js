// ==================================================
// 特效選擇器（共用元件）
// ==================================================
// 新增／編輯狗狗、建立子代的特效 checkbox 群組共用這一組邏輯：
//   - 產生 checkbox HTML
//   - 依 dogType 即時限制可勾選數量（純種最多 3、混種最多 1）
//   - 使用者勾太多時，不直接清空，取消「剛剛那個造成超過的動作」
//   - dogType 切換時，保留前面的合法數量，超過的部分才移除，並顯示提示文字
//
// 規則本身定義在 js/utils/effectValidation.js，這裡只負責 DOM 行為。

import { validateDogEffects } from "../utils/effectValidation.js";

/** 產生特效 checkbox 群組的 HTML */
export function buildEffectCheckboxesHtml(effects, selectedIds = [], checkboxClass = "effect-checkbox") {
  const selectedSet = new Set(selectedIds);
  return effects
    .map(
      (e) => `
      <label style="display:inline-flex; align-items:center; gap:4px; margin-right:10px;">
        <input type="checkbox" class="${checkboxClass}" value="${e.id}" ${selectedSet.has(e.id) ? "checked" : ""} />${e.name}
      </label>`
    )
    .join("");
}

/**
 * 幫一組特效 checkbox 掛上即時的數量限制行為。
 *
 * @param {object} options
 * @param {HTMLElement} options.containerEl - 包含所有 checkbox 的容器
 * @param {string} options.checkboxSelector - checkbox 的 CSS selector（例如 ".effect-checkbox"）
 * @param {() => string} options.getDogType - 取得目前的 dogType（"pure" | "mixed"）
 * @param {HTMLElement} [options.warningEl] - 用來顯示提示文字的元素（選填）
 * @returns {{
 *   enforceOnTypeChange: () => void,
 *   getCheckedIds: () => string[]
 * }}
 *   enforceOnTypeChange - dogType 切換時呼叫，會依新的上限保留前面合法數量、移除超過的部分
 *   getCheckedIds       - 取得目前勾選的特效 id 清單
 */
export function attachEffectEnforcement({ containerEl, checkboxSelector, getDogType, warningEl }) {
  function getCheckboxes() {
    return Array.from(containerEl.querySelectorAll(checkboxSelector));
  }

  function getCheckedIds() {
    return getCheckboxes()
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);
  }

  function setWarning(message) {
    if (warningEl) warningEl.textContent = message || "";
  }

  /**
   * 使用者勾選／取消勾選某個 checkbox 時呼叫：如果因此超過目前 dogType 的上限，
   * 直接取消「剛剛使用者勾的那一個」（也就是不允許這次操作生效），而不是清空全部。
   */
  function handleCheckboxChange(changedCheckbox) {
    const dogType = getDogType();
    const checkedIds = getCheckedIds();
    const result = validateDogEffects(dogType, checkedIds);

    if (!result.valid) {
      if (changedCheckbox && changedCheckbox.checked) {
        // 使用者這次的動作是「多勾一個」導致超過上限，把這次的勾選復原
        changedCheckbox.checked = false;
      } else {
        // 理論上不太會發生（取消勾選只會讓數量變少），保險起見還是照 correctedEffects 修正一次
        const keepSet = new Set(result.correctedEffects);
        getCheckboxes().forEach((cb) => {
          if (cb.checked && !keepSet.has(cb.value)) cb.checked = false;
        });
      }
      setWarning(result.errorMessage);
    } else {
      setWarning("");
    }
  }

  /**
   * dogType 切換時呼叫：保留前面的合法數量，移除超過的部分（不是直接清空），並顯示提示。
   */
  function enforceOnTypeChange() {
    const dogType = getDogType();
    const checkedIds = getCheckedIds();
    const result = validateDogEffects(dogType, checkedIds);

    if (!result.valid) {
      const keepSet = new Set(result.correctedEffects);
      getCheckboxes().forEach((cb) => {
        if (cb.checked && !keepSet.has(cb.value)) cb.checked = false;
      });
      setWarning(result.errorMessage);
    } else {
      setWarning("");
    }
  }

  getCheckboxes().forEach((cb) => {
    cb.addEventListener("change", () => handleCheckboxChange(cb));
  });

  return { enforceOnTypeChange, getCheckedIds };
}
