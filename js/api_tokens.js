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

      // 2A. Method requested by user: GET https://advert-api.wildberries.ru/adv/v3/fullstats
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
