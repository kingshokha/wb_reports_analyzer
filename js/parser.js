/**
 * WB Finance Analytics - File Parser & Excel Data Processor
 */

let isSidebarDrawerMode = false;

function enableDrawerSidebar() {
  const aside = document.getElementById('sidebarContainer');
  const headerClose = document.getElementById('sidebarHeaderClose');
  const toggleBtn = document.getElementById('btnToggleSidebar');

  if (!aside) return;
  isSidebarDrawerMode = true;

  aside.className = "fixed inset-y-0 left-0 z-50 w-80 sm:w-96 bg-white border-r border-slate-200 shadow-2xl p-6 space-y-6 overflow-y-auto custom-scrollbar transition-transform duration-300 transform -translate-x-full";
  
  closeSidebarDrawer();

  if (headerClose) {
    headerClose.classList.remove('hidden');
    headerClose.classList.add('flex');
  }
  if (toggleBtn) {
    toggleBtn.classList.remove('hidden');
  }

  if (window.lucide) lucide.createIcons();
}

function toggleSidebarDrawer() {
  const aside = document.getElementById('sidebarContainer');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!aside) return;

  if (aside.classList.contains('-translate-x-full')) {
    aside.classList.remove('-translate-x-full');
    aside.classList.add('translate-x-0');
    if (backdrop) backdrop.classList.remove('hidden');
  } else {
    closeSidebarDrawer();
  }
}

function closeSidebarDrawer() {
  const aside = document.getElementById('sidebarContainer');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (aside && isSidebarDrawerMode) {
    aside.classList.remove('translate-x-0');
    aside.classList.add('-translate-x-full');
  }
  if (backdrop) backdrop.classList.add('hidden');
}

function showError(error) {
  const loadingState = document.getElementById('loadingState');
  if (loadingState) loadingState.classList.add('hidden');
  
  const welcomeState = document.getElementById('welcomeState');
  if (welcomeState && !isSidebarDrawerMode) welcomeState.classList.remove('hidden');
  
  const banner = document.getElementById('errorBanner');
  if (banner) {
    setText('errorMessage', "Ошибка: " + error.message);
    banner.classList.remove('hidden');
  }
  if (isSidebarDrawerMode) {
    toggleSidebarDrawer();
  }
  if (window.lucide) lucide.createIcons();
}

function handleFile(file) {
  const errBanner = document.getElementById('errorBanner');
  if (errBanner) errBanner.classList.add('hidden');
  
  const welcomeState = document.getElementById('welcomeState');
  if (welcomeState) welcomeState.classList.add('hidden');
  
  const dashboardState = document.getElementById('dashboardState');
  if (dashboardState) dashboardState.classList.add('hidden');

  const fileNameEl = document.getElementById('fileName');
  if (fileNameEl) {
    fileNameEl.classList.remove('hidden');
    const span = fileNameEl.querySelector('span');
    if (span) span.innerText = file.name;
  }

  if (file.name.toLowerCase().endsWith('.zip')) {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) loadingState.classList.add('hidden');
    if (welcomeState) welcomeState.classList.remove('hidden');
    if (typeof openMergerModal === 'function') openMergerModal();
    if (typeof addFilesToMerger === 'function') addFilesToMerger([file]);
    return;
  }

  const loadingState = document.getElementById('loadingState');
  if (loadingState) loadingState.classList.remove('hidden');

  const reader = new FileReader();
  if (file.name.toLowerCase().endsWith('.csv')) {
    reader.onload = function(e) {
      try {
        const text = decodeText(e.target.result);
        const rows = parseCSV(text);
        lastLoadedRows = rows;
        processRows(rows, true);
      } catch (error) {
        showError(error);
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    reader.onload = function(e) {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error("Загруженный файл пуст или имеет неверный формат.");
        }
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        if (!worksheet) {
          throw new Error("Рабочий лист пуст.");
        }
        let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
        lastLoadedRows = rows;
        processRows(rows, true);
      } catch (error) {
        showError(error);
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

function processRows(rows, skipAutoDetect) {
  if (!rows || rows.length === 0) {
    showError(new Error("Файл не содержит строк данных."));
    return;
  }

  COL_MAP = {
    C:  letterToIdx('C'),   // 2 - Категория / Предмет
    D:  letterToIdx('D'),   // 3 - Артикул WB
    F:  letterToIdx('F'),   // 5 - Артикул продавца
    G:  letterToIdx('G'),   // 6 - Название товара
    K:  letterToIdx('K'),   // 10 - Обоснование для оплаты
    M:  letterToIdx('M'),   // 12 - Дата операции
    O:  letterToIdx('O'),   // 14 - Розничная цена (для расчета налога)
    T:  letterToIdx('T'),   // 19 - Цена розничная с учетом скидки (сумма выкупа)
    W:  letterToIdx('W'),   // 22 - СПП, %
    X:  letterToIdx('X'),   // 23 - Комиссия WB, % (кВВ)
    AC: letterToIdx('AC'),  // 28 - Эквайринг (руб.)
    AH: letterToIdx('AH'),  // 33 - К перечислению за товар
    AK: letterToIdx('AK'),  // 36 - Логистика
    AO: letterToIdx('AO'),  // 40 - Штрафы
    AP: letterToIdx('AP'),  // 41 - Конструктор тарифов
    AQ: letterToIdx('AQ'),  // 42 - Виды логистики / пояснения удержаний
    BH: letterToIdx('BH'),  // 59 - Хранение
    BI: letterToIdx('BI'),  // 60 - Прочие удержания
    BJ: letterToIdx('BJ')   // 61 - Приемка
  };

  const dataStartIdx = 0;
  
  let localMinDate = null;
  let localMaxDate = null;

  for (let i = dataStartIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row) || row.length < 3) continue;
    const dVal = parseDate(row[COL_MAP.M]);
    if (dVal) {
      if (!localMinDate || dVal < localMinDate) localMinDate = dVal;
      if (!localMaxDate || dVal > localMaxDate) localMaxDate = dVal;
    }
  }

  minFileDate = localMinDate;
  maxFileDate = localMaxDate;

  let filterStart = null;
  let filterEnd = null;

  if (minFileDate && maxFileDate) {
    const preset = document.getElementById('selectPeriodPreset')?.value || 'all';
    const fromInput = document.getElementById('inputDateFrom');
    const toInput = document.getElementById('inputDateTo');

    if (preset === 'all') {
      filterStart = new Date(minFileDate.getFullYear(), minFileDate.getMonth(), minFileDate.getDate(), 0, 0, 0, 0);
      filterEnd = new Date(maxFileDate.getFullYear(), maxFileDate.getMonth(), maxFileDate.getDate(), 23, 59, 59, 999);
      if (fromInput) fromInput.value = toLocalInputDate(minFileDate);
      if (toInput) toInput.value = toLocalInputDate(maxFileDate);
    } else if (preset === 'last30') {
      filterEnd = new Date(maxFileDate.getFullYear(), maxFileDate.getMonth(), maxFileDate.getDate(), 23, 59, 59, 999);
      const startCand = new Date(maxFileDate.getTime() - 29 * 24 * 60 * 60 * 1000);
      filterStart = new Date(startCand.getFullYear(), startCand.getMonth(), startCand.getDate(), 0, 0, 0, 0);
      if (fromInput) fromInput.value = toLocalInputDate(filterStart);
      if (toInput) toInput.value = toLocalInputDate(filterEnd);
    } else if (preset === 'prev30') {
      const pivotEnd = new Date(maxFileDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      filterEnd = new Date(pivotEnd.getFullYear(), pivotEnd.getMonth(), pivotEnd.getDate(), 23, 59, 59, 999);
      const startCand = new Date(pivotEnd.getTime() - 29 * 24 * 60 * 60 * 1000);
      filterStart = new Date(startCand.getFullYear(), startCand.getMonth(), startCand.getDate(), 0, 0, 0, 0);
      if (fromInput) fromInput.value = toLocalInputDate(filterStart);
      if (toInput) toInput.value = toLocalInputDate(filterEnd);
    } else if (preset === 'custom' && fromInput && toInput && fromInput.value && toInput.value) {
      const pStart = parseDate(fromInput.value);
      const pEnd = parseDate(toInput.value);
      if (pStart) filterStart = new Date(pStart.getFullYear(), pStart.getMonth(), pStart.getDate(), 0, 0, 0, 0);
      if (pEnd) filterEnd = new Date(pEnd.getFullYear(), pEnd.getMonth(), pEnd.getDate(), 23, 59, 59, 999);
    } else {
      filterStart = new Date(minFileDate.getFullYear(), minFileDate.getMonth(), minFileDate.getDate(), 0, 0, 0, 0);
      filterEnd = new Date(maxFileDate.getFullYear(), maxFileDate.getMonth(), maxFileDate.getDate(), 23, 59, 59, 999);
      if (fromInput && !fromInput.value) fromInput.value = toLocalInputDate(minFileDate);
      if (toInput && !toInput.value) toInput.value = toLocalInputDate(maxFileDate);
    }
  }

  globalStats = {
    turnover: 0,
    salesCount: 0,
    returnsCount: 0,
    returnsSum: 0,
    returnsList: [],
    categorySpp: {},
    commissionSum: 0,
    acquiringSum: 0,
    logisticsSum: 0,
    storageSum: 0,
    payoutSum: 0,
    salesPayoutSum: 0,
    returnsPayoutSum: 0,
    finesSum: 0,
    tariffDesignerSum: 0,
    deductionsSum: 0,
    deductionsList: [],
    acceptanceSum: 0,
    taxSum: 0,
    sppAvg: 0,
    logisticsBreakdown: {},
    dailyTimeline: {},
    products: {}
  };

  let salesRetailSum = 0;
  let returnsRetailSum = 0;
  let salesAcquiringSum = 0;
  let returnsAcquiringSum = 0;
  let sppTotalSum = 0;
  let sppValidCount = 0;
  let validDataRowCount = 0;

  for (let i = dataStartIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row) || row.length < 3) continue;

    const dVal = parseDate(row[COL_MAP.M]);
    if (filterStart && filterEnd) {
      if (dVal) {
        if (dVal < filterStart || dVal > filterEnd) {
          continue;
        }
      }
    }

    const categoryVal = String(row[COL_MAP.C] !== undefined && row[COL_MAP.C] !== null ? row[COL_MAP.C] : '').trim();
    const skuVal = String(row[COL_MAP.D] !== undefined && row[COL_MAP.D] !== null ? row[COL_MAP.D] : '').trim();
    const supplierSkuVal = String(row[COL_MAP.F] !== undefined && row[COL_MAP.F] !== null ? row[COL_MAP.F] : '').trim();
    const nameVal = String(row[COL_MAP.G] !== undefined && row[COL_MAP.G] !== null ? row[COL_MAP.G] : '').trim();
    const reasonVal = String(row[COL_MAP.K] !== undefined && row[COL_MAP.K] !== null ? row[COL_MAP.K] : '').toLowerCase().trim();
    const rowT = parseNum(row[COL_MAP.T]);
    const rowW = parseNum(row[COL_MAP.W]);
    const rowX = parseNum(row[COL_MAP.X]);
    const rowAC = parseNum(row[COL_MAP.AC]);
    const rowAH = parseNum(row[COL_MAP.AH]);
    const rowAK = parseNum(row[COL_MAP.AK]);
    const rowAQ = String(row[COL_MAP.AQ] !== undefined && row[COL_MAP.AQ] !== null ? row[COL_MAP.AQ] : '').trim();
    const rowBH = parseNum(row[COL_MAP.BH]);
    const rowAO = parseNum(row[COL_MAP.AO]);
    const rowAP = parseNum(row[COL_MAP.AP]);
    const rowBI = parseNum(row[COL_MAP.BI]);
    const rowBJ = parseNum(row[COL_MAP.BJ]);
    const rowO = parseNum(row[COL_MAP.O]);

    if (!skuVal && rowAK === 0 && rowBH === 0 && rowT === 0 && rowAO === 0 && rowAP === 0 && rowBI === 0 && rowBJ === 0) continue;
    
    if (skuVal.toLowerCase() === 'итого' || skuVal.toLowerCase() === 'всего' || skuVal.toLowerCase() === 'согласовано') {
      continue;
    }

    validDataRowCount++;

    const dayKey = dVal ? toLocalInputDate(dVal) : '';
    if (dayKey) {
      if (!globalStats.dailyTimeline) globalStats.dailyTimeline = {};
      if (!globalStats.dailyTimeline[dayKey]) {
        globalStats.dailyTimeline[dayKey] = {
          date: dVal,
          dateKey: dayKey,
          dateFormatted: formatDate(dVal),
          salesTurnover: 0,
          returnsTurnover: 0,
          turnover: 0,
          salesPayout: 0,
          returnsPayout: 0,
          payout: 0,
          commission: 0,
          acquiring: 0,
          fees: 0,
          logistics: 0,
          storage: 0,
          fines: 0,
          tariffDesigner: 0,
          deductions: 0,
          acceptance: 0,
          wbExpenses: 0,
          salesRetailSum: 0,
          returnsRetailSum: 0,
          tax: 0,
          skuSoldQty: {},
          cogs: 0,
          netProfit: 0
        };
      }
    }
    const dayItem = dayKey ? globalStats.dailyTimeline[dayKey] : null;

    if (rowW !== 0) {
      let sppVal = rowW;
      if (Math.abs(sppVal) > 0 && Math.abs(sppVal) <= 1) {
        sppVal = sppVal * 100;
      }
      sppTotalSum += Math.abs(sppVal);
      sppValidCount++;

      const catName = categoryVal || 'Без категории';
      if (!globalStats.categorySpp[catName]) {
        globalStats.categorySpp[catName] = { totalSpp: 0, count: 0 };
      }
      globalStats.categorySpp[catName].totalSpp += Math.abs(sppVal);
      globalStats.categorySpp[catName].count += 1;
    }

    globalStats.storageSum += rowBH;
    globalStats.finesSum += Math.abs(rowAO);
    globalStats.tariffDesignerSum += Math.abs(rowAP);
    globalStats.acceptanceSum += Math.abs(rowBJ);

    if (dayItem) {
      dayItem.storage += rowBH;
      dayItem.fines += Math.abs(rowAO);
      dayItem.tariffDesigner += Math.abs(rowAP);
      dayItem.acceptance += Math.abs(rowBJ);
    }

    if (rowBI !== 0) {
      globalStats.deductionsSum += rowBI;
      globalStats.deductionsList.push({
        rawDate: dVal,
        date: dVal ? formatDate(dVal) : (row[COL_MAP.M] ? String(row[COL_MAP.M]).trim() : '—'),
        sku: skuVal || '—',
        reason: rowAQ || 'Удержание / Взыскание',
        amount: rowBI
      });
      if (dayItem) dayItem.deductions += rowBI;
    }

    if (rowAK !== 0) {
      globalStats.logisticsSum += rowAK;
      if (dayItem) dayItem.logistics += rowAK;

      const logType = rowAQ || 'Не указан / Прочее';
      if (!globalStats.logisticsBreakdown[logType]) {
        globalStats.logisticsBreakdown[logType] = { sum: 0, count: 0 };
      }
      globalStats.logisticsBreakdown[logType].sum += rowAK;
      globalStats.logisticsBreakdown[logType].count += 1;

      if (skuVal) {
        if (!globalStats.products[skuVal]) {
          globalStats.products[skuVal] = {
            sku: skuVal,
            supplierSku: supplierSkuVal || '—',
            category: categoryVal || '—',
            name: nameVal || 'Без названия',
            soldQty: 0,
            returnedQty: 0,
            salesTurnover: 0,
            returnsTurnover: 0,
            salesRetailSum: 0,
            returnsRetailSum: 0,
            salesPayout: 0,
            returnsPayout: 0,
            commission: 0,
            acquiring: 0,
            logistics: 0,
            turnover: 0,
            payout: 0
          };

    if (skuVal && dayKey && globalStats.products[skuVal]) {
      const prodTimeline = globalStats.products[skuVal];
      if (!prodTimeline.dailyTimeline) prodTimeline.dailyTimeline = {};
      if (!prodTimeline.dailyTimeline[dayKey]) {
        prodTimeline.dailyTimeline[dayKey] = {
          date: dVal,
          dateKey: dayKey,
          dateFormatted: formatDate(dVal),
          soldQty: 0,
          returnedQty: 0,
          turnoverT: 0,
          retailSumO: 0,
          payableAH: 0,
          logisticsAK: 0,
          sppSum: 0,
          sppCount: 0
        };
      }
      const pDay = prodTimeline.dailyTimeline[dayKey];

      if (rowW !== 0) {
        let sppVal = rowW;
        if (Math.abs(sppVal) > 0 && Math.abs(sppVal) <= 1) sppVal = sppVal * 100;
        pDay.sppSum += Math.abs(sppVal);
        pDay.sppCount += 1;
      }

      if (rowAK !== 0) {
        pDay.logisticsAK += rowAK;
      }

      if (isSale) {
        pDay.soldQty += 1;
        pDay.turnoverT += rowT;
        pDay.retailSumO += Math.abs(rowO);
        pDay.payableAH += rowAH;
      } else if (isReturn) {
        pDay.returnedQty += 1;
        pDay.turnoverT -= Math.abs(rowT);
        pDay.retailSumO -= Math.abs(rowO);
        pDay.payableAH -= Math.abs(rowAH);
      }
    }

        }
        globalStats.products[skuVal].logistics += rowAK;
      }
    }

    const isVoluntaryCompensation = reasonVal.includes('добровольная компенсация при возврате');
    let isSale = reasonVal.includes('продажа') || reasonVal.includes('реализация') || isVoluntaryCompensation;
    let isReturn = reasonVal.includes('возврат') && !isVoluntaryCompensation;

    if (rowT === 0 && rowAH === 0) {
      isSale = false;
      isReturn = false;
    }

    if (!skuVal) {
      isSale = false;
      isReturn = false;
    }

    if (skuVal && (isSale || isReturn)) {
      if (!globalStats.products[skuVal]) {
        globalStats.products[skuVal] = {
          sku: skuVal,
          supplierSku: supplierSkuVal || '—',
          category: categoryVal || '—',
          name: nameVal || 'Без названия',
          soldQty: 0,
          returnedQty: 0,
          salesTurnover: 0,
          returnsTurnover: 0,
          salesRetailSum: 0,
          returnsRetailSum: 0,
          salesPayout: 0,
          returnsPayout: 0,
          commission: 0,
          acquiring: 0,
          logistics: 0,
          turnover: 0,
          payout: 0
        };
      }
      if (supplierSkuVal && globalStats.products[skuVal].supplierSku === '—') {
        globalStats.products[skuVal].supplierSku = supplierSkuVal;
      }
      if (categoryVal && (!globalStats.products[skuVal].category || globalStats.products[skuVal].category === '—')) {
        globalStats.products[skuVal].category = categoryVal;
      }
      if (nameVal && globalStats.products[skuVal].name === 'Без названия') {
        globalStats.products[skuVal].name = nameVal;
      }
    }

    let commPercent = rowX;
    if (Math.abs(commPercent) > 1) {
      commPercent = commPercent / 100;
    }
    const rowCommission = Math.abs(rowT) * commPercent;
    const acquiringVal = Math.abs(rowAC);

    if (isSale) {
      globalStats.salesCount++;
      globalStats.turnover += rowT;
      globalStats.commissionSum += rowCommission;
      salesAcquiringSum += acquiringVal;
      salesRetailSum += Math.abs(rowO);
      globalStats.salesPayoutSum += rowAH;

      if (dayItem) {
        dayItem.salesTurnover += rowT;
        dayItem.commission += rowCommission;
        dayItem.acquiring += acquiringVal;
        dayItem.salesRetailSum += Math.abs(rowO);
        dayItem.salesPayout += rowAH;
        if (skuVal) {
          dayItem.skuSoldQty[skuVal] = (dayItem.skuSoldQty[skuVal] || 0) + 1;
        }
      }

      const prod = globalStats.products[skuVal];
      prod.soldQty++;
      prod.salesTurnover += rowT;
      prod.salesPayout += rowAH;
      prod.commission += rowCommission;
      prod.acquiring += acquiringVal;
      prod.salesRetailSum += Math.abs(rowO);

    } else if (isReturn) {
      globalStats.returnsCount++;
      globalStats.returnsSum += Math.abs(rowT);
      globalStats.commissionSum -= rowCommission;
      returnsAcquiringSum += acquiringVal;
      returnsRetailSum += Math.abs(rowO);
      globalStats.returnsPayoutSum += Math.abs(rowAH);

      if (dayItem) {
        dayItem.returnsTurnover += Math.abs(rowT);
        dayItem.commission -= rowCommission;
        dayItem.acquiring -= acquiringVal;
        dayItem.returnsRetailSum += Math.abs(rowO);
        dayItem.returnsPayout += Math.abs(rowAH);
        if (skuVal) {
          dayItem.skuSoldQty[skuVal] = (dayItem.skuSoldQty[skuVal] || 0) - 1;
        }
      }

      globalStats.returnsList.push({
        date: dVal ? formatDate(dVal) : (row[COL_MAP.M] ? String(row[COL_MAP.M]).trim() : '—'),
        sku: skuVal || '—',
        supplierSku: supplierSkuVal || '—',
        category: categoryVal || '—',
        name: nameVal || 'Без названия',
        amount: Math.abs(rowT)
      });

      const prod = globalStats.products[skuVal];
      prod.returnedQty++;
      prod.returnsTurnover += Math.abs(rowT);
      prod.returnsPayout += Math.abs(rowAH);
      prod.commission -= rowCommission;
      prod.acquiring -= acquiringVal;
      prod.returnsRetailSum += Math.abs(rowO);

    } else {
      globalStats.salesPayoutSum += rowAH;
      if (dayItem) dayItem.salesPayout += rowAH;
    }
  }

  if (validDataRowCount === 0) {
    showError(new Error("Не удалось считать полезные данные отчета за выбранный период."));
    return;
  }

  globalStats.payoutSum = globalStats.salesPayoutSum - globalStats.returnsPayoutSum;
  globalStats.acquiringSum = salesAcquiringSum - returnsAcquiringSum;
  globalStats.salesRetailSum = salesRetailSum;
  globalStats.returnsRetailSum = returnsRetailSum;
  
  const taxRateVal = parseNum(document.getElementById('inputTaxRate')?.value);
  const taxRatePercent = isNaN(taxRateVal) || taxRateVal < 0 ? 6 : taxRateVal;
  globalStats.taxRatePercent = taxRatePercent;

  globalStats.sppAvg = sppValidCount > 0 ? (sppTotalSum / sppValidCount) : 0;

  const netRetailSum = salesRetailSum - returnsRetailSum;
  globalStats.taxSum = netRetailSum * (taxRatePercent / 100);

  for (const dayKey in globalStats.dailyTimeline) {
    const day = globalStats.dailyTimeline[dayKey];
    day.turnover = day.salesTurnover - day.returnsTurnover;
    day.fees = day.commission + day.acquiring;
    day.payout = day.salesPayout - day.returnsPayout;
    day.wbExpenses = day.storage + day.fines + day.tariffDesigner + day.acceptance;
    day.tax = Math.max(0, (day.salesRetailSum - day.returnsRetailSum)) * (taxRatePercent / 100);
  }

  for (const sku in globalStats.products) {
    const prod = globalStats.products[sku];
    prod.turnover = prod.salesTurnover - prod.returnsTurnover;
    prod.payout = prod.salesPayout - prod.returnsPayout;
    const prodNetRetail = (prod.salesRetailSum || 0) - (prod.returnsRetailSum || 0);
    prod.taxSum = prodNetRetail * (taxRatePercent / 100);
    prod.adSpend = skuAdSpendMap[String(sku).trim()] || skuAdSpendMap[sku] || 0;
  }

  productsList = Object.values(globalStats.products);
  if (typeof updateCategoryFilterDropdown === 'function') updateCategoryFilterDropdown();
  if (typeof applyProductFilters === 'function') applyProductFilters();

  if (typeof updateFinancials === 'function') updateFinancials();
  if (typeof renderLogisticsBreakdown === 'function') renderLogisticsBreakdown();
  if (typeof sortProducts === 'function') sortProducts(currentSortField, true); 

  enableDrawerSidebar();

  const loadingState = document.getElementById('loadingState');
  if (loadingState) loadingState.classList.add('hidden');
  
  const dashboardState = document.getElementById('dashboardState');
  if (dashboardState) dashboardState.classList.remove('hidden');

  if (window.lucide) lucide.createIcons();
}
