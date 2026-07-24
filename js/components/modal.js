// ==================================================
// Modal 元件
// ==================================================
// 簡易彈出視窗，不依賴任何框架。
// 用於：新增/編輯表單、確認刪除、顯示血緣路徑等情境。

/**
 * 開啟一個 Modal
 * @param {{title: string, contentHtml: string, onMount?: (modalEl: HTMLElement) => void}} options
 * @returns {{ close: () => void, el: HTMLElement }}
 */
export function openModal({ title, contentHtml, onMount }) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal";

  modal.innerHTML = `
    <div class="modal-header">
      <h3>${title}</h3>
      <button type="button" class="modal-close-btn" aria-label="關閉">×</button>
    </div>
    <div class="modal-body">${contentHtml}</div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
  }

  modal.querySelector(".modal-close-btn").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  if (onMount) onMount(modal);

  return { close, el: modal };
}

/** 簡易確認對話框，回傳 Promise<boolean> */
export function confirmModal(message) {
  return new Promise((resolve) => {
    const { close } = openModal({
      title: "請確認",
      contentHtml: `
        <p>${message}</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" data-action="cancel">取消</button>
          <button type="button" class="btn btn-danger" data-action="confirm">確定</button>
        </div>
      `,
      onMount: (modalEl) => {
        modalEl.querySelector('[data-action="cancel"]').addEventListener("click", () => {
          close();
          resolve(false);
        });
        modalEl.querySelector('[data-action="confirm"]').addEventListener("click", () => {
          close();
          resolve(true);
        });
      }
    });
  });
}
