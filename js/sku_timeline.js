/**
 * WB Finance Analytics - Individual SKU Timeline Modal & Multi-Metric Chart
 */

let skuTimelineChart = null;
let currentTimelineSku = null;

function openProductTimelineModal(sku) {
  if (!sku) return;
  currentTimelineSku = String(sku).trim();

  let prod = null;
  if (globalStats && globalStats.products) {
    prod = globalStats.products[currentTimelineSku] || globalStats.products[sku];
  }
  if (!prod && Array.isArray(productsList)) {
    prod = productsList.find(p => String(p.sku).trim() === currentTimelineSku || p.sku === sku);
  }

  if (!prod) {
    console.warn("Product not found for SKU:", sku);
    return;
  }

  // Set modal header info
  const titleEl = document.getElementById('skuModalTitle');
  const badgeEl = document.getElementById('skuModalBadge');
  const subEl = document.getElementById('skuModalSubtitle');

  if (titleEl) titleEl.innerText = prod.name || 'Без названия';
  if (badgeEl) badgeEl.innerText = `SKU WB: ${prod.sku}`;
  if (subEl) {
    const suppText = prod.supplierSku && prod.supplierSku !== '—' ? ` | Арт. продавца: ${prod.supplierSku}` : '';
    const catText = prod.category && prod.category !== '—' ? ` | Категория: ${prod.category}` : '';
    subEl.innerText = `Детализация по дням${suppText}${catText}`;
  }

  // Populate KPI summary cards
  renderSkuModalKpis(prod);

  // Show modal & lock scroll
  const modal = document.getElementById('modalProductTimeline');
  if (modal) {
    modal.classList.remove('hidden');
    lockBodyScroll();
  }

  // Draw chart
  updateSkuTimelineChart();

  if (window.lucide) lucide.createIcons();
}

function closeProductTimelineModal() {
  const modal = document.getElementById('modalProductTimeline');
  if (modal) {
    modal.classList.add('hidden');
    unlockBodyScroll();
  }
  currentTimelineSku = null;
}

function toggleAllSkuTimelineMetrics(selectAll) {
  const chkIds = ['chkSkuT', 'chkSkuAvgT', 'chkSkuP', 'chkSkuW', 'chkSkuAH', 'chkSkuAK', 'chkSkuSold', 'chkSkuReturned', 'chkSkuProfit'];
  chkIds.forEach(id => {
    const chk = document.getElementById(id);
    if (chk) chk.checked = selectAll;
  });
  updateSkuTimelineChart();
}

function renderSkuModalKpis(prod) {
  const container = document.getElementById('skuModalKpiCards');
  const avgContainer = document.getElementById('skuModalAvgCards');
  if (!container && !avgContainer) return;

  const unitCogs = skuCogsMap[prod.sku] || 0;
  const unitFf = skuFfMap[prod.sku] || 0;
  const totalCogs = prod.soldQty * (unitCogs + unitFf);
  const adSpend = getProductAdSpend ? getProductAdSpend(prod) : (prod.adSpend || 0);

  // Period totals
  if (container) {
    container.innerHTML = `
      <div class="bg-purple-50/70 p-2.5 rounded-2xl border border-purple-100 space-y-0.5">
        <div class="text-[10px] text-purple-700 font-semibold uppercase tracking-wider">Выкупы (T)</div>
        <div class="text-xs sm:text-sm font-black text-purple-900">${formatCurrency(prod.turnover)}</div>
      </div>
      <div class="bg-indigo-50/70 p-2.5 rounded-2xl border border-indigo-100 space-y-0.5">
        <div class="text-[10px] text-indigo-700 font-semibold uppercase tracking-wider">Продано</div>
        <div class="text-xs sm:text-sm font-black text-indigo-900">${prod.soldQty} шт</div>
      </div>
      <div class="bg-rose-50/70 p-2.5 rounded-2xl border border-rose-100 space-y-0.5">
        <div class="text-[10px] text-rose-700 font-semibold uppercase tracking-wider">Возвраты</div>
        <div class="text-xs sm:text-sm font-black text-rose-900">${prod.returnedQty} шт</div>
      </div>
      <div class="bg-amber-50/70 p-2.5 rounded-2xl border border-amber-100 space-y-0.5">
        <div class="text-[10px] text-amber-700 font-semibold uppercase tracking-wider">К перечислению (AH)</div>
        <div class="text-xs sm:text-sm font-black text-amber-900">${formatCurrency(prod.payout)}</div>
      </div>
      <div class="bg-rose-50/70 p-2.5 rounded-2xl border border-rose-100 space-y-0.5">
        <div class="text-[10px] text-rose-700 font-semibold uppercase tracking-wider">Логистика (AK)</div>
        <div class="text-xs sm:text-sm font-black text-rose-900">${formatCurrency(prod.logistics || 0)}</div>
      </div>
      <div class="bg-emerald-50/70 p-2.5 rounded-2xl border border-emerald-100 space-y-0.5">
        <div class="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider">Реклама API</div>
        <div class="text-xs sm:text-sm font-black text-emerald-900">${formatCurrency(adSpend)}</div>
      </div>
    `;
  }

  // Calculate Averages for the period
  let daysCount = 0;
  let sppSumTotal = 0;
  let sppCountTotal = 0;

  if (prod.dailyTimeline) {
    const dates = Object.keys(prod.dailyTimeline);
    daysCount = dates.length;
    dates.forEach(dKey => {
      const day = prod.dailyTimeline[dKey];
      if (day.sppCount > 0) {
        sppSumTotal += day.sppSum;
        sppCountTotal += day.sppCount;
      }
    });
  }

  let totalPSum = 0;
  let totalPCount = 0;
  if (prod.dailyTimeline) {
    Object.values(prod.dailyTimeline).forEach(d => {
      if (d.pricePCount > 0) {
        totalPSum += d.pricePSum;
        totalPCount += d.pricePCount;
      }
    });
  }
  const avgBuyerPriceP = totalPCount > 0 ? (totalPSum / totalPCount) : (prod.soldQty > 0 ? (prod.turnover / prod.soldQty) : 0);
  const avgSppPercent = sppCountTotal > 0 ? (sppSumTotal / sppCountTotal) : 0;
  const avgPayableAHPerUnit = prod.soldQty > 0 ? (prod.payout / prod.soldQty) : 0;
  const avgLogisticsPerUnit = prod.soldQty > 0 ? ((prod.logistics || 0) / prod.soldQty) : 0;
  const avgSalesPerDay = daysCount > 0 ? (prod.soldQty / daysCount) : 0;
  const avgReturnsPerDay = daysCount > 0 ? (prod.returnedQty / daysCount) : 0;
  const avgTurnoverPerUnit = prod.soldQty > 0 ? (prod.turnover / prod.soldQty) : 0;

  const totalTax = typeof calculateTax === 'function' ? calculateTax(prod.salesRetailSum || 0, prod.returnsRetailSum || 0) : 0;
  const totalNetProfit = (prod.payout || 0) - (prod.logistics || 0) - totalCogs - totalTax - adSpend;
  const avgProfitPerUnit = prod.soldQty > 0 ? (totalNetProfit / prod.soldQty) : 0;
  const avgProfitPerDay = daysCount > 0 ? (totalNetProfit / daysCount) : 0;
  const profitColorClass = totalNetProfit >= 0 ? 'text-emerald-700' : 'text-rose-600';

  if (avgContainer) {
    avgContainer.innerHTML = `
      <div class="bg-white p-2.5 rounded-2xl border border-purple-200/80 space-y-0.5 shadow-2xs">
        <div class="text-[10px] text-purple-700 font-bold uppercase tracking-wider">Ср. цена выкупа (T)</div>
        <div class="text-xs font-extrabold text-purple-900">${formatCurrency(avgTurnoverPerUnit)} / шт</div>
      </div>

      <div class="bg-white p-2.5 rounded-2xl border border-blue-200/80 space-y-0.5 shadow-2xs">
        <div class="text-[10px] text-blue-700 font-bold uppercase tracking-wider">Ср. цена (P)</div>
        <div class="text-xs font-extrabold text-blue-900">${formatCurrency(prod.soldQty > 0 ? (totalPSum / prod.soldQty) : (totalPCount > 0 ? totalPSum / totalPCount : 0))} / шт</div>
      </div>

      <div class="bg-white p-2.5 rounded-2xl border border-emerald-200/80 space-y-0.5 shadow-2xs">
        <div class="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Ср. прибыль / шт</div>
        <div class="text-xs font-extrabold ${profitColorClass}">${formatCurrency(avgProfitPerUnit)} / шт</div>
      </div>

      <div class="bg-white p-2.5 rounded-2xl border border-emerald-200/80 space-y-0.5 shadow-2xs">
        <div class="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Ср. прибыль / день</div>
        <div class="text-xs font-extrabold ${profitColorClass}">${formatCurrency(avgProfitPerDay)}</div>
      </div>

      <div class="bg-white p-2.5 rounded-2xl border border-emerald-200/80 space-y-0.5 shadow-2xs">
        <div class="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Ср. СПП % (W)</div>
        <div class="text-xs font-extrabold text-emerald-900">${avgSppPercent.toFixed(1)}%</div>
      </div>

      <div class="bg-white p-2.5 rounded-2xl border border-amber-200/80 space-y-0.5 shadow-2xs">
        <div class="text-[10px] text-amber-700 font-bold uppercase tracking-wider">Ср. Выплата (AH)</div>
        <div class="text-xs font-extrabold text-amber-900">${formatCurrency(avgPayableAHPerUnit)} / шт</div>
      </div>

      <div class="bg-white p-2.5 rounded-2xl border border-rose-200/80 space-y-0.5 shadow-2xs">
        <div class="text-[10px] text-rose-700 font-bold uppercase tracking-wider">Ср. Логистика (AK)</div>
        <div class="text-xs font-extrabold text-rose-900">${formatCurrency(avgLogisticsPerUnit)} / ед</div>
      </div>

      <div class="bg-white p-2.5 rounded-2xl border border-indigo-200/80 space-y-0.5 shadow-2xs">
        <div class="text-[10px] text-indigo-700 font-bold uppercase tracking-wider">Продаж в день</div>
        <div class="text-xs font-extrabold text-indigo-900">${avgSalesPerDay.toFixed(1)} шт/день</div>
      </div>

      <div class="bg-white p-2.5 rounded-2xl border border-rose-200/80 space-y-0.5 shadow-2xs">
        <div class="text-[10px] text-rose-600 font-bold uppercase tracking-wider">Возвратов в день</div>
        <div class="text-xs font-extrabold text-rose-800">${avgReturnsPerDay.toFixed(1)} шт/день</div>
      </div>
    `;
  }
}


function updateSkuTimelineChart() {
  if (!currentTimelineSku) return;

  let prod = null;
  if (globalStats && globalStats.products) {
    prod = globalStats.products[currentTimelineSku];
  }

  const canvas = document.getElementById('chartSkuTimeline');
  if (!canvas) return;

  if (skuTimelineChart) {
    skuTimelineChart.destroy();
    skuTimelineChart = null;
  }

  if (!prod || !prod.dailyTimeline) {
    return;
  }

  const sortedDates = Object.keys(prod.dailyTimeline).sort();
  if (sortedDates.length === 0) return;

  const labels = sortedDates.map(dKey => prod.dailyTimeline[dKey].dateFormatted);

  // Extract metric arrays
  const dataT = [];          // T: Выкуп ₽ (Left Y)
  const dataAvgT = [];       // Ср. цена выкупа T ₽ (Left Y)
  const dataP = [];          // P: Цена покупателя ₽ (Left Y)
  const dataW = [];          // W: СПП % (Right Y1)
  const dataAH = [];         // AH: К перечислению ₽ (Left Y)
  const dataAK = [];         // AK: Логистика ₽ (Right Y1)
  const dataSold = [];       // Продажи шт (Right Y1)
  const dataReturned = [];   // Возвраты шт (Right Y1)
  const dataProfit = [];     // Чистая прибыль ₽ (Left Y)

  sortedDates.forEach(dKey => {
    const day = prod.dailyTimeline[dKey];
    dataT.push(day.turnoverT || 0);

    const dayAvgT = day.soldQty > 0 ? (day.turnoverT / day.soldQty) : 0;
    dataAvgT.push(Math.round(dayAvgT * 100) / 100);

    // Total sum of Column P for that day
    const totalPForDay = day.pricePSum !== undefined ? day.pricePSum : 0;
    dataP.push(Math.round(totalPForDay * 100) / 100);

    // Calculate SPP W
    const sppPercent = day.sppCount > 0 ? (day.sppSum / day.sppCount) : 0;
    dataW.push(Math.round(sppPercent * 10) / 10);

    dataAH.push(day.payableAH || 0);
    dataAK.push(day.logisticsAK || 0);
    dataSold.push(day.soldQty || 0);
    dataReturned.push(day.returnedQty || 0);

    const unitCogsVal = typeof getProductUnitCogs === 'function' ? getProductUnitCogs(prod.sku, prod.supplierSku) : (skuCogsMap[prod.sku] || 0);
    const unitFfVal = typeof getProductUnitFf === 'function' ? getProductUnitFf(prod.sku, prod.supplierSku) : (skuFfMap[prod.sku] || 0);
    const dayCogs = (day.soldQty || 0) * (unitCogsVal + unitFfVal);
    const dayTax = typeof calculateTax === 'function' ? calculateTax(day.retailSumO || 0, 0) : ((day.retailSumO || 0) * (typeof getTaxRate === 'function' ? getTaxRate() : 0.07));
    const dayNetProfit = (day.payableAH || 0) - (day.logisticsAK || 0) - dayCogs - dayTax;
    dataProfit.push(Math.round(dayNetProfit * 100) / 100);
  });

  const datasets = [];

  // Checkbox states
  const showT = document.getElementById('chkSkuT')?.checked;
  const showAvgT = document.getElementById('chkSkuAvgT')?.checked;
  const showP = document.getElementById('chkSkuP')?.checked;
  const showW = document.getElementById('chkSkuW')?.checked;
  const showAH = document.getElementById('chkSkuAH')?.checked;
  const showAK = document.getElementById('chkSkuAK')?.checked;
  const showSold = document.getElementById('chkSkuSold')?.checked;
  const showReturned = document.getElementById('chkSkuReturned')?.checked;
  const showProfit = document.getElementById('chkSkuProfit')?.checked;

  if (showT) {
    datasets.push({
      label: 'Выкупы T (₽)',
      data: dataT,
      borderColor: '#9333ea', // purple-600
      backgroundColor: '#9333ea',
      yAxisID: 'y',
      tension: 0.25,
      borderWidth: 2.5,
      borderDash: [],
      pointStyle: 'circle',
      pointRadius: 4,
      pointHoverRadius: 6
    });
  }

  if (showAvgT) {
    datasets.push({
      label: 'Ср. цена выкупа T (₽)',
      data: dataAvgT,
      borderColor: '#7c3aed', // violet-600
      backgroundColor: '#7c3aed',
      yAxisID: 'y',
      tension: 0.25,
      borderWidth: 2.5,
      borderDash: [],
      pointStyle: 'circle',
      pointRadius: 4,
      pointHoverRadius: 6
    });
  }

  if (showP) {
    datasets.push({
      label: 'Цена для клиента P (₽)',
      data: dataP,
      borderColor: '#2563eb', // blue-600
      backgroundColor: '#2563eb',
      yAxisID: 'y',
      tension: 0.25,
      borderWidth: 2.5,
      borderDash: [],
      pointStyle: 'circle',
      pointRadius: 4,
      pointHoverRadius: 6
    });
  }

  if (showAH) {
    datasets.push({
      label: 'К перечислению AH (₽)',
      data: dataAH,
      borderColor: '#d97706', // amber-600
      backgroundColor: '#d97706',
      yAxisID: 'y',
      tension: 0.25,
      borderWidth: 2.5,
      borderDash: [],
      pointStyle: 'circle',
      pointRadius: 4,
      pointHoverRadius: 6
    });
  }

  if (showW) {
    datasets.push({
      label: 'СПП W (%)',
      data: dataW,
      borderColor: '#059669', // emerald-600
      backgroundColor: '#059669',
      yAxisID: 'y1',
      tension: 0.25,
      borderWidth: 2,
      borderDash: [],
      pointStyle: 'circle',
      pointRadius: 4,
      pointHoverRadius: 6
    });
  }

  if (showAK) {
    datasets.push({
      label: 'Логистика AK (₽)',
      data: dataAK,
      borderColor: '#dc2626', // rose-600
      backgroundColor: '#dc2626',
      yAxisID: 'y1',
      tension: 0.25,
      borderWidth: 2,
      borderDash: [],
      pointStyle: 'circle',
      pointRadius: 4,
      pointHoverRadius: 6
    });
  }

  if (showSold) {
    datasets.push({
      label: 'Продано (шт)',
      data: dataSold,
      borderColor: '#4f46e5', // indigo-600
      backgroundColor: '#4f46e5',
      yAxisID: 'y1',
      tension: 0.25,
      borderWidth: 2,
      borderDash: [],
      pointStyle: 'circle',
      pointRadius: 4,
      pointHoverRadius: 6
    });
  }

  if (showReturned) {
    datasets.push({
      label: 'Возвраты (шт)',
      data: dataReturned,
      borderColor: '#f43f5e', // rose-500
      backgroundColor: '#f43f5e',
      yAxisID: 'y1',
      tension: 0.25,
      borderWidth: 2,
      borderDash: [],
      pointStyle: 'circle',
      pointRadius: 4,
      pointHoverRadius: 6
    });
  }

  if (showProfit) {
    datasets.push({
      label: 'Чистая прибыль (₽)',
      data: dataProfit,
      borderColor: '#059669', // emerald-600
      backgroundColor: '#059669',
      yAxisID: 'y',
      tension: 0.25,
      borderWidth: 2.5,
      borderDash: [],
      pointStyle: 'circle',
      pointRadius: 4,
      pointHoverRadius: 6
    });
  }

  const ctx = canvas.getContext('2d');
  const verticalHoverLinePlugin = {
    id: 'verticalHoverLine',
    afterDraw: (chart) => {
      if (chart.tooltip?._active && chart.tooltip._active.length) {
        const activePoint = chart.tooltip._active[0];
        const ctx = chart.ctx;
        const x = activePoint.element.x;
        const topY = chart.scales.y.top;
        const bottomY = chart.scales.y.bottom;

        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(x, topY);
        ctx.lineTo(x, bottomY);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(147, 51, 234, 0.65)'; // purple dashed line
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  skuTimelineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets
    },
    plugins: [verticalHoverLinePlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false, // Instantaneous display
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            font: { size: 11, weight: 'bold' }
          }
        },
        tooltip: {
          padding: 10,
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleFont: { size: 12, weight: 'bold' },
          bodyFont: { size: 11 },
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.parsed.y !== null) {
                if (label.includes('(шт)')) {
                  label += context.parsed.y + ' шт';
                } else if (label.includes('(%)')) {
                  label += context.parsed.y + '%';
                } else {
                  label += formatCurrency(context.parsed.y);
                }
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 } }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Суммы (Выкуп, Цена, Выплата) ₽',
            color: '#64748b',
            font: { size: 10, weight: 'bold' }
          },
          grid: { color: 'rgba(226, 232, 240, 0.6)' },
          ticks: {
            font: { size: 10 },
            callback: function(value) {
              return formatCurrency(value);
            }
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Мелкие суммы / Штуки / %',
            color: '#64748b',
            font: { size: 10, weight: 'bold' }
          },
          grid: { drawOnChartArea: false },
          ticks: { font: { size: 10 } }
        }
      }
    }
  });
}
