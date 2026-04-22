// ===== App Entry & Router =====
let currentPage = null;
let autoOpenCamera = false; // Global flag for camera shortcut

async function init() {
  await openDB();
  await initDefaultData();
  await requestPersistentStorage();
  window.addEventListener('hashchange', route);
  route();
}

// Request persistent storage to prevent browser from clearing IndexedDB
async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    try {
      const granted = await navigator.storage.persist();
      if (!granted) {
        // Check if we should show a one-time hint
        const hintKey = 'rf_persist_hint_shown';
        if (!localStorage.getItem(hintKey)) {
          // Will show hint after first page render
          setTimeout(() => {
            showToast('提示：添加到主屏幕可防止数据丢失', 4000);
            localStorage.setItem(hintKey, '1');
          }, 1500);
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }
}

function route() {
  const hash = location.hash || '#/';
  const container = document.getElementById('page-container');

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });

  // Determine current tab
  let tab = 'home';
  if (hash.includes('/transactions')) tab = 'transactions';
  else if (hash.includes('/invoices')) tab = 'invoices';
  else if (hash.includes('/settings') || hash.includes('/categories')) tab = 'settings';

  const navItem = document.querySelector(`.nav-item[data-tab="${tab}"]`);
  if (navItem) navItem.classList.add('active');

  // Show/hide bottom nav (hide on detail/form pages)
  const bottomNav = document.getElementById('bottom-nav');
  const isSubPage = hash.includes('/add') || hash.includes('/edit') || hash.includes('/detail');
  bottomNav.style.display = isSubPage ? 'none' : 'flex';
  container.style.paddingBottom = isSubPage ? '0' : `calc(var(--nav-height) + var(--safe-bottom) + 8px)`;

  // Route to page
  if (hash === '#/' || hash === '#') {
    renderHomePage(container);
  } else if (hash === '#/transactions') {
    renderTransactionListPage(container);
  } else if (hash === '#/transactions/add') {
    renderTransactionAddPage(container);
  } else if (hash.startsWith('#/transactions/edit/')) {
    const id = parseInt(hash.split('/').pop());
    renderTransactionAddPage(container, id);
  } else if (hash.startsWith('#/transactions/detail/')) {
    const id = parseInt(hash.split('/').pop());
    renderTransactionDetailPage(container, id);
  } else if (hash === '#/invoices') {
    renderInvoiceListPage(container);
  } else if (hash === '#/invoices/add') {
    renderInvoiceAddPage(container);
  } else if (hash.startsWith('#/invoices/edit/')) {
    const id = parseInt(hash.split('/').pop());
    renderInvoiceAddPage(container, null, id);
  } else if (hash.startsWith('#/invoices/detail/')) {
    const id = parseInt(hash.split('/').pop());
    renderInvoiceDetailPage(container, id);
  } else if (hash === '#/settings' || hash === '#/categories') {
    renderCategoryManagePage(container);
  } else {
    renderHomePage(container);
  }
}

// ===== EXPORT MODAL =====
function showExportModal() {
  const existing = document.getElementById('export-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'export-modal';
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="confirm-box" style="max-width:300px">
      <p style="font-size:16px;font-weight:600;margin-bottom:16px;">选择导出内容</p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="btn btn-primary" id="export-tx-btn" style="width:100%">导出交易记录</button>
        <button class="btn btn-outline" id="export-inv-btn" style="width:100%">导出发票记录</button>
        <button class="btn btn-cancel" onclick="this.closest('.modal').remove()" style="width:100%">取消</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('export-tx-btn').addEventListener('click', async () => {
    modal.remove();
    const transactions = await TransactionService.getAll();
    const cats = await CategoryService.getAll();
    CsvUtil.downloadTransactions(transactions, cats);
  });

  document.getElementById('export-inv-btn').addEventListener('click', async () => {
    modal.remove();
    const invoices = await InvoiceService.getAll();
    CsvUtil.downloadInvoices(invoices);
  });
}

// ===== HOME PAGE =====
async function renderHomePage(container) {
  // Fetch all data in parallel
  const [
    monthTxTotal, monthTxReimbursed, monthTxUnreimbursed,
    monthInvTotal, monthInvReimbursed, monthInvUnreimbursed,
    allTxTotal, allTxReimbursed, allTxUnreimbursed,
    allInvTotal, allInvReimbursed, allInvUnreimbursed,
    recent, categories
  ] = await Promise.all([
    TransactionService.getThisMonthTotal(),
    TransactionService.getThisMonthReimbursedTotal(),
    TransactionService.getThisMonthUnreimbursedTotal(),
    InvoiceService.getThisMonthTotal(),
    InvoiceService.getThisMonthReimbursedTotal(),
    InvoiceService.getThisMonthUnreimbursedTotal(),
    TransactionService.getAllTotal(),
    TransactionService.getAllReimbursedTotal(),
    TransactionService.getAllUnreimbursedTotal(),
    InvoiceService.getAllTotal(),
    InvoiceService.getAllReimbursedTotal(),
    InvoiceService.getAllUnreimbursedTotal(),
    TransactionService.getRecent(5),
    CategoryService.getAll()
  ]);

  const catMap = {};
  categories.forEach(c => catMap[c.id] = c.name);

  container.innerHTML = `
    <div style="padding: 16px 16px 8px; background: var(--primary); color: white;">
      <h1 style="font-size: 22px; font-weight: 700;">ReimburseFlow</h1>
      <p style="font-size: 13px; opacity: 0.85; margin-top: 2px;">快速报销，轻松管理</p>
    </div>
    <div class="card" style="margin-top: -8px; border-radius: 16px 16px 12px 12px;">
      <div class="card-title">本月概览</div>
      <div class="overview-section">
        <div class="overview-section-title">交易</div>
        <div class="overview-row">
          <span class="overview-label">本月交易总额</span>
          <span class="overview-value">${MoneyUtil.format(monthTxTotal)}</span>
        </div>
        <div class="overview-row sub">
          <span class="overview-label">已报销</span>
          <span class="overview-value reimbursed">${MoneyUtil.format(monthTxReimbursed)}</span>
        </div>
        <div class="overview-row sub">
          <span class="overview-label">未报销</span>
          <span class="overview-value unreimbursed">${MoneyUtil.format(monthTxUnreimbursed)}</span>
        </div>
      </div>
      <div class="overview-section" style="margin-top:12px">
        <div class="overview-section-title">发票</div>
        <div class="overview-row">
          <span class="overview-label">本月发票总额</span>
          <span class="overview-value">${MoneyUtil.format(monthInvTotal)}</span>
        </div>
        <div class="overview-row sub">
          <span class="overview-label">已报销</span>
          <span class="overview-value reimbursed">${MoneyUtil.format(monthInvReimbursed)}</span>
        </div>
        <div class="overview-row sub">
          <span class="overview-label">未报销</span>
          <span class="overview-value unreimbursed">${MoneyUtil.format(monthInvUnreimbursed)}</span>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">历史概览</div>
      <div class="overview-section">
        <div class="overview-section-title">交易</div>
        <div class="overview-row">
          <span class="overview-label">历史交易总额</span>
          <span class="overview-value">${MoneyUtil.format(allTxTotal)}</span>
        </div>
        <div class="overview-row sub">
          <span class="overview-label">已报销</span>
          <span class="overview-value reimbursed">${MoneyUtil.format(allTxReimbursed)}</span>
        </div>
        <div class="overview-row sub">
          <span class="overview-label">未报销</span>
          <span class="overview-value unreimbursed">${MoneyUtil.format(allTxUnreimbursed)}</span>
        </div>
      </div>
      <div class="overview-section" style="margin-top:12px">
        <div class="overview-section-title">发票</div>
        <div class="overview-row">
          <span class="overview-label">历史发票总额</span>
          <span class="overview-value">${MoneyUtil.format(allInvTotal)}</span>
        </div>
        <div class="overview-row sub">
          <span class="overview-label">已报销</span>
          <span class="overview-value reimbursed">${MoneyUtil.format(allInvReimbursed)}</span>
        </div>
        <div class="overview-row sub">
          <span class="overview-label">未报销</span>
          <span class="overview-value unreimbursed">${MoneyUtil.format(allInvUnreimbursed)}</span>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">快捷操作</div>
      <div class="quick-actions">
        <button class="quick-action-btn" onclick="location.hash='#/transactions/add'">
          <span class="icon">✏️</span>手动记账
        </button>
        <button class="quick-action-btn" id="photo-shortcut-btn">
          <span class="icon">📷</span>拍照/选图记账
        </button>
        <button class="quick-action-btn" onclick="location.hash='#/invoices/add'">
          <span class="icon">🧾</span>上传发票
        </button>
        <button class="quick-action-btn" id="export-btn">
          <span class="icon">📤</span>导出记录
        </button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">最近记录</div>
      ${recent.length === 0 ? '<div class="empty-state" style="padding:20px"><div class="empty-text">暂无交易记录</div></div>' :
        recent.map(t => `
          <div class="recent-item" onclick="location.hash='#/transactions/detail/${t.id}'">
            <span class="r-date">${DateUtil.formatShort(t.transaction_date)}</span>
            <span class="r-category">${catMap[t.category_id] || '未知'}</span>
            <span class="r-amount">-${MoneyUtil.format(t.amount)}</span>
          </div>
        `).join('')}
      ${recent.length > 0 ? '<div class="see-all"><a href="#/transactions">查看全部</a></div>' : ''}
    </div>
  `;

  // Export button handler - show modal
  document.getElementById('export-btn').addEventListener('click', showExportModal);

  // Photo shortcut - set flag then navigate once
  document.getElementById('photo-shortcut-btn').addEventListener('click', () => {
    autoOpenCamera = true;
    location.hash = '#/transactions/add';
  });
}

// ===== TRANSACTION LIST PAGE =====
async function renderTransactionListPage(container) {
  const categories = await CategoryService.getAll();
  const allTransactions = await TransactionService.getAll();
  const catMap = {};
  categories.forEach(c => catMap[c.id] = c.name);

  // Multi-dimension filter state
  let dim1 = 'category'; // primary group dimension
  let dim2 = 'month';    // secondary group dimension
  const dimensions = [
    { key: 'category', label: '费用类别' },
    { key: 'month', label: '日期' },
    { key: 'company', label: '公司抬头' }
  ];

  function getDimensionValue(t, dim) {
    if (dim === 'category') return catMap[t.category_id] || '未知';
    if (dim === 'month') return DateUtil.formatMonth(t.transaction_date);
    if (dim === 'company') return t.company_title || '未填写';
    return '未知';
  }

  function renderList() {
    // Group by dim1, then within each group group by dim2
    const groups = {};
    allTransactions.forEach(t => {
      const key1 = getDimensionValue(t, dim1);
      if (!groups[key1]) groups[key1] = {};
      const key2 = getDimensionValue(t, dim2);
      if (!groups[key1][key2]) groups[key1][key2] = [];
      groups[key1][key2].push(t);
    });

    const total = safeSum(allTransactions);
    const reimbursedTotal = safeSum(allTransactions.filter(t => t.is_reimbursed));
    const unreimbursedTotal = safeSum(allTransactions.filter(t => !t.is_reimbursed));

    // Build grouped display
    let groupedHtml = '';
    if (allTransactions.length === 0) {
      groupedHtml = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-text">暂无交易记录</div>
          <button class="btn btn-primary" onclick="location.hash='#/transactions/add'">记一笔</button>
        </div>`;
    } else {
      Object.entries(groups).forEach(([key1, subGroups]) => {
        let groupTotal = 0;
        Object.values(subGroups).forEach(items => {
          groupTotal += safeSum(items);
        });
        groupedHtml += `<div class="group-header">${key1} <span style="float:right;font-size:13px;color:var(--text-secondary)">-${MoneyUtil.format(groupTotal)}</span></div>`;
        Object.entries(subGroups).forEach(([key2, items]) => {
          if (key1 !== key2) {
            const subTotal = safeSum(items);
            groupedHtml += `<div class="sub-group-header">${key2} <span style="float:right;font-size:12px;color:var(--text-secondary)">-${MoneyUtil.format(subTotal)}</span></div>`;
          }
          items.forEach(t => {
            groupedHtml += renderTransactionItem(t, catMap);
          });
        });
      });
    }

    container.innerHTML = `
      <div class="page-header">
        <h1>交易记录</h1>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-sm" id="tx-export-btn">导出</button>
          <button class="btn btn-primary btn-sm" onclick="location.hash='#/transactions/add'">+ 新增</button>
        </div>
      </div>
      <div class="filter-bar">
        ${dimensions.map(d => `
          <div style="display:flex;align-items:center;gap:4px;">
            <span style="font-size:11px;color:var(--text-secondary)">${d.label}:</span>
            <select class="dim-select" data-dim="${d.key}" style="font-size:12px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;background:var(--bg);">
              ${dimensions.map(dd => `<option value="${dd.key}" ${(d.key === dim1 && dd.key === dim1) || (d.key === dim2 && dd.key === dim2) ? 'selected' : ''}>${dd.label}</option>`).join('')}
            </select>
          </div>
        `).join('')}
      </div>
      <div class="summary-bar" style="flex-wrap:wrap;gap:4px 12px;">
        <span>合计: <span class="total-amount">-${MoneyUtil.format(total)}</span></span>
        <span style="font-size:12px;color:var(--text-secondary)">已报销: ${MoneyUtil.format(reimbursedTotal)}</span>
        <span style="font-size:12px;color:var(--text-secondary)">未报销: ${MoneyUtil.format(unreimbursedTotal)}</span>
      </div>
      <div id="tx-list-body">
        ${groupedHtml}
      </div>
    `;

    // Bind dimension selectors
    container.querySelectorAll('.dim-select').forEach(select => {
      select.addEventListener('change', () => {
        const dimKey = select.dataset.dim;
        const val = select.value;
        if (dimKey === dimensions[0].key) dim1 = val;
        else dim2 = val;
        // Ensure dim1 != dim2
        if (dim1 === dim2) {
          const other = dimensions.find(d => d.key !== dim1);
          if (dimKey === dimensions[0].key) dim2 = other.key;
          else dim1 = other.key;
        }
        renderList();
      });
    });

    // Bind toggle reimbursed
    container.querySelectorAll('[data-tx-action="toggle"]').forEach(badge => {
      badge.addEventListener('click', async (e) => {
        e.stopPropagation();
        const txId = parseInt(badge.dataset.id);
        await TransactionService.toggleReimbursed(txId);
        // Refresh data and re-render
        const updated = await TransactionService.getAll();
        allTransactions.length = 0;
        updated.forEach(t => allTransactions.push(t));
        renderList();
      });
    });

    // Export button
    document.getElementById('tx-export-btn').addEventListener('click', async () => {
      const txs = await TransactionService.getAll();
      const cats = await CategoryService.getAll();
      CsvUtil.downloadTransactions(txs, cats);
    });
  }

  renderList();
}

function renderTransactionItem(t, catMap) {
  return `
    <div class="transaction-item" onclick="location.hash='#/transactions/detail/${t.id}'">
      <div class="t-left">
        <div class="t-category">${catMap[t.category_id] || '未知'}</div>
        <div class="t-desc">${t.description || ''}</div>
      </div>
      <div class="t-right">
        <div class="t-amount">-${MoneyUtil.format(t.amount)}</div>
        <div class="t-date">${DateUtil.formatShort(t.transaction_date)} ${t.receipt_uris && t.receipt_uris.length ? '<span class="t-receipt">📷</span>' : ''}</div>
        <span class="badge ${t.is_reimbursed ? 'badge-reimbursed' : 'badge-unreimbursed'}"
          data-id="${t.id}" data-tx-action="toggle" style="font-size:11px;padding:1px 6px;">
          ${t.is_reimbursed ? '已报销 ✓' : '未报销'}
        </span>
      </div>
    </div>
  `;
}

// ===== TRANSACTION ADD/EDIT PAGE =====
async function renderTransactionAddPage(container, editId = null) {
  const categories = await CategoryService.getAll();
  let transaction = editId ? await TransactionService.getById(editId) : null;
  const isEdit = !!transaction;

  // OCR state
  let ocrResult = null;
  let receiptFiles = transaction ? (transaction.receipt_uris || []) : [];

  function render() {
    const defaultDate = transaction ? DateUtil.format(transaction.transaction_date) : DateUtil.format(Date.now());
    const defaultAmount = transaction ? transaction.amount : '';
    const defaultDesc = transaction ? (transaction.description || '') : '';
    const defaultCatId = transaction ? transaction.category_id : (categories[0] ? categories[0].id : '');
    const defaultCompany = transaction ? (transaction.company_title || '') : '';

    container.innerHTML = `
      <div class="page-header">
        <button class="back-btn" onclick="history.back()">← 返回</button>
        <button class="btn btn-primary btn-sm" id="save-btn">${isEdit ? '更新' : '保存'}</button>
      </div>
      <div class="form-page">
        ${ocrResult ? `
          <div style="margin-bottom:12px;">
            ${ocrResult.success ? `
              <div class="ocr-status success">✓ 已识别到信息，请对照原图确认后保存
                <a href="javascript:void(0)" id="view-ocr-text" style="margin-left:8px;color:inherit;text-decoration:underline;font-size:12px">查看原文</a>
              </div>
            ` : `
              <div class="ocr-status error">✗ 识别不完整，请对照原图手动补齐
                <a href="javascript:void(0)" id="view-ocr-text" style="margin-left:8px;color:inherit;text-decoration:underline;font-size:12px">查看原文</a>
              </div>
            `}
            ${receiptFiles.length > 0 ? `
              <div style="margin-top:8px; text-align:center;">
                <img src="${receiptFiles[0]}" style="max-width:100%; max-height:200px; border-radius:8px; border:1px solid var(--border);"
                  onclick="viewImage(this.src)">
                <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">点击放大查看原图</div>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <div class="form-group">
          <label>金额</label>
          <input type="number" id="tx-amount" class="amount-input" placeholder="0.00" step="0.01"
            value="${ocrResult && ocrResult.amount != null ? ocrResult.amount : defaultAmount}">
        </div>

        <div class="form-group">
          <label>日期</label>
          <input type="date" id="tx-date" value="${ocrResult && ocrResult.date ? DateUtil.format(ocrResult.date) : defaultDate}">
        </div>

        <div class="form-group">
          <label>公司抬头</label>
          <input type="text" id="tx-company" placeholder="购买方名称（选填）"
            value="${ocrResult && ocrResult.company_title ? ocrResult.company_title : defaultCompany}">
        </div>

        <div class="form-group">
          <label>分类</label>
          <select id="tx-category">
            ${categories.map(c => `<option value="${c.id}" ${(ocrResult && ocrResult.category && ocrResult.category.id === c.id) || (!ocrResult && c.id == defaultCatId) ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label>备注</label>
          <textarea id="tx-desc" placeholder="添加备注...">${defaultDesc}</textarea>
        </div>

        <div class="form-group">
          <label>凭证</label>
          <div class="receipt-area">
            ${receiptFiles.map((uri, i) => `
              <div class="receipt-thumb">
                <img src="${uri}" onclick="viewImage('${uri.replace(/'/g, "\\'")}')">
                <button class="remove-btn" data-index="${i}">×</button>
              </div>
            `).join('')}
            ${receiptFiles.length < 3 ? `
              <button class="add-receipt-btn" id="add-receipt-btn">
                <span style="font-size:20px">+</span>
                <span>${receiptFiles.length === 0 ? '拍照/选图' : '添加'}</span>
              </button>
            ` : ''}
          </div>
          <input type="file" id="receipt-input" accept="image/*" style="display:none">
        </div>

        ${receiptFiles.length === 0 ? `
          <div style="text-align:center; margin-top:8px;">
            <button class="btn btn-outline" id="ocr-trigger-btn">📷 拍照/选图识别</button>
            <div style="font-size:11px; color:var(--text-secondary); margin-top:6px;">提示：从相册选择清晰照片识别更准确</div>
          </div>
        ` : ''}
      </div>
    `;

    // Bind events
    document.getElementById('save-btn').addEventListener('click', async () => {
      const amount = MoneyUtil.parse(document.getElementById('tx-amount').value);
      const dateStr = document.getElementById('tx-date').value;
      const catId = parseInt(document.getElementById('tx-category').value);
      const desc = document.getElementById('tx-desc').value.trim();
      const companyTitle = document.getElementById('tx-company').value.trim();

      if (amount <= 0) {
        showToast('请输入金额');
        return;
      }
      if (!dateStr) {
        showToast('请选择日期');
        return;
      }

      const dateTimestamp = DateUtil.parse(dateStr);
      if (!dateTimestamp) {
        showToast('日期格式错误');
        return;
      }

      const data = {
        amount,
        category_id: catId,
        transaction_date: dateTimestamp,
        description: desc,
        company_title: companyTitle,
        receipt_uris: receiptFiles,
        is_from_ocr: ocrResult && ocrResult.success ? 1 : 0,
        is_reimbursed: transaction ? transaction.is_reimbursed : 0,
        reimbursed_at: transaction ? transaction.reimbursed_at : null,
      };

      if (isEdit) {
        data.id = transaction.id;
        data.created_at = transaction.created_at;
        await TransactionService.update(data);
        showToast('更新成功');
      } else {
        await TransactionService.add(data);
        showToast('保存成功');
      }
      location.hash = '#/transactions';
    });

    // Receipt file input (uses hidden input, cancel = returns to form normally)
    const receiptInput = document.getElementById('receipt-input');
    const addBtn = document.getElementById('add-receipt-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => receiptInput.click());
    }
    if (receiptInput) {
      receiptInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const dataURI = await fileToDataURI(file);
        const compressed = await compressImage(dataURI);
        receiptFiles.push(compressed);
        render();
      });
    }

    // Remove receipt buttons
    container.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        receiptFiles.splice(idx, 1);
        render();
      });
    });

    // OCR trigger button - NO capture attribute, uses system picker
    const ocrBtn = document.getElementById('ocr-trigger-btn');
    if (ocrBtn) {
      ocrBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return; // User cancelled - stays on form
          const dataURI = await fileToDataURI(file);
          const compressed = await compressImage(dataURI);
          receiptFiles = [compressed];

          // Show loading state
          ocrResult = null;
          render();

          // Add loading indicator
          const pageContent = container.querySelector('.form-page');
          if (pageContent) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'ocr-status loading';
            loadingDiv.textContent = '⏳ 正在识别中...';
            pageContent.insertBefore(loadingDiv, pageContent.firstChild);
          }

          try {
            ocrResult = await OcrService.processImage(compressed, categories);
          } catch (err) {
            ocrResult = { success: false };
          }
          render();
        });
        input.addEventListener('cancel', () => {
          // User cancelled - do nothing, stay on form
        });
        input.click();
      });
    }

    // View OCR raw text
    const viewOcrLink = document.getElementById('view-ocr-text');
    if (viewOcrLink && ocrResult && ocrResult.text) {
      viewOcrLink.addEventListener('click', () => {
        alert('OCR 识别原文:\n\n' + ocrResult.text);
      });
    }
  }

  render();

  // Auto-open camera if coming from photo shortcut
  if (autoOpenCamera) {
    autoOpenCamera = false;
    setTimeout(() => {
      const ocrBtn = document.getElementById('ocr-trigger-btn');
      if (ocrBtn) ocrBtn.click();
    }, 300);
  }
}

// ===== TRANSACTION DETAIL PAGE =====
async function renderTransactionDetailPage(container, id) {
  const transaction = await TransactionService.getById(id);
  if (!transaction) {
    location.hash = '#/transactions';
    return;
  }
  const categories = await CategoryService.getAll();
  const catMap = {};
  categories.forEach(c => catMap[c.id] = c.name);
  const catName = catMap[transaction.category_id] || '未知';

  container.innerHTML = `
    <div class="page-header">
      <button class="back-btn" onclick="history.back()">← 返回</button>
      <div class="header-actions">
        <button class="btn btn-outline btn-sm" id="edit-btn">编辑</button>
        <button class="btn btn-danger btn-sm" id="delete-btn">删除</button>
      </div>
    </div>
    <div class="card" style="margin-top:8px">
      <div style="text-align:center; margin-bottom:16px;">
        <div style="font-size:32px; font-weight:700; color:var(--danger);">-${MoneyUtil.format(transaction.amount)}</div>
        <div style="font-size:14px; color:var(--text-secondary); margin-top:4px;">${catName}</div>
        <span class="badge ${transaction.is_reimbursed ? 'badge-reimbursed' : 'badge-unreimbursed'}" id="toggle-status" style="margin-top:8px; cursor:pointer">
          ${transaction.is_reimbursed ? '已报销 ✓' : '未报销'}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">日期</span>
        <span class="detail-value">${DateUtil.format(transaction.transaction_date)}</span>
      </div>
      ${transaction.company_title ? `
        <div class="detail-row">
          <span class="detail-label">公司抬头</span>
          <span class="detail-value">${transaction.company_title}</span>
        </div>
      ` : ''}
      <div class="detail-row">
        <span class="detail-label">录入方式</span>
        <span class="detail-value">${transaction.is_from_ocr ? 'OCR识别' : '手动录入'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">备注</span>
        <span class="detail-value">${transaction.description || '无'}</span>
      </div>
      ${transaction.receipt_uris && transaction.receipt_uris.length > 0 ? `
        <div class="detail-row" style="border:none">
          <span class="detail-label">凭证</span>
        </div>
        <div class="detail-images">
          ${transaction.receipt_uris.map(uri => `<img src="${uri}" onclick="viewImage(this.src)">`).join('')}
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById('toggle-status').addEventListener('click', async () => {
    await TransactionService.toggleReimbursed(id);
    renderTransactionDetailPage(container, id);
  });

  document.getElementById('edit-btn').addEventListener('click', () => {
    location.hash = `#/transactions/edit/${id}`;
  });

  document.getElementById('delete-btn').addEventListener('click', async () => {
    const ok = await showConfirm('确定删除这条交易记录吗？');
    if (ok) {
      await TransactionService.delete(id);
      showToast('已删除');
      location.hash = '#/transactions';
    }
  });
}

// ===== INVOICE LIST PAGE =====
async function renderInvoiceListPage(container) {
  let statusFilter = 'all';

  async function renderList() {
    const invoices = await InvoiceService.getFiltered(statusFilter);
    const unreimbursedTotal = await InvoiceService.getUnreimbursedTotal();

    container.innerHTML = `
      <div class="page-header">
        <h1>发票管理</h1>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-sm" id="inv-export-btn">导出</button>
          <button class="btn btn-primary btn-sm" onclick="location.hash='#/invoices/add'">+ 新增</button>
        </div>
      </div>
      <div class="filter-bar">
        <button class="chip ${statusFilter === 'all' ? 'active' : ''}" data-status="all">全部</button>
        <button class="chip ${statusFilter === 'unreimbursed' ? 'active' : ''}" data-status="unreimbursed">未报销</button>
        <button class="chip ${statusFilter === 'reimbursed' ? 'active' : ''}" data-status="reimbursed">已报销</button>
      </div>
      ${unreimbursedTotal > 0 ? `<div class="unreimbursed-total">未报销合计: ${MoneyUtil.format(unreimbursedTotal)}</div>` : ''}
      <div id="inv-list-body">
        ${invoices.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">🧾</div>
            <div class="empty-text">暂无发票</div>
            <button class="btn btn-primary" onclick="location.hash='#/invoices/add'">添加发票</button>
          </div>
        ` : invoices.map(inv => `
          <div class="invoice-card" onclick="location.hash='#/invoices/detail/${inv.id}'">
            <div class="invoice-top">
              ${inv.image_uri ? `<img class="invoice-thumb" src="${inv.image_uri}" onclick="event.stopPropagation(); viewImage(this.src)">` : `<div class="invoice-thumb" style="display:flex;align-items:center;justify-content:center;font-size:20px">🧾</div>`}
              <div class="invoice-info">
                <div class="invoice-amount">${MoneyUtil.format(inv.amount)}</div>
                <div class="invoice-company">${inv.company_title}</div>
                ${inv.invoice_number ? `<div class="invoice-number">No. ${inv.invoice_number}</div>` : ''}
              </div>
            </div>
            <div class="invoice-bottom">
              <span class="invoice-date">${DateUtil.format(inv.invoice_date)}</span>
              <span class="badge ${inv.is_reimbursed ? 'badge-reimbursed' : 'badge-unreimbursed'}"
                data-id="${inv.id}" data-action="toggle">
                ${inv.is_reimbursed ? '已报销 ✓' : '未报销'}
              </span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Bind filter chips
    container.querySelectorAll('.chip[data-status]').forEach(chip => {
      chip.addEventListener('click', () => {
        statusFilter = chip.dataset.status;
        renderList();
      });
    });

    // Bind toggle reimbursed
    container.querySelectorAll('[data-action="toggle"]').forEach(badge => {
      badge.addEventListener('click', async (e) => {
        e.stopPropagation();
        const invId = parseInt(badge.dataset.id);
        await InvoiceService.toggleReimbursed(invId);
        renderList();
      });
    });

    // Export button
    document.getElementById('inv-export-btn').addEventListener('click', async () => {
      const invs = await InvoiceService.getAll();
      CsvUtil.downloadInvoices(invs);
    });
  }

  renderList();
}

// ===== INVOICE ADD/EDIT PAGE =====
async function renderInvoiceAddPage(container, ocrMode = false, editId = null) {
  let invoice = editId ? await InvoiceService.getById(editId) : null;
  const isEdit = !!invoice;
  let imageUri = invoice ? invoice.image_uri : null;
  let ocrResult = null;

  function render() {
    const defaultDate = invoice ? DateUtil.format(invoice.invoice_date) : DateUtil.format(Date.now());
    const defaultAmount = invoice ? invoice.amount : '';
    const defaultNumber = invoice ? (invoice.invoice_number || '') : '';
    const defaultCompany = invoice ? (invoice.company_title || '') : '';
    const defaultSeller = invoice ? (invoice.seller_name || '') : '';
    const defaultRemarks = invoice ? (invoice.remarks || '') : '';

    container.innerHTML = `
      <div class="page-header">
        <button class="back-btn" onclick="history.back()">← 返回</button>
        <button class="btn btn-primary btn-sm" id="save-inv-btn">${isEdit ? '更新' : '保存'}</button>
      </div>
      <div class="form-page">
        ${ocrResult ? `
          <div style="margin-bottom:12px;">
            ${ocrResult.success ? `
              <div class="ocr-status success">✓ 已识别到信息，请对照原图确认后保存
                <a href="javascript:void(0)" id="view-ocr-text" style="margin-left:8px;color:inherit;text-decoration:underline;font-size:12px">查看原文</a>
              </div>
            ` : `
              <div class="ocr-status error">✗ 识别不完整，请对照原图手动补齐
                <a href="javascript:void(0)" id="view-ocr-text" style="margin-left:8px;color:inherit;text-decoration:underline;font-size:12px">查看原文</a>
              </div>
            `}
            ${imageUri ? `
              <div style="margin-top:8px; text-align:center;">
                <img src="${imageUri}" style="max-width:100%; max-height:200px; border-radius:8px; border:1px solid var(--border);"
                  onclick="viewImage(this.src)">
                <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">点击放大查看原图</div>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <div class="form-group">
          <label>金额</label>
          <input type="number" id="inv-amount" class="amount-input" placeholder="0.00" step="0.01"
            value="${ocrResult && ocrResult.amount != null ? ocrResult.amount : defaultAmount}">
        </div>

        <div class="form-group">
          <label>日期</label>
          <input type="date" id="inv-date"
            value="${ocrResult && ocrResult.date ? DateUtil.format(ocrResult.date) : defaultDate}">
        </div>

        <div class="form-group">
          <label>公司抬头</label>
          <input type="text" id="inv-company" placeholder="购买方名称"
            value="${ocrResult && ocrResult.company_title ? ocrResult.company_title : defaultCompany}">
        </div>

        <div class="form-group">
          <label>发票号码</label>
          <input type="text" id="inv-number" placeholder="选填，用于查重"
            value="${ocrResult && ocrResult.invoice_number ? ocrResult.invoice_number : defaultNumber}">
        </div>

        <div class="form-group">
          <label>销售方名称</label>
          <input type="text" id="inv-seller" placeholder="选填"
            value="${ocrResult && ocrResult.seller_name ? ocrResult.seller_name : defaultSeller}">
        </div>

        <div class="form-group">
          <label>备注</label>
          <textarea id="inv-remarks" placeholder="添加备注...">${defaultRemarks}</textarea>
        </div>

        <div class="form-group">
          <label>发票图片</label>
          <div class="receipt-area">
            ${imageUri ? `
              <div class="receipt-thumb">
                <img src="${imageUri}" onclick="viewImage('${imageUri.replace(/'/g, "\\'")}')">
                <button class="remove-btn" id="remove-inv-img">×</button>
              </div>
            ` : ''}
            ${!imageUri ? `
              <button class="add-receipt-btn" id="add-inv-img">
                <span style="font-size:20px">+</span>
                <span>拍照/选图</span>
              </button>
            ` : ''}
          </div>
          <input type="file" id="inv-file-input" accept="image/*" style="display:none">
        </div>

        ${imageUri && !ocrResult && !isEdit ? `
          <div style="text-align:center; margin-top:8px;">
            <button class="btn btn-outline" id="inv-ocr-btn">🔍 识别发票内容</button>
            <div style="font-size:11px; color:var(--text-secondary); margin-top:6px;">提示：从相册选择清晰照片识别更准确</div>
          </div>
        ` : ''}
      </div>
    `;

    // Save
    document.getElementById('save-inv-btn').addEventListener('click', async () => {
      const amount = MoneyUtil.parse(document.getElementById('inv-amount').value);
      const dateStr = document.getElementById('inv-date').value;
      const company = document.getElementById('inv-company').value.trim();
      const number = document.getElementById('inv-number').value.trim();
      const seller = document.getElementById('inv-seller').value.trim();
      const remarks = document.getElementById('inv-remarks').value.trim();

      if (amount <= 0) { showToast('请输入金额'); return; }
      if (!dateStr) { showToast('请选择日期'); return; }
      if (!company) { showToast('请输入公司抬头'); return; }

      const dateTimestamp = DateUtil.parse(dateStr);
      if (!dateTimestamp) { showToast('日期格式错误'); return; }

      const data = {
        amount,
        invoice_date: dateTimestamp,
        company_title: company,
        invoice_number: number,
        seller_name: seller,
        remarks,
        image_uri: imageUri,
        is_reimbursed: invoice ? invoice.is_reimbursed : 0,
        reimbursed_at: invoice ? invoice.reimbursed_at : null,
        tax_amount: null,
      };

      if (isEdit) {
        data.id = invoice.id;
        data.created_at = invoice.created_at;
        await InvoiceService.update(data);
        showToast('更新成功');
      } else {
        await InvoiceService.add(data);
        showToast('保存成功');
      }
      location.hash = '#/invoices';
    });

    // Image upload with OCR
    const fileInput = document.getElementById('inv-file-input');
    const addImgBtn = document.getElementById('add-inv-img');
    if (addImgBtn) {
      addImgBtn.addEventListener('click', () => {
        fileInput.click();
      });
    }
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return; // User cancelled - stays on form
        const dataURI = await fileToDataURI(file);
        imageUri = await compressImage(dataURI);

        // Auto-trigger OCR after taking photo
        render();
        await runOcr();
      });
    }

    // Remove image
    const removeBtn = document.getElementById('remove-inv-img');
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        imageUri = null;
        ocrResult = null;
        render();
      });
    }

    // Manual OCR trigger button
    const invOcrBtn = document.getElementById('inv-ocr-btn');
    if (invOcrBtn) {
      invOcrBtn.addEventListener('click', async () => {
        await runOcr();
      });
    }

    // View OCR raw text
    const viewOcrLink = document.getElementById('view-ocr-text');
    if (viewOcrLink && ocrResult && ocrResult.text) {
      viewOcrLink.addEventListener('click', () => {
        alert('OCR 识别原文:\n\n' + ocrResult.text);
      });
    }
  }

  async function runOcr() {
    if (!imageUri) return;
    const categories = await CategoryService.getAll();

    ocrResult = null;
    render();

    // Add loading indicator
    const pageContent = container.querySelector('.form-page');
    if (pageContent) {
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'ocr-status loading';
      loadingDiv.textContent = '⏳ 正在识别发票内容...';
      pageContent.insertBefore(loadingDiv, pageContent.firstChild);
    }

    try {
      ocrResult = await OcrService.processImage(imageUri, categories);
    } catch (err) {
      ocrResult = { success: false };
    }
    render();
  }

  render();
}

// ===== INVOICE DETAIL PAGE =====
async function renderInvoiceDetailPage(container, id) {
  const invoice = await InvoiceService.getById(id);
  if (!invoice) {
    location.hash = '#/invoices';
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <button class="back-btn" onclick="history.back()">← 返回</button>
      <div class="header-actions">
        <button class="btn btn-outline btn-sm" id="inv-download-img-btn">下载图片</button>
        <button class="btn btn-outline btn-sm" id="inv-edit-btn">编辑</button>
        <button class="btn btn-danger btn-sm" id="inv-delete-btn">删除</button>
      </div>
    </div>
    <div class="card" style="margin-top:8px">
      <div style="text-align:center; margin-bottom:16px;">
        <div style="font-size:32px; font-weight:700;">${MoneyUtil.format(invoice.amount)}</div>
        <span class="badge ${invoice.is_reimbursed ? 'badge-reimbursed' : 'badge-unreimbursed'}" id="toggle-status" style="margin-top:8px; cursor:pointer">
          ${invoice.is_reimbursed ? '已报销 ✓' : '未报销'}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">日期</span>
        <span class="detail-value">${DateUtil.format(invoice.invoice_date)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">公司抬头</span>
        <span class="detail-value">${invoice.company_title}</span>
      </div>
      ${invoice.invoice_number ? `
        <div class="detail-row">
          <span class="detail-label">发票号码</span>
          <span class="detail-value">${invoice.invoice_number}</span>
        </div>
      ` : ''}
      ${invoice.seller_name ? `
        <div class="detail-row">
          <span class="detail-label">销售方</span>
          <span class="detail-value">${invoice.seller_name}</span>
        </div>
      ` : ''}
      <div class="detail-row">
        <span class="detail-label">报销状态</span>
        <span class="detail-value">${invoice.is_reimbursed ? '已报销' : '未报销'}</span>
      </div>
      ${invoice.remarks ? `
        <div class="detail-row">
          <span class="detail-label">备注</span>
          <span class="detail-value">${invoice.remarks}</span>
        </div>
      ` : ''}
      ${invoice.image_uri ? `
        <div class="detail-row" style="border:none">
          <span class="detail-label">发票图片</span>
        </div>
        <div class="detail-images">
          <img src="${invoice.image_uri}" onclick="viewImage(this.src)">
        </div>
      ` : ''}
    </div>
  `;

  // Download image button
  document.getElementById('inv-download-img-btn').addEventListener('click', () => {
    if (!invoice.image_uri) {
      showToast('无图片可下载');
      return;
    }
    const a = document.createElement('a');
    a.href = invoice.image_uri;
    const number = invoice.invoice_number || invoice.id;
    a.download = `发票_${number}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('图片下载成功');
  });

  document.getElementById('toggle-status').addEventListener('click', async () => {
    await InvoiceService.toggleReimbursed(id);
    renderInvoiceDetailPage(container, id);
  });

  document.getElementById('inv-edit-btn').addEventListener('click', () => {
    location.hash = `#/invoices/edit/${id}`;
  });

  document.getElementById('inv-delete-btn').addEventListener('click', async () => {
    const ok = await showConfirm('确定删除这张发票吗？');
    if (ok) {
      await InvoiceService.delete(id);
      showToast('已删除');
      location.hash = '#/invoices';
    }
  });
}

// ===== CATEGORY MANAGE PAGE =====
async function renderCategoryManagePage(container) {
  const categories = await CategoryService.getAll();

  container.innerHTML = `
    <div class="page-header">
      <button class="back-btn" onclick="location.hash='#/'">← 返回</button>
      <h1>分类管理</h1>
      <span></span>
    </div>
    <div class="inline-input-row">
      <input type="text" id="new-cat-input" placeholder="输入新分类名称">
      <button class="btn btn-primary btn-sm" id="add-cat-btn">添加</button>
    </div>
    <div id="cat-list">
      ${categories.map(c => `
        <div class="category-item" data-id="${c.id}">
          <span class="cat-name">${c.name}${c.is_default ? ' <span style="font-size:11px;color:var(--text-secondary)">内置</span>' : ''}</span>
          <div class="cat-actions">
            <button class="btn btn-outline btn-sm cat-edit-btn" data-id="${c.id}" data-name="${c.name}">编辑</button>
            ${!c.is_default ? `<button class="btn btn-danger btn-sm cat-del-btn" data-id="${c.id}">删除</button>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
    ${categories.length === 0 ? '<div class="empty-state"><div class="empty-text">暂无分类</div></div>' : ''}
  `;

  // Add category
  document.getElementById('add-cat-btn').addEventListener('click', async () => {
    const input = document.getElementById('new-cat-input');
    const name = input.value.trim();
    if (!name) { showToast('请输入分类名称'); return; }
    try {
      await CategoryService.add(name);
      showToast('添加成功');
      renderCategoryManagePage(container);
    } catch (e) {
      showToast('分类名称已存在');
    }
  });

  // Edit category
  container.querySelectorAll('.cat-edit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id);
      const oldName = btn.dataset.name;
      const newName = prompt('修改分类名称:', oldName);
      if (newName && newName.trim() && newName.trim() !== oldName) {
        try {
          await CategoryService.update(id, newName.trim());
          showToast('更新成功');
          renderCategoryManagePage(container);
        } catch (e) {
          showToast('更新失败');
        }
      }
    });
  });

  // Delete category
  container.querySelectorAll('.cat-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id);
      const ok = await showConfirm('确定删除这个分类吗？');
      if (ok) {
        try {
          await CategoryService.delete(id);
          showToast('已删除');
          renderCategoryManagePage(container);
        } catch (e) {
          showToast(e.message || '删除失败');
        }
      }
    });
  });
}

// ===== Initialize =====
init();
