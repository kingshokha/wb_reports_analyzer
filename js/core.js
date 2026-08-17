/**
 * WB Finance Analytics - Core State, Formatting, and Storage
 */

function letterToIdx(letter) {
  if (!letter) return 0;
  let clean = String(letter).toUpperCase().trim();
  let col = 0;
  for (let i = 0; i < clean.length; i++) {
    col = col * 26 + (clean.charCodeAt(i) - 64);
  }
  return col - 1;
}

function idxToLetter(idx) {
  if (idx === undefined || idx === null || isNaN(idx)) return '';
  let temp = idx;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

let COL_MAP = {
  C:  letterToIdx('C'),   // 2 - Категория / Предмет
  D:  letterToIdx('D'),   // 3 - Артикул WB
  F:  letterToIdx('F'),   // 5 - Артикул продавца
  G:  letterToIdx('G'),   // 6 - Название товара
  K:  letterToIdx('K'),   // 10 - Обоснование для оплаты
  M:  letterToIdx('M'),   // 12 - Дата операции
  O:  letterToIdx('O'),   // 14 - Розничная цена (для расчета налога)
  T:  letterToIdx('T'),   // 19 - Цена розничная с учетом скидки (сумма выкупа)
  W:  letterToIdx('W'),   // 22 - СПП, %
  X:  letterToIdx('X'),   // 23 - Комиссия WB, % (кВВ)
  AC: letterToIdx('AC'),  // 28 - Эквайринг (руб.)
  AH: letterToIdx('AH'),  // 33 - К перечислению за товар
  AK: letterToIdx('AK'),  // 36 - Логистика
  AO: letterToIdx('AO'),  // 40 - Штрафы
  AP: letterToIdx('AP'),  // 41 - Конструктор тарифов
  AQ: letterToIdx('AQ'),  // 42 - Виды логистики / пояснения удержаний
  BH: letterToIdx('BH'),  // 59 - Хранение
  BI: letterToIdx('BI'),  // 60 - Прочие удержания
  BJ: letterToIdx('BJ')   // 61 - Приемка
};

const LOCAL_STORAGE_COGS_KEY = 'wb_reports_sku_cogs_map';
const LOCAL_STORAGE_FF_KEY = 'wb_reports_sku_ff_map';
const LOCAL_STORAGE_API_TOKENS_KEY = 'wb_analytics_api_tokens';
const LOCAL_STORAGE_ACTIVE_TOKEN_ID_KEY = 'wb_analytics_active_token_id';
const LOCAL_STORAGE_SKU_AD_SPEND_KEY = 'wb_analytics_sku_ad_spend';

let lastLoadedRows = null;
let minFileDate = null;
let maxFileDate = null;
let skuCogsMap = {};
let skuFfMap = {};
let skuAdSpendMap = {};
let apiTokensList = [];
let activeApiTokenId = null;
let mergerFiles = [];

let globalStats = {
  turnover: 0,
  salesCount: 0,
  returnsCount: 0,
  returnsSum: 0,
  returnsList: [],
  categorySpp: {},
  commissionSum: 0,
  acquiringSum: 0,
  logisticsSum: 0,
  storageSum: 0,
  payoutSum: 0,
  salesPayoutSum: 0,
  returnsPayoutSum: 0,
  finesSum: 0,
  tariffDesignerSum: 0,
  deductionsSum: 0,
  deductionsList: [],
  acceptanceSum: 0,
  taxSum: 0,
  sppAvg: 0,
  logisticsBreakdown: {},
  dailyTimeline: {},
  products: {}
};

let productsList = [];
let filteredProducts = [];
let currentPage = 1;
let cogsCurrentPage = 1;
let itemsPerPage = 50;
let currentSortField = 'sold';
let currentSortDirection = 'desc';

let cogsSortField = 'name';
let cogsSortDirection = 'asc';

let financeChartInstance = null;
let logisticsChartInstance = null;
let dailyTimelineChartInstance = null;

function loadSkuCogsFromStorage() {
  try {
    const rawCogsKeys = [LOCAL_STORAGE_COGS_KEY, 'sku_cogs_map', 'wb_cogs_map', 'cogsMap'];
    const rawFfKeys = [LOCAL_STORAGE_FF_KEY, 'sku_ff_map', 'wb_ff_map', 'ffMap'];

    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.toLowerCase().includes('cogs') || k.toLowerCase().includes('sebes'))) {
          if (!rawCogsKeys.includes(k)) rawCogsKeys.push(k);
        }
        if (k && (k.toLowerCase().includes('ff') || k.toLowerCase().includes('fulfil'))) {
          if (!rawFfKeys.includes(k)) rawFfKeys.push(k);
        }
      }
    }

    const mergedCogs = {};
    rawCogsKeys.forEach(key => {
      try {
        const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            for (const itemKey in parsed) {
              const val = parseNum(parsed[itemKey]);
              if (val > 0) {
                mergedCogs[itemKey] = val;
                const cleanKey = String(itemKey).trim();
                const numKey = String(parseInt(cleanKey, 10) || '');
                if (cleanKey) mergedCogs[cleanKey] = val;
                if (numKey && !isNaN(parseInt(cleanKey, 10))) mergedCogs[numKey] = val;
              }
            }
          }
        }
      } catch (e) {}
    });
    skuCogsMap = mergedCogs;

    const mergedFf = {};
    rawFfKeys.forEach(key => {
      try {
        const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            for (const itemKey in parsed) {
              const val = parseNum(parsed[itemKey]);
              if (val > 0) {
                mergedFf[itemKey] = val;
                const cleanKey = String(itemKey).trim();
                const numKey = String(parseInt(cleanKey, 10) || '');
                if (cleanKey) mergedFf[cleanKey] = val;
                if (numKey && !isNaN(parseInt(cleanKey, 10))) mergedFf[numKey] = val;
              }
            }
          }
        }
      } catch (e) {}
    });
    skuFfMap = mergedFf;

    if (typeof saveSkuCogsToStorage === 'function') saveSkuCogsToStorage();

  } catch (e) {
    console.error("Ошибка восстановления себестоимости из localStorage:", e);
  }
}

function saveSkuCogsToStorage() {
  try {
    localStorage.setItem(LOCAL_STORAGE_COGS_KEY, JSON.stringify(skuCogsMap));
    localStorage.setItem(LOCAL_STORAGE_FF_KEY, JSON.stringify(skuFfMap));
  } catch (e) {
    console.error("Ошибка сохранения себестоимости и ФФ в localStorage:", e);
  }
}

function loadApiTokensFromStorage() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_API_TOKENS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) apiTokensList = parsed;
    }
    const savedActiveId = localStorage.getItem(LOCAL_STORAGE_ACTIVE_TOKEN_ID_KEY);
    if (savedActiveId) {
      activeApiTokenId = savedActiveId;
    } else if (apiTokensList.length > 0) {
      activeApiTokenId = apiTokensList[0].id;
    }
  } catch (e) {
    console.error("Ошибка чтения API токенов из localStorage:", e);
  }
}

function saveApiTokensToStorage() {
  try {
    localStorage.setItem(LOCAL_STORAGE_API_TOKENS_KEY, JSON.stringify(apiTokensList));
    if (activeApiTokenId) {
      localStorage.setItem(LOCAL_STORAGE_ACTIVE_TOKEN_ID_KEY, activeApiTokenId);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_ACTIVE_TOKEN_ID_KEY);
    }
  } catch (e) {
    console.error("Ошибка сохранения API токенов в localStorage:", e);
  }
}

function loadSkuAdSpendFromStorage() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_SKU_AD_SPEND_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') skuAdSpendMap = parsed;
    }
  } catch (e) {
    console.error("Ошибка чтения расходов рекламы из localStorage:", e);
  }
}

function saveSkuAdSpendToStorage() {
  try {
    localStorage.setItem(LOCAL_STORAGE_SKU_AD_SPEND_KEY, JSON.stringify(skuAdSpendMap));
  } catch (e) {
    console.error("Ошибка сохранения расходов рекламы в localStorage:", e);
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

function formatCurrency(val) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function parseNum(val) {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  let str = String(val).replace(/\s/g, '').replace(/,/g, '.');
  let num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function toLocalInputDate(date) {
  if (!date || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    let d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }
  let str = String(val).trim();
  if (!str || str === '—' || str === '-') return null;

  // Match Russian date DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY with optional time
  const matchRu = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (matchRu) {
    const day = parseInt(matchRu[1], 10);
    const month = parseInt(matchRu[2], 10) - 1;
    const year = parseInt(matchRu[3], 10);
    const hours = matchRu[4] ? parseInt(matchRu[4], 10) : 0;
    const mins = matchRu[5] ? parseInt(matchRu[5], 10) : 0;
    const secs = matchRu[6] ? parseInt(matchRu[6], 10) : 0;
    const d = new Date(year, month, day, hours, mins, secs);
    return isNaN(d.getTime()) ? null : d;
  }

  // Match ISO date YYYY-MM-DD or YYYY.MM.DD or YYYY/MM/DD with optional time
  const matchIso = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (matchIso) {
    const year = parseInt(matchIso[1], 10);
    const month = parseInt(matchIso[2], 10) - 1;
    const day = parseInt(matchIso[3], 10);
    const hours = matchIso[4] ? parseInt(matchIso[4], 10) : 0;
    const mins = matchIso[5] ? parseInt(matchIso[5], 10) : 0;
    const secs = matchIso[6] ? parseInt(matchIso[6], 10) : 0;
    const d = new Date(year, month, day, hours, mins, secs);
    return isNaN(d.getTime()) ? null : d;
  }

  let d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(val) {
  if (!val) return '—';
  if (typeof val === 'string') return val;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '—';
    const day = String(val.getDate()).padStart(2, '0');
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const year = val.getFullYear();
    return `${day}.${month}.${year}`;
  }
  return String(val);
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function splitCsvLine(line, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i+1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result.map(val => {
    let clean = val.trim();
    if (clean.startsWith('"') && clean.endsWith('"')) {
      clean = clean.slice(1, -1);
    }
    return clean.replace(/""/g, '"');
  });
}

function parseCSV(text) {
  let delimiter = ',';
  if (text.includes(';')) {
    const commaCount = (text.match(/,/g) || []).length;
    const semiCount = (text.match(/;/g) || []).length;
    if (semiCount > commaCount) delimiter = ';';
  }
  
  const lines = [];
  let row = [];
  let inQuotes = false;
  let current = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i+1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(current);
      lines.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }
  if (current || row.length > 0) {
    row.push(current);
    lines.push(row);
  }
  
  return lines.map(r => r.map(cell => cell.trim()))
              .filter(r => r.length > 0 && r.some(cell => cell !== ''));
}

function decodeText(arrayBuffer) {
  const uint8 = new Uint8Array(arrayBuffer);
  let isUtf8 = true;
  let i = 0;
  while (i < uint8.length) {
    if (uint8[i] <= 0x7F) {
      i += 1;
    } else if (uint8[i] >= 0xC2 && uint8[i] <= 0xDF && uint8[i+1] >= 0x80 && uint8[i+1] <= 0xBF) {
      i += 2;
    } else if (uint8[i] === 0xE0 && uint8[i+1] >= 0xA0 && uint8[i+1] <= 0xBF && uint8[i+2] >= 0x80 && uint8[i+2] <= 0xBF) {
      i += 3;
    } else if (uint8[i] >= 0xE1 && uint8[i] <= 0xEF && uint8[i+1] >= 0x80 && uint8[i+1] <= 0xBF && uint8[i+2] >= 0x80 && uint8[i+2] <= 0xBF) {
      i += 3;
    } else {
      isUtf8 = false;
      break;
    }
  }
  const decoder = new TextDecoder(isUtf8 ? 'utf-8' : 'windows-1251');
  return decoder.decode(uint8);
}

function changeItemsPerPage(val) {
  itemsPerPage = parseInt(val, 10) || 50;
  currentPage = 1;
  cogsCurrentPage = 1;

  const selSKU = document.getElementById('selectItemsPerPage');
  if (selSKU) selSKU.value = itemsPerPage;
  const selCogs = document.getElementById('selectCogsItemsPerPage');
  if (selCogs) selCogs.value = itemsPerPage;

  if (typeof renderProductTable === 'function') renderProductTable();
  if (typeof renderCogsTable === 'function') renderCogsTable();
}

function lockBodyScroll() {
  document.body.classList.add('overflow-hidden');
}

function unlockBodyScroll() {
  const modalRootIds = [
    'modalTurnover',
    'modalFees',
    'modalTotalWbPayable',
    'modalExpenses',
    'modalDeductions',
    'modalMerger',
    'modalReturns',
    'modalSpp',
    'modalCogsImport',
    'modalProductTimeline'
  ];
  const hasOpenModal = modalRootIds.some(id => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('hidden');
  });

  if (!hasOpenModal) {
    document.body.classList.remove('overflow-hidden');
  }
}

