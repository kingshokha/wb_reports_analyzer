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
        <span>Выгрузка из WB Advert API (v3/fullstats): интервал ${currentChunkIndex} из ${totalChunks}</span>
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
 * Helper to make API requests with CORS proxy fallback
 */
async function fetchWbApi(url, token, options = {}) {
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
  const headers = {
    'Authorization': token,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, { ...options, headers });
    return res;
  } catch (corsErr) {
    console.warn("Direct fetch to WB API failed, using CORS proxy:", corsErr);
    return await fetch(proxyUrl, { ...options, headers });
  }
}

/**
 * Fetch campaign info and map advertId -> [nmId1, nmId2, ...]
 * Uses https://advert-api.wildberries.ru/api/advert/v2/adverts and /adv/v1/promotion/adverts
 */
async function fetchCampaignArticlesMap(token, rawCollector) {
  const campNmsMap = {};

  const processAdvertObject = (adv) => {
    if (!adv || typeof adv !== 'object') return;
    const advId = adv.advertId || adv.id || adv.advert_id || adv.campId;
    if (!advId) return;

    const nms = [];
    // 1. Direct nms/nm/nmId array or value
    if (Array.isArray(adv.nms)) nms.push(...adv.nms);
    if (Array.isArray(adv.nm)) nms.push(...adv.nm);
    if (Array.isArray(adv.nmIds)) nms.push(...adv.nmIds);
    if (adv.nmId) nms.push(adv.nmId);
    if (adv.nm_id) nms.push(adv.nm_id);

    // 2. params
    if (Array.isArray(adv.params)) {
      adv.params.forEach(p => {
        if (Array.isArray(p.nms)) nms.push(...p.nms);
        if (Array.isArray(p.nm)) nms.push(...p.nm);
        if (p.nmId) nms.push(p.nmId);
        if (p.nm_id) nms.push(p.nm_id);
      });
    }

    // 3. autoParams
    if (adv.autoParams) {
      if (Array.isArray(adv.autoParams.nms)) nms.push(...adv.autoParams.nms);
      if (Array.isArray(adv.autoParams.nm)) nms.push(...adv.autoParams.nm);
      if (adv.autoParams.nmId) nms.push(adv.autoParams.nmId);
    }

    // 4. unitedParams
    if (Array.isArray(adv.unitedParams)) {
      adv.unitedParams.forEach(p => {
        if (Array.isArray(p.nms)) nms.push(...p.nms);
        if (Array.isArray(p.nm)) nms.push(...p.nm);
        if (p.nmId) nms.push(p.nmId);
      });
    }

    // 5. cards or items
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

    if (nms.length > 0) {
      const cleanList = Array.from(new Set(nms.map(n => String(n).trim()))).filter(Boolean);
      if (cleanList.length > 0) {
        campNmsMap[String(advId)] = cleanList;
      }
    }
  };

  // Endpoint 1: https://advert-api.wildberries.ru/api/advert/v2/adverts (requested by user)
  try {
    const resV2 = await fetchWbApi('https://advert-api.wildberries.ru/api/advert/v2/adverts', token);
    if (resV2) {
      if (resV2.ok) {
        const dataV2 = await resV2.json();
        if (rawCollector) rawCollector['api/advert/v2/adverts'] = dataV2;
        console.log("api/advert/v2/adverts response:", dataV2);

        if (Array.isArray(dataV2)) {
          dataV2.forEach(processAdvertObject);
        } else if (dataV2 && Array.isArray(dataV2.adverts)) {
          dataV2.adverts.forEach(processAdvertObject);
        } else if (dataV2 && Array.isArray(dataV2.data)) {
          dataV2.data.forEach(processAdvertObject);
        }
      } else {
        const errText = await resV2.text();
        if (rawCollector) rawCollector['api/advert/v2/adverts_error'] = { status: resV2.status, text: errText };
      }
    }
  } catch (errV2) {
    console.warn("Could not fetch api/advert/v2/adverts:", errV2);
    if (rawCollector) rawCollector['api/advert/v2/adverts_exception'] = errV2.message;
  }

  // Endpoint 2: https://advert-api.wildberries.ru/adv/v1/promotion/adverts (classic endpoint)
  try {
    const resV1 = await fetchWbApi('https://advert-api.wildberries.ru/adv/v1/promotion/adverts', token);
    if (resV1) {
      if (resV1.ok) {
        const dataV1 = await resV1.json();
        if (rawCollector) rawCollector['adv/v1/promotion/adverts'] = dataV1;
        console.log("adv/v1/promotion/adverts response:", dataV1);

        if (Array.isArray(dataV1)) {
          dataV1.forEach(processAdvertObject);
        }
      } else {
        const errText = await resV1.text();
        if (rawCollector) rawCollector['adv/v1/promotion/adverts_error'] = { status: resV1.status, text: errText };
      }
    }
  } catch (errV1) {
    console.warn("Could not fetch adv/v1/promotion/adverts:", errV1);
  }

  return campNmsMap;
}

/**
 * Recursively extracts nmId and sum from WB fullstats response
 */
function extractNmSpendsFromFullstats(data, newSkuAdMap, campNmsMap) {
  if (!Array.isArray(data)) return 0;
  let totalExtracted = 0;

  data.forEach(item => {
    let foundInnerNm = false;

    // 1. Structure: days -> apps -> nm -> nmId / sum
    if (Array.isArray(item.days)) {
      item.days.forEach(day => {
        if (Array.isArray(day.apps)) {
          day.apps.forEach(app => {
            if (Array.isArray(app.nm)) {
              app.nm.forEach(nmItem => {
                const nmId = nmItem.nmId || nmItem.nm || nmItem.id;
                const sumVal = parseNum(nmItem.sum !== undefined ? nmItem.sum : (nmItem.cost || nmItem.spend));
                if (nmId && sumVal > 0) {
                  const skuKey = String(nmId).trim();
                  newSkuAdMap[skuKey] = (newSkuAdMap[skuKey] || 0) + sumVal;
                  totalExtracted += sumVal;
                  foundInnerNm = true;
                }
              });
            }
          });
        }

        // Structure: days -> nms -> nmId / sum
        if (Array.isArray(day.nms)) {
          day.nms.forEach(nmItem => {
            const nmId = nmItem.nmId || nmItem.nm || nmItem.id;
            const sumVal = parseNum(nmItem.sum !== undefined ? nmItem.sum : (nmItem.cost || nmItem.spend));
            if (nmId && sumVal > 0) {
              const skuKey = String(nmId).trim();
              newSkuAdMap[skuKey] = (newSkuAdMap[skuKey] || 0) + sumVal;
              totalExtracted += sumVal;
              foundInnerNm = true;
            }
          });
        }
      });
    }

    // 2. Structure: boosterStats -> nm / sum
    if (Array.isArray(item.boosterStats)) {
      item.boosterStats.forEach(b => {
        const nmId = b.nm || b.nmId || b.id;
        const sumVal = parseNum(b.sum !== undefined ? b.sum : (b.cost || b.spend));
        if (nmId && sumVal > 0) {
          const skuKey = String(nmId).trim();
          newSkuAdMap[skuKey] = (newSkuAdMap[skuKey] || 0) + sumVal;
          totalExtracted += sumVal;
          foundInnerNm = true;
        }
      });
    }

    // 3. Structure: item.nms -> nmId / sum
    if (Array.isArray(item.nms)) {
      item.nms.forEach(nmItem => {
        const nmId = nmItem.nmId || nmItem.nm || nmItem.id;
        const sumVal = parseNum(nmItem.sum !== undefined ? nmItem.sum : (nmItem.cost || nmItem.spend));
        if (nmId && sumVal > 0) {
          const skuKey = String(nmId).trim();
          newSkuAdMap[skuKey] = (newSkuAdMap[skuKey] || 0) + sumVal;
          totalExtracted += sumVal;
          foundInnerNm = true;
        }
      });
    }

    // 4. If campaign has top-level sum and no inner nms were parsed, distribute via campNmsMap
    const topSum = parseNum(item.sum !== undefined ? item.sum : (item.cost || item.spend || item.updSum));
    if (!foundInnerNm && topSum > 0) {
      const advId = item.advertId || item.id;
      let nms = campNmsMap[String(advId)] || [];
      if (nms.length === 0 && item.campName) {
        const m = item.campName.match(/\b\d{7,10}\b/g);
        if (m && m.length > 0) nms = Array.from(new Set(m.map(String)));
      }

      if (nms.length > 0) {
        const perSku = topSum / nms.length;
        nms.forEach(sku => {
          const skuKey = String(sku).trim();
          newSkuAdMap[skuKey] = (newSkuAdMap[skuKey] || 0) + perSku;
        });
      } else {
        const fallbackKey = advId ? `adv_${advId}` : `unassigned`;
        newSkuAdMap[fallbackKey] = (newSkuAdMap[fallbackKey] || 0) + topSum;
      }
      totalExtracted += topSum;
    }
  });

  return totalExtracted;
}

/**
 * Fetch WB Advertising / Promotion Spend by SKU using GET /adv/v3/fullstats & /adv/v1/upd fallback
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

  showApiTokensStatus("1/3. Считываем кампании продавца из Wildberries API...", "info");

  // Raw collector for user inspectability
  const rawPayload = {
    fetchTimestamp: new Date().toISOString(),
    period: { from: formatDate(startDate), to: formatDate(endDate) },
    totalChunks: chunks.length,
    chunks: chunks,
    rawResponses: {}
  };

  // Step 1: Pre-fetch campaign articles map
  const campNmsMap = await fetchCampaignArticlesMap(token, rawPayload.rawResponses);
  rawPayload['mappedCampaigns'] = campNmsMap;
  console.log("WB Campaign articles mapped:", Object.keys(campNmsMap).length);

  const newSkuAdMap = {};
  let totalAdSum = 0;

  try {
    // Step 2: Query GET /adv/v3/fullstats and /adv/v1/upd for each 30-day chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const progressPercent = Math.round(((i) / chunks.length) * 100);

      showApiTokensProgress(i + 1, chunks.length, chunk, totalAdSum, progressPercent);
      if (btnSync) {
        btnSync.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Интервал ${i + 1}/${chunks.length} (${progressPercent}%)...`;
      }

      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 450));
      }

      // 2A. Method: GET https://advert-api.wildberries.ru/adv/v3/fullstats
      let chunkLoaded = false;
      const allCampIds = Object.keys(campNmsMap);

      if (allCampIds.length > 0) {
        for (let b = 0; b < allCampIds.length; b += 50) {
          const batchIds = allCampIds.slice(b, b + 50);
          const v3Url = `https://advert-api.wildberries.ru/adv/v3/fullstats?ids=${batchIds.join(',')}&from=${chunk.from}&to=${chunk.to}`;
          
          try {
            let resV3 = await fetchWbApi(v3Url, token);
            if (resV3 && resV3.status === 429) {
              await new Promise(r => setTimeout(r, 2500));
              resV3 = await fetchWbApi(v3Url, token);
            }

            if (resV3 && resV3.ok) {
              const dataV3 = await resV3.json();
              rawPayload.rawResponses[`v3/fullstats_${chunk.from}_${chunk.to}_batch${b}`] = dataV3;
              if (Array.isArray(dataV3) && dataV3.length > 0) {
                console.log(`v3/fullstats response for interval ${chunk.fromFormatted}-${chunk.toFormatted}:`, dataV3);
                const sumExtracted = extractNmSpendsFromFullstats(dataV3, newSkuAdMap, campNmsMap);
                totalAdSum += sumExtracted;
                chunkLoaded = true;
              }
            } else if (resV3) {
              rawPayload.rawResponses[`v3/fullstats_${chunk.from}_${chunk.to}_error`] = {
                status: resV3.status,
                text: await resV3.text()
              };
            }
          } catch (v3Err) {
            console.warn("v3/fullstats batch fetch failed:", v3Err);
          }
        }
      }

      // 2B. Fallback / supplementary: GET /adv/v1/upd
      const updUrl = `https://advert-api.wildberries.ru/adv/v1/upd?from=${chunk.from}&to=${chunk.to}`;
      try {
        let resUpd = await fetchWbApi(updUrl, token);
        if (resUpd && resUpd.status === 429) {
          await new Promise(r => setTimeout(r, 2500));
          resUpd = await fetchWbApi(updUrl, token);
        }

        if (resUpd && resUpd.ok) {
          const dataUpd = await resUpd.json();
          rawPayload.rawResponses[`v1/upd_${chunk.from}_${chunk.to}`] = dataUpd;
          if (Array.isArray(dataUpd) && dataUpd.length > 0) {
            console.log(`v1/upd response for interval ${chunk.fromFormatted}-${chunk.toFormatted}:`, dataUpd);
            if (!chunkLoaded) {
              const sumExtracted = extractNmSpendsFromFullstats(dataUpd, newSkuAdMap, campNmsMap);
              totalAdSum += sumExtracted;
            }
          }
        } else if (resUpd) {
          rawPayload.rawResponses[`v1/upd_${chunk.from}_${chunk.to}_error`] = {
            status: resUpd.status,
            text: await resUpd.text()
          };
        }
      } catch (updErr) {
        console.warn("v1/upd fetch failed:", updErr);
      }
    }

    rawPayload['aggregatedSkuSpend'] = newSkuAdMap;
    setRawApiData(rawPayload);

    console.log("Final newSkuAdMap:", newSkuAdMap);

    if (Object.keys(newSkuAdMap).length === 0) {
      showApiTokensStatus(
        `Запрос выполнен успешно (${chunks.length} ${chunks.length === 1 ? 'интервал' : 'интервала'}, ${formatDate(startDate)} — ${formatDate(endDate)}), но рекламных расходов в кабинете WB за этот период не найдено. Проверьте сырые данные в поле ниже.`,
        "warning"
      );
      return;
    }

    // Step 3: Save to storage
    skuAdSpendMap = newSkuAdMap;
    saveSkuAdSpendToStorage();

    let matchedSkusCount = 0;
    let totalAssignedToReportSkus = 0;

    // Step 4: Apply to globalStats.products
    for (const sku in globalStats.products) {
      const prod = globalStats.products[sku];
      const cleanSku = String(sku).trim();
      const ad = skuAdSpendMap[cleanSku] || skuAdSpendMap[sku] || 0;
      prod.adSpend = ad;
      if (ad > 0) {
        matchedSkusCount++;
        totalAssignedToReportSkus += ad;
      }
    }

    // Step 5: Apply to productsList & filteredProducts
    if (Array.isArray(productsList)) {
      productsList.forEach(p => {
        const cleanSku = String(p.sku).trim();
        p.adSpend = skuAdSpendMap[cleanSku] || skuAdSpendMap[p.sku] || 0;
      });
    }

    if (Array.isArray(filteredProducts)) {
      filteredProducts.forEach(p => {
        const cleanSku = String(p.sku).trim();
        p.adSpend = skuAdSpendMap[cleanSku] || skuAdSpendMap[p.sku] || 0;
      });
    }

    // Step 6: Set overall ad spend input field on overview tab
    const adInput = document.getElementById('inputAdSpend');
    if (adInput) {
      adInput.value = totalAdSum.toFixed(2);
    }

    // Step 7: Update financials and re-render tables
    if (typeof updateFinancials === 'function') updateFinancials();
    if (typeof renderProductTable === 'function') renderProductTable();
    if (typeof applyProductFilters === 'function') applyProductFilters();

    const reportMatchText = matchedSkusCount > 0 
      ? ` Сопоставлено с товарами в текущем отчете: ${matchedSkusCount} SKU на сумму ${formatCurrency(totalAssignedToReportSkus)}.`
      : ` Найдено расходов по ${Object.keys(newSkuAdMap).length} артикулам/кампаниям.`;

    showApiTokensStatus(
      `✅ Успешно выгружено по методу <strong>adv/v3/fullstats</strong> за период <strong>${formatDate(startDate)} — ${formatDate(endDate)}</strong>! Всего рекламных затрат: <strong>${formatCurrency(totalAdSum)}</strong>.${reportMatchText} Полный сырой ответ выведен в поле ниже.`,
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
