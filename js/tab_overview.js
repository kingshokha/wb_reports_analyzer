/**
 * WB Finance Analytics - Overview Tab Logic, Charts, & Modals
 */

function updateFinancials() {
  const adSpendInput = parseNum(document.getElementById('inputAdSpend')?.value);
  const otherSpendInput = parseNum(document.getElementById('inputOtherSpend')?.value);
  const taxRateInputVal = parseNum(document.getElementById('inputTaxRate')?.value);
  const taxRatePercent = isNaN(taxRateInputVal) || taxRateInputVal < 0 ? 6 : taxRateInputVal;
  globalStats.taxRatePercent = taxRatePercent;

  if (globalStats.salesRetailSum !== undefined && globalStats.returnsRetailSum !== undefined) {
    const netRetailSum = globalStats.salesRetailSum - globalStats.returnsRetailSum;
    globalStats.taxSum = netRetailSum * (taxRatePercent / 100);
  }

  const netTurnover = globalStats.turnover - globalStats.returnsSum;
  const calculatedCOGS = typeof calculateTotalCogs === 'function' ? calculateTotalCogs() : 0;

  const calculatedNetProfit = globalStats.payoutSum 
    - adSpendInput 
    - globalStats.storageSum 
    - globalStats.finesSum
    - globalStats.tariffDesignerSum
    - globalStats.acceptanceSum
    - globalStats.deductionsSum
    - globalStats.logisticsSum
    - globalStats.taxSum
    - otherSpendInput 
    - calculatedCOGS;

  setText('statTurnover', formatCurrency(netTurnover));
  setText('statSalesCount', `${globalStats.salesCount} шт`);
  setText('statReturnsCount', `${globalStats.returnsCount} шт`);
  setText('statReturnsSum', formatCurrency(globalStats.returnsSum));
  setText('statSppAvg', `${(globalStats.sppAvg || 0).toFixed(2)}%`);
  
  const returnsRatio = globalStats.turnover > 0 ? (globalStats.returnsSum / globalStats.turnover) * 100 : 0;
  setText('statReturnsPercent', `${returnsRatio.toFixed(2)}%`);

  const feesSum = globalStats.commissionSum + globalStats.acquiringSum;
  setText('statFees', formatCurrency(feesSum));
  setText('statCommission', formatCurrency(globalStats.commissionSum));
  setText('statAcquiring', formatCurrency(globalStats.acquiringSum));
  
  const feesRatio = netTurnover > 0 ? (feesSum / netTurnover) * 100 : 0;
  setText('statFeesRatio', `${feesRatio.toFixed(2)}%`);

  setText('statTaxCardTitle', `Налог ${taxRatePercent}% (O)`);
  setText('statTaxCard', formatCurrency(globalStats.taxSum));

  const otherWbExpenses = globalStats.finesSum 
    + globalStats.tariffDesignerSum 
    + globalStats.acceptanceSum;

  const totalWbExpenses = globalStats.logisticsSum + globalStats.storageSum + otherWbExpenses;

  setText('statLogAndStore', formatCurrency(totalWbExpenses));
  setText('statDeductionsCard', formatCurrency(globalStats.deductionsSum));
  setText('statLogisticsOnly', formatCurrency(globalStats.logisticsSum));
  setText('statStorage', formatCurrency(globalStats.storageSum));
  setText('statOtherWbExpenses', formatCurrency(otherWbExpenses));

  setText('statPayout', formatCurrency(globalStats.payoutSum));
  setText('statSalesPayout', formatCurrency(globalStats.salesPayoutSum));
  setText('statReturnsPayout', `-${formatCurrency(globalStats.returnsPayoutSum)}`);
  
  const payoutRatio = netTurnover > 0 ? (globalStats.payoutSum / netTurnover) * 100 : 0;
  setText('statPayoutRatio', `${payoutRatio.toFixed(2)}%`);

  const totalWbPayable = globalStats.payoutSum 
    - globalStats.logisticsSum 
    - globalStats.tariffDesignerSum 
    - globalStats.deductionsSum 
    - globalStats.storageSum 
    - globalStats.acceptanceSum 
    - globalStats.finesSum;

  setText('statTotalWbPayable', formatCurrency(totalWbPayable));

  const netProfitEl = document.getElementById('statNetProfit');
  if (netProfitEl) {
    netProfitEl.innerText = formatCurrency(calculatedNetProfit);
    if (calculatedNetProfit < 0) {
      netProfitEl.className = "text-2xl font-extrabold text-rose-400 mt-1";
    } else {
      netProfitEl.className = "text-2xl font-extrabold text-yellow-400 mt-1";
    }
  }

  const breakdownItems = [
    { label: 'Сумма выкупа (T)', val: netTurnover, color: 'bg-blue-500', isIncome: true },
    { label: 'Комиссия и эквайринг (T × X + AC)', val: globalStats.commissionSum + globalStats.acquiringSum, color: 'bg-amber-500' },
    { label: 'Услуги по доставке (AK)', val: globalStats.logisticsSum, color: 'bg-indigo-500' },
    { label: 'Хранение на складах (BH)', val: globalStats.storageSum, color: 'bg-pink-500' },
    { label: 'Штрафы (AO)', val: globalStats.finesSum, color: 'bg-red-600' },
    { label: 'Конструктор тарифов (AP)', val: globalStats.tariffDesignerSum, color: 'bg-orange-500' },
    { label: 'Удержания (BI)', val: globalStats.deductionsSum, color: 'bg-amber-700' },
    { label: 'Операции при приемке (BJ)', val: globalStats.acceptanceSum, color: 'bg-teal-600' },
    { label: `Расчетный налог ${taxRatePercent}% (O)`, val: globalStats.taxSum, color: 'bg-amber-900' },
    { label: 'Расход на рекламу (введено)', val: adSpendInput, color: 'bg-red-400' },
    { label: 'Себестоимость товаров (COGS)', val: calculatedCOGS, color: 'bg-purple-500' },
    { label: 'Накладные и прочие издержки', val: otherSpendInput, color: 'bg-slate-500' }
  ];

  breakdownItems.sort((a, b) => Math.abs(b.val) - Math.abs(a.val));

  const container = document.getElementById('breakdownItemsContainer');
  if (container) {
    container.innerHTML = '';
    breakdownItems.forEach(item => {
      const div = document.createElement('div');
      div.className = "flex justify-between py-1.5 border-b border-slate-50";
      const valStr = item.isIncome ? formatCurrency(item.val) : `-${formatCurrency(item.val)}`;
      const valClass = item.isIncome ? "font-semibold text-slate-700" : "text-rose-600 font-semibold";
      
      div.innerHTML = `
        <span class="text-slate-500 flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full ${item.color}"></span>
          ${item.label}:
        </span>
        <span class="${valClass}">${valStr}</span>
      `;
      container.appendChild(div);
    });
  }
  
  setText('storageDetailsSum', formatCurrency(globalStats.storageSum));
  setText('storageLabel', formatCurrency(globalStats.storageSum));
  setText('finesLabel', formatCurrency(globalStats.finesSum));
  setText('tariffLabel', formatCurrency(globalStats.tariffDesignerSum));
  setText('acceptanceLabel', formatCurrency(globalStats.acceptanceSum));
  
  setText('taxLabelTitle', `Расчетный налог ${taxRatePercent}% (O)`);
  setText('taxLabel', formatCurrency(globalStats.taxSum));

  renderFinanceChart(calculatedNetProfit, adSpendInput, calculatedCOGS, otherSpendInput);
  if (window.lucide) lucide.createIcons();
}

function renderFinanceChart(netProfit, adSpend, cogs, otherSpend) {
  const ctx = document.getElementById('financeChart');
  if (!ctx) return;
  
  if (financeChartInstance) {
    financeChartInstance.destroy();
  }

  const visualProfit = Math.max(0, netProfit);
  const taxLabelText = `Налог ${globalStats.taxRatePercent !== undefined ? globalStats.taxRatePercent : 6}%`;

  const chartData = {
    labels: [
      'Чистая прибыль', 
      'Комиссия WB', 
      'Эквайринг', 
      'Логистика', 
      'Хранение', 
      'Штрафы', 
      'Конструктор тарифов', 
      'Удержания', 
      'Приемка', 
      taxLabelText,
      'Реклама', 
      'Себестоимость', 
      'Прочее'
    ],
    datasets: [{
      data: [
        visualProfit,
        globalStats.commissionSum,
        globalStats.acquiringSum,
        globalStats.logisticsSum,
        globalStats.storageSum,
        globalStats.finesSum,
        globalStats.tariffDesignerSum,
        globalStats.deductionsSum,
        globalStats.acceptanceSum,
        globalStats.taxSum,
        adSpend,
        cogs,
        otherSpend
      ],
      backgroundColor: [
        '#10b981',
        '#cb11ab',
        '#f59e0b',
        '#6366f1',
        '#ec4899',
        '#ef4444',
        '#f97316',
        '#b45309',
        '#0d9488',
        '#a16207',
        '#f87171',
        '#a855f7',
        '#64748b'
      ],
      borderWidth: 1
    }]
  };

  financeChartInstance = new Chart(ctx.getContext('2d'), {
    type: 'doughnut',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 10,
            font: { size: 9 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.label || '';
              if (label) label += ': ';
              label += formatCurrency(context.raw);
              return label;
            }
          }
        }
      },
      cutout: '55%'
    }
  });
}

function renderLogisticsBreakdown() {
  const tbody = document.getElementById('logisticsTypeTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const labels = [];
  const values = [];

  const sortedLogistics = Object.entries(globalStats.logisticsBreakdown)
    .sort((a, b) => b[1].sum - a[1].sum);

  const LOGISTICS_TOOLTIPS = {
    'к клиенту при продаже':     'От склада до покупателя при продаже товара',
    'к клиенту при отмене':      'От склада до покупателя при отмене без выкупа товара',
    'от клиента при отмене':     'От покупателя до склада при отмене покупателем без выкупа',
    'от клиента при возврате':   'От покупателя до склада, когда покупатель вернул товар после выдачи',
  };

  sortedLogistics.forEach(([type, data]) => {
    const sum = data.sum;
    const count = data.count;
    const ratio = globalStats.logisticsSum > 0 ? (sum / globalStats.logisticsSum) * 100 : 0;
    
    labels.push(type);
    values.push(sum);

    const tooltipText = LOGISTICS_TOOLTIPS[type.toLowerCase()] || '';
    const infoIcon = tooltipText
      ? `<span class="relative group inline-flex items-center ml-1.5 cursor-default">
           <span class="w-4 h-4 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold leading-none select-none hover:bg-purple-100 hover:text-purple-700 transition-colors">i</span>
           <span class="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-50 hidden group-hover:flex w-56 bg-slate-800 text-white text-[11px] leading-snug rounded-lg px-3 py-2 shadow-xl pointer-events-none whitespace-normal">
             ${tooltipText}
           </span>
         </span>`
      : '';

    const row = document.createElement('tr');
    row.className = "hover:bg-slate-50 transition-colors text-slate-700 text-xs";
    row.innerHTML = `
      <td class="py-3 px-4 font-medium">
        <span class="flex items-center gap-0">${type}${infoIcon}</span>
      </td>
      <td class="py-3 px-4 text-right font-semibold">
        ${formatCurrency(sum)} <span class="text-[11px] font-semibold text-purple-700 ml-1.5 bg-purple-50 px-1.5 py-0.5 rounded-md">(${count} шт.)</span>
      </td>
      <td class="py-3 px-4 text-right text-slate-400 font-medium">${ratio.toFixed(2)}%</td>
    `;
    tbody.appendChild(row);
  });

  if (sortedLogistics.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="py-6 text-center text-slate-400">Данные по видам логистики отсутствуют</td></tr>`;
  }

  const canvas = document.getElementById('logisticsChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  if (logisticsChartInstance) {
    logisticsChartInstance.destroy();
  }

  logisticsChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        label: 'Сумма услуг (руб.)',
        data: values,
        backgroundColor: [
          '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
          '#a855f7', '#ef4444', '#0d9488', '#8b5cf6', '#64748b'
        ].slice(0, labels.length),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 12,
            font: { size: 10 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.label || '';
              if (label) label += ': ';
              label += formatCurrency(context.raw);
              return label;
            }
          }
        }
      },
      cutout: '55%'
    }
  });
}

function openTurnoverModal() {
  const modal = document.getElementById('modalTurnover');
  if (!modal) return;

  const grossTurnover = globalStats.turnover || 0;
  const returnsSum = globalStats.returnsSum || 0;
  const netTurnover = grossTurnover - returnsSum;

  setText('modalTurnoverGross', formatCurrency(grossTurnover));
  setText('modalTurnoverReturns', `- ${formatCurrency(returnsSum)}`);
  setText('modalTurnoverNet', formatCurrency(netTurnover));
  setText('modalTurnoverSalesCount', `${globalStats.salesCount || 0} шт`);
  setText('modalTurnoverReturnsCount', `${globalStats.returnsCount || 0} шт`);

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeTurnoverModal() {
  const modal = document.getElementById('modalTurnover');
  if (modal) modal.classList.add('hidden');
}

function openFeesModal() {
  const modal = document.getElementById('modalFees');
  if (!modal) return;

  const commSum = globalStats.commissionSum || 0;
  const acqSum = globalStats.acquiringSum || 0;
  const totalFees = commSum + acqSum;
  const netTurnover = (globalStats.turnover || 0) - (globalStats.returnsSum || 0);
  const ratio = netTurnover > 0 ? (totalFees / netTurnover) * 100 : 0;

  setText('modalFeesCommission', formatCurrency(commSum));
  setText('modalFeesAcquiring', formatCurrency(acqSum));
  setText('modalFeesTotal', formatCurrency(totalFees));
  setText('modalFeesRatioPercent', `${ratio.toFixed(2)}%`);

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeFeesModal() {
  const modal = document.getElementById('modalFees');
  if (modal) modal.classList.add('hidden');
}

function openTotalWbPayableModal() {
  const modal = document.getElementById('modalTotalWbPayable');
  if (!modal) return;

  const totalPayable = (globalStats.payoutSum || 0)
    - (globalStats.logisticsSum || 0)
    - (globalStats.storageSum || 0)
    - (globalStats.tariffDesignerSum || 0)
    - (globalStats.deductionsSum || 0)
    - (globalStats.acceptanceSum || 0)
    - (globalStats.finesSum || 0);

  setText('modalPayableAH', formatCurrency(globalStats.payoutSum));
  setText('modalPayableLogistics', `- ${formatCurrency(globalStats.logisticsSum)}`);
  setText('modalPayableStorage', `- ${formatCurrency(globalStats.storageSum)}`);
  setText('modalPayableTariff', `- ${formatCurrency(globalStats.tariffDesignerSum)}`);
  setText('modalPayableDeductions', `- ${formatCurrency(globalStats.deductionsSum)}`);
  setText('modalPayableAcceptance', `- ${formatCurrency(globalStats.acceptanceSum)}`);
  setText('modalPayableFines', `- ${formatCurrency(globalStats.finesSum)}`);
  setText('modalPayableTotal', formatCurrency(totalPayable));

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeTotalWbPayableModal() {
  const modal = document.getElementById('modalTotalWbPayable');
  if (modal) modal.classList.add('hidden');
}

function openExpensesModal() {
  const modal = document.getElementById('modalExpenses');
  if (!modal) return;
  
  const otherWbExpenses = globalStats.finesSum 
    + globalStats.tariffDesignerSum 
    + globalStats.acceptanceSum;
  const totalWbExpenses = globalStats.logisticsSum + globalStats.storageSum + otherWbExpenses;

  const listEl = document.getElementById('modalExpensesList');
  if (listEl) {
    const expenseCategories = [
      { label: 'Логистика (AK)', val: globalStats.logisticsSum },
      { label: 'Хранение (BH)', val: globalStats.storageSum },
      { label: 'Штрафы (AO)', val: globalStats.finesSum },
      { label: 'Конструктор тарифов (AP)', val: globalStats.tariffDesignerSum },
      { label: 'Операции при приемке (BJ)', val: globalStats.acceptanceSum }
    ];

    const filteredExpenses = expenseCategories.filter(item => Math.abs(item.val) >= 1);
    
    if (filteredExpenses.length > 0) {
      listEl.innerHTML = filteredExpenses.map(item => `
        <div class="flex justify-between py-1.5 border-b border-slate-100">
          <span class="text-slate-500">${item.label}:</span>
          <span class="font-semibold text-slate-800">${formatCurrency(item.val)}</span>
        </div>
      `).join('');
    } else {
      listEl.innerHTML = `<div class="text-slate-400 py-3 text-center text-xs">Расходы менее 1 ₽ или отсутствуют</div>`;
    }
  }

  setText('modalTotalExpenses', formatCurrency(totalWbExpenses));

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeExpensesModal() {
  const modal = document.getElementById('modalExpenses');
  if (modal) modal.classList.add('hidden');
}

let deductionsSortField = 'date';
let deductionsSortDirection = 'desc';

function sortDeductions(field, preventToggle = false) {
  if (!preventToggle) {
    if (deductionsSortField === field) {
      deductionsSortDirection = deductionsSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      deductionsSortField = field;
      deductionsSortDirection = (field === 'reason') ? 'asc' : 'desc';
    }
  }

  ['date', 'reason', 'amount'].forEach(f => {
    const icon = document.getElementById(`deductions_sort_icon_${f}`);
    if (icon) icon.innerText = '⇅';
  });

  const activeIcon = document.getElementById(`deductions_sort_icon_${deductionsSortField}`);
  if (activeIcon) {
    activeIcon.innerText = deductionsSortDirection === 'asc' ? '▲' : '▼';
  }

  renderDeductionsTable();
}

function getDeductionTimestamp(item) {
  if (item.rawDate instanceof Date && !isNaN(item.rawDate.getTime())) {
    return item.rawDate.getTime();
  }
  if (!item.date || item.date === '—') return 0;
  
  const parts = String(item.date).split('.');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  const d = new Date(item.date);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function renderDeductionsTable() {
  const tbody = document.getElementById('deductionsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!globalStats.deductionsList || globalStats.deductionsList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="py-8 text-center text-slate-400">Удержания за выбранный период отсутствуют</td>
      </tr>
    `;
    return;
  }

  const sortedList = [...globalStats.deductionsList];
  sortedList.sort((a, b) => {
    if (deductionsSortField === 'date') {
      const tA = getDeductionTimestamp(a);
      const tB = getDeductionTimestamp(b);
      return deductionsSortDirection === 'asc' ? tA - tB : tB - tA;
    } else if (deductionsSortField === 'reason') {
      const rA = (a.reason || '').toLowerCase();
      const rB = (b.reason || '').toLowerCase();
      return deductionsSortDirection === 'asc' 
        ? rA.localeCompare(rB) 
        : rB.localeCompare(rA);
    } else if (deductionsSortField === 'amount') {
      return deductionsSortDirection === 'asc' 
        ? a.amount - b.amount 
        : b.amount - a.amount;
    }
    return 0;
  });

  sortedList.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition-colors text-xs";
    
    const lowerReason = (item.reason || '').toLowerCase();
    const isAdvanceReturn = item.amount < 0 || lowerReason.includes('возврат');

    let amountClass = "text-rose-600 font-bold";
    let amountFormatted = formatCurrency(item.amount);

    if (isAdvanceReturn) {
      amountClass = "text-emerald-600 font-bold";
      if (item.amount < 0) {
        amountFormatted = `+${formatCurrency(Math.abs(item.amount))}`;
      } else {
        amountFormatted = `+${formatCurrency(item.amount)}`;
      }
    }

    tr.innerHTML = `
      <td class="py-2.5 px-3 text-slate-500 font-medium whitespace-nowrap">${item.date}</td>
      <td class="py-2.5 px-3 text-slate-800 font-medium">${item.reason}</td>
      <td class="py-2.5 px-3 text-right ${amountClass} whitespace-nowrap">${amountFormatted}</td>
    `;
    tbody.appendChild(tr);
  });
}

function openDeductionsModal() {
  const modal = document.getElementById('modalDeductions');
  if (!modal) return;

  setText('modalDeductionsTotalSum', formatCurrency(globalStats.deductionsSum));

  deductionsSortField = 'date';
  deductionsSortDirection = 'desc';
  sortDeductions('date', true);

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeDeductionsModal() {
  const modal = document.getElementById('modalDeductions');
  if (modal) modal.classList.add('hidden');
}

function openReturnsModal() {
  const modal = document.getElementById('modalReturns');
  if (modal) {
    modal.classList.remove('hidden');
    renderReturnsModalTable();
    if (window.lucide) lucide.createIcons();
  }
}

function closeReturnsModal() {
  const modal = document.getElementById('modalReturns');
  if (modal) modal.classList.add('hidden');
}

function renderReturnsModalTable() {
  const tbody = document.getElementById('returnsModalTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const query = (document.getElementById('returnsSearchInput')?.value || '').toLowerCase().trim();
  const returnsList = globalStats.returnsList || [];

  const filtered = returnsList.filter(item => {
    if (!query) return true;
    return item.sku.toLowerCase().includes(query) ||
      item.supplierSku.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query);
  });

  let sumTotal = 0;
  filtered.forEach(item => {
    sumTotal += item.amount;
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition-colors";
    tr.innerHTML = `
      <td class="py-2.5 px-4 font-mono text-slate-500">${item.date}</td>
      <td class="py-2.5 px-4 font-mono font-semibold text-slate-700">${item.sku}</td>
      <td class="py-2.5 px-4 font-mono text-slate-500">${item.supplierSku}</td>
      <td class="py-2.5 px-4 text-slate-600 font-medium">${item.category}</td>
      <td class="py-2.5 px-4 text-slate-800 font-medium max-w-xs truncate" title="${item.name}">${item.name}</td>
      <td class="py-2.5 px-4 text-right font-bold text-rose-600">${formatCurrency(item.amount)}</td>
    `;
    tbody.appendChild(tr);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400">Возвраты не найдены</td></tr>`;
  }

  setText('returnsModalSubtitle', `Всего возвратов в отчете: ${returnsList.length} шт на сумму ${formatCurrency(globalStats.returnsSum || 0)}`);
  setText('returnsModalTotalSum', formatCurrency(sumTotal));
}

function openSppModal() {
  const modal = document.getElementById('modalSpp');
  if (modal) {
    modal.classList.remove('hidden');
    renderSppModalTable();
    if (window.lucide) lucide.createIcons();
  }
}

function closeSppModal() {
  const modal = document.getElementById('modalSpp');
  if (modal) modal.classList.add('hidden');
}

function renderSppModalTable() {
  const tbody = document.getElementById('sppModalTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const categorySpp = globalStats.categorySpp || {};
  const list = [];
  for (const cat in categorySpp) {
    const item = categorySpp[cat];
    const avg = item.count > 0 ? (item.totalSpp / item.count) : 0;
    list.push({ category: cat, count: item.count, avgSpp: avg });
  }

  list.sort((a, b) => b.avgSpp - a.avgSpp);

  list.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition-colors";
    tr.innerHTML = `
      <td class="py-3 px-4 font-semibold text-slate-800">${item.category}</td>
      <td class="py-3 px-4 text-center font-mono text-slate-500">${item.count} шт</td>
      <td class="py-3 px-4 text-right font-bold text-violet-700">${item.avgSpp.toFixed(2)}%</td>
    `;
    tbody.appendChild(tr);
  });

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="py-8 text-center text-slate-400">Данные по СПП в категориях отсутствуют</td></tr>`;
  }

  setText('sppModalSubtitle', `Средняя СПП по всему отчету: ${globalStats.sppAvg ? globalStats.sppAvg.toFixed(2) : '0.00'}%`);
}
