
function getProductUnitCogs(sku, supplierSku) {
  if (typeof skuCogsMap === 'undefined' || !skuCogsMap) return 0;
  const s = String(sku || '').trim();
  const numS = String(parseInt(s, 10) || '');
  const supp = String(supplierSku || '').trim();
  return skuCogsMap[s] || skuCogsMap[numS] || skuCogsMap[supp] || skuCogsMap[sku] || 0;
}

function getProductUnitFf(sku, supplierSku) {
  if (typeof skuFfMap === 'undefined' || !skuFfMap) return 0;
  const s = String(sku || '').trim();
  const numS = String(parseInt(s, 10) || '');
  const supp = String(supplierSku || '').trim();
  return skuFfMap[s] || skuFfMap[numS] || skuFfMap[supp] || skuFfMap[sku] || 0;
}

/**
 * WB Finance Analytics - Cost of Goods Sold (COGS) Tab Logic
 */

function calculateTotalCogs() {
  let total = 0;
  productsList.forEach(p => {
    const cogsVal = getProductUnitCogs(p.sku, p.supplierSku);
    const ffVal = getProductUnitFf(p.sku, p.supplierSku);
    total += p.soldQty * (cogsVal + ffVal);
  });
  return total;
}


function updateSkuCogs(sku, val) {
  const numericVal = parseNum(val);
  const cleanSku = String(sku || '').trim();
  const numSku = String(parseInt(cleanSku, 10) || '');

  if (numericVal > 0) {
    skuCogsMap[sku] = numericVal;
    if (cleanSku) skuCogsMap[cleanSku] = numericVal;
    if (numSku) skuCogsMap[numSku] = numericVal;
  } else {
    delete skuCogsMap[sku];
    if (cleanSku) delete skuCogsMap[cleanSku];
    if (numSku) delete skuCogsMap[numSku];
  }
  saveSkuCogsToStorage();
  onCogsOrFfUpdated(sku);
}

function updateSkuFf(sku, val) {
  const numericVal = parseNum(val);
  const cleanSku = String(sku || '').trim();
  const numSku = String(parseInt(cleanSku, 10) || '');

  if (numericVal > 0) {
    skuFfMap[sku] = numericVal;
    if (cleanSku) skuFfMap[cleanSku] = numericVal;
    if (numSku) skuFfMap[numSku] = numericVal;
  } else {
    delete skuFfMap[sku];
    if (cleanSku) delete skuFfMap[cleanSku];
    if (numSku) delete skuFfMap[numSku];
  }
  saveSkuCogsToStorage();
  onCogsOrFfUpdated(sku);
}


function updateSkuFf(sku, val) {
  const numericVal = parseNum(val);
  if (numericVal > 0) {
    skuFfMap[sku] = numericVal;
  } else {
    delete skuFfMap[sku];
  }
  saveSkuCogsToStorage();
  onCogsOrFfUpdated(sku);
}

function onCogsOrFfUpdated(sku) {
  const p = globalStats.products[sku];
  if (p) {
    const rowTotalEl = document.getElementById(`total_cogs_${sku}`);
    if (rowTotalEl) {
      const unitCogs = skuCogsMap[sku] || 0;
      const unitFf = skuFfMap[sku] || 0;
      rowTotalEl.innerText = formatCurrency(p.soldQty * (unitCogs + unitFf));
    }
  }
  
  if (typeof updateFinancials === 'function') updateFinancials();
  if (typeof renderProductTable === 'function') renderProductTable();
  setText('totalCogsValueLabel', formatCurrency(calculateTotalCogs()));
}

function sortCogs(field, preventToggle = false) {
  if (!preventToggle) {
    if (cogsSortField === field) {
      cogsSortDirection = cogsSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      cogsSortField = field;
      cogsSortDirection = (field === 'name' || field === 'sku' || field === 'supplierSku' || field === 'category') ? 'asc' : 'desc';
    }
  }

  const fields = ['sku', 'supplierSku', 'category', 'name', 'sold', 'cogs', 'ff', 'total'];
  fields.forEach(f => {
    const el = document.getElementById(`cogs_sort_icon_${f}`);
    if (el) el.innerText = '⇅';
  });
  const currentArrow = cogsSortDirection === 'asc' ? '▲' : '▼';
  const activeIcon = document.getElementById(`cogs_sort_icon_${cogsSortField}`);
  if (activeIcon) activeIcon.innerText = currentArrow;

  cogsCurrentPage = 1;
  renderCogsTable();
}

function prevCogsPage() {
  if (cogsCurrentPage > 1) {
    cogsCurrentPage--;
    renderCogsTable();
  }
}

function nextCogsPage() {
  const query = (document.getElementById('cogsSearch')?.value || '').toLowerCase().trim();
  const onlyNoCogs = document.getElementById('chkOnlyNoCogs')?.checked || false;

  const filteredList = productsList.filter(p => {
    const matchesQuery = p.sku.toLowerCase().includes(query) || 
      (p.supplierSku && p.supplierSku.toLowerCase().includes(query)) ||
      (p.category && p.category.toLowerCase().includes(query)) ||
      p.name.toLowerCase().includes(query);
    if (!matchesQuery) return false;

    if (onlyNoCogs) {
      const unitCogs = parseNum(skuCogsMap[p.sku]);
      const unitFf = parseNum(skuFfMap[p.sku]);
      return (unitCogs + unitFf) === 0;
    }
    return true;
  });

  if (cogsCurrentPage * itemsPerPage < filteredList.length) {
    cogsCurrentPage++;
    renderCogsTable();
  }
}

function renderCogsTable() {
  const tbody = document.getElementById('cogsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const query = (document.getElementById('cogsSearch')?.value || '').toLowerCase().trim();
  const onlyNoCogs = document.getElementById('chkOnlyNoCogs')?.checked || false;

  const filteredList = productsList.filter(p => {
    const matchesQuery = p.sku.toLowerCase().includes(query) || 
      (p.supplierSku && p.supplierSku.toLowerCase().includes(query)) ||
      (p.category && p.category.toLowerCase().includes(query)) ||
      p.name.toLowerCase().includes(query);
    if (!matchesQuery) return false;

    if (onlyNoCogs) {
      const unitCogs = parseNum(skuCogsMap[p.sku]);
      const unitFf = parseNum(skuFfMap[p.sku]);
      return (unitCogs + unitFf) === 0;
    }
    return true;
  });

  filteredList.sort((a, b) => {
    let valA = 0, valB = 0;
    if (cogsSortField === 'sku') {
      return cogsSortDirection === 'asc' 
        ? a.sku.localeCompare(b.sku, undefined, { numeric: true }) 
        : b.sku.localeCompare(a.sku, undefined, { numeric: true });
    }
    else if (cogsSortField === 'supplierSku') {
      return cogsSortDirection === 'asc' 
        ? (a.supplierSku || '').localeCompare(b.supplierSku || '', undefined, { numeric: true }) 
        : (b.supplierSku || '').localeCompare(a.supplierSku || '', undefined, { numeric: true });
    }
    else if (cogsSortField === 'category') {
      return cogsSortDirection === 'asc' 
        ? (a.category || '').localeCompare(b.category || '') 
        : (b.category || '').localeCompare(a.category || '');
    }
    else if (cogsSortField === 'name') {
      return cogsSortDirection === 'asc' 
        ? a.name.localeCompare(b.name) 
        : b.name.localeCompare(a.name);
    }
    else if (cogsSortField === 'sold') { valA = a.soldQty; valB = b.soldQty; }
    else if (cogsSortField === 'cogs') { valA = skuCogsMap[a.sku] || 0; valB = skuCogsMap[b.sku] || 0; }
    else if (cogsSortField === 'ff') { valA = skuFfMap[a.sku] || 0; valB = skuFfMap[b.sku] || 0; }
    else if (cogsSortField === 'total') {
      valA = a.soldQty * ((skuCogsMap[a.sku] || 0) + (skuFfMap[a.sku] || 0));
      valB = b.soldQty * ((skuCogsMap[b.sku] || 0) + (skuFfMap[b.sku] || 0));
    }

    return cogsSortDirection === 'asc' ? valA - valB : valB - valA;
  });

  const startIndex = (cogsCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredList.length);
  const paginatedList = filteredList.slice(startIndex, endIndex);

  paginatedList.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition-colors text-slate-700 text-xs";
    const currentCogsVal = skuCogsMap[p.sku] !== undefined ? skuCogsMap[p.sku] : '';
    const currentFfVal = skuFfMap[p.sku] !== undefined ? skuFfMap[p.sku] : '';
    const unitCogs = parseNum(currentCogsVal);
    const unitFf = parseNum(currentFfVal);
    const totalItemCogs = p.soldQty * (unitCogs + unitFf);
    
    tr.innerHTML = `
      <td class="py-3 px-5 font-mono text-xs font-semibold text-slate-600">${p.sku}</td>
      <td class="py-3 px-5 font-mono text-xs text-slate-500">${p.supplierSku || '—'}</td>
      <td class="py-3 px-5 font-medium text-slate-600">${p.category || '—'}</td>
      <td class="py-3 px-5 max-w-xs truncate font-medium text-slate-800" title="${p.name}">${p.name}</td>
      <td class="py-3 px-5 text-right font-semibold text-slate-800">${p.soldQty} шт</td>
      <td class="py-3 px-5 text-right">
        <input type="number" min="0" step="0.01" value="${currentCogsVal}" 
               oninput="updateSkuCogs('${p.sku}', this.value)" 
               placeholder="0.00" 
               class="w-28 px-2.5 py-1 border border-slate-200 rounded-lg text-right font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-xs" />
      </td>
      <td class="py-3 px-5 text-right">
        <input type="number" min="0" step="0.01" value="${currentFfVal}" 
               oninput="updateSkuFf('${p.sku}', this.value)" 
               placeholder="0.00" 
               class="w-28 px-2.5 py-1 border border-slate-200 rounded-lg text-right font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-xs text-indigo-700" />
      </td>
      <td class="py-3 px-5 text-right font-bold text-slate-900"><span id="total_cogs_${p.sku}">${formatCurrency(totalItemCogs)}</span></td>
    `;
    tbody.appendChild(tr);
  });
  
  if (filteredList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="py-12 text-center text-slate-400">Товары не найдены</td>
      </tr>
    `;
    setText('cogsTablePaginationInfo', "Показано 0-0 из 0 товаров");
  } else {
    setText('cogsTablePaginationInfo', `Показано ${startIndex + 1}-${endIndex} из ${filteredList.length} товаров`);
  }

  const prevBtn = document.getElementById('btnPrevCogsPage');
  if (prevBtn) prevBtn.disabled = cogsCurrentPage === 1;

  const nextBtn = document.getElementById('btnNextCogsPage');
  if (nextBtn) nextBtn.disabled = endIndex >= filteredList.length;

  setText('totalCogsValueLabel', formatCurrency(calculateTotalCogs()));
  if (window.lucide) lucide.createIcons();
}
