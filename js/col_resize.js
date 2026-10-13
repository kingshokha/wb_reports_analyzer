/**
 * WB Finance Analytics - Resizable table columns
 *
 * Тянем за правый край заголовка столбца, ширины сохраняются в localStorage
 * отдельно для каждой таблицы. Двойной клик по краю сбрасывает ширины таблицы.
 * Ключ таблицы - data-resize-key или id ее tbody, ключ столбца - data-col
 * заголовка или его порядковый номер.
 */

const LOCAL_STORAGE_COL_WIDTHS_KEY = 'wb_analytics_col_widths';
const COL_RESIZE_MIN_WIDTH = 40;

let colWidthsMap = {};
try {
  const savedWidths = localStorage.getItem(LOCAL_STORAGE_COL_WIDTHS_KEY);
  if (savedWidths) {
    const parsed = JSON.parse(savedWidths);
    if (parsed && typeof parsed === 'object') colWidthsMap = parsed;
  }
} catch (e) {
  console.error("Ошибка чтения ширины столбцов из localStorage:", e);
}

function saveColWidthsToStorage() {
  try {
    localStorage.setItem(LOCAL_STORAGE_COL_WIDTHS_KEY, JSON.stringify(colWidthsMap));
  } catch (e) {
    console.error("Ошибка сохранения ширины столбцов в localStorage:", e);
  }
}

function getResizeTableKey(table) {
  if (table.dataset.resizeKey) return table.dataset.resizeKey;
  const tbody = table.querySelector('tbody[id]');
  return tbody ? tbody.id : '';
}

function getResizeHeaderCells(table) {
  const rows = table.tHead ? table.tHead.rows : [];
  if (!rows.length) return [];
  return Array.from(rows[rows.length - 1].cells);
}

function getResizeColKey(th, index) {
  return th.dataset.col || ('i' + index);
}

// Фиксированная раскладка: ширина таблицы = сумма ширин столбцов
function applyStoredColWidths(table) {
  const key = getResizeTableKey(table);
  const stored = colWidthsMap[key];
  const cells = getResizeHeaderCells(table);

  if (!stored || cells.length === 0) {
    table.classList.remove('col-resized');
    table.style.tableLayout = '';
    table.style.width = '';
    table.style.minWidth = '';
    cells.forEach(th => { th.style.width = ''; });
    return;
  }

  // Новым столбцам без сохраненной ширины берем естественную ширину
  const missing = cells.some((th, i) => !stored[getResizeColKey(th, i)]);
  let natural = [];
  if (missing) {
    table.style.tableLayout = '';
    table.style.width = '';
    cells.forEach(th => { th.style.width = ''; });
    natural = cells.map(th => th.offsetWidth);
  }

  let total = 0;
  cells.forEach((th, i) => {
    const w = stored[getResizeColKey(th, i)] || natural[i] || 120;
    th.style.width = w + 'px';
    total += w;
  });
  table.classList.add('col-resized');
  table.style.tableLayout = 'fixed';
  table.style.width = total + 'px';
  table.style.minWidth = '0';
}

function snapshotColWidths(table) {
  const key = getResizeTableKey(table);
  const widths = {};
  getResizeHeaderCells(table).forEach((th, i) => {
    // Округляем вверх, иначе дробные пиксели обрежут содержимое многоточием
    widths[getResizeColKey(th, i)] = Math.ceil(th.getBoundingClientRect().width);
  });
  colWidthsMap[key] = Object.assign(widths, colWidthsMap[key] || {});
}

let colResizeJustEnded = false;

function startColResize(e, table, th) {
  e.preventDefault();
  e.stopPropagation();

  snapshotColWidths(table);
  applyStoredColWidths(table);

  const key = getResizeTableKey(table);
  const cells = getResizeHeaderCells(table);
  const colKey = getResizeColKey(th, cells.indexOf(th));
  const startX = e.clientX;
  const startWidth = colWidthsMap[key][colKey];
  const startTableWidth = table.offsetWidth;

  document.body.classList.add('col-resizing');

  const onMove = (ev) => {
    const width = Math.max(COL_RESIZE_MIN_WIDTH, Math.round(startWidth + ev.clientX - startX));
    colWidthsMap[key][colKey] = width;
    th.style.width = width + 'px';
    table.style.width = (startTableWidth + width - startWidth) + 'px';
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.classList.remove('col-resizing');
    saveColWidthsToStorage();
    // mouseup над заголовком порождает click - не даем ему запустить сортировку
    colResizeJustEnded = true;
    setTimeout(() => { colResizeJustEnded = false; }, 0);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function resetColWidths(table) {
  delete colWidthsMap[getResizeTableKey(table)];
  saveColWidthsToStorage();
  applyStoredColWidths(table);
}

function attachColResizeHandles(table) {
  getResizeHeaderCells(table).forEach(th => {
    if (th.querySelector(':scope > .col-resize-handle')) return;
    th.classList.add('col-resize-th');
    const handle = document.createElement('span');
    handle.className = 'col-resize-handle';
    handle.title = 'Потяните, чтобы изменить ширину. Двойной клик - сбросить ширины таблицы';
    handle.addEventListener('mousedown', (e) => startColResize(e, table, th));
    handle.addEventListener('click', (e) => e.stopPropagation());
    handle.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      resetColWidths(table);
    });
    th.appendChild(handle);
  });
}

function setupResizableTable(table) {
  if (table.dataset.resizeReady || !table.tHead || !getResizeTableKey(table)) return;
  table.dataset.resizeReady = '1';

  const refresh = () => {
    observer.disconnect();
    attachColResizeHandles(table);
    if (colWidthsMap[getResizeTableKey(table)]) applyStoredColWidths(table);
    observer.observe(table.tHead, { childList: true, subtree: true });
  };

  // Заголовки многих таблиц перерисовываются целиком - вешаем ручки заново
  const observer = new MutationObserver(refresh);
  refresh();

  // Таблицы в скрытых вкладках и модалках меряются, когда становятся видимыми
  if (window.ResizeObserver) {
    let wasVisible = table.offsetWidth > 0;
    new ResizeObserver(() => {
      const visible = table.offsetWidth > 0;
      if (visible && !wasVisible && colWidthsMap[getResizeTableKey(table)]) applyStoredColWidths(table);
      wasVisible = visible;
    }).observe(table);
  }
}

function initResizableTables() {
  document.querySelectorAll('table').forEach(setupResizableTable);

  document.addEventListener('click', (e) => {
    if (colResizeJustEnded) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
}
