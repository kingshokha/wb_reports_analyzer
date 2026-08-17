
function getProductAdSpend(p) {
  if (!p) return 0;
  const s = String(p.sku || '').trim();
  const numS = String(parseInt(s, 10) || '');
  const supp = String(p.supplierSku || '').trim();

  const fromMap = (typeof skuAdSpendMap !== 'undefined' && skuAdSpendMap)
    ? (skuAdSpendMap[s] || skuAdSpendMap[numS] || skuAdSpendMap[supp] || skuAdSpendMap[p.sku] || 0)
    : 0;

  if (fromMap > 0) return fromMap;
  return p.adSpend || 0;
}

/**
 * WB Finance Analytics - Products by SKU Tab Logic
 */

let skuTableColumns = {
  sku: true,
  supplierSku: true,
  category: true,
  name: true,
  sold: true,
  returned: true,
  turnover: true,
  comm_acq: true,
  logistics: true,
  cogs: true,
  ad_spend: true,
  tax: true,
  payout: true
};

let activeCategories = new Set();
let availableCategories = [];

function toggleCategoryFilterDropdown(e) {
  if (e) e.stopPropagation();
  const colDd = document.getElementById('columnFilterDropdown');
  if (colDd) colDd.classList.add('hidden');

  const dd = document.getElementById('categoryFilterDropdown');
  if (dd) dd.classList.toggle('hidden');
}

function updateCategoryFilterDropdown() {
  const listEl = document.getElementById('categoryFilterList');
  if (!listEl) return;

  const cats = Array.from(new Set(productsList.map(p => p.category || '—'))).sort();
  availableCategories = cats;

  if (activeCategories.size === 0 && cats.length > 0) {
    activeCategories = new Set(cats);
  } else {
    cats.forEach(c => activeCategories.add(c));
  }

  if (cats.length === 0) {
    listEl.innerHTML = `<div class="text-slate-400 py-2 text-center text-xs">Категории не найдены</div>`;
    return;
  }

  listEl.innerHTML = cats.map(cat => {
    const isChecked = activeCategories.has(cat);
    const safeCat = cat.replace(/'/g, "\\'");
    return `
      <label class="flex items-center gap-2 py-1 px-1.5 hover:bg-purple-50 rounded cursor-pointer text-xs">
        <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleCategory('${safeCat}')" class="cat-item-chk rounded text-purple-600 focus:ring-purple-500">
        <span class="truncate" title="${cat}">${cat}</span>
      </label>
    `;
  }).join('');

  updateCategoryFilterBadge();
}

function toggleCategory(catName) {
  if (activeCategories.has(catName)) {
    activeCategories.delete(catName);
  } else {
    activeCategories.add(catName);
  }
  updateCategoryFilterBadge();
  applyProductFilters();
}

function toggleAllCategories(selectAll) {
  if (selectAll) {
    activeCategories = new Set(availableCategories);
  } else {
    activeCategories.clear();
  }
  const chks = document.querySelectorAll('.cat-item-chk');
  chks.forEach(chk => chk.checked = selectAll);

  updateCategoryFilterBadge();
  applyProductFilters();
}

function updateCategoryFilterBadge() {
  const chkAll = document.getElementById('cat_chk_all');
  if (chkAll) {
    chkAll.checked = availableCategories.length > 0 && availableCategories.every(c => activeCategories.has(c));
  }

  const badge = document.getElementById('categoryFilterBadge');
  if (!badge) return;

  if (availableCategories.length > 0 && activeCategories.size < availableCategories.length) {
    badge.innerText = `${activeCategories.size}/${availableCategories.length}`;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function applyProductFilters() {
  const query = (document.getElementById('productSearch')?.value || '').toLowerCase().trim();
  filteredProducts = productsList.filter(p => {
    const cat = p.category || '—';
    if (activeCategories.size > 0 && !activeCategories.has(cat)) {
      return false;
    }
    if (activeCategories.size === 0) {
      return false;
    }
    if (!query) return true;
    return p.sku.toLowerCase().includes(query) || 
      (p.supplierSku && p.supplierSku.toLowerCase().includes(query)) ||
      (p.category && p.category.toLowerCase().includes(query)) ||
      p.name.toLowerCase().includes(query);
  });
  currentPage = 1;
  renderProductTable();
}

function toggleColumnFilterDropdown(e) {
  if (e) e.stopPropagation();
  const catDd = document.getElementById('categoryFilterDropdown');
  if (catDd) catDd.classList.add('hidden');

  const dd = document.getElementById('columnFilterDropdown');
  if (dd) dd.classList.toggle('hidden');
}

function toggleAllSkuColumns(selectAll) {
  for (const col in skuTableColumns) {
    skuTableColumns[col] = selectAll;
    const chk = document.getElementById(`col_chk_${col}`);
    if (chk) chk.checked = selectAll;
  }
  renderProductTableHeaders();
  renderProductTable();
}

function toggleSkuColumn(colName) {
  if (skuTableColumns.hasOwnProperty(colName)) {
    skuTableColumns[colName] = !skuTableColumns[colName];
    
    const allChecked = Object.values(skuTableColumns).every(Boolean);
    const chkAll = document.getElementById('col_chk_all');
    if (chkAll) chkAll.checked = allChecked;

    const colChk = document.getElementById(`col_chk_${colName}`);
    if (colChk) colChk.checked = skuTableColumns[colName];

    renderProductTableHeaders();
    renderProductTable();
  }
}

function renderProductTableHeaders() {
  const tr = document.getElementById('productTableHeaderRow');
  if (!tr) return;
  tr.innerHTML = '';

  const cols = [
    { id: 'sku', title: 'Артикул WB (D)', field: 'sku' },
    { id: 'supplierSku', title: 'Арт. продавца (F)', field: 'supplierSku' },
    { id: 'category', title: 'Категория (C)', field: 'category' },
    { id: 'name', title: 'Название (G)', field: 'name' },
    { id: 'sold', title: 'Продано (шт)', field: 'sold', alignRight: true },
    { id: 'returned', title: 'Возвраты', field: 'returned', alignRight: true },
    { id: 'turnover', title: 'Сумма выкупа (T)', field: 'turnover', alignRight: true },
    { id: 'comm_acq', title: 'Комиссия и Эквайринг', field: 'comm_acq', alignRight: true },
    { id: 'logistics', title: 'Логистика (AK)', field: 'logistics', alignRight: true },
    { id: 'cogs', title: 'Себестоимость', field: 'cogs', alignRight: true },
    { id: 'ad_spend', title: 'Реклама (₽)', field: 'ad_spend', alignRight: true },
    { id: 'tax', title: 'Налог (₽)', field: 'tax', alignRight: true },
    { id: 'payout', title: 'Чистая прибыль', field: 'payout', alignRight: true, tooltip: 'С учетом всех расходов, себестоимости и рекламы' }
  ];

  cols.forEach(col => {
    if (!skuTableColumns[col.id]) return;
    const th = document.createElement('th');
    let alignClass = col.alignRight ? 'text-right' : '';
    th.className = `py-4 px-5 cursor-pointer hover:text-purple-600 transition-colors ${alignClass}`;
    if (col.tooltip) {
      th.title = col.tooltip;
    }
    th.onclick = () => sortProducts(col.field);
    
    let arrow = '⇅';
    if (currentSortField === col.field) {
      arrow = currentSortDirection === 'asc' ? '▲' : '▼';
    }

    const tooltipHtml = col.tooltip 
      ? `<span class="relative group inline-flex items-center ml-1 cursor-default" title="${col.tooltip}">
           <span class="w-3.5 h-3.5 rounded-full bg-slate-200 text-slate-500 inline-flex items-center justify-center text-[9px] font-bold leading-none select-none hover:bg-purple-100 hover:text-purple-700 transition-colors">i</span>
         </span>`
      : '';
    
    th.innerHTML = `${col.title}${tooltipHtml} <span id="sort_icon_${col.field}">${arrow}</span>`;
    tr.appendChild(th);
  });
}

function sortProducts(field, preventToggle = false) {
  if (!preventToggle) {
    if (currentSortField === field) {
      currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      currentSortField = field;
      currentSortDirection = (field === 'name' || field === 'sku' || field === 'supplierSku' || field === 'category') ? 'asc' : 'desc';
    }
  }

  renderProductTableHeaders();

  filteredProducts.sort((a, b) => {
    let valA = 0, valB = 0;
    if (field === 'sku') {
      return currentSortDirection === 'asc' 
        ? a.sku.localeCompare(b.sku, undefined, { numeric: true }) 
        : b.sku.localeCompare(a.sku, undefined, { numeric: true });
    }
    else if (field === 'supplierSku') {
      return currentSortDirection === 'asc' 
        ? (a.supplierSku || '').localeCompare(b.supplierSku || '', undefined, { numeric: true }) 
        : (b.supplierSku || '').localeCompare(a.supplierSku || '', undefined, { numeric: true });
    }
    else if (field === 'category') {
      return currentSortDirection === 'asc' 
        ? (a.category || '').localeCompare(b.category || '') 
        : (b.category || '').localeCompare(a.category || '');
    }
    else if (field === 'name') {
      return currentSortDirection === 'asc' 
        ? a.name.localeCompare(b.name) 
        : b.name.localeCompare(a.name);
    }
    else if (field === 'sold') { valA = a.soldQty; valB = b.soldQty; }
    else if (field === 'returned') { valA = a.returnedQty; valB = b.returnedQty; }
    else if (field === 'turnover') { valA = a.turnover; valB = b.turnover; }
    else if (field === 'comm_acq') { valA = a.commission + a.acquiring; valB = b.commission + b.acquiring; }
    else if (field === 'logistics') { valA = a.logistics || 0; valB = b.logistics || 0; }
    else if (field === 'cogs') {
      valA = a.soldQty * ((skuCogsMap[a.sku] || 0) + (skuFfMap[a.sku] || 0));
      valB = b.soldQty * ((skuCogsMap[b.sku] || 0) + (skuFfMap[b.sku] || 0));
    }
    else if (field === 'ad_spend') {
      valA = getProductAdSpend(a);
      valB = getProductAdSpend(b);
    }
    else if (field === 'tax') { valA = a.taxSum || 0; valB = b.taxSum || 0; }
    else if (field === 'payout') {
      const adA = getProductAdSpend(a);
      const adB = getProductAdSpend(b);
      valA = a.turnover - (a.commission + a.acquiring) - (a.logistics || 0) - (a.soldQty * ((skuCogsMap[a.sku] || 0) + (skuFfMap[a.sku] || 0))) - (a.taxSum || 0) - adA;
      valB = b.turnover - (b.commission + b.acquiring) - (b.logistics || 0) - (b.soldQty * ((skuCogsMap[b.sku] || 0) + (skuFfMap[b.sku] || 0))) - (b.taxSum || 0) - adB;
    }

    return currentSortDirection === 'asc' ? valA - valB : valB - valA;
  });

  currentPage = 1;
  renderProductTable();
}

function renderProductTable() {
  renderProductTableHeaders();

  const tbody = document.getElementById('productTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const activeColCount = Object.values(skuTableColumns).filter(Boolean).length;

  if (filteredProducts.length > 0) {
    let totalSoldQty = 0;
    let totalReturnedQty = 0;
    let totalTurnover = 0;
    let totalCommAcq = 0;
    let totalLogisticsSum = 0;
    let totalCogsSum = 0;
    let totalAdSpendSum = 0;
    let totalTaxSum = 0;
    let totalProfit = 0;

    filteredProducts.forEach(p => {
      totalSoldQty += p.soldQty;
      totalReturnedQty += p.returnedQty;
      totalTurnover += p.turnover;
      const commAcq = (p.commission + p.acquiring);
      totalCommAcq += commAcq;
      const itemLogistics = (p.logistics || 0);
      totalLogisticsSum += itemLogistics;
      const unitCogs = skuCogsMap[p.sku] || 0;
      const unitFf = skuFfMap[p.sku] || 0;
      const itemCogs = p.soldQty * (unitCogs + unitFf);
      totalCogsSum += itemCogs;
      const itemAdSpend = getProductAdSpend(p);
      p.adSpend = itemAdSpend;
      totalAdSpendSum += itemAdSpend;
      const itemTax = (p.taxSum || 0);
      totalTaxSum += itemTax;
      const itemProfit = p.turnover - commAcq - itemLogistics - itemCogs - itemTax - itemAdSpend;
      p.profit = itemProfit;
      totalProfit += itemProfit;
    });

    const summaryTr = document.createElement('tr');
    summaryTr.className = "bg-purple-50/90 border-b-2 border-purple-200 text-purple-950 font-bold text-xs shadow-sm select-none";
    
    let summaryCellsHTML = '';

    let labelColSpan = 0;
    if (skuTableColumns.sku) labelColSpan++;
    if (skuTableColumns.supplierSku) labelColSpan++;
    if (skuTableColumns.category) labelColSpan++;
    if (skuTableColumns.name) labelColSpan++;
    if (labelColSpan === 0) labelColSpan = 1;

    summaryCellsHTML += `
      <td class="py-3.5 px-5 uppercase tracking-wider font-extrabold text-[11px] text-purple-900" colspan="${labelColSpan}">
        <div class="flex items-center gap-1.5">
          <i data-lucide="sigma" class="w-4 h-4 text-purple-700"></i>
          ИТОГО СУММЫ (Товаров: ${filteredProducts.length}):
        </div>
      </td>
    `;

    if (skuTableColumns.sold) {
      summaryCellsHTML += `<td class="py-3.5 px-5 text-right text-emerald-700 font-extrabold">${totalSoldQty} шт</td>`;
    }
    if (skuTableColumns.returned) {
      summaryCellsHTML += `<td class="py-3.5 px-5 text-right text-rose-600 font-extrabold">${totalReturnedQty} шт</td>`;
    }
    if (skuTableColumns.turnover) {
      summaryCellsHTML += `<td class="py-3.5 px-5 text-right text-purple-950 font-extrabold">${formatCurrency(totalTurnover)}</td>`;
    }
    if (skuTableColumns.comm_acq) {
      summaryCellsHTML += `<td class="py-3.5 px-5 text-right text-purple-950 font-extrabold">${formatCurrency(totalCommAcq)}</td>`;
    }
    if (skuTableColumns.logistics) {
      summaryCellsHTML += `<td class="py-3.5 px-5 text-right text-purple-950 font-extrabold">${formatCurrency(totalLogisticsSum)}</td>`;
    }
    if (skuTableColumns.cogs) {
      summaryCellsHTML += `<td class="py-3.5 px-5 text-right text-purple-950 font-extrabold">${formatCurrency(totalCogsSum)}</td>`;
    }
    if (skuTableColumns.ad_spend) {
      summaryCellsHTML += `<td class="py-3.5 px-5 text-right text-purple-950 font-extrabold">${formatCurrency(totalAdSpendSum)}</td>`;
    }
    if (skuTableColumns.tax) {
      summaryCellsHTML += `<td class="py-3.5 px-5 text-right text-amber-800 font-extrabold">${formatCurrency(totalTaxSum)}</td>`;
    }
    if (skuTableColumns.payout) {
      const profitColorClass = totalProfit >= 0 ? 'text-emerald-700' : 'text-rose-600';
      summaryCellsHTML += `<td class="py-3.5 px-5 text-right ${profitColorClass} font-extrabold">${formatCurrency(totalProfit)}</td>`;
    }

    summaryTr.innerHTML = summaryCellsHTML;
    tbody.appendChild(summaryTr);
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredProducts.length);
  const paginatedList = filteredProducts.slice(startIndex, endIndex);

  paginatedList.forEach(p => {
    const commAcqSum = p.commission + p.acquiring;
    const itemLogistics = p.logistics || 0;
    const unitCogs = skuCogsMap[p.sku] || 0;
    const unitFf = skuFfMap[p.sku] || 0;
    const totalUnit = unitCogs + unitFf;
    const totalCogs = p.soldQty * totalUnit;
    const itemAdSpend = getProductAdSpend(p);
    const itemTax = p.taxSum || 0;
    const itemProfit = p.profit !== undefined ? p.profit : (p.turnover - commAcqSum - itemLogistics - totalCogs - itemTax - itemAdSpend);
    
    const cogsLabel = totalUnit > 0 
      ? `<span class="font-semibold text-slate-800">${formatCurrency(totalCogs)}</span>`
      : `<span class="text-slate-400 font-normal">Не указана</span>`;

    const adSpendLabel = itemAdSpend > 0
      ? `<span class="font-semibold text-rose-600">${formatCurrency(itemAdSpend)}</span>`
      : `<span class="text-slate-400 font-normal">0.00 ₽</span>`;

    const tr = document.createElement('tr');
    tr.className = "hover:bg-purple-50/50 transition-colors text-slate-700 text-xs cursor-pointer group";
    tr.setAttribute("onclick", "openProductTimelineModal('" + p.sku + "')");
    tr.setAttribute("title", "Нажмите, чтобы посмотреть динамику цен и продаж товара");
    
    let rowCellsHTML = '';
    if (skuTableColumns.sku) {
      rowCellsHTML += `<td class="py-3 px-5 font-mono text-xs font-semibold text-slate-600">${p.sku}</td>`;
    }
    if (skuTableColumns.supplierSku) {
      rowCellsHTML += `<td class="py-3 px-5 font-mono text-xs text-slate-500">${p.supplierSku || '—'}</td>`;
    }
    if (skuTableColumns.category) {
      rowCellsHTML += `<td class="py-3 px-5 font-medium text-slate-600">${p.category || '—'}</td>`;
    }
    if (skuTableColumns.name) {
      rowCellsHTML += `<td class="py-3 px-5 max-w-xs truncate font-medium text-slate-800" title="${p.name}">${p.name}</td>`;
    }
    if (skuTableColumns.sold) {
      rowCellsHTML += `<td class="py-3 px-5 text-right font-semibold text-emerald-600">${p.soldQty} шт</td>`;
    }
    if (skuTableColumns.returned) {
      rowCellsHTML += `<td class="py-3 px-5 text-right font-semibold text-rose-500">${p.returnedQty} шт</td>`;
    }
    if (skuTableColumns.turnover) {
      rowCellsHTML += `<td class="py-3 px-5 text-right font-semibold">${formatCurrency(p.turnover)}</td>`;
    }
    if (skuTableColumns.comm_acq) {
      rowCellsHTML += `<td class="py-3 px-5 text-right text-slate-600 font-medium">${formatCurrency(commAcqSum)}</td>`;
    }
    if (skuTableColumns.logistics) {
      rowCellsHTML += `<td class="py-3 px-5 text-right text-slate-600 font-medium">${formatCurrency(p.logistics || 0)}</td>`;
    }
    if (skuTableColumns.cogs) {
      rowCellsHTML += `<td class="py-3 px-5 text-right">${cogsLabel}</td>`;
    }
    if (skuTableColumns.ad_spend) {
      rowCellsHTML += `<td class="py-3 px-5 text-right">${adSpendLabel}</td>`;
    }
    if (skuTableColumns.tax) {
      rowCellsHTML += `<td class="py-3 px-5 text-right font-medium text-amber-800">${formatCurrency(itemTax)}</td>`;
    }
    if (skuTableColumns.payout) {
      const profitCellClass = itemProfit >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold';
      rowCellsHTML += `<td class="py-3 px-5 text-right ${profitCellClass}">${formatCurrency(itemProfit)}</td>`;
    }

    tr.innerHTML = rowCellsHTML;
    tbody.appendChild(tr);
  });

  if (filteredProducts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${activeColCount || 8}" class="py-12 text-center text-slate-400">Товары с реальным финансовым оборотом не найдены</td>
      </tr>
    `;
    setText('tablePaginationInfo', "Показано 0-0 из 0 товаров");
  } else {
    setText('tablePaginationInfo', `Показано ${startIndex + 1}-${endIndex} из ${filteredProducts.length} товаров`);
  }

  const prevBtn = document.getElementById('btnPrevPage');
  if (prevBtn) prevBtn.disabled = currentPage === 1;

  const nextBtn = document.getElementById('btnNextPage');
  if (nextBtn) nextBtn.disabled = endIndex >= filteredProducts.length;
  if (window.lucide) lucide.createIcons();
}

function exportSKUTableCSV() {
  if (productsList.length === 0) return;
  
  let csvContent = "\uFEFF"; 
  csvContent += "Артикул WB (D);Артикул продавца (F);Категория (C);Название (G);Продано (шт);Возвраты (шт);Сумма выкупа (T);Комиссия и Эквайринг;Логистика (AK);Себестоимость;Реклама (₽);Налог (₽);Чистая прибыль\r\n";
  
  productsList.forEach(p => {
    const commAcqSum = p.commission + p.acquiring;
    const itemLogistics = p.logistics || 0;
    const unitCogs = skuCogsMap[p.sku] || 0;
    const unitFf = skuFfMap[p.sku] || 0;
    const totalCogs = p.soldQty * (unitCogs + unitFf);
    const itemAdSpend = getProductAdSpend(p);
    const taxVal = p.taxSum || 0;
    const itemProfit = p.profit !== undefined ? p.profit : (p.turnover - commAcqSum - itemLogistics - totalCogs - taxVal - itemAdSpend);

    const row = [
      `"${p.sku.replace(/"/g, '""')}"`,
      `"${(p.supplierSku || '—').replace(/"/g, '""')}"`,
      `"${(p.category || '—').replace(/"/g, '""')}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      p.soldQty,
      p.returnedQty,
      p.turnover.toFixed(2),
      commAcqSum.toFixed(2),
      (p.logistics || 0).toFixed(2),
      totalCogs.toFixed(2),
      itemAdSpend.toFixed(2),
      taxVal.toFixed(2),
      itemProfit.toFixed(2)
    ];
    csvContent += row.join(";") + "\r\n";
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Анализ_SKU_WB_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
