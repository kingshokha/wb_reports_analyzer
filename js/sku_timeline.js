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
  const chkIds = ['chkSkuT', 'chkSkuP', 'chkSkuW', 'chkSkuAH', 'chkSkuAK', 'chkSkuSold', 'chkSkuReturned'];
  chkIds.forEach(id => {
    const chk = document.getElementById(id);
    if (chk) chk.checked = selectAll;
  });
  updateSkuTimelineChart();
}

function renderSkuModalKpis(prod) {
  const container = document.getElementById('skuModalKpiCards');
  if (!container) return;

  const unitCogs = skuCogsMap[prod.sku] || 0;
  const unitFf = skuFfMap[prod.sku] || 0;
  const totalCogs = prod.soldQty * (unitCogs + unitFf);
  const adSpend = getProductAdSpend ? getProductAdSpend(prod) : (prod.adSpend || 0);

  container.innerHTML = `
    <div class="bg-purple-50/70 p-3 rounded-2xl border border-purple-100 space-y-1">
      <div class="text-[10px] text-purple-700 font-semibold uppercase tracking-wider">Выкуп (T)</div>
      <div class="text-sm font-black text-purple-900">${formatCurrency(prod.turnover)}</div>
    </div>
    <div class="bg-indigo-50/70 p-3 rounded-2xl border border-indigo-100 space-y-1">
      <div class="text-[10px] text-indigo-700 font-semibold uppercase tracking-wider">Продано</div>
      <div class="text-sm font-black text-indigo-900">${prod.soldQty} шт</div>
    </div>
    <div class="bg-rose-50/70 p-3 rounded-2xl border border-rose-100 space-y-1">
      <div class="text-[10px] text-rose-700 font-semibold uppercase tracking-wider">Возвраты</div>
      <div class="text-sm font-black text-rose-900">${prod.returnedQty} шт</div>
    </div>
    <div class="bg-amber-50/70 p-3 rounded-2xl border border-amber-100 space-y-1">
      <div class="text-[10px] text-amber-700 font-semibold uppercase tracking-wider">К перечислению (AH)</div>
      <div class="text-sm font-black text-amber-900">${formatCurrency(prod.payout)}</div>
    </div>
    <div class="bg-rose-50/70 p-3 rounded-2xl border border-rose-100 space-y-1">
      <div class="text-[10px] text-rose-700 font-semibold uppercase tracking-wider">Логистика (AK)</div>
      <div class="text-sm font-black text-rose-900">${formatCurrency(prod.logistics || 0)}</div>
    </div>
    <div class="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-100 space-y-1">
      <div class="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider">Реклама API</div>
      <div class="text-sm font-black text-emerald-900">${formatCurrency(adSpend)}</div>
    </div>
  `;
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
  const dataP = [];          // P: Цена покупателя ₽ (Left Y)
  const dataW = [];          // W: СПП % (Right Y1)
  const dataAH = [];         // AH: К перечислению ₽ (Left Y)
  const dataAK = [];         // AK: Логистика ₽ (Right Y1)
  const dataSold = [];       // Продажи шт (Right Y1)
  const dataReturned = [];   // Возвраты шт (Right Y1)

  sortedDates.forEach(dKey => {
    const day = prod.dailyTimeline[dKey];
    dataT.push(day.turnoverT || 0);

    // Calculate buyer price P
    let buyerPriceP = 0;
    if (day.soldQty > 0) {
      buyerPriceP = day.turnoverT / day.soldQty;
    } else if (day.retailSumO > 0) {
      buyerPriceP = day.retailSumO;
    }
    dataP.push(Math.round(buyerPriceP * 100) / 100);

    // Calculate SPP W
    const sppPercent = day.sppCount > 0 ? (day.sppSum / day.sppCount) : 0;
    dataW.push(Math.round(sppPercent * 10) / 10);

    dataAH.push(day.payableAH || 0);
    dataAK.push(day.logisticsAK || 0);
    dataSold.push(day.soldQty || 0);
    dataReturned.push(day.returnedQty || 0);
  });

  const datasets = [];

  // Checkbox states
  const showT = document.getElementById('chkSkuT')?.checked;
  const showP = document.getElementById('chkSkuP')?.checked;
  const showW = document.getElementById('chkSkuW')?.checked;
  const showAH = document.getElementById('chkSkuAH')?.checked;
  const showAK = document.getElementById('chkSkuAK')?.checked;
  const showSold = document.getElementById('chkSkuSold')?.checked;
  const showReturned = document.getElementById('chkSkuReturned')?.checked;

  if (showT) {
    datasets.push({
      label: 'Цена выкупа T (₽)',
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

  if (showP) {
    datasets.push({
      label: 'Цена пок. P (₽)',
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

  const ctx = canvas.getContext('2d');
  skuTimelineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets
    },
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
