/**
 * WB Finance Analytics - Wildberries API Tokens & Promotion Ad Spend Sync
 * Strictly compliant with official Wildberries Promotion OpenApi specs
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

function showApiTokensProgress(currentChunkIndex, totalChunks, currentChunk, currentSum, percent, stageText) {
  const el = document.getElementById('apiTokensStatusAlert');
  if (!el) return;

  const stage = stageText || `Выгрузка из WB API (v3/fullstats): интервал ${currentChunkIndex} из ${totalChunks}`;

  el.className = `p-5 rounded-2xl border bg-purple-50/80 text-purple-950 border-purple-200 flex flex-col gap-3 text-xs leading-relaxed transition-all shadow-sm`;
  el.innerHTML = `
    <div class="flex items-center justify-between font-bold">
      <div class="flex items-center gap-2">
        <i data-lucide="loader-2" class="w-4 h-4 text-purple-600 animate-spin"></i>
        <span>${stage}</span>
      </div>
      <span class="text-purple-700 font-extrabold">${percent}%</span>
    </div>

    <!-- Progress bar -->
    <div class="w-full bg-purple-200/60 rounded-full h-2 overflow-hidden">
      <div class="bg-gradient-to-r from-purple-600 to-indigo-600 h-2 rounded-full transition-all duration-300" style="width: ${percent}%"></div>
    </div>

    <div class="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-1 pt-1">
      <div>Интервал: <strong>${currentChunk.fromFormatted} — ${currentChunk.toFormatted}</strong></div>
      <div>Накоплено расходов: <strong class="text-purple-900 font-bold">${formatCurrency(currentSum)}</strong></div>
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
    console.warn("Direct fetch failed for " + url + ", trying proxy...", corsErr);
  }

  // 2. Proxy 1: corsproxy.io
  try {
    const proxy1 = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const res = await fetch(proxy1, { ...options, headers });
    if (res && res.status !== 0) return res;
  } catch (e1) {
    console.warn("corsproxy.io failed, trying allorigins...", e1);
  }

  // 3. Proxy 2: allorigins.win
  try {
    const proxy2 = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxy2, { ...options, headers });
    if (res && res.status !== 0) return res;
  } catch (e2) {
    console.warn("allorigins failed, trying codetabs...", e2);
  }

  // 4. Proxy 3: codetabs
  try {
    const proxy3 = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
    const res = await fetch(proxy3, { ...options, headers });
    return res;
  } catch (e3) {
    console.error("All CORS proxies failed for " + url + ":", e3);
    throw e3;
  }
}

/**
 * Parses any advert JSON object to extract its article numbers (nms)
 */
function extractNmsFromAdvertObject(adv) {
  if (!adv || typeof adv !== 'object') return [];
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

  return Array.from(new Set(nms.map(n => String(n).trim()))).filter(Boolean);
}

/**
 * Step 1: Discovers all campaign IDs across all official endpoints
 */
async function discoverAllCampaigns(token, rawCollector) {
  const discoveredIds = new Set();
  const campArticlesMap = {};
  const campInfoMap = {};

  const registerAdv = (adv) => {
    if (!adv || typeof adv !== 'object') return;
    const advId = String(adv.advertId || adv.id || adv.advert_id || adv.campId || '').trim();
    if (!advId) return;

    discoveredIds.add(advId);
    campInfoMap[advId] = {
      name: adv.name || adv.campName || '',
      type: adv.type || adv.advertType,
      status: adv.status
    };

    const nms = extractNmsFromAdvertObject(adv);
    if (nms.length > 0) {
      campArticlesMap[advId] = nms;
    }
  };

  // 1A. GET /adv/v1/promotion/count (official summary of all campaign IDs grouped by status)
  try {
    const resCount = await fetchWbApi('https://advert-api.wildberries.ru/adv/v1/promotion/count', token);
    if (resCount && resCount.ok) {
      const dataCount = await resCount.json();
      if (rawCollector) rawCollector['adv_v1_promotion_count'] = dataCount;

      if (dataCount && Array.isArray(dataCount.adverts)) {
        dataCount.adverts.forEach(group => {
          if (Array.isArray(group.advert_list)) {
            group.advert_list.forEach(item => {
              const aId = String(item.advertId || item.id || '').trim();
              if (aId) discoveredIds.add(aId);
            });
          }
        });
      }
    }
  } catch (errCount) {
    console.warn("adv/v1/promotion/count failed:", errCount);
  }

  // 1B. GET /api/advert/v2/adverts (v2 endpoint)
  try {
    const resV2 = await fetchWbApi('https://advert-api.wildberries.ru/api/advert/v2/adverts', token);
    if (resV2 && resV2.ok) {
      const dataV2 = await resV2.json();
      if (rawCollector) rawCollector['api_advert_v2_adverts'] = dataV2;

      if (Array.isArray(dataV2)) {
        dataV2.forEach(registerAdv);
      } else if (dataV2 && Array.isArray(dataV2.adverts)) {
        dataV2.adverts.forEach(group => {
          registerAdv(group);
          if (Array.isArray(group.advert_list)) {
            group.advert_list.forEach(item => {
              const aId = String(item.advertId || item.id || '').trim();
              if (aId) discoveredIds.add(aId);
            });
          }
        });
      }
    }
  } catch (errV2) {
    console.warn("api/advert/v2/adverts failed:", errV2);
  }

  // 1C. GET /adv/v0/allcamps (v0 endpoint)
  try {
    const resV0 = await fetchWbApi('https://advert-api.wildberries.ru/adv/v0/allcamps', token);
    if (resV0 && resV0.ok) {
      const dataV0 = await resV0.json();
      if (rawCollector) rawCollector['adv_v0_allcamps'] = dataV0;
      if (Array.isArray(dataV0)) {
        dataV0.forEach(registerAdv);
      } else if (dataV0 && typeof dataV0 === 'object') {
        Object.values(dataV0).forEach(val => {
          if (Array.isArray(val)) val.forEach(registerAdv);
        });
      }
    }
  } catch (errV0) {
    console.warn("adv/v0/allcamps failed:", errV0);
  }

  return { discoveredIds, campArticlesMap, campInfoMap };
}

/**
 * Step 2: For campaign IDs missing articles, queries /adv/v1/advert?id=...
 */
async function fetchCampaignNmsDetails(campaignIds, campArticlesMap, campInfoMap, token, rawCollector) {
  const idsWithoutNms = campaignIds.filter(id => !campArticlesMap[id] || campArticlesMap[id].length === 0);
  console.log(`Fetching parameters for ${idsWithoutNms.length} campaigns without NMs...`);

  for (let i = 0; i < idsWithoutNms.length; i++) {
    const advId = idsWithoutNms[i];
    try {
      if (i > 0 && i % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const advUrl = `https://advert-api.wildberries.ru/adv/v1/advert?id=${advId}`;
      const res = await fetchWbApi(advUrl, token);
      if (res && res.ok) {
        const advData = await res.json();
        if (rawCollector) rawCollector[`adv_v1_advert_${advId}`] = advData;

        if (advData) {
          if (advData.name && campInfoMap[advId]) campInfoMap[advId].name = advData.name;
          const nms = extractNmsFromAdvertObject(advData);
          if (nms.length > 0) {
            campArticlesMap[advId] = nms;
          }
        }
      }
    } catch (e) {
      console.warn(`Failed to fetch /adv/v1/advert for ${advId}:`, e);
    }
  }
}

/**
 * Step 3: Updates all product tables and recalculates net profit across all views
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
 * Main Execution Function
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
    btnSync.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Выполняется...`;
  }

  showApiTokensStatus("Шаг 1/3. Получение списка всех рекламных кампаний...", "info");

  const rawPayload = {
    fetchTimestamp: new Date().toISOString(),
    period: { from: formatDate(startDate), to: formatDate(endDate) },
    totalChunks: chunks.length,
    chunks: chunks,
    rawResponses: {}
  };

  // STEP 1: Discover all campaign IDs
  const { discoveredIds, campArticlesMap, campInfoMap } = await discoverAllCampaigns(token, rawPayload.rawResponses);
  
  // STEP 2: Query /adv/v1/upd to add any campaigns with financial deductions
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const updUrl = `https://advert-api.wildberries.ru/adv/v1/upd?from=${chunk.from}&to=${chunk.to}`;
      const resUpd = await fetchWbApi(updUrl, token);
      if (resUpd && resUpd.ok) {
        const dataUpd = await resUpd.json();
        rawPayload.rawResponses[`adv_v1_upd_${chunk.from}_${chunk.to}`] = dataUpd;
        if (Array.isArray(dataUpd)) {
          dataUpd.forEach(upd => {
            const uId = String(upd.advertId || upd.id || '').trim();
            if (uId) {
              discoveredIds.add(uId);
              if (upd.campName && !campInfoMap[uId]) {
                campInfoMap[uId] = { name: upd.campName, type: upd.advertType };
              }
            }
          });
        }
      }
    } catch (errUpd) {
      console.warn("v1/upd query failed:", errUpd);
    }
  }

  const allCampIdsList = Array.from(discoveredIds);
  console.log(`Total unique campaigns discovered: ${allCampIdsList.length}`, allCampIdsList);

  // STEP 3: Fetch article mappings for campaigns
  showApiTokensStatus("Шаг 2/3. Определение артикулов рекламируемых товаров...", "info");
  await fetchCampaignNmsDetails(allCampIdsList, campArticlesMap, campInfoMap, token, rawPayload.rawResponses);
  rawPayload['campaign_to_articles_map'] = campArticlesMap;

  // STEP 4: Query /adv/v3/fullstats for all campaigns
  const campaignSpendsMap = {};
  const directSkuSpendsMap = {};
  let totalAdSum = 0;

  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const progressPercent = Math.round(((i + 1) / chunks.length) * 100);

      showApiTokensProgress(i + 1, chunks.length, chunk, totalAdSum, progressPercent, `Выгрузка статистики: интервал ${i + 1} из ${chunks.length}`);
      if (btnSync) {
        btnSync.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Выгрузка v3/fullstats: ${progressPercent}%...`;
      }

      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 450));
      }

      // Query v3/fullstats in batches of up to 50
      if (allCampIdsList.length > 0) {
        for (let b = 0; b < allCampIdsList.length; b += 50) {
          const batchIds = allCampIdsList.slice(b, b + 50);
          const v3Url = `https://advert-api.wildberries.ru/adv/v3/fullstats?ids=${batchIds.join(',')}&from=${chunk.from}&to=${chunk.to}`;

          try {
            let resV3 = await fetchWbApi(v3Url, token);
            if (resV3 && resV3.status === 429) {
              await new Promise(r => setTimeout(r, 2500));
              resV3 = await fetchWbApi(v3Url, token);
            }

            if (resV3 && resV3.ok) {
              const dataV3 = await resV3.json();
              rawPayload.rawResponses[`adv_v3_fullstats_${chunk.from}_${chunk.to}_batch${b}`] = dataV3;

              if (Array.isArray(dataV3) && dataV3.length > 0) {
                dataV3.forEach(campItem => {
                  const campId = String(campItem.advertId || campItem.id || '').trim();
                  if (!campId) return;

                  let itemDirectSum = 0;

                  // Direct nms in days -> apps -> nm
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

                  // Booster stats
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

                  if (finalSum > 0) {
                    campaignSpendsMap[campId] = (campaignSpendsMap[campId] || 0) + finalSum;
                    totalAdSum += finalSum;
                  }
                });
              }
            } else if (resV3) {
              const errText = await resV3.text();
              rawPayload.rawResponses[`adv_v3_fullstats_${chunk.from}_${chunk.to}_error`] = {
                status: resV3.status,
                text: errText
              };
            }
          } catch (v3Err) {
            console.warn("v3/fullstats call failed:", v3Err);
          }
        }
      }

      // Check /adv/v1/upd write-offs
      const rawUpdData = rawPayload.rawResponses[`adv_v1_upd_${chunk.from}_${chunk.to}`];
      if (Array.isArray(rawUpdData)) {
        rawUpdData.forEach(updItem => {
          const campId = String(updItem.advertId || updItem.id || '').trim();
          const uSum = parseNum(updItem.updSum !== undefined ? updItem.updSum : (updItem.sum || updItem.cost));
          if (campId && uSum > 0 && !campaignSpendsMap[campId]) {
            campaignSpendsMap[campId] = uSum;
            totalAdSum += uSum;
          }
        });
      }
    }

    rawPayload['campaign_spends_by_id'] = campaignSpendsMap;
    rawPayload['direct_sku_spends'] = directSkuSpendsMap;

    // STEP 5: MATCHING SPENDS TO SKUS
    const newSkuAdMap = {};

    // 5A. Direct SKU Spends from fullstats
    for (const skuKey in directSkuSpendsMap) {
      newSkuAdMap[skuKey] = (newSkuAdMap[skuKey] || 0) + directSkuSpendsMap[skuKey];
    }

    // 5B. Distribute Campaign Spends to Articles
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
          // If seller only has 1 or few products in report, assign to all report products
          const reportSkus = Object.keys(globalStats.products || {});
          if (reportSkus.length === 1) {
            newSkuAdMap[reportSkus[0]] = (newSkuAdMap[reportSkus[0]] || 0) + campSpend;
          } else {
            newSkuAdMap[`adv_${advId}`] = campSpend;
          }
        }
      }
    }

    rawPayload['final_sku_ad_spend'] = newSkuAdMap;
    setRawApiData(rawPayload);

    console.log("Final Matched SKU Ad Spend Map:", newSkuAdMap);

    if (Object.keys(newSkuAdMap).length === 0) {
      showApiTokensStatus(
        `Запрос выполнен (${chunks.length} ${chunks.length === 1 ? 'интервал' : 'интервала'}, ${formatDate(startDate)} — ${formatDate(endDate)}), но списаний на рекламу за этот период не обнаружено. Полный JSON-ответ WB API доступен внизу.`,
        "warning"
      );
      return;
    }

    // Save to storage
    skuAdSpendMap = newSkuAdMap;
    saveSkuAdSpendToStorage();

    // Apply to product structures and re-render tables
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
      `✅ Успешно выгружено и сопоставлено за период <strong>${formatDate(startDate)} — ${formatDate(endDate)}</strong>! Всего расходов: <strong>${formatCurrency(totalAdSum)}</strong>.${reportMatchText}`,
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
