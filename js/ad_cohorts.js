/**
 * WB Finance Analytics - Ad spend allocation by order date (cohorts)
 *
 * Отчет WB считает выкупы по дате продажи, а реклама тратится в день заказа.
 * Поэтому каждая выкупленная штука получает рекламу недели, когда ее заказали:
 *
 *   реклама на 1 выкуп (артикул, неделя заказа) = реклама артикула за неделю
 *                                                 / ожидаемые выкупы из заказов этой недели
 *
 * Выкупы одной недели заказов приходят в отчеты еще 2-4 недели, а в загруженном
 * файле видна только их часть. Долю, которая попадает в окно дат файла (полноту),
 * оцениваем по распределению задержек "заказ -> выкуп" из самого файла:
 *   ожидаемые выкупы = увиденные выкупы / полнота
 */

// Ниже этой полноты неделя считается по средней стоимости выкупа артикула
const AD_COHORT_MIN_COMPLETENESS = 0.35;
const DAY_MS = 24 * 60 * 60 * 1000;

// Результат последнего расчета для окна настроек и пересчета после загрузки рекламы
let adCohortState = null;

function dateKeyToUtc(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToDateKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDaysToKey(key, days) {
  return utcToDateKey(dateKeyToUtc(key) + days * DAY_MS);
}

function diffDaysKeys(fromKey, toKey) {
  return Math.round((dateKeyToUtc(toKey) - dateKeyToUtc(fromKey)) / DAY_MS);
}

// Неделя начинается с понедельника
function getWeekStartKey(dayKey) {
  const ms = dateKeyToUtc(dayKey);
  const weekday = (new Date(ms).getUTCDay() + 6) % 7;
  return utcToDateKey(ms - weekday * DAY_MS);
}

function formatWeekLabel(weekKey) {
  const fmt = (key) => key.slice(8, 10) + '.' + key.slice(5, 7);
  return `${fmt(weekKey)}–${fmt(addDaysToKey(weekKey, 6))}`;
}

// Та же классификация продажи, что и в parser.js
function getSaleRowInfo(row) {
  const sku = String(row[COL_MAP.D] !== undefined && row[COL_MAP.D] !== null ? row[COL_MAP.D] : '').trim();
  if (!sku) return null;
  const lowerSku = sku.toLowerCase();
  if (lowerSku === 'итого' || lowerSku === 'всего' || lowerSku === 'согласовано') return null;

  const reason = String(row[COL_MAP.K] !== undefined && row[COL_MAP.K] !== null ? row[COL_MAP.K] : '').trim().toLowerCase();
  if (reason.includes('добровольная компенсация при возврате')) return null;
  if (!reason.includes('продажа') && !reason.includes('реализация')) return null;
  if (parseNum(row[COL_MAP.T]) === 0 && parseNum(row[COL_MAP.AH]) === 0) return null;

  const saleDate = parseDate(row[COL_MAP.M]);
  const orderDate = parseDate(row[COL_MAP.L]);
  return {
    sku: sku,
    saleKey: saleDate ? toLocalInputDate(saleDate) : '',
    orderKey: orderDate ? toLocalInputDate(orderDate) : ''
  };
}

// Неделя заказа для строки продажи (пусто, если в отчете нет даты заказа)
function getOrderWeekKeyForRow(row) {
  const orderDate = parseDate(row[COL_MAP.L]);
  return orderDate ? getWeekStartKey(toLocalInputDate(orderDate)) : '';
}

/**
 * Скан всех строк файла без фильтра периода: выкупы по неделям заказа
 * и распределение задержек "заказ -> выкуп".
 */
function buildOrderCohorts(rows) {
  const cohorts = {};
  const lagCounts = [];
  let lagTotal = 0;
  let minSaleKey = '';
  let maxSaleKey = '';
  let minOrderKey = '';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row) || row.length < 3) continue;
    const info = getSaleRowInfo(row);
    if (!info || !info.saleKey || !info.orderKey) continue;

    if (!minSaleKey || info.saleKey < minSaleKey) minSaleKey = info.saleKey;
    if (!maxSaleKey || info.saleKey > maxSaleKey) maxSaleKey = info.saleKey;
    if (!minOrderKey || info.orderKey < minOrderKey) minOrderKey = info.orderKey;

    const lag = Math.max(0, diffDaysKeys(info.orderKey, info.saleKey));
    lagCounts[lag] = (lagCounts[lag] || 0) + 1;
    lagTotal++;

    const weekKey = getWeekStartKey(info.orderKey);
    if (!cohorts[info.sku]) cohorts[info.sku] = {};
    cohorts[info.sku][weekKey] = (cohorts[info.sku][weekKey] || 0) + 1;
  }

  // lagCdf[k] - доля выкупов, пришедших не позже чем через k дней после заказа
  const lagCdf = [];
  let acc = 0;
  for (let k = 0; k < lagCounts.length; k++) {
    acc += lagCounts[k] || 0;
    lagCdf[k] = lagTotal > 0 ? acc / lagTotal : 1;
  }

  return { cohorts, lagCdf, lagTotal, minSaleKey, maxSaleKey, minOrderKey };
}

function lagCdfAt(lagCdf, k) {
  if (k < 0) return 0;
  if (k >= lagCdf.length) return 1;
  return lagCdf[k];
}

// Доля выкупов заказов дня orderKey, попадающая в окно дат продаж файла
function getOrderDayCompleteness(base, orderKey) {
  const upper = lagCdfAt(base.lagCdf, diffDaysKeys(orderKey, base.maxSaleKey));
  const lower = lagCdfAt(base.lagCdf, diffDaysKeys(orderKey, base.minSaleKey) - 1);
  return Math.max(0, upper - lower);
}

// Дни недели, по которым считаем рекламу: заказы после последней продажи в файл не попали
function getWeekDayKeys(base, weekKey) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const key = addDaysToKey(weekKey, i);
    if (key > base.maxSaleKey) break;
    days.push(key);
  }
  return days;
}

/**
 * Полный расчет: когорты из всех строк + реклама из API.
 * Возвращает стоимость рекламы на 1 выкуп по артикулу и неделе заказа.
 */
function computeAdCohorts(rows) {
  const base = buildOrderCohorts(rows || []);
  const state = {
    base: base,
    hasAdData: false,
    cpu: {},        // sku -> weekKey -> { cpu, ad, observed, expected, completeness, coverage, pooled }
    weeks: [],      // сводка по неделям для окна настроек
    totalAd: 0
  };

  if (!base.maxSaleKey || base.lagTotal === 0 || typeof getAdSpendForDay !== 'function') {
    adCohortState = state;
    return state;
  }

  const firstWeek = getWeekStartKey(base.minOrderKey);
  const lastWeek = getWeekStartKey(base.maxSaleKey);
  const weekKeys = [];
  for (let w = firstWeek; w <= lastWeek; w = addDaysToKey(w, 7)) weekKeys.push(w);

  // Полнота и покрытие рекламными данными по неделям (общие для всех артикулов)
  const weekMeta = {};
  weekKeys.forEach(weekKey => {
    const days = getWeekDayKeys(base, weekKey);
    const completeness = days.length > 0
      ? days.reduce((s, d) => s + getOrderDayCompleteness(base, d), 0) / days.length
      : 0;
    const coveredDays = days.filter(d => isAdDayLoaded(d)).length;
    weekMeta[weekKey] = {
      days: days,
      completeness: completeness,
      coverage: days.length > 0 ? coveredDays / days.length : 0
    };
  });

  // Реклама по артикулам и неделям: и по артикулам из отчета, и по тем, что есть только в рекламе
  const adBySkuWeek = {};
  weekKeys.forEach(weekKey => {
    weekMeta[weekKey].days.forEach(dayKey => {
      const daySpend = getAdSpendForDay(dayKey);
      for (const sku in daySpend) {
        if (!adBySkuWeek[sku]) adBySkuWeek[sku] = {};
        adBySkuWeek[sku][weekKey] = (adBySkuWeek[sku][weekKey] || 0) + daySpend[sku];
      }
    });
  });

  const skus = new Set([...Object.keys(base.cohorts), ...Object.keys(adBySkuWeek)]);
  const weekTotals = {};
  weekKeys.forEach(w => { weekTotals[w] = { ad: 0, observed: 0, expected: 0, appliedSum: 0, appliedQty: 0 }; });

  skus.forEach(sku => {
    const skuCohorts = base.cohorts[sku] || {};
    const skuAd = adBySkuWeek[sku] || {};
    const rowsBySku = {};
    let reliableAd = 0, reliableExpected = 0, allAd = 0, allExpected = 0;

    weekKeys.forEach(weekKey => {
      const meta = weekMeta[weekKey];
      const ad = skuAd[weekKey] || 0;
      const observed = skuCohorts[weekKey] || 0;
      const expected = meta.completeness > 0 ? observed / meta.completeness : 0;
      rowsBySku[weekKey] = { ad, observed, expected, completeness: meta.completeness, coverage: meta.coverage, cpu: null, pooled: false };

      // Сводка по неделе - только по артикулам, которые в эту неделю рекламировались
      weekTotals[weekKey].ad += ad;
      if (ad > 0) {
        weekTotals[weekKey].observed += observed;
        weekTotals[weekKey].expected += expected;
      }
      state.totalAd += ad;

      // Среднее считаем только по неделям, когда артикул рекламировался
      if (meta.coverage > 0 && ad > 0 && expected > 0) {
        allAd += ad;
        allExpected += expected;
        if (meta.completeness >= AD_COHORT_MIN_COMPLETENESS) {
          reliableAd += ad;
          reliableExpected += expected;
        }
      }
    });

    // Средняя стоимость выкупа артикула - для недель, где видна слишком малая доля выкупов
    const pooledCpu = reliableExpected > 0
      ? reliableAd / reliableExpected
      : (allExpected > 0 ? allAd / allExpected : null);

    weekKeys.forEach(weekKey => {
      const r = rowsBySku[weekKey];
      if (r.coverage === 0) return; // реклама за неделю не загружена
      if (r.ad === 0) {
        r.cpu = 0; // рекламы не было - штукам этой недели заказа реклама не достается
      } else if (r.completeness >= AD_COHORT_MIN_COMPLETENESS && r.expected > 0) {
        r.cpu = r.ad / r.expected;
      } else if (r.observed > 0 && pooledCpu !== null) {
        r.cpu = pooledCpu;
        r.pooled = true;
      }

      // Для сводки - стоимость, реально примененная к штукам рекламируемых артикулов
      if (r.ad > 0 && r.cpu !== null && r.observed > 0) {
        weekTotals[weekKey].appliedSum += r.observed * r.cpu;
        weekTotals[weekKey].appliedQty += r.observed;
      }
    });

    state.cpu[sku] = rowsBySku;
  });

  state.hasAdData = weekKeys.some(w => weekMeta[w].coverage > 0);
  state.weeks = weekKeys.map(weekKey => {
    const t = weekTotals[weekKey];
    const meta = weekMeta[weekKey];
    return {
      weekKey: weekKey,
      label: formatWeekLabel(weekKey),
      ad: t.ad,
      observed: t.observed,
      expected: t.expected,
      completeness: meta.completeness,
      coverage: meta.coverage,
      cpu: t.appliedQty > 0 ? t.appliedSum / t.appliedQty : null
    };
  });

  adCohortState = state;
  return state;
}

function getAdCostPerUnit(sku, weekKey) {
  if (!adCohortState || !weekKey) return null;
  const skuRows = adCohortState.cpu[String(sku).trim()];
  if (!skuRows || !skuRows[weekKey]) return null;
  return skuRows[weekKey].cpu;
}

/**
 * Раскладывает рекламу на выкупы выбранного периода: каждой штуке - стоимость
 * рекламы недели ее заказа. Пишет p.adSpend, дневные суммы для графиков и итоги.
 */
function allocateAdSpendToProducts() {
  let allocated = 0;
  let unitsWithAd = 0;
  let unitsWithoutData = 0;

  const products = (globalStats && globalStats.products) || {};
  for (const sku in products) {
    const p = products[sku];
    let prodAd = 0;
    const weeks = p.orderWeekQty || {};
    for (const weekKey in weeks) {
      const qty = weeks[weekKey];
      const cpu = getAdCostPerUnit(sku, weekKey);
      if (cpu === null) {
        if (adCohortState && adCohortState.hasAdData) unitsWithoutData += qty;
        continue;
      }
      prodAd += qty * cpu;
      unitsWithAd += qty;
    }
    p.adSpend = prodAd;
    allocated += prodAd;

    if (p.dailyTimeline) {
      for (const dayKey in p.dailyTimeline) {
        const pDay = p.dailyTimeline[dayKey];
        let dayAd = 0;
        const dayWeeks = pDay.orderWeekQty || {};
        for (const weekKey in dayWeeks) {
          const cpu = getAdCostPerUnit(sku, weekKey);
          if (cpu !== null) dayAd += dayWeeks[weekKey] * cpu;
        }
        pDay.adSpend = dayAd;
      }
    }
  }

  if (globalStats && globalStats.dailyTimeline) {
    for (const dayKey in globalStats.dailyTimeline) {
      let dayAd = 0;
      for (const sku in products) {
        const pDay = products[sku].dailyTimeline && products[sku].dailyTimeline[dayKey];
        if (pDay) dayAd += pDay.adSpend || 0;
      }
      globalStats.dailyTimeline[dayKey].adSpend = dayAd;
    }
  }

  if (globalStats) {
    globalStats.apiAdSpendSum = allocated;
    globalStats.apiAdUnitsWithAd = unitsWithAd;
    globalStats.apiAdUnitsWithoutData = unitsWithoutData;
  }
  return allocated;
}

// Пересчет после загрузки рекламы или смены кабинетов - без повторного разбора файла
function refreshAdAllocation() {
  if (!lastLoadedRows) return;
  computeAdCohorts(lastLoadedRows);
  allocateAdSpendToProducts();

  if (typeof updateFinancials === 'function') updateFinancials();
  if (typeof sortProducts === 'function') sortProducts(currentSortField, true);
  if (typeof currentTimelineSku !== 'undefined' && currentTimelineSku && typeof updateSkuTimelineChart === 'function') {
    const modal = document.getElementById('modalProductTimeline');
    if (modal && !modal.classList.contains('hidden')) updateSkuTimelineChart();
  }
  if (typeof renderAdSettingsCohorts === 'function') renderAdSettingsCohorts();
}
