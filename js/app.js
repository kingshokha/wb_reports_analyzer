/**
 * WB Finance Analytics - Main Application Entry Point & Event Bindings
 */

function initEvents() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const mergerDropzone = document.getElementById('mergerDropzone');
  const mergerFileInput = document.getElementById('mergerFileInput');
  const inputAdSpend = document.getElementById('inputAdSpend');
  const inputOtherSpend = document.getElementById('inputOtherSpend');
  const productSearch = document.getElementById('productSearch');
  const cogsSearch = document.getElementById('cogsSearch');
  const selectPeriodPreset = document.getElementById('selectPeriodPreset');
  const btnApplyPeriod = document.getElementById('btnApplyPeriod');

  if (dropzone) {
    dropzone.addEventListener('click', () => fileInput && fileInput.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-purple-500', 'bg-purple-50/20');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-purple-500', 'bg-purple-50/20');
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-purple-500', 'bg-purple-50/20');
      if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) {
        handleFile(e.target.files[0]);
      }
    });
  }

  if (mergerDropzone) {
    mergerDropzone.addEventListener('click', () => mergerFileInput && mergerFileInput.click());
    mergerDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      mergerDropzone.classList.add('border-purple-500', 'bg-purple-100/40');
    });
    mergerDropzone.addEventListener('dragleave', () => {
      mergerDropzone.classList.remove('border-purple-500', 'bg-purple-100/40');
    });
    mergerDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      mergerDropzone.classList.remove('border-purple-500', 'bg-purple-100/40');
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        addFilesToMerger(e.dataTransfer.files);
      }
    });
  }

  if (mergerFileInput) {
    mergerFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length) {
        addFilesToMerger(e.target.files);
        e.target.value = '';
      }
    });
  }

  if (inputAdSpend) inputAdSpend.addEventListener('input', () => updateFinancials());
  if (inputOtherSpend) inputOtherSpend.addEventListener('input', () => updateFinancials());
  const inputTaxRate = document.getElementById('inputTaxRate');
  if (inputTaxRate) inputTaxRate.addEventListener('input', () => updateFinancials());

  if (productSearch) {
    productSearch.addEventListener('input', () => {
      applyProductFilters();
    });
  }

  if (cogsSearch) {
    cogsSearch.addEventListener('input', () => {
      cogsCurrentPage = 1;
      renderCogsTable();
    });
  }

  const prevBtn = document.getElementById('btnPrevPage');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderProductTable();
      }
    });
  }

  const nextBtn = document.getElementById('btnNextPage');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentPage * itemsPerPage < filteredProducts.length) {
        currentPage++;
        renderProductTable();
      }
    });
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('border-purple-600', 'text-purple-600');
        b.classList.add('text-slate-500', 'border-transparent');
      });
      btn.classList.add('border-purple-600', 'text-purple-600');
      btn.classList.remove('text-slate-500', 'border-transparent');

      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      const targetTab = document.getElementById(btn.dataset.tab);
      if (targetTab) targetTab.classList.remove('hidden');
      
      if (btn.dataset.tab === 'tab-cogs') {
        renderCogsTable();
      }
      
      if (window.lucide) lucide.createIcons();
    });
  });

  if (selectPeriodPreset) {
    selectPeriodPreset.addEventListener('change', () => {
      const customInputs = document.getElementById('customDateInputs');
      if (selectPeriodPreset.value === 'custom') {
        customInputs.classList.remove('hidden');
      } else {
        customInputs.classList.add('hidden');
        if (lastLoadedRows) {
          processRows(lastLoadedRows, true);
        }
      }
    });
  }

  if (btnApplyPeriod) {
    btnApplyPeriod.addEventListener('click', () => {
      if (lastLoadedRows) {
        processRows(lastLoadedRows, true);
      }
    });
  }

  const btnExportSKU = document.getElementById('btnExportSKU');
  if (btnExportSKU) {
    btnExportSKU.addEventListener('click', () => exportSKUTableCSV());
  }

  window.addEventListener('click', function(e) {
    const modalTur = document.getElementById('modalTurnover');
    if (e.target === modalTur) closeTurnoverModal();

    const modalFee = document.getElementById('modalFees');
    if (e.target === modalFee) closeFeesModal();

    const modalPay = document.getElementById('modalTotalWbPayable');
    if (e.target === modalPay) closeTotalWbPayableModal();

    const modalExp = document.getElementById('modalExpenses');
    if (e.target === modalExp) closeExpensesModal();

    const modalDed = document.getElementById('modalDeductions');
    if (e.target === modalDed) closeDeductionsModal();

    const modalMrg = document.getElementById('modalMerger');
    if (e.target === modalMrg) closeMergerModal();

    const modalRet = document.getElementById('modalReturns');
    if (e.target === modalRet) closeReturnsModal();

    const modalSppEl = document.getElementById('modalSpp');
    if (e.target === modalSppEl) closeSppModal();

    const dd = document.getElementById('columnFilterDropdown');
    const btnCol = document.getElementById('btnColumnFilter');
    if (dd && !dd.classList.contains('hidden')) {
      if (!dd.contains(e.target) && (!btnCol || !btnCol.contains(e.target))) {
        dd.classList.add('hidden');
      }
    }

    const catDd = document.getElementById('categoryFilterDropdown');
    const btnCat = document.getElementById('btnCategoryFilter');
    if (catDd && !catDd.classList.contains('hidden')) {
      if (!catDd.contains(e.target) && (!btnCat || !btnCat.contains(e.target))) {
        catDd.classList.add('hidden');
      }
    }
  });
}

window.onload = function() {
  loadSkuCogsFromStorage();
  initEvents();
  if (window.lucide) lucide.createIcons();
};
