/**
 * WB Finance Analytics - Ad cabinets (WB Promotion API) and ad spend sync
 *
 * Кабинеты: название + API-токен категории «Продвижение», хранятся только в этом браузере.
 * Расходы берутся из GET /adv/v3/fullstats: кампания -> дни -> платформы -> артикулы (поле sum).
 * Лимит метода - 3 запроса в минуту (интервал 20 сек), до 50 кампаний и 31 дня за запрос,
 * статистика есть только у кампаний в статусах 7 (завершена), 9 (активна), 11 (пауза).
 * Запросы идут напрямую в WB: API отдает CORS-заголовки, токен никуда больше не уходит.
 */

const LOCAL_STORAGE_AD_CABINETS_KEY = 'wb_analytics_ad_cabinets';
const LOCAL_STORAGE_AD_STATS_KEY = 'wb_analytics_ad_stats';
const WB_ADVERT_API = 'https://advert-api.wildberries.ru';
const FULLSTATS_INTERVAL_MS = 21000;
const FULLSTATS_MAX_DAYS = 31;
const FULLSTATS_MAX_IDS = 50;
const FULLSTATS_RETRY_MS = 30000;
const FULLSTATS_MAX_RETRIES = 4;

let adCabinets = [];   // { id, name, token, enabled, createdAt, lastSyncAt, lastError }
let adStats = {};      // cabinetId -> { days: { dayKey: { nmId: sum } }, loadedAt: { dayKey: fetchDayKey } }
let adSyncState = { running: false, cancel: false, lines: {} };

try {
  const savedCabinets = localStorage.getItem(LOCAL_STORAGE_AD_CABINETS_KEY);
  if (savedCabinets) {
    const parsed = JSON.parse(savedCabinets);
    if (Array.isArray(parsed)) adCabinets = parsed;
  }
  const savedStats = localStorage.getItem(LOCAL_STORAGE_AD_STATS_KEY);
  if (savedStats) {
    const parsed = JSON.parse(savedStats);
    if (parsed && typeof parsed === 'object') adStats = parsed;
  }
} catch (e) {
  console.error("Ошибка чтения рекламных кабинетов из localStorage:", e);
}

function saveAdCabinets() {
  try {
    localStorage.setItem(LOCAL_STORAGE_AD_CABINETS_KEY, JSON.stringify(adCabinets));
  } catch (e) {
    console.error("Ошибка сохранения рекламных кабинетов в localStorage:", e);
  }
}

function saveAdStats() {
  try {
    localStorage.setItem(LOCAL_STORAGE_AD_STATS_KEY, JSON.stringify(adStats));
  } catch (e) {
    console.error("Ошибка сохранения рекламной статистики в localStorage:", e);
    showAdSettingsAlert('Не хватило места в хранилище браузера для рекламной статистики. Очистите загруженную рекламу.', 'error');
  }
}

function getEnabledAdCabinets() {
  return adCabinets.filter(c => c.enabled);
}

/* ---------- Данные для расчета (используются в ad_cohorts.js) ---------- */

// Расходы по артикулам за день, сумма по включенным кабинетам
function getAdSpendForDay(dayKey) {
  const result = {};
  getEnabledAdCabinets().forEach(cab => {
    const day = adStats[cab.id] && adStats[cab.id].days[dayKey];
    if (!day) return;
    for (const nmId in day) result[nmId] = (result[nmId] || 0) + day[nmId];
  });
  return result;
}

// День загружен, если его статистика есть во всех включенных кабинетах
function isAdDayLoaded(dayKey) {
  const enabled = getEnabledAdCabinets();
  if (enabled.length === 0) return false;
  return enabled.every(cab => adStats[cab.id] && adStats[cab.id].loadedAt && adStats[cab.id].loadedAt[dayKey]);
}

/* ---------- Токены ---------- */

// Токен WB - JWT: из него можно прочитать срок действия, не отправляя его никуда
function decodeWbToken(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function getTokenExpiry(token) {
  const payload = decodeWbToken(token);
  return payload && payload.exp ? new Date(payload.exp * 1000) : null;
}

function maskWbToken(token) {
  if (!token) return '';
  return token.length <= 16 ? '••••' : `${token.slice(0, 6)}…${token.slice(-6)}`;
}

function escapeAdHtml(val) {
  return String(val === undefined || val === null ? '' : val)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---------- Запросы к WB ---------- */

const adSleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function wbAdvertGet(path, token) {
  let res;
  try {
    res = await fetch(WB_ADVERT_API + path, { headers: { Authorization: token } });
  } catch (e) {
    throw new Error('Нет связи с API Wildberries. Проверьте интернет.');
  }
  return res;
}

async function readWbError(res) {
  let detail = '';
  try {
    const body = await res.json();
    detail = body.detail || (body.errors && body.errors[0] && body.errors[0].detail) || body.title || '';
  } catch (e) {}
  if (res.status === 401) return 'Токен недействителен или просрочен (401).';
  if (res.status === 403) return 'У токена нет доступа к категории «Продвижение» (403).';
  return `Ошибка WB ${res.status}${detail ? ': ' + detail : ''}`;
}

// Кампании, у которых может быть статистика за период
async function fetchAdvertIds(cabinet, rangeStartKey) {
  const res = await wbAdvertGet('/adv/v1/promotion/count', cabinet.token);
  if (!res.ok) throw new Error(await readWbError(res));
  const data = await res.json();
  const ids = [];
  const rangeStart = new Date(rangeStartKey + 'T00:00:00');
  (data.adverts || []).forEach(group => {
    if (![7, 9, 11].includes(group.status)) return;
    (group.advert_list || []).forEach(adv => {
      // Завершенная до начала периода кампания статистики за период не даст
      if (group.status === 7 && adv.changeTime && new Date(adv.changeTime) < rangeStart) return;
      ids.push(adv.advertId);
    });
  });
  return Array.from(new Set(ids));
}

async function fetchFullstats(cabinet, ids, beginKey, endKey, onWait) {
  const path = `/adv/v3/fullstats?ids=${ids.join(',')}&beginDate=${beginKey}&endDate=${endKey}`;
  for (let attempt = 0; ; attempt++) {
    const res = await wbAdvertGet(path, cabinet.token);
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
    if (res.status === 429 && attempt < FULLSTATS_MAX_RETRIES) {
      await onWait(FULLSTATS_RETRY_MS, 'лимит WB, повтор');
      continue;
    }
    throw new Error(await readWbError(res));
  }
}

// Дни, которые нужно запросить: не загруженные или загруженные до того, как день закончился
function getDaysToFetch(cabinet, startKey, endKey) {
  const loadedAt = (adStats[cabinet.id] && adStats[cabinet.id].loadedAt) || {};
  const days = [];
  for (let d = startKey; d <= endKey; d = addDaysToKey(d, 1)) {
    const fetchedOn = loadedAt[d];
    if (!fetchedOn || fetchedOn <= addDaysToKey(d, 1)) days.push(d);
  }
  return days;
}

// Подряд идущие дни -> интервалы не длиннее 31 дня
function groupDaysToRanges(days) {
  const ranges = [];
  days.forEach(d => {
    const last = ranges[ranges.length - 1];
    if (last && addDaysToKey(last.end, 1) === d && diffDaysKeys(last.start, d) < FULLSTATS_MAX_DAYS) {
      last.end = d;
    } else {
      ranges.push({ start: d, end: d });
    }
  });
  return ranges;
}

// Период рекламы, нужный загруженному отчету: недели заказов всех его выкупов
function getRequiredAdRange() {
  const base = adCohortState && adCohortState.base;
  if (!base || !base.minOrderKey || !base.maxSaleKey) return null;
  const todayKey = toLocalInputDate(new Date());
  const end = base.maxSaleKey < todayKey ? base.maxSaleKey : todayKey;
  return { start: getWeekStartKey(base.minOrderKey), end: end };
}

async function syncCabinetAdStats(cabinet, range) {
  const setLine = (text, type = 'info') => {
    adSyncState.lines[cabinet.id] = { text: `${cabinet.name}: ${text}`, type };
    renderAdSyncStatus();
  };

  const days = getDaysToFetch(cabinet, range.start, range.end);
  if (days.length === 0) {
    setLine('реклама за период уже загружена', 'success');
    return;
  }

  setLine('получаю список кампаний…');
  const ids = await fetchAdvertIds(cabinet, days[0]);
  const ranges = groupDaysToRanges(days);
  const batches = [];
  for (let i = 0; i < ids.length; i += FULLSTATS_MAX_IDS) batches.push(ids.slice(i, i + FULLSTATS_MAX_IDS));

  if (!adStats[cabinet.id]) adStats[cabinet.id] = { days: {}, loadedAt: {} };
  const store = adStats[cabinet.id];
  const todayKey = toLocalInputDate(new Date());
  const totalRequests = ranges.length * batches.length;
  let requestNo = 0;
  let lastRequestAt = 0;

  const waitWithCountdown = async (ms, reason) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      if (adSyncState.cancel) throw new Error('Загрузка остановлена');
      setLine(`${reason}: ${Math.ceil((until - Date.now()) / 1000)} сек`);
      await adSleep(Math.min(1000, until - Date.now()));
    }
  };

  for (const r of ranges) {
    // Копим ответы интервала отдельно и сохраняем, только когда пришли все пачки кампаний
    const chunkDays = {};
    for (let d = r.start; d <= r.end; d = addDaysToKey(d, 1)) chunkDays[d] = {};

    for (const batch of batches) {
      if (adSyncState.cancel) throw new Error('Загрузка остановлена');
      const sinceLast = Date.now() - lastRequestAt;
      if (lastRequestAt && sinceLast < FULLSTATS_INTERVAL_MS) {
        await waitWithCountdown(FULLSTATS_INTERVAL_MS - sinceLast, `запрос ${requestNo + 1} из ${totalRequests} через`);
      }
      requestNo++;
      setLine(`запрос ${requestNo} из ${totalRequests} (${r.start} — ${r.end})…`);
      lastRequestAt = Date.now();
      const stats = await fetchFullstats(cabinet, batch, r.start, r.end, waitWithCountdown);
      lastRequestAt = Date.now();

      stats.forEach(campaign => {
        (campaign.days || []).forEach(day => {
          const dayKey = String(day.date || '').slice(0, 10);
          if (!chunkDays[dayKey]) return;
          (day.apps || []).forEach(app => {
            (app.nms || []).forEach(nm => {
              const sum = Number(nm.sum) || 0;
              if (!nm.nmId || sum === 0) return;
              chunkDays[dayKey][nm.nmId] = (chunkDays[dayKey][nm.nmId] || 0) + sum;
            });
          });
        });
      });
    }

    for (const dayKey in chunkDays) {
      const rounded = {};
      for (const nmId in chunkDays[dayKey]) rounded[nmId] = Math.round(chunkDays[dayKey][nmId] * 100) / 100;
      store.days[dayKey] = rounded;
      store.loadedAt[dayKey] = todayKey;
    }
    saveAdStats();
  }

  const total = days.reduce((s, d) => s + Object.values(store.days[d] || {}).reduce((a, b) => a + b, 0), 0);
  setLine(`загружено ${days.length} дн., кампаний: ${ids.length}, расходы ${formatCurrency(total)}`, 'success');
}

async function startAdSync() {
  if (adSyncState.running) return;
  const range = getRequiredAdRange();
  const cabinets = getEnabledAdCabinets();
  if (!range) {
    showAdSettingsAlert('Сначала загрузите отчет: период рекламы берется из дат заказов в отчете.', 'error');
    return;
  }
  if (cabinets.length === 0) {
    showAdSettingsAlert('Добавьте кабинет или отметьте галочкой хотя бы один.', 'error');
    return;
  }

  adSyncState = { running: true, cancel: false, lines: {} };
  showAdSettingsAlert('');
  renderAdSettings();

  // Лимит считается на профиль продавца, поэтому кабинеты грузим параллельно
  await Promise.all(cabinets.map(async cab => {
    try {
      await syncCabinetAdStats(cab, range);
      cab.lastSyncAt = new Date().toISOString();
      cab.lastError = '';
    } catch (e) {
      cab.lastError = e.message;
      adSyncState.lines[cab.id] = { text: `${cab.name}: ${e.message}`, type: 'error' };
    }
  }));

  saveAdCabinets();
  adSyncState.running = false;
  renderAdSettings();
  if (typeof refreshAdAllocation === 'function') refreshAdAllocation();
}

function cancelAdSync() {
  if (adSyncState.running) adSyncState.cancel = true;
}

/* ---------- Кабинеты ---------- */

async function handleAddAdCabinet(e) {
  if (e && e.preventDefault) e.preventDefault();
  const nameInput = document.getElementById('adCabinetName');
  const tokenInput = document.getElementById('adCabinetToken');
  const token = (tokenInput?.value || '').trim().replace(/^Bearer\s+/i, '');
  const name = (nameInput?.value || '').trim() || `Кабинет ${adCabinets.length + 1}`;

  if (!token) {
    showAdSettingsAlert('Вставьте API-токен.', 'error');
    return;
  }
  if (adCabinets.some(c => c.token === token)) {
    showAdSettingsAlert('Этот токен уже добавлен.', 'error');
    return;
  }
  const expiry = getTokenExpiry(token);
  if (expiry && expiry < new Date()) {
    showAdSettingsAlert(`Срок действия токена истек ${expiry.toLocaleDateString('ru-RU')}.`, 'error');
    return;
  }

  // Проверяем токен легким запросом списка кампаний
  showAdSettingsAlert('Проверяю токен…', 'info');
  try {
    const res = await wbAdvertGet('/adv/v1/promotion/count', token);
    if (!res.ok) throw new Error(await readWbError(res));
  } catch (err) {
    showAdSettingsAlert(err.message, 'error');
    return;
  }

  adCabinets.push({
    id: 'cab_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name: name,
    token: token,
    enabled: true,
    createdAt: new Date().toISOString(),
    lastSyncAt: '',
    lastError: ''
  });
  saveAdCabinets();
  if (nameInput) nameInput.value = '';
  if (tokenInput) tokenInput.value = '';
  showAdSettingsAlert(`Кабинет «${name}» добавлен.`, 'success');
  renderAdSettings();
  if (typeof refreshAdAllocation === 'function') refreshAdAllocation();
}

function toggleAdCabinet(id, enabled) {
  const cab = adCabinets.find(c => c.id === id);
  if (!cab) return;
  cab.enabled = !!enabled;
  saveAdCabinets();
  renderAdSettings();
  if (typeof refreshAdAllocation === 'function') refreshAdAllocation();
}

function deleteAdCabinet(id) {
  const cab = adCabinets.find(c => c.id === id);
  if (!cab || adSyncState.running) return;
  if (!confirm(`Удалить кабинет «${cab.name}» и его загруженную рекламу?`)) return;
  adCabinets = adCabinets.filter(c => c.id !== id);
  delete adStats[id];
  saveAdCabinets();
  saveAdStats();
  renderAdSettings();
  if (typeof refreshAdAllocation === 'function') refreshAdAllocation();
}

function clearAdStats() {
  if (adSyncState.running) return;
  if (!confirm('Удалить всю загруженную рекламную статистику? Кабинеты и токены останутся.')) return;
  adStats = {};
  saveAdStats();
  renderAdSettings();
  if (typeof refreshAdAllocation === 'function') refreshAdAllocation();
}

/* ---------- Окно настроек ---------- */

function openAdSettingsModal() {
  if (typeof lockBodyScroll === 'function') lockBodyScroll();
  const modal = document.getElementById('modalAdSettings');
  if (!modal) return;
  modal.classList.remove('hidden');
  renderAdSettings();
}

function closeAdSettingsModal() {
  const modal = document.getElementById('modalAdSettings');
  if (modal) modal.classList.add('hidden');
  if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
}

function showAdSettingsAlert(msg, type = 'info') {
  const el = document.getElementById('adSettingsAlert');
  if (!el) return;
  if (!msg) {
    el.className = 'hidden';
    el.textContent = '';
    return;
  }
  const styles = {
    info: 'bg-purple-50 border-purple-200 text-purple-900',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    error: 'bg-rose-50 border-rose-200 text-rose-900'
  };
  el.className = `p-3 rounded-xl border text-xs font-medium ${styles[type] || styles.info}`;
  el.textContent = msg;
}

function getCabinetLoadedSummary(cab) {
  const store = adStats[cab.id];
  const days = store ? Object.keys(store.loadedAt || {}).sort() : [];
  if (days.length === 0) return 'реклама не загружена';
  const fmt = (k) => k.slice(8, 10) + '.' + k.slice(5, 7) + '.' + k.slice(0, 4);
  return `загружено ${days.length} дн. (${fmt(days[0])} — ${fmt(days[days.length - 1])})`;
}

function renderAdCabinetsList() {
  const container = document.getElementById('adCabinetsList');
  if (!container) return;
  setText('adCabinetsCount', adCabinets.length);

  if (adCabinets.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
        Кабинетов пока нет. Добавьте токен выше.
      </div>`;
    return;
  }

  container.innerHTML = adCabinets.map(cab => {
    const expiry = getTokenExpiry(cab.token);
    const expired = expiry && expiry < new Date();
    const expiryText = expiry
      ? `<span class="${expired ? 'text-rose-600 font-semibold' : 'text-slate-400'}">токен до ${expiry.toLocaleDateString('ru-RU')}</span>`
      : '';
    const errorText = cab.lastError ? `<p class="text-[11px] text-rose-600 mt-0.5">${escapeAdHtml(cab.lastError)}</p>` : '';
    return `
      <label class="flex items-start gap-3 p-3 rounded-xl border ${cab.enabled ? 'border-purple-200 bg-purple-50/50' : 'border-slate-200 bg-white'} cursor-pointer transition-colors">
        <input type="checkbox" ${cab.enabled ? 'checked' : ''} ${adSyncState.running ? 'disabled' : ''}
               onchange="toggleAdCabinet('${cab.id}', this.checked)"
               class="mt-0.5 rounded text-purple-600 focus:ring-purple-500">
        <div class="flex-1 min-w-0 text-xs">
          <p class="font-semibold text-slate-800 truncate">${escapeAdHtml(cab.name)}</p>
          <p class="text-[11px] text-slate-400 font-mono">${escapeAdHtml(maskWbToken(cab.token))}</p>
          <p class="text-[11px] text-slate-500 mt-0.5">${getCabinetLoadedSummary(cab)} ${expiryText ? '· ' + expiryText : ''}</p>
          ${errorText}
        </div>
        <button type="button" onclick="event.preventDefault(); event.stopPropagation(); deleteAdCabinet('${cab.id}')"
                class="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors shrink-0" title="Удалить кабинет">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </label>`;
  }).join('');
}

function renderAdSyncStatus() {
  const el = document.getElementById('adSyncStatus');
  if (!el) return;
  const lines = Object.values(adSyncState.lines);
  if (lines.length === 0) {
    el.innerHTML = '';
    return;
  }
  const colors = { info: 'text-slate-600', success: 'text-emerald-700', error: 'text-rose-600' };
  el.innerHTML = lines.map(l => `<p class="${colors[l.type] || colors.info}">${escapeAdHtml(l.text)}</p>`).join('');
}

function renderAdSyncControls() {
  const range = getRequiredAdRange();
  const fmt = (k) => k.slice(8, 10) + '.' + k.slice(5, 7) + '.' + k.slice(0, 4);
  setText('adRequiredRange', range ? `${fmt(range.start)} — ${fmt(range.end)}` : 'загрузите отчет');

  const btnSync = document.getElementById('btnAdSync');
  const btnCancel = document.getElementById('btnAdSyncCancel');
  const btnClear = document.getElementById('btnAdClear');
  if (btnSync) {
    btnSync.disabled = adSyncState.running || !range || getEnabledAdCabinets().length === 0;
    btnSync.classList.toggle('hidden', adSyncState.running);
  }
  if (btnCancel) btnCancel.classList.toggle('hidden', !adSyncState.running);
  if (btnClear) btnClear.disabled = adSyncState.running;
}

function renderAdSettingsCohorts() {
  const tbody = document.getElementById('adCohortsTableBody');
  const summary = document.getElementById('adCohortsSummary');
  if (!tbody) return;

  const state = adCohortState;
  if (!state || !state.weeks || state.weeks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400">Загрузите отчет, чтобы увидеть недели заказов</td></tr>`;
    if (summary) summary.innerHTML = '';
    return;
  }

  tbody.innerHTML = state.weeks.map(w => {
    const noData = w.coverage === 0;
    const partial = w.coverage > 0 && w.coverage < 1;
    const lowCompleteness = w.completeness < AD_COHORT_MIN_COMPLETENESS;
    const completenessPct = Math.round(w.completeness * 100);
    const completenessClass = lowCompleteness ? 'text-amber-600' : (w.completeness >= 0.9 ? 'text-emerald-600' : 'text-slate-700');
    const adCell = noData
      ? '<span class="text-slate-300">нет данных</span>'
      : formatCurrency(w.ad) + (partial ? ' <span class="text-[10px] text-amber-600">(не все дни)</span>' : '');
    const cpuCell = w.cpu === null
      ? '<span class="text-slate-300">—</span>'
      : formatCurrency(w.cpu) + (lowCompleteness ? ' <span class="text-[10px] text-amber-600" title="Видна малая доля выкупов - для штук этой недели берется средняя стоимость выкупа артикула">≈ ср.</span>' : '');
    return `
      <tr class="hover:bg-slate-50">
        <td class="py-2 px-3 font-medium whitespace-nowrap">${w.label}</td>
        <td class="py-2 px-3 text-right whitespace-nowrap">${adCell}</td>
        <td class="py-2 px-3 text-right">${w.observed}</td>
        <td class="py-2 px-3 text-right font-semibold ${completenessClass}">${completenessPct}%</td>
        <td class="py-2 px-3 text-right">${w.expected.toFixed(1)}</td>
        <td class="py-2 px-3 text-right font-semibold whitespace-nowrap">${cpuCell}</td>
      </tr>`;
  }).join('');

  if (summary) {
    const allocated = globalStats.apiAdSpendSum || 0;
    const units = globalStats.apiAdUnitsWithAd || 0;
    const noDataUnits = globalStats.apiAdUnitsWithoutData || 0;
    summary.innerHTML = state.hasAdData
      ? `На выкупы выбранного периода отнесено <strong class="text-slate-900">${formatCurrency(allocated)}</strong> рекламы (${units} шт.)` +
        (noDataUnits > 0 ? `, у <strong class="text-amber-700">${noDataUnits} шт.</strong> нет рекламных данных за неделю заказа` : '') +
        `. Реклама за все недели: ${formatCurrency(state.totalAd)} — остаток приходится на выкупы вне периода и еще не выкупленные заказы. Эта реклама учитывается в прибыли артикулов (вкладка SKU и карточка товара); в сводке она не вычитается — WB уже удержал ее в отчете (Удержания, BI).`
      : 'Реклама еще не загружена: добавьте кабинет и нажмите «Загрузить рекламу».';
  }
}

function renderAdSettings() {
  renderAdCabinetsList();
  renderAdSyncControls();
  renderAdSyncStatus();
  renderAdSettingsCohorts();
  if (window.lucide) lucide.createIcons();
}
