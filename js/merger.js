/**
 * WB Finance Analytics - Multi-report Merger Tool
 */

function openMergerModal() {
  if (typeof lockBodyScroll === "function") lockBodyScroll();
  const modal = document.getElementById('modalMerger');
  if (modal) {
    modal.classList.remove('hidden');
    renderMergerFilesList();
    if (window.lucide) lucide.createIcons();
  }
}

function closeMergerModal() {
  const modal = document.getElementById('modalMerger');
  if (modal) modal.classList.add('hidden');
  if (typeof unlockBodyScroll === "function") unlockBodyScroll();
}

async function addFilesToMerger(fileList) {
  if (!fileList || fileList.length === 0) return;

  for (let f = 0; f < fileList.length; f++) {
    const fileObj = fileList[f];
    const lowerName = fileObj.name.toLowerCase();

    if (lowerName.endsWith('.zip')) {
      try {
        if (typeof JSZip === 'undefined') {
          throw new Error("Библиотека JSZip не загружена.");
        }
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(fileObj);
        const validEntries = [];
        zipContent.forEach((relativePath, zipEntry) => {
          if (!zipEntry.dir) {
            const lower = relativePath.toLowerCase();
            if (!lower.includes('__macosx') && !relativePath.startsWith('.') &&
                (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv'))) {
              validEntries.push(zipEntry);
            }
          }
        });
        validEntries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        for (let i = 0; i < validEntries.length; i++) {
          const zipEntry = validEntries[i];
          const entryName = zipEntry.name;
          const isCsv = entryName.toLowerCase().endsWith('.csv');
          let rows = [];

          if (isCsv) {
            const arrayBuf = await zipEntry.async('arraybuffer');
            const text = decodeText(arrayBuf);
            rows = parseCSV(text);
          } else {
            const arrayBuf = await zipEntry.async('arraybuffer');
            const workbook = XLSX.read(arrayBuf, { type: 'array' });
            if (workbook && workbook.SheetNames && workbook.SheetNames.length > 0) {
              const worksheet = workbook.Sheets[workbook.SheetNames[0]];
              rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
            }
          }

          if (rows && rows.length > 0) {
            mergerFiles.push({
              id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
              name: entryName,
              sizeStr: 'из zip (' + fileObj.name + ')',
              rows: rows,
              rowCount: rows.length
            });
          }
        }
      } catch (err) {
        showError(err);
      }
    } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
      await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
          try {
            let rows = [];
            if (lowerName.endsWith('.csv')) {
              const text = decodeText(e.target.result);
              rows = parseCSV(text);
            } else {
              const workbook = XLSX.read(e.target.result, { type: 'array' });
              if (workbook && workbook.SheetNames && workbook.SheetNames.length > 0) {
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
              }
            }

            if (rows && rows.length > 0) {
              mergerFiles.push({
                id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                name: fileObj.name,
                sizeStr: formatFileSize(fileObj.size),
                rows: rows,
                rowCount: rows.length
              });
            }
          } catch (err) {
            showError(err);
          }
          resolve();
        };
        reader.readAsArrayBuffer(fileObj);
      });
    }
  }

  renderMergerFilesList();
}

function removeMergerFile(id) {
  mergerFiles = mergerFiles.filter(f => f.id !== id);
  renderMergerFilesList();
}

function clearMergerFiles() {
  mergerFiles = [];
  renderMergerFilesList();
}

function renderMergerFilesList() {
  const container = document.getElementById('mergerFilesList');
  const countEl = document.getElementById('mergerFilesCount');
  const btnClear = document.getElementById('btnClearMergerFiles');
  const btnExport = document.getElementById('btnExportMergedModal');
  const summaryBanner = document.getElementById('mergerSummaryInfo');

  if (!container) return;
  container.innerHTML = '';

  if (countEl) countEl.innerText = mergerFiles.length;

  if (mergerFiles.length === 0) {
    container.innerHTML = `
      <div id="mergerEmptyState" class="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
        Файлы пока не добавлены. Выберите или перетащите их выше.
      </div>
    `;
    if (btnClear) btnClear.classList.add('hidden');
    if (btnExport) btnExport.disabled = true;
    if (summaryBanner) summaryBanner.classList.add('hidden');
    return;
  }

  if (btnClear) btnClear.classList.remove('hidden');
  if (btnExport) btnExport.disabled = false;

  let totalMergedRowsCount = 0;

  mergerFiles.forEach((file, index) => {
    const isBase = index === 0;
    const rowsToInclude = isBase ? file.rowCount : Math.max(0, file.rowCount - 1);
    totalMergedRowsCount += rowsToInclude;

    const div = document.createElement('div');
    div.className = `p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
      isBase 
        ? 'bg-purple-50/70 border-purple-200 text-purple-950' 
        : 'bg-slate-50 border-slate-200 text-slate-800'
    }`;

    div.innerHTML = `
      <div class="flex items-center gap-3 min-w-0 pr-2">
        <span class="shrink-0 font-bold px-2 py-0.5 rounded-lg text-[10px] uppercase ${
          isBase 
            ? 'bg-purple-600 text-white shadow-sm' 
            : 'bg-slate-200 text-slate-600'
        }">
          ${isBase ? '1. ОСНОВА (с шапкой)' : `${index + 1}. Данные (без шапки)`}
        </span>
        <div class="min-w-0">
          <p class="font-semibold truncate text-slate-800" title="${file.name}">${file.name}</p>
          <p class="text-[11px] text-slate-400">
            ${file.sizeStr} • Строк в файле: <strong>${file.rowCount}</strong> (в слияние: ${rowsToInclude})
          </p>
        </div>
      </div>
      <button onclick="removeMergerFile('${file.id}')" class="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors shrink-0" title="Удалить файл">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    `;
    container.appendChild(div);
  });

  if (summaryBanner) {
    summaryBanner.classList.remove('hidden');
    setText('mergerSummaryTitle', `Готово к слиянию файлов: ${mergerFiles.length}`);
    setText('mergerSummaryDetails', `Первый отчет вносит заголовок + данные. Всего в итоговом файле будет ${totalMergedRowsCount} строк.`);
  }

  if (window.lucide) lucide.createIcons();
}

function exportMergedReport() {
  if (mergerFiles.length === 0) {
    alert("Пожалуйста, добавьте хотя бы один файл для объединения.");
    return;
  }

  let finalMergedRows = [];
  mergerFiles.forEach((file, index) => {
    if (index === 0) {
      finalMergedRows = finalMergedRows.concat(file.rows);
    } else {
      finalMergedRows = finalMergedRows.concat(file.rows.slice(1));
    }
  });

  if (finalMergedRows.length === 0) {
    alert("Строки для объединения не найдены.");
    return;
  }

  const newSheet = XLSX.utils.aoa_to_sheet(finalMergedRows);
  const newWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWb, newSheet, "Объединенный отчет");

  const filename = `Объединенный_отчет_WB_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(newWb, filename);
}
