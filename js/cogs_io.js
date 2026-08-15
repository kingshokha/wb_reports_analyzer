/**
 * WB Finance Analytics - Cost of Goods Sold (COGS) Import / Export Logic
 * 
 * Format: "Артикул - закупка на 1 ед. - фулфилмент"
 */

function showCogsToast(message, type = 'success') {
  let toastContainer = document.getElementById('cogsToastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'cogsToastContainer';
    toastContainer.className = 'fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-emerald-800 text-white' : (type === 'error' ? 'bg-rose-800 text-white' : 'bg-slate-800 text-white');
  const iconName = type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-triangle' : 'info');

  toast.className = `${bgClass} pointer-events-auto px-4 py-3 rounded-2xl shadow-xl border border-white/10 text-xs font-medium flex items-center gap-2.5 transition-all duration-300 transform translate-y-4 opacity-0`;
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-4 h-4 shrink-0"></i>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  });

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-4', 'opacity-0');
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 300);
  }, 4000);
}

function exportCogsToClipboard() {
  const skus = new Set();
  
  if (Array.isArray(productsList)) {
    productsList.forEach(p => {
      if (p && p.sku) skus.add(String(p.sku).trim());
    });
  }

  if (skuCogsMap && typeof skuCogsMap === 'object') {
    Object.keys(skuCogsMap).forEach(k => skus.add(String(k).trim()));
  }
  if (skuFfMap && typeof skuFfMap === 'object') {
    Object.keys(skuFfMap).forEach(k => skus.add(String(k).trim()));
  }

  if (skus.size === 0) {
    showCogsToast("Нет данных по товарам для экспорта себестоимости.", "error");
    return;
  }

  const lines = [];
  skus.forEach(sku => {
    const cogsVal = parseNum(skuCogsMap[sku]) || 0;
    const ffVal = parseNum(skuFfMap[sku]) || 0;
    lines.push(`${sku} - ${cogsVal.toFixed(2)} - ${ffVal.toFixed(2)}`);
  });

  const exportText = lines.join('\r\n');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(exportText).then(() => {
      showCogsToast(`Себестоимость скопирована в буфер обмена (${lines.length} шт.) в формате: Артикул - закупка на 1 ед. - фулфилмент`, "success");
    }).catch(err => {
      fallbackCopyTextToClipboard(exportText, lines.length);
    });
  } else {
    fallbackCopyTextToClipboard(exportText, lines.length);
  }
}

function fallbackCopyTextToClipboard(text, count) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showCogsToast(`Себестоимость скопирована в буфер обмена (${count} шт.) в формате: Артикул - закупка на 1 ед. - фулфилмент`, "success");
    } else {
      showCogsToast("Не удалось скопировать данные в буфер обмена.", "error");
    }
  } catch (err) {
    showCogsToast("Ошибка доступа к буферу обмена: " + err.message, "error");
  }

  document.body.removeChild(textArea);
}

function openCogsImportModal() {
  if (typeof lockBodyScroll === "function") lockBodyScroll();
  const modal = document.getElementById('modalCogsImport');
  if (!modal) return;

  const textarea = document.getElementById('cogsImportTextarea');
  if (textarea) textarea.value = '';

  const statusEl = document.getElementById('cogsImportStatus');
  if (statusEl) {
    statusEl.innerHTML = '';
    statusEl.classList.add('hidden');
  }

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeCogsImportModal() {
  const modal = document.getElementById('modalCogsImport');
  if (modal) modal.classList.add('hidden');
  if (typeof unlockBodyScroll === "function") unlockBodyScroll();
}

async function pasteFromClipboardToCogsImport() {
  const textarea = document.getElementById('cogsImportTextarea');
  if (!textarea) return;

  if (navigator.clipboard && navigator.clipboard.readText) {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        textarea.value = text;
        showCogsImportStatus(`Вставлено из буфера обмена (${text.split('\n').filter(l => l.trim()).length} строк). Нажмите «Применить импорт».`, "success");
        return;
      }
    } catch (err) {
      console.warn("Clipboard read error, fallback to focus:", err);
    }
  }

  textarea.focus();
  showCogsImportStatus("Нажмите сочетание клавиш Ctrl+V (или Cmd+V), чтобы вставить текст в поле.", "info");
}

function showCogsImportStatus(message, type = 'info') {
  const statusEl = document.getElementById('cogsImportStatus');
  if (!statusEl) return;

  let colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
  if (type === 'success') colorClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (type === 'error') colorClass = 'bg-rose-50 text-rose-800 border-rose-200';

  statusEl.className = `p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${colorClass}`;
  statusEl.innerHTML = message;
  statusEl.classList.remove('hidden');
}

function applyCogsImport() {
  const textarea = document.getElementById('cogsImportTextarea');
  if (!textarea || !textarea.value.trim()) {
    showCogsImportStatus("Пожалуйста, вставьте или введите строки с себестоимостью.", "error");
    return;
  }

  const rawText = textarea.value;
  const lines = rawText.split(/\r?\n/);

  let updatedCount = 0;
  let skippedCount = 0;

  lines.forEach(line => {
    const clean = line.trim();
    if (!clean) return;

    // Split by dash '-' or '—' or tab '\t' or ';' or ','
    let parts = [];
    if (clean.includes('—')) {
      parts = clean.split('—').map(p => p.trim());
    } else if (clean.includes(' - ')) {
      parts = clean.split(' - ').map(p => p.trim());
    } else if (clean.includes('\t')) {
      parts = clean.split('\t').map(p => p.trim());
    } else if (clean.includes(';')) {
      parts = clean.split(';').map(p => p.trim());
    } else if (clean.includes(',')) {
      parts = clean.split(',').map(p => p.trim());
    } else if (clean.includes('-')) {
      parts = clean.split('-').map(p => p.trim());
    } else {
      parts = clean.split(/\s+/).map(p => p.trim());
    }

    if (parts.length >= 2) {
      const sku = String(parts[0]).replace(/["']/g, '').trim();
      const cogsVal = parseNum(parts[1]);
      const ffVal = parts.length >= 3 ? parseNum(parts[2]) : 0;

      if (sku && (!isNaN(cogsVal) || !isNaN(ffVal))) {
        if (cogsVal > 0) {
          skuCogsMap[sku] = cogsVal;
        } else {
          delete skuCogsMap[sku];
        }

        if (ffVal > 0) {
          skuFfMap[sku] = ffVal;
        } else {
          delete skuFfMap[sku];
        }

        updatedCount++;
      } else {
        skippedCount++;
      }
    } else {
      skippedCount++;
    }
  });

  if (updatedCount === 0) {
    showCogsImportStatus("Не удалось распознать данные. Проверьте формат: «Артикул - закупка на 1 ед. - фулфилмент».", "error");
    return;
  }

  saveSkuCogsToStorage();

  if (typeof renderCogsTable === 'function') renderCogsTable();
  if (typeof renderProductTable === 'function') renderProductTable();
  if (typeof updateFinancials === 'function') updateFinancials();
  if (typeof calculateTotalCogs === 'function') {
    setText('totalCogsValueLabel', formatCurrency(calculateTotalCogs()));
  }

  closeCogsImportModal();
  showCogsToast(`Успешно импортировано и сохранено ${updatedCount} товаров${skippedCount > 0 ? ` (пропущено: ${skippedCount})` : ''}`, "success");
}
