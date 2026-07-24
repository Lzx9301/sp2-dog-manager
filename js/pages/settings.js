// ==================================================
// 系統設定頁面 (settings.html)
// ==================================================
import { requireLogin } from "../services/authService.js";
import { renderNav } from "../components/nav.js";
import { openModal, confirmModal } from "../components/modal.js";
import {
  getAllBreeds,
  createBreed,
  updateBreed
} from "../services/breedService.js";
import { getAllEffects, createEffect, updateEffect, deleteEffect } from "../services/effectService.js";
import {
  getAllPatterns,
  createPattern,
  updatePattern,
  addAliasToPattern,
  deletePattern
} from "../services/patternService.js";

await requireLogin();
renderNav("settings.html");

// ---------- 品種 ----------

async function loadBreeds() {
  const breeds = await getAllBreeds();
  const el = document.getElementById("breed-list");
  el.innerHTML = "";

  if (breeds.length === 0) {
    el.innerHTML = `<div class="empty-state">尚未建立任何品種</div>`;
    return;
  }

  breeds.forEach((breed, index) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid var(--color-border);";
    row.innerHTML = `
      <span style="flex:1;">${breed.name} ${breed.isActive === false ? '<span class="tag">已停用</span>' : ""}</span>
      <button class="btn btn-secondary btn-small" data-action="up">↑</button>
      <button class="btn btn-secondary btn-small" data-action="down">↓</button>
      <button class="btn btn-secondary btn-small" data-action="rename">改名</button>
      <button class="btn btn-secondary btn-small" data-action="toggle">${breed.isActive === false ? "啟用" : "停用"}</button>
    `;

    row.querySelector('[data-action="up"]').addEventListener("click", async () => {
      if (index === 0) return;
      await swapBreedOrder(breeds[index - 1], breed);
      await loadBreeds();
    });
    row.querySelector('[data-action="down"]').addEventListener("click", async () => {
      if (index === breeds.length - 1) return;
      await swapBreedOrder(breed, breeds[index + 1]);
      await loadBreeds();
    });
    row.querySelector('[data-action="rename"]').addEventListener("click", async () => {
      const newName = prompt("輸入新的品種名稱：", breed.name);
      if (newName && newName.trim()) {
        await updateBreed(breed.id, { name: newName.trim() });
        await loadBreeds();
      }
    });
    row.querySelector('[data-action="toggle"]').addEventListener("click", async () => {
      await updateBreed(breed.id, { isActive: breed.isActive === false });
      await loadBreeds();
    });

    el.appendChild(row);
  });
}

async function swapBreedOrder(breedA, breedB) {
  const orderA = breedA.sortOrder ?? 0;
  const orderB = breedB.sortOrder ?? 0;
  await Promise.all([
    updateBreed(breedA.id, { sortOrder: orderB }),
    updateBreed(breedB.id, { sortOrder: orderA })
  ]);
}

document.getElementById("add-breed-btn").addEventListener("click", async () => {
  const name = prompt("輸入品種名稱：");
  if (name && name.trim()) {
    const breeds = await getAllBreeds();
    const maxOrder = breeds.reduce((max, b) => Math.max(max, b.sortOrder ?? 0), 0);
    await createBreed({ name: name.trim(), sortOrder: maxOrder + 1 });
    await loadBreeds();
  }
});

// ---------- 特效 ----------

async function loadEffects() {
  const effects = await getAllEffects();
  const el = document.getElementById("effect-list");
  el.innerHTML = "";

  if (effects.length === 0) {
    el.innerHTML = `<div class="empty-state">尚未建立任何特效</div>`;
    return;
  }

  effects.forEach((effect) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid var(--color-border);";
    row.innerHTML = `
      <span style="flex:1;">${effect.name}</span>
      <button class="btn btn-secondary btn-small" data-action="rename">改名</button>
      <button class="btn btn-danger btn-small" data-action="delete">刪除</button>
    `;

    row.querySelector('[data-action="rename"]').addEventListener("click", async () => {
      const newName = prompt("輸入新的特效名稱：", effect.name);
      if (newName && newName.trim()) {
        await updateEffect(effect.id, { name: newName.trim() });
        await loadEffects();
      }
    });
    row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      const confirmed = await confirmModal(`確定要刪除特效「${effect.name}」嗎？已使用此特效的狗狗資料不會被自動修改。`);
      if (confirmed) {
        await deleteEffect(effect.id);
        await loadEffects();
      }
    });

    el.appendChild(row);
  });
}

document.getElementById("add-effect-btn").addEventListener("click", async () => {
  const name = prompt("輸入特效名稱：");
  if (name && name.trim()) {
    await createEffect({ name: name.trim() });
    await loadEffects();
  }
});

// ---------- 圖案 ----------

async function loadPatterns() {
  const patterns = await getAllPatterns();
  const el = document.getElementById("pattern-list");
  el.innerHTML = "";

  if (patterns.length === 0) {
    el.innerHTML = `<div class="empty-state">尚未建立任何圖案</div>`;
    return;
  }

  patterns.forEach((pattern) => {
    const row = document.createElement("div");
    row.style.cssText = "padding:8px 0; border-bottom:1px solid var(--color-border);";
    row.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <strong style="flex:1;">${pattern.canonicalName}</strong>
        <button class="btn btn-secondary btn-small" data-action="rename">改名</button>
        <button class="btn btn-secondary btn-small" data-action="add-alias">新增別名</button>
        <button class="btn btn-danger btn-small" data-action="delete">刪除</button>
      </div>
      <div class="dog-meta">別名：${(pattern.aliases || []).join("、") || "（無）"}</div>
    `;

    row.querySelector('[data-action="rename"]').addEventListener("click", async () => {
      const newName = prompt("輸入新的正式名稱：", pattern.canonicalName);
      if (newName && newName.trim()) {
        await updatePattern(pattern.id, { canonicalName: newName.trim() });
        await loadPatterns();
      }
    });
    row.querySelector('[data-action="add-alias"]').addEventListener("click", async () => {
      const alias = prompt("輸入要合併的別名：");
      if (alias && alias.trim()) {
        await addAliasToPattern(pattern.id, alias.trim());
        await loadPatterns();
      }
    });
    row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      const confirmed = await confirmModal(`確定要刪除圖案「${pattern.canonicalName}」嗎？`);
      if (confirmed) {
        await deletePattern(pattern.id);
        await loadPatterns();
      }
    });

    el.appendChild(row);
  });
}

document.getElementById("add-pattern-btn").addEventListener("click", async () => {
  const name = prompt("輸入圖案正式名稱：");
  if (name && name.trim()) {
    await createPattern({ canonicalName: name.trim(), aliases: [] });
    await loadPatterns();
  }
});

// ---------- 初始化 ----------

await loadBreeds();
await loadEffects();
await loadPatterns();
