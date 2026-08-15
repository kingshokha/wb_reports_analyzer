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

function showApiTokensProgress(currentChunkIndex, totalChunks, currentChunk, currentSum, percent) {
  const el = document.getElementById('apiTokensStatusAlert');
  if (!el) return;

  el.className = `p-5 rounded-2xl border bg-purple-50/80 text-purple-950 border-purple-200 flex flex-col gap-3 text-xs leading-relaxed transition-all shadow-sm`;
  el.innerHTML = `
    <div class="flex items-center justify-between font-bold">
      <div class="flex items-center gap-2">
        <i data-lucide="loader-2" class="w-4 h-4 text-purple-600 animate-spin"></i>
        <span>Выгрузка из WB API: интервал ${currentChunkIndex} из ${totalChunks}</span>
      </div>
      <span class="text-purple-700">${percent}%</span>
    </div>

    <!-- Progress bar -->
    <div class="w-full bg-purple-200/60 rounded-full h-2 overflow-hidden">
      <div class="bg-gradient-to-r from-purple-600 to-indigo-600 h-2 rounded-full transition-all duration-300" style="width: ${percent}%"></div>
    </div>

    <div class="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-1 pt-1">
      <div>Текущий период: <strong>${currentChunk.fromFormatted} — ${currentChunk.toFormatted}</strong></div>
      <div>Накоплено расходов: <strong class="text-purple-900">${formatCurrency(currentSum)}</strong></div>
    </div>
  `;
  el.classList.remove('hidden');

  if (window.lucide) lucide.createIcons();
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
 * Fetch WB Advertising / Promotion Spend by SKU for the report period with chunking & rate limit handling
 */
async function fetchWbAdSpendForReport() {
  const activeTokenObj = getActiveApiTokenObj();
  if (!activeTokenObj || !activeTokenObj.token) {
    showApiTokensStatus("Сначала добавьте и выберите активный токен API Wildberries с правами «Продвижение / Реклама»", "error");
    return;
  }

  const token = activeTokenObj.token.trim();

  // Determine date range from input dates or min/max dates of parsed report
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
    // Default to last 30 days
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

  // Split into <= 30-day chunks
  const chunks = splitDateRangeIntoChunks(startDate, endDate, 30);

  const btnSync = document.getElementById('btnSyncWbAdSpend');
  if (btnSync) {
    btnSync.disabled = true;
    btnSync.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Выгрузка расходов...`;
  }

  const allRecords = [];
  let totalAdSum = 0;

  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const progressPercent = Math.round(((i) / chunks.length) * 100);

      // Inform user about current chunk progress
      showApiTokensProgress(i + 1, chunks.length, chunk, totalAdSum, progressPercent);
      if (btnSync) {
        btnSync.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Интервал ${i + 1}/${chunks.length} (${progressPercent}%)...`;
      }

      // Respect WB API rate limit: polite delay of 450ms between chunk calls
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 450));
      }

      const directUrl = `https://advert-api.wildberries.ru/adv/v1/upd?from=${chunk.from}&to=${chunk.to}`;
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(directUrl)}`;

      let response = null;
      let usedProxy = false;

      const makeRequest = async (targetUrl) => {
        return fetch(targetUrl, {
          method: 'GET',
          headers: {
            'Authorization': token,
            'Content-Type': 'application/json'
          }
        });
      };

      try {
        response = await makeRequest(directUrl);
      } catch (corsErr) {
        usedProxy = true;
        response = await makeRequest(proxyUrl);
      }

      // Handle 429 Too Many Requests with automatic retry after 2.5s
      if (response && response.status === 429) {
        showApiTokensStatus(`Лимит запросов WB API: ожидание 2.5 сек перед повтором интервала ${chunk.fromFormatted} — ${chunk.toFormatted}...`, "warning");
        await new Promise(resolve => setTimeout(resolve, 2500));
        response = await makeRequest(usedProxy ? proxyUrl : directUrl);
      }

      if (!response || !response.ok) {
        const errText = response ? await response.text() : 'Сетевая ошибка';
        let detailedMsg = `Ошибка при выгрузке интервала ${chunk.fromFormatted} — ${chunk.toFormatted} (Код ${response ? response.status : 'ERR'}): `;
        if (response && response.status === 401) {
          detailedMsg += 'Неверный токен. Убедитесь, что токен активен и имеет права категории «Продвижение / Реклама».';
        } else if (response && response.status === 429) {
          detailedMsg += 'Превышен лимит запросов к WB API. Подождите минуту и повторите попытку.';
        } else {
          detailedMsg += errText ? errText.substring(0, 150) : 'Проверьте доступность API.';
        }
        showApiTokensStatus(detailedMsg, "error");
        return;
      }

      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        data.forEach(rec => {
          allRecords.push(rec);
          const sumVal = parseNum(rec.updSum !== undefined ? rec.updSum : (rec.sum !== undefined ? rec.sum : rec.cost));
          if (sumVal > 0) totalAdSum += sumVal;
        });
      }
    }

    // Process and aggregate all records across all chunks
    if (allRecords.length === 0) {
      showApiTokensStatus(
        `Запрос выполнен успешно (${chunks.length} ${chunks.length === 1 ? 'интервал' : 'интервала'}, ${formatDate(startDate)} — ${formatDate(endDate)}), но рекламных списаний в кабинете WB за этот период не найдено.`,
        "warning"
      );
      return;
    }

    const newSkuAdMap = {};
    let matchedSkusCount = 0;

    allRecords.forEach(item => {
      const sumVal = parseNum(item.updSum !== undefined ? item.updSum : (item.sum !== undefined ? item.sum : item.cost));
      if (sumVal <= 0) return;

      const nmIds = Array.isArray(item.nmIds) && item.nmIds.length > 0 
        ? item.nmIds 
        : (item.nmId ? [item.nmId] : (item.nms ? item.nms : []));

      if (nmIds.length === 1) {
        const skuStr = String(nmIds[0]).trim();
        newSkuAdMap[skuStr] = (newSkuAdMap[skuStr] || 0) + sumVal;
      } else if (nmIds.length > 1) {
        const perSkuSum = sumVal / nmIds.length;
        nmIds.forEach(id => {
          const skuStr = String(id).trim();
          newSkuAdMap[skuStr] = (newSkuAdMap[skuStr] || 0) + perSkuSum;
        });
      } else if (item.advertId) {
        const advKey = `adv_${item.advertId}`;
        newSkuAdMap[advKey] = (newSkuAdMap[advKey] || 0) + sumVal;
      }
    });

    // Merge into global map and storage
    skuAdSpendMap = newSkuAdMap;
    saveSkuAdSpendToStorage();

    // Assign to report products
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
      ? ` Сопоставлено с товарами в текущем отчете: ${matchedSkusCount} SKU на сумму ${formatCurrency(totalAssignedToReportSkus)}.`
      : '';

    showApiTokensStatus(
      `✅ Успешно выгружено ${chunks.length} ${chunks.length === 1 ? 'интервал' : 'интервалов'} за период <strong>${formatDate(startDate)} — ${formatDate(endDate)}</strong>! Всего рекламных затрат: <strong>${formatCurrency(totalAdSum)}</strong>.${reportMatchText} Данные внесены в столбец «Реклама» таблицы товаров и учтены в расчете чистой прибыли.`,
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
