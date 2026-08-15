/**
 * WB Finance Analytics - Wildberries API Tokens & Promotion Ad Spend Sync
 */

function getActiveApiTokenObj() {
  if (!activeApiTokenId && apiTokensList.length > 0) {
    activeApiTokenId = apiTokensList[0].id;
  }
  return apiTokensList.find(t => t.id === activeApiTokenId) || null;
}

function handleAddApiToken(e) {
  if (e && e.preventDefault) e.preventDefault();

  const nameInput = document.getElementById('inputTokenName');
  const tokenInput = document.getElementById('inputTokenValue');

  if (!tokenInput || !tokenInput.value.trim()) {
    showApiTokensStatus("Пожалуйста, введите токен API Wildberries", "error");
    return;
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
      : `<button type="button" onclick="setActiveApiToken('${tok.id}')" class="px-2.5 py-1 text-xs rounded-lg font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors">
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
          <button type="button" onclick="copyTokenToClipboard('${tok.id}')" class="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors" title="Скопировать токен">
            <i data-lucide="copy" class="w-4 h-4"></i>
          </button>
          <button type="button" onclick="deleteApiToken('${tok.id}')" class="p-2 text-rose-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors" title="Удалить токен">
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

/**
 * Fetch WB Advertising / Promotion Spend by SKU for the report period
 */
async function fetchWbAdSpendForReport() {
  const activeTokenObj = getActiveApiTokenObj();
  if (!activeTokenObj || !activeTokenObj.token) {
    showApiTokensStatus("Сначала добавьте и выберите активный токен API Wildberries с правами «Продвижение / Реклама»", "error");
    return;
  }

  const token = activeTokenObj.token.trim();

  // Determine date range from input dates or min/max dates of parsed report
  let fromDateStr = '';
  let toDateStr = '';

  const inputFrom = document.getElementById('inputDateFrom')?.value;
  const inputTo = document.getElementById('inputDateTo')?.value;

  if (inputFrom && inputTo) {
    fromDateStr = inputFrom;
    toDateStr = inputTo;
  } else if (minFileDate && maxFileDate) {
    fromDateStr = toLocalInputDate(minFileDate);
    toDateStr = toLocalInputDate(maxFileDate);
  } else {
    // Default to last 30 days
    const endD = new Date();
    const startD = new Date(endD.getTime() - 30 * 24 * 60 * 60 * 1000);
    fromDateStr = toLocalInputDate(startD);
    toDateStr = toLocalInputDate(endD);
  }

  const btnSync = document.getElementById('btnSyncWbAdSpend');
  if (btnSync) {
    btnSync.disabled = true;
    btnSync.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Загрузка расходов из WB API...`;
  }

  showApiTokensStatus(`Запрашиваем рекламные расходы с ${fromDateStr} по ${toDateStr} через Wildberries Advert API...`, "info");

  try {
    const directUrl = `https://advert-api.wildberries.ru/adv/v1/upd?from=${fromDateStr}&to=${toDateStr}`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(directUrl)}`;

    let response = null;
    let usedProxy = false;

    try {
      response = await fetch(directUrl, {
        method: 'GET',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        }
      });
    } catch (corsErr) {
      console.warn("Direct fetch to WB Advert API failed, trying CORS proxy fallback...", corsErr);
      usedProxy = true;
      response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        }
      });
    }

    if (!response || !response.ok) {
      const errText = response ? await response.text() : 'Сетевая ошибка';
      let detailedMsg = `Код ответа WB API: ${response ? response.status : 'Ошибка'}. `;
      if (response && response.status === 401) {
        detailedMsg += 'Неверный или просроченный токен авторизации. Убедитесь, что у токена включена категория «Продвижение / Реклама».';
      } else if (response && response.status === 429) {
        detailedMsg += 'Превышен лимит запросов к API Wildberries. Пожалуйста, подождите 1 минуту и повторите попытку.';
      } else {
        detailedMsg += errText ? errText.substring(0, 150) : 'Проверьте токен и доступность API.';
      }
      showApiTokensStatus(detailedMsg, "error");
      return;
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      showApiTokensStatus(`WB API ответил успешно, но за период с ${fromDateStr} по ${toDateStr} рекламные списания не найдены.`, "warning");
      return;
    }

    // Process and aggregate ad spend per SKU / nmId
    let totalAdSum = 0;
    let matchedSkusCount = 0;
    const newSkuAdMap = {};

    data.forEach(item => {
      // Structure of /adv/v1/upd item: { updTime, advertId, campName, advertType, paymentType, updSum, sum, nmIds: [...] }
      const sumVal = parseNum(item.updSum !== undefined ? item.updSum : (item.sum !== undefined ? item.sum : item.cost));
      if (sumVal <= 0) return;

      totalAdSum += sumVal;

      const nmIds = Array.isArray(item.nmIds) && item.nmIds.length > 0 
        ? item.nmIds 
        : (item.nmId ? [item.nmId] : (item.nms ? item.nms : []));

      if (nmIds.length === 1) {
        const skuStr = String(nmIds[0]).trim();
        newSkuAdMap[skuStr] = (newSkuAdMap[skuStr] || 0) + sumVal;
      } else if (nmIds.length > 1) {
        // Divide proportionally or equally among SKUs in this campaign
        const perSkuSum = sumVal / nmIds.length;
        nmIds.forEach(id => {
          const skuStr = String(id).trim();
          newSkuAdMap[skuStr] = (newSkuAdMap[skuStr] || 0) + perSkuSum;
        });
      } else if (item.advertId) {
        // If nmIds not returned in upd, associate with advertId fallback
        const advKey = `adv_${item.advertId}`;
        newSkuAdMap[advKey] = (newSkuAdMap[advKey] || 0) + sumVal;
      }
    });

    // Merge into skuAdSpendMap
    skuAdSpendMap = newSkuAdMap;
    saveSkuAdSpendToStorage();

    // Apply ad spend to productsList and globalStats.products
    let totalAssignedToReportSkus = 0;
    for (const sku in globalStats.products) {
      const prod = globalStats.products[sku];
      const ad = skuAdSpendMap[sku] || 0;
      prod.adSpend = ad;
      if (ad > 0) {
        matchedSkusCount++;
        totalAssignedToReportSkus += ad;
      }
    }

    // Set overall ad spend input field on overview tab
    const adInput = document.getElementById('inputAdSpend');
    if (adInput) {
      adInput.value = totalAdSum.toFixed(2);
    }

    // Update financials and re-render tables
    if (typeof updateFinancials === 'function') updateFinancials();
    if (typeof applyProductFilters === 'function') applyProductFilters();

    const reportMatchText = matchedSkusCount > 0 
      ? ` Сопоставлено с артикулами в текущем отчете: ${matchedSkusCount} SKU на сумму ${formatCurrency(totalAssignedToReportSkus)}.`
      : '';

    showApiTokensStatus(
      `✅ Успешно получены расходы на рекламу за период ${fromDateStr} — ${toDateStr}! Всего расходов в кабинете WB: <strong>${formatCurrency(totalAdSum)}</strong>.${reportMatchText} Данные внесены в столбец «Реклама» таблицы товаров и учтены в расчете чистой прибыли.`,
      "success"
    );

  } catch (err) {
    console.error("Ошибка при получении расходов из WB API:", err);
    showApiTokensStatus(`Ошибка при обращении к WB API: ${err.message || 'Сетевой сбой'}. Попробуйте повторить запрос позже.`, "error");
  } finally {
    if (btnSync) {
      btnSync.disabled = false;
      btnSync.innerHTML = `<i data-lucide="refresh-cw" class="w-4 h-4"></i> Загрузить расходы на рекламу из WB API`;
      if (window.lucide) lucide.createIcons();
    }
  }
}
