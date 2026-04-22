// ===== Utility Functions =====

const DateUtil = {
  format(timestamp) {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  formatShort(timestamp) {
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  },
  formatMonth(timestamp) {
    const d = new Date(timestamp);
    return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  },
  now() {
    return Date.now();
  },
  startOfMonth(timestamp) {
    const d = new Date(timestamp || Date.now());
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  },
  endOfMonth(timestamp) {
    const d = new Date(timestamp || Date.now());
    return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
  },
  parse(str) {
    if (!str) return null;
    // Try YYYY-MM-DD
    const m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    // Try YYYY年MM月DD日
    const m2 = str.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
    if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3]).getTime();
    return Date.parse(str) || null;
  }
};

const MoneyUtil = {
  format(amount) {
    return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  parse(str) {
    const num = parseFloat(str);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
  }
};

const CsvUtil = {
  generateTransactions(transactions, categories) {
    const catMap = {};
    categories.forEach(c => catMap[c.id] = c.name);

    const header = '日期,分类,金额,公司抬头,备注,报销状态,是否有凭证';
    const rows = transactions.map(t => {
      const catName = catMap[t.category_id] || '未知';
      const hasReceipt = t.receipt_uris && t.receipt_uris.length > 0 ? '是' : '否';
      const desc = (t.description || '').replace(/"/g, '""');
      const company = (t.company_title || '').replace(/"/g, '""');
      const status = t.is_reimbursed ? '已报销' : '未报销';
      return `${DateUtil.format(t.transaction_date)},${catName},${MoneyUtil.format(t.amount)},"${company}","${desc}",${status},${hasReceipt}`;
    });
    return '\uFEFF' + header + '\n' + rows.join('\n');
  },

  downloadTransactions(transactions, categories) {
    if (transactions.length === 0) {
      showToast('暂无交易记录可导出');
      return;
    }
    const csv = this.generateTransactions(transactions, categories);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `交易记录_${DateUtil.format(Date.now())}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('交易记录导出成功');
  },

  generateInvoices(invoices) {
    const header = '发票号码,金额,开票日期,公司抬头,销售方名称,报销状态,备注';
    const rows = invoices.map(inv => {
      const number = (inv.invoice_number || '').replace(/"/g, '""');
      const company = (inv.company_title || '').replace(/"/g, '""');
      const seller = (inv.seller_name || '').replace(/"/g, '""');
      const remarks = (inv.remarks || '').replace(/"/g, '""');
      const status = inv.is_reimbursed ? '已报销' : '未报销';
      return `"${number}",${MoneyUtil.format(inv.amount)},${DateUtil.format(inv.invoice_date)},"${company}","${seller}",${status},"${remarks}"`;
    });
    return '\uFEFF' + header + '\n' + rows.join('\n');
  },

  downloadInvoices(invoices) {
    if (invoices.length === 0) {
      showToast('暂无发票记录可导出');
      return;
    }
    const csv = this.generateInvoices(invoices);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `发票记录_${DateUtil.format(Date.now())}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('发票记录导出成功');
  },

  // Legacy alias for backward compatibility
  generate(transactions, categories) {
    return this.generateTransactions(transactions, categories);
  },
  download(transactions, categories) {
    return this.downloadTransactions(transactions, categories);
  }
};

// Image utility: convert file to base64 data URI for local storage
function fileToDataURI(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Compress image before storing
function compressImage(dataURI, maxWidth = 1200, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxWidth) {
        h = Math.round(h * maxWidth / w);
        w = maxWidth;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataURI;
  });
}

// Preprocess image for OCR: gentle grayscale + contrast enhancement
function preprocessForOCR(dataURI) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      // Limit to 2000px for OCR processing
      const maxDim = 2000;
      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      // Get pixel data
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      // Gentle enhancement: grayscale + mild contrast boost
      for (let i = 0; i < data.length; i += 4) {
        // Grayscale
        let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Mild contrast boost: stretch from 40-220 → 0-255
        gray = ((gray - 40) / 180) * 255;
        gray = Math.max(0, Math.min(255, gray));
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.src = dataURI;
  });
}

// Toast notification
function showToast(message, duration = 2000) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// Confirm dialog
function showConfirm(message) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('confirm-dialog');
    document.getElementById('confirm-message').textContent = message;
    dialog.classList.add('active');
    const okBtn = document.getElementById('confirm-ok');
    const handler = () => {
      resolve(true);
      okBtn.removeEventListener('click', handler);
    };
    okBtn.addEventListener('click', handler);
  });
}

function closeConfirmDialog() {
  document.getElementById('confirm-dialog').classList.remove('active');
}

// Image viewer
function viewImage(src) {
  const viewer = document.getElementById('image-viewer');
  document.getElementById('image-viewer-img').src = src;
  viewer.classList.add('active');
}
