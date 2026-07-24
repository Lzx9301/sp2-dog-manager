// ==================================================
// Autocomplete 元件
// ==================================================
// 用於「自由輸入＋自動建議」的欄位，例如系列、紀念標籤。
// 不使用任何前端框架，純 DOM 操作。
//
// 使用方式：
//   attachAutocomplete(inputElement, suggestionListArray)
//   輸入時會在 input 下方顯示符合的建議，點擊建議會帶入 input。

/**
 * 幫一個 <input> 元素掛上 autocomplete 建議清單
 * @param {HTMLInputElement} inputEl
 * @param {string[]} suggestions - 目前可供建議的選項（例如所有已存在的系列名稱）
 * @param {(value: string) => void} [onSelect] - 選擇建議後的 callback（選填）
 */
export function attachAutocomplete(inputEl, suggestions, onSelect) {
  const wrapper = document.createElement("div");
  wrapper.className = "autocomplete-wrapper";
  inputEl.parentNode.insertBefore(wrapper, inputEl);
  wrapper.appendChild(inputEl);

  const listEl = document.createElement("ul");
  listEl.className = "autocomplete-list";
  listEl.style.display = "none";
  wrapper.appendChild(listEl);

  function renderSuggestions(keyword) {
    const lower = keyword.trim().toLowerCase();
    const matched = lower
      ? suggestions.filter((s) => s.toLowerCase().includes(lower))
      : suggestions;

    listEl.innerHTML = "";

    if (matched.length === 0) {
      listEl.style.display = "none";
      return;
    }

    matched.slice(0, 20).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      li.className = "autocomplete-item";
      li.addEventListener("mousedown", (e) => {
        // mousedown 而不是 click，避免 input 的 blur 事件先觸發導致清單先被隱藏
        e.preventDefault();
        inputEl.value = item;
        listEl.style.display = "none";
        if (onSelect) onSelect(item);
      });
      listEl.appendChild(li);
    });

    listEl.style.display = "block";
  }

  inputEl.addEventListener("input", () => renderSuggestions(inputEl.value));
  inputEl.addEventListener("focus", () => renderSuggestions(inputEl.value));
  inputEl.addEventListener("blur", () => {
    // 延遲隱藏，讓 mousedown 的選取事件有機會先執行
    setTimeout(() => (listEl.style.display = "none"), 150);
  });
}

/**
 * 多選標籤輸入元件（用於紀念標籤等可複選＋自由新增的欄位）
 * @param {HTMLElement} containerEl - 用來渲染已選標籤 chip 的容器
 * @param {HTMLInputElement} inputEl - 輸入新標籤用的 input
 * @param {string[]} existingTags - 目前系統中已存在的標籤（給 autocomplete 建議）
 * @param {string[]} initialSelected - 初始已選的標籤
 * @returns {{ getSelectedTags: () => string[] }}
 */
export function attachTagInput(containerEl, inputEl, existingTags, initialSelected = []) {
  let selectedTags = [...initialSelected];

  function renderChips() {
    containerEl.innerHTML = "";
    selectedTags.forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.textContent = tag;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "tag-chip-remove";
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", () => {
        selectedTags = selectedTags.filter((t) => t !== tag);
        renderChips();
      });

      chip.appendChild(removeBtn);
      containerEl.appendChild(chip);
    });
  }

  function addTag(tag) {
    const trimmed = tag.trim();
    if (!trimmed || selectedTags.includes(trimmed)) return;
    selectedTags.push(trimmed);
    renderChips();
    inputEl.value = "";
  }

  attachAutocomplete(inputEl, existingTags, (value) => addTag(value));

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputEl.value);
    }
  });

  renderChips();

  return {
    getSelectedTags: () => selectedTags
  };
}
