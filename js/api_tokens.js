/**
 * WB Finance Analytics - Wildberries API Tokens & Promotion Ad Spend Sync
 */

let lastRawApiData = null;

function getActiveApiTokenObj() {
  if (!activeApiTokenId && apiTokensList.length > 0) {
    activeApiTokenId = apiTokensList[0].id;
  }
  return apiTokensList.find(t => t.id === activeApiTokenId) || null;
}

function handleAddApiToken(e) {
  if (e) {
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
  }

  const nameInput = document.getElementById('inputTokenName');
  const tokenInput = document.getElementById('inputTokenValue');

  if (!tokenInput || !tokenInput.value.trim()) {
    showApiTokensStatus("Пожалуйста, введите токен API Wildberries", "error");
    return false;
  }

  const nameVal = (nameInput?.value || '').trim() || `Токен #${apiTokensList.length + 1}`;
  const tokenVal = tokenInput.value.trim();

  const newToken = {
    id: 'tok_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    name: nameVal,
    token: tokenVal,
    createdAt: new Date().toLocaleDateString('ru-RU')
  };

  apiTokensList.unshift(newToken);
  activeApiTokenId = newToken.id;
  saveApiTokensToStorage();

  if (nameInput) nameInput.value = '';
  if (tokenInput) tokenInput.value = '';

  showApiTokensStatus(`Токен «${nameVal}» успешно сохранен и выбран активным!`, "success");
  renderApiTokensTab();
  return false;
}

function setActiveApiToken(id) {
  activeApiTokenId = id;
  saveApiTokensToStorage();
  renderApiTokensTab();
}

function deleteApiToken(id) {
  const tok = apiTokensList.find(t => t.id === id);
  const name = tok ? tok.name : 'токен';

  if (!confirm(`Вы уверены, что хотите удалить ${name}?`)) {
    return;
  }

  apiTokensList = apiTokensList.filter(t => t.id !== id);
  if (activeApiTokenId === id) {
    activeApiTokenId = apiTokensList.length > 0 ? apiTokensList[0].id : null;
  }
  saveApiTokensToStorage();
  renderApiTokensTab();
  showApiTokensStatus(`Токен «${name}» удален`, "info");
}

function clearAllApiTokens() {
  if (apiTokensList.length === 0) return;
  if (!confirm("Вы действительно хотите удалить все сохраненные токены API?")) return;

  apiTokensList = [];
  activeApiTokenId = null;
  saveApiTokensToStorage();
  renderApiTokensTab();
  showApiTokensStatus("Все токены удалены", "info");
}

function renderApiTokensTab() {
  const listContainer = document.getElementById('apiTokensListContainer');
  const emptyState = document.getElementById('apiTokensEmptyState');
  const countBadge = document.getElementById('apiTokensCountBadge');
  const activeTokenInfo = document.getElementById('apiActiveTokenDisplay');

  if (countBadge) countBadge.innerText = apiTokensList.length;

  const activeToken = getActiveApiTokenObj();
  if (activeTokenInfo) {
    if (activeToken) {
      const masked = maskToken(activeToken.token);
      activeTokenInfo.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="font-bold text-slate-800">${activeToken.name}</span>
          <span class="font-mono text-slate-400 text-xs">(${masked})</span>
        </div>
      `;
    } else {
      activeTokenInfo.innerHTML = `<span class="text-slate-400 font-medium">Токен не выбран</span>`;
    }
  }

  if (!listContainer) return;

  if (apiTokensList.length === 0) {
    listContainer.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  listContainer.innerHTML = apiTokensList.map(tok => {
    const isActive = tok.id === activeApiTokenId;
    const masked = maskToken(tok.token);

    const activeBadge = isActive
      ? `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 border border-emerald-200">
           <i data-lucide="check" class="w-3 h-3"></i> Активен
         </span>`
      : `<button type="button" onclick="setActiveApiToken('${tok.id}')" class="px-2.5 py-1 text-xs rounded-lg font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors cursor-pointer">
           Выбрать
         </button>`;

    const cardBorder = isActive ? 'border-purple-300 bg-purple-50/30' : 'border-slate-200/80 bg-white hover:border-slate-300';

    return `
      <div class="p-4 rounded-2xl border ${cardBorder} transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <h4 class="font-bold text-sm text-slate-800">${tok.name}</h4>
            ${activeBadge}
          </div>
          <p class="text-xs font-mono text-slate-500 flex items-center gap-2">
            <span>Ключ: ${masked}</span>
            <span class="text-slate-300">•</span>
            <span class="text-slate-400">Добавлен: ${tok.createdAt}</span>
          </p>
        </div>

        <div class="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button type="button" onclick="copyTokenToClipboard('${tok.id}')" class="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer" title="Скопировать токен">
            <i data-lucide="copy" class="w-4 h-4"></i>
          </button>
          <button type="button" onclick="deleteApiToken('${tok.id}')" class="p-2 text-rose-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer" title="Удалить токен">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function maskToken(token) {
  if (!token) return '';
  if (token.length <= 12) return '••••••••';
  return token.substring(0, 6) + '••••••••' + token.substring(token.length - 4);
}

function copyTokenToClipboard(id) {
  const tok = apiTokensList.find(t => t.id === id);
  if (!tok) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(tok.token).then(() => {
      showApiTokensStatus(`Токен «${tok.name}» скопирован в буфер обмена`, "success");
    });
  }
}

function showApiTokensStatus(msg, type = "info") {
  const el = document.getElementById('apiTokensStatusAlert');
  if (!el) return;

  const bgClasses = {
    success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    error: 'bg-rose-50 text-rose-900 border-rose-200',
    warning: 'bg-amber-50 text-amber-900 border-amber-200',
    info: 'bg-purple-50 text-purple-900 border-purple-200'
  };

  const iconName = {
    success: 'check-circle-2',
    error: 'alert-triangle',
    warning: 'alert-circle',
    info: 'info'
  };

  el.className = `p-4 rounded-2xl border ${bgClasses[type] || bgClasses.info} flex items-center gap-3 text-xs leading-relaxed transition-all shadow-xs`;
  el.innerHTML = `
    <i data-lucide="${iconName[type] || 'info'}" class="w-5 h-5 shrink-0"></i>
    <div class="flex-grow">${msg}</div>
  `;
  el.classList.remove('hidden');

  if (window.lucide) lucide.createIcons();
}

function showApiTokensProgress(currentChunkIndex, totalChunks, currentChunk, currentSum, percent) {
  const el = document.getElementById('apiTokensStatusAlert');
  if (!el) return;

  el.className = `p-5 rounded-2xl border bg-purple-50/80 text-purple-950 border-purple-200 flex flex-col gap-3 text-xs leading-relaxed transition-all shadow-sm`;
  el.innerHTML = `
    <div class="flex items-center justify-between font-bold">
      <div class="flex items-center gap-2">
        <i data-lucide="loader-2" class="w-4 h-4 text-purple-600 animate-spin"></i>
        <span>Выгрузка из WB API (v3/fullstats): интервал ${currentChunkIndex} из ${totalChunks}</span>
      </div>
      <span class="text-purple-700">${percent}%</span>
    </div>

    <!-- Progress bar -->
    <div class="w-full bg-purple-200/60 rounded-full h-2 overflow-hidden">
      <div class="bg-gradient-to-r from-purple-600 to-indigo-600 h-2 rounded-full transition-all duration-300" style="width: ${percent}%"></div>
    </div>

    <div class="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-1 pt-1">
      <div>Период: <strong>${currentChunk.fromFormatted} — ${currentChunk.toFormatted}</strong></div>
      <div>Накоплено расходов: <strong class="text-purple-900">${formatCurrency(currentSum)}</strong></div>
    </div>
  `;
  el.classList.remove('hidden');

  if (window.lucide) lucide.createIcons();
}

/**
 * Updates the raw JSON debug textarea and meta info
 */
function setRawApiData(dataObj) {
  lastRawApiData = dataObj;
  const textarea = document.getElementById('rawApiDataTextarea');
  const meta = document.getElementById('rawApiDataMeta');

  if (!textarea) return;

  try {
    const formatted = JSON.stringify(dataObj, null, 2);
    textarea.value = formatted;
    
    if (meta) {
      const lineCount = formatted.split('\n').length;
      const byteSize = new Blob([formatted]).size;
      const sizeStr = byteSize > 1024 ? (byteSize / 1024).toFixed(1) + ' КБ' : byteSize + ' Б';
      meta.innerText = `${lineCount} строк (${sizeStr})`;
    }
  } catch (e) {
    textarea.value = String(dataObj);
  }
}

function copyRawApiDataToClipboard() {
  const textarea = document.getElementById('rawApiDataTextarea');
  if (!textarea || !textarea.value) {
    showApiTokensStatus("Поле с сырыми данными пусто", "warning");
    return;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textarea.value).then(() => {
      showApiTokensStatus("Сырой JSON скопирован в буфер обмена", "success");
    });
  }
}

function clearRawApiDataDisplay() {
  const textarea = document.getElementById('rawApiDataTextarea');
  const meta = document.getElementById('rawApiDataMeta');
  if (textarea) textarea.value = '';
  if (meta) meta.innerText = '0 строк';
  lastRawApiData = null;
}

/**
 * Splits a date range (startDate, endDate) into non-overlapping intervals of max maxDays (default 30 days)
 */
function splitDateRangeIntoChunks(startDate, endDate, maxDays = 30) {
  const chunks = [];
  let currentStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const finalEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  while (currentStart <= finalEnd) {
    let currentEnd = new Date(currentStart.getTime() + (maxDays - 1) * 24 * 60 * 60 * 1000);
    if (currentEnd > finalEnd) {
      currentEnd = new Date(finalEnd.getTime());
    }

    chunks.push({
      from: toLocalInputDate(currentStart),
      to: toLocalInputDate(currentEnd),
      fromFormatted: formatDate(currentStart),
      toFormatted: formatDate(currentEnd),
      daysCount: Math.round((currentEnd - currentStart) / (24 * 60 * 60 * 1000)) + 1
    });

    currentStart = new Date(currentEnd.getTime() + 24 * 60 * 60 * 1000);
  }

  return chunks;
}

/**
 * Helper to make API requests with multiple CORS proxies fallback
 */
async function fetchWbApi(url, token, options = {}) {
  const headers = {
    'Authorization': token,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // 1. Direct fetch
  try {
    const res = await fetch(url, { ...options, headers });
    if (res && res.status !== 0) return res;
  } catch (corsErr) {
    console.warn("Direct fetch failed for " + url + ", trying proxy 1...", corsErr);
  }

  // 2. Proxy 1: corsproxy.io
  try {
    const proxy1 = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const res = await fetch(proxy1, { ...options, headers });
    if (res && res.status !== 0) return res;
  } catch (e1) {
    console.warn("Proxy 1 failed, trying proxy 2...", e1);
  }

  // 3. Proxy 2: allorigins.win
  try {
    const proxy2 = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxy2, { ...options, headers });
    if (res && res.status !== 0) return res;
  } catch (e2) {
    console.warn("Proxy 2 failed, trying proxy 3...", e2);
  }

  // 4. Proxy 3: codetabs
  try {
    const proxy3 = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
    const res = await fetch(proxy3, { ...options, headers });
    return res;
  } catch (e3) {
    console.error("All proxies failed for " + url + ":", e3);
    throw e3;
  }
}

/**
 * Method 1: GET https://advert-api.wildberries.ru/api/advert/v2/adverts (and fallbacks)
 * Retrieves all campaigns, their IDs, and all associated SKU/nmId articles.
 */
async function fetchAdvertsV2Campaigns(token, rawCollector) {
  const campArticlesMap = {};
  const campInfoMap = {};

  const processAdvert = (adv) => {
    if (!adv || typeof adv !== 'object') return;
    const advId = String(adv.advertId || adv.id || adv.advert_id || adv.campId || '').trim();
    if (!advId) return;

    campInfoMap[advId] = {
      name: adv.name || adv.campName || '',
      type: adv.type,
      status: adv.status
    };

    const nms = [];
    if (Array.isArray(adv.nms)) nms.push(...adv.nms);
    if (Array.isArray(adv.nm)) nms.push(...adv.nm);
    if (Array.isArray(adv.nmIds)) nms.push(...adv.nmIds);
    if (adv.nmId) nms.push(adv.nmId);
    if (adv.nm_id) nms.push(adv.nm_id);

    if (Array.isArray(adv.params)) {
      adv.params.forEach(p => {
        if (Array.isArray(p.nms)) nms.push(...p.nms);
        if (Array.isArray(p.nm)) nms.push(...p.nm);
        if (p.nmId) nms.push(p.nmId);
        if (p.nm_id) nms.push(p.nm_id);
      });
    }

    if (adv.autoParams) {
      if (Array.isArray(adv.autoParams.nms)) nms.push(...adv.autoParams.nms);
      if (Array.isArray(adv.autoParams.nm)) nms.push(...adv.autoParams.nm);
      if (adv.autoParams.nmId) nms.push(adv.autoParams.nmId);
    }

    if (Array.isArray(adv.unitedParams)) {
      adv.unitedParams.forEach(p => {
        if (Array.isArray(p.nms)) nms.push(...p.nms);
        if (Array.isArray(p.nm)) nms.push(...p.nm);
        if (p.nmId) nms.push(p.nmId);
      });
    }

    if (Array.isArray(adv.cards)) {
      adv.cards.forEach(c => {
        if (c.nmId) nms.push(c.nmId);
        if (c.sku) nms.push(c.sku);
      });
    }
    if (Array.isArray(adv.items)) {
      adv.items.forEach(it => {
        if (it.nmId) nms.push(it.nmId);
        if (it.sku) nms.push(it.sku);
      });
    }

    const cleanSkus = Array.from(new Set(nms.map(n => String(n).trim()))).filter(Boolean);
    if (!campArticlesMap[advId] || campArticlesMap[advId].length === 0) {
      campArticlesMap[advId] = cleanSkus;
    } else if (cleanSkus.length > 0) {
      campArticlesMap[advId] = Array.from(new Set([...campArticlesMap[advId], ...cleanSkus]));
    }
  };

  // 1. Primary endpoint: https://advert-api.wildberries.ru/api/advert/v2/adverts
  try {
    const resV2 = await fetchWbApi('https://advert-api.wildberries.ru/api/advert/v2/adverts', token);
    if (resV2 && resV2.ok) {
      const dataV2 = await resV2.json();
      if (rawCollector) rawCollector['api_advert_v2_adverts'] = dataV2;

      if (Array.isArray(dataV2)) {
        dataV2.forEach(processAdvert);
      } else if (dataV2 && Array.isArray(dataV2.adverts)) {
        dataV2.adverts.forEach(processAdvert);
      } else if (dataV2 && Array.isArray(dataV2.data)) {
        dataV2.data.forEach(processAdvert);
      }
    } else if (resV2) {
      const errText = await resV2.text();
      if (rawCollector) rawCollector['api_advert_v2_adverts_error'] = { status: resV2.status, text: errText };
    }
  } catch (errV2) {
    console.warn("api/advert/v2/adverts call failed:", errV2);
    if (rawCollector) rawCollector['api_advert_v2_adverts_exception'] = errV2.message;
  }

  // 2. Supplementary endpoint: https://advert-api.wildberries.ru/adv/v1/promotion/adverts
  try {
    const resV1 = await fetchWbApi('https://advert-api.wildberries.ru/adv/v1/promotion/adverts', token);
    if (resV1 && resV1.ok) {
      const dataV1 = await resV1.json();
      if (rawCollector) rawCollector['adv_v1_promotion_adverts'] = dataV1;
      if (Array.isArray(dataV1)) {
        dataV1.forEach(processAdvert);
      }
    }
  } catch (errV1) {
    console.warn("adv/v1/promotion/adverts call failed:", errV1);
  }

  // 3. Supplementary endpoint: https://advert-api.wildberries.ru/adv/v0/allcamps
  try {
    const resV0 = await fetchWbApi('https://advert-api.wildberries.ru/adv/v0/allcamps', token);
    if (resV0 && resV0.ok) {
      const dataV0 = await resV0.json();
      if (rawCollector) rawCollector['adv_v0_allcamps'] = dataV0;
      if (Array.isArray(dataV0)) {
        dataV0.forEach(processAdvert);
      } else if (dataV0 && typeof dataV0 === 'object') {
        Object.values(dataV0).forEach(val => {
          if (Array.isArray(val)) val.forEach(processAdvert);
        });
      }
    }
  } catch (errV0) {
    console.warn("adv/v0/allcamps call failed:", errV0);
  }

  return { campArticlesMap, campInfoMap };
}

/**
 * Apply all SKU advertising spends to data structures and re-render tables
 */
function updateAllProductAdSpends() {
  for (const sku in globalStats.products) {
    const prod = globalStats.products[sku];
    const cleanSku = String(sku || '').trim();
    const numSku = String(parseInt(cleanSku, 10) || '');
    const cleanSupp = String(prod.supplierSku || '').trim();
    const ad = skuAdSpendMap[cleanSku] || skuAdSpendMap[numSku] || skuAdSpendMap[cleanSupp] || skuAdSpendMap[sku] || 0;
    prod.adSpend = ad;
  }

  if (Array.isArray(productsList)) {
    productsList.forEach(p => {
      const cleanSku = String(p.sku || '').trim();
      const numSku = String(parseInt(cleanSku, 10) || '');
      const cleanSupp = String(p.supplierSku || '').trim();
      p.adSpend = skuAdSpendMap[cleanSku] || skuAdSpendMap[numSku] || skuAdSpendMap[cleanSupp] || skuAdSpendMap[p.sku] || 0;
    });
  }

  if (Array.isArray(filteredProducts)) {
    filteredProducts.forEach(p => {
      const cleanSku = String(p.sku || '').trim();
      const numSku = String(parseInt(cleanSku, 10) || '');
      const cleanSupp = String(p.supplierSku || '').trim();
      p.adSpend = skuAdSpendMap[cleanSku] || skuAdSpendMap[numSku] || skuAdSpendMap[cleanSupp] || skuAdSpendMap[p.sku] || 0;
    });
  }

  if (typeof updateFinancials === 'function') updateFinancials();
  if (typeof renderProductTable === 'function') renderProductTable();
  if (typeof applyProductFilters === 'function') applyProductFilters();
}

/**
 * Full Pipeline:
 * 1. GET https://advert-api.wildberries.ru/api/advert/v2/adverts -> IDs & Articles
 * 2. GET https://advert-api.wildberries.ru/adv/v3/fullstats & /adv/v1/upd -> Campaign Spends
 * 3. Match Campaign IDs from (2) with (1) and distribute spends to SKUs
 */
async function fetchWbAdSpendForReport() {
  const activeTokenObj = getActiveApiTokenObj();
  if (!activeTokenObj || !activeTokenObj.token) {
    showApiTokensStatus("Сначала добавьте и выберите активный токен API Wildberries с правами «Продвижение / Реклама»", "error");
    return;
  }

  const token = activeTokenObj.token.trim();

  let startDate = null;
  let endDate = null;

  const inputFrom = document.getElementById('inputDateFrom')?.value;
  const inputTo = document.getElementById('inputDateTo')?.value;

  if (inputFrom && inputTo) {
    startDate = parseDate(inputFrom);
    endDate = parseDate(inputTo);
  } else if (minFileDate && maxFileDate) {
    startDate = new Date(minFileDate.getTime());
    endDate = new Date(maxFileDate.getTime());
  } else {
    endDate = new Date();
    startDate = new Date(endDate.getTime() - 29 * 24 * 60 * 60 * 1000);
  }

  if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    showApiTokensStatus("Не удалось определить диапазон дат отчета. Выберите период в фильтре дат.", "error");
    return;
  }

  if (startDate > endDate) {
    const tmp = startDate;
    startDate = endDate;
    endDate = tmp;
  }

  const chunks = splitDateRangeIntoChunks(startDate, endDate, 30);

  const btnSync = document.getElementById('btnSyncWbAdSpend');
  if (btnSync) {
    btnSync.disabled = true;
    btnSync.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Подготовка...`;
  }

  showApiTokensStatus("Шаг 1/2. Запрашиваем список кампаний и артикулов через api/advert/v2/adverts...", "info");

  // Raw collector container
  const rawPayload = {
    fetchTimestamp: new Date().toISOString(),
    period: { from: formatDate(startDate), to: formatDate(endDate) },
    totalChunks: chunks.length,
    chunks: chunks,
    rawResponses: {}
  };

  // STEP 1: Fetch campaign IDs and their articles from api/advert/v2/adverts
  const { campArticlesMap, campInfoMap } = await fetchAdvertsV2Campaigns(token, rawPayload.rawResponses);
  rawPayload['matched_campaigns_to_articles'] = campArticlesMap;
  
  const knownCampaignIds = new Set(Object.keys(campArticlesMap));
  console.log(`Found ${knownCampaignIds.size} campaigns from api/advert/v2/adverts:`, campArticlesMap);

  const campaignSpendsMap = {};
  const directSkuSpendsMap = {};
  let totalAdSum = 0;

  try {
    // STEP 2: Query GET https://advert-api.wildberries.ru/adv/v3/fullstats & /adv/v1/upd
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const progressPercent = Math.round(((i) / chunks.length) * 100);

      showApiTokensProgress(i + 1, chunks.length, chunk, totalAdSum, progressPercent);
      if (btnSync) {
        btnSync.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Выгрузка v3/fullstats: ${i + 1}/${chunks.length} (${progressPercent}%)...`;
      }

      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 450));
      }

      // 2A. Query /adv/v1/upd for this chunk to discover any active or historical campaign IDs
      try {
        const updUrl = `https://advert-api.wildberries.ru/adv/v1/upd?from=${chunk.from}&to=${chunk.to}`;
        const resUpd = await fetchWbApi(updUrl, token);
        if (resUpd && resUpd.ok) {
          const dataUpd = await resUpd.json();
          rawPayload.rawResponses[`v1_upd_${chunk.from}_${chunk.to}`] = dataUpd;
          if (Array.isArray(dataUpd) && dataUpd.length > 0) {
            dataUpd.forEach(updItem => {
              const campId = String(updItem.advertId || updItem.id || '').trim();
              if (campId) knownCampaignIds.add(campId);
              const uSum = parseNum(updItem.updSum !== undefined ? updItem.updSum : (updItem.sum || updItem.cost));
              if (campId && uSum > 0) {
                campaignSpendsMap[campId] = (campaignSpendsMap[campId] || 0) + uSum;
                totalAdSum += uSum;
              }
            });
          }
        }
      } catch (uErr) {
        console.warn("v1/upd call failed for chunk:", uErr);
      }

      // 2B. Query v3/fullstats for all known campaign IDs
      const allCampList = Array.from(knownCampaignIds);
      if (allCampList.length > 0) {
        for (let b = 0; b < allCampList.length; b += 50) {
          const batchIds = allCampList.slice(b, b + 50);
          const v3Url = `https://advert-api.wildberries.ru/adv/v3/fullstats?ids=${batchIds.join(',')}&from=${chunk.from}&to=${chunk.to}`;
          
          try {
            let resV3 = await fetchWbApi(v3Url, token);
            if (resV3 && resV3.status === 429) {
              await new Promise(r => setTimeout(r, 2500));
              resV3 = await fetchWbApi(v3Url, token);
            }

            if (resV3 && resV3.ok) {
              const dataV3 = await resV3.json();
              rawPayload.rawResponses[`v3_fullstats_${chunk.from}_${chunk.to}_batch${b}`] = dataV3;
              
              if (Array.isArray(dataV3) && dataV3.length > 0) {
                dataV3.forEach(campItem => {
                  const campId = String(campItem.advertId || campItem.id || campItem.advert_id || '').trim();
                  if (!campId) return;

                  let itemDirectSum = 0;

                  // 1. Direct nm spends in days -> apps -> nm
                  if (Array.isArray(campItem.days)) {
                    campItem.days.forEach(day => {
                      if (Array.isArray(day.apps)) {
                        day.apps.forEach(app => {
                          if (Array.isArray(app.nm)) {
                            app.nm.forEach(n => {
                              const nmId = String(n.nmId || n.nm || n.id || '').trim();
                              const nSum = parseNum(n.sum !== undefined ? n.sum : (n.cost || n.spend));
                              if (nmId && nSum > 0) {
                                directSkuSpendsMap[nmId] = (directSkuSpendsMap[nmId] || 0) + nSum;
                                itemDirectSum += nSum;
                              }
                            });
                          }
                        });
                      }

                      if (Array.isArray(day.nms)) {
                        day.nms.forEach(n => {
                          const nmId = String(n.nmId || n.nm || n.id || '').trim();
                          const nSum = parseNum(n.sum !== undefined ? n.sum : (n.cost || n.spend));
                          if (nmId && nSum > 0) {
                            directSkuSpendsMap[nmId] = (directSkuSpendsMap[nmId] || 0) + nSum;
                            itemDirectSum += nSum;
                          }
                        });
                      }
                    });
                  }

                  // 2. Booster stats
                  if (Array.isArray(campItem.boosterStats)) {
                    campItem.boosterStats.forEach(b => {
                      const nmId = String(b.nm || b.nmId || b.id || '').trim();
                      const bSum = parseNum(b.sum !== undefined ? b.sum : (b.cost || b.spend));
                      if (nmId && bSum > 0) {
                        directSkuSpendsMap[nmId] = (directSkuSpendsMap[nmId] || 0) + bSum;
                        itemDirectSum += bSum;
                      }
                    });
                  }

                  // Top level sum
                  const topCampSum = parseNum(campItem.sum !== undefined ? campItem.sum : (campItem.cost || campItem.spend));
                  const finalSum = itemDirectSum > 0 ? itemDirectSum : topCampSum;

                  if (finalSum > 0 && !campaignSpendsMap[campId]) {
                    campaignSpendsMap[campId] = finalSum;
                    totalAdSum += finalSum;
                  }
                });
              }
            } else if (resV3) {
              const errText = await resV3.text();
              rawPayload.rawResponses[`v3_fullstats_${chunk.from}_${chunk.to}_error`] = {
                status: resV3.status,
                text: errText
              };
            }
          } catch (v3Err) {
            console.warn("v3/fullstats call failed:", v3Err);
          }
        }
      }
    }

    rawPayload['campaign_spends_by_id'] = campaignSpendsMap;
    rawPayload['direct_sku_spends'] = directSkuSpendsMap;

    // STEP 3: MATCHING (Сопоставление ID кампаний с артикулами из api/advert/v2/adverts)
    const newSkuAdMap = {};

    // 3A. First, populate from direct SKU spends found in v3/fullstats
    for (const skuKey in directSkuSpendsMap) {
      newSkuAdMap[skuKey] = (newSkuAdMap[skuKey] || 0) + directSkuSpendsMap[skuKey];
    }

    // 3B. For each campaign ID in campaignSpendsMap, distribute to its articles from v2/adverts
    for (const advId in campaignSpendsMap) {
      const campSpend = campaignSpendsMap[advId];
      if (campSpend <= 0) continue;

      const skus = campArticlesMap[advId] || [];

      if (skus.length > 0) {
        const alreadyAssigned = skus.reduce((sum, s) => sum + (directSkuSpendsMap[s] || 0), 0);
        if (alreadyAssigned < campSpend) {
          const remaining = campSpend - alreadyAssigned;
          const perSku = remaining / skus.length;
          skus.forEach(s => {
            newSkuAdMap[s] = (newSkuAdMap[s] || 0) + perSku;
          });
        }
      } else {
        const info = campInfoMap[advId];
        let foundRegexNms = [];
        if (info && info.name) {
          const m = info.name.match(/\b\d{7,10}\b/g);
          if (m && m.length > 0) foundRegexNms = Array.from(new Set(m));
        }

        if (foundRegexNms.length > 0) {
          const perSku = campSpend / foundRegexNms.length;
          foundRegexNms.forEach(s => {
            newSkuAdMap[s] = (newSkuAdMap[s] || 0) + perSku;
          });
        } else {
          newSkuAdMap[`adv_${advId}`] = campSpend;
        }
      }
    }

    rawPayload['final_sku_ad_spend'] = newSkuAdMap;
    setRawApiData(rawPayload);

    console.log("Matched Final SKU Ad Spend Map:", newSkuAdMap);

    if (Object.keys(newSkuAdMap).length === 0) {
      showApiTokensStatus(
        `Запрос выполнен (${chunks.length} ${chunks.length === 1 ? 'интервал' : 'интервала'}, ${formatDate(startDate)} — ${formatDate(endDate)}), но списаний на рекламу за этот период не найдено. Полный ответ WB API отображен в сырых данных внизу.`,
        "warning"
      );
      return;
    }

    // Save to storage
    skuAdSpendMap = newSkuAdMap;
    saveSkuAdSpendToStorage();

    // Update state and UI
    updateAllProductAdSpends();

    let matchedSkusCount = 0;
    let totalAssignedToReportSkus = 0;

    for (const sku in globalStats.products) {
      const prod = globalStats.products[sku];
      if ((prod.adSpend || 0) > 0) {
        matchedSkusCount++;
        totalAssignedToReportSkus += prod.adSpend;
      }
    }

    // Update overall ad spend input field on overview tab
    const adInput = document.getElementById('inputAdSpend');
    if (adInput) {
      adInput.value = totalAdSum.toFixed(2);
    }

    const reportMatchText = matchedSkusCount > 0 
      ? ` Сопоставлено с товарами в текущем отчете: ${matchedSkusCount} SKU на сумму ${formatCurrency(totalAssignedToReportSkus)}.`
      : ` Найдено расходов по ${Object.keys(newSkuAdMap).length} артикулам/кампаниям.`;

    showApiTokensStatus(
      `✅ Успешно сопоставлены кампании из <strong>api/advert/v2/adverts</strong> с расходами из <strong>adv/v3/fullstats</strong> за период <strong>${formatDate(startDate)} — ${formatDate(endDate)}</strong>! Всего рекламных затрат: <strong>${formatCurrency(totalAdSum)}</strong>.${reportMatchText} Полный ответ выведен в сырых данных внизу.`,
      "success"
    );

  } catch (err) {
    console.error("Ошибка при получении расходов из WB API:", err);
    if (rawPayload) setRawApiData(rawPayload);
    showApiTokensStatus(`Ошибка при обращении к WB API: ${err.message || 'Сетевой сбой'}. Попробуйте повторить запрос позже.`, "error");
  } finally {
    if (btnSync) {
      btnSync.disabled = false;
      btnSync.innerHTML = `<i data-lucide="refresh-cw" class="w-4 h-4"></i> Загрузить расходы на рекламу из WB API`;
      if (window.lucide) lucide.createIcons();
    }
  }
}
