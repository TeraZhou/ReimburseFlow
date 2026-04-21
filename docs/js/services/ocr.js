// ===== OCR Service =====
const OcrService = {
  // Extract amount from OCR text - prioritize total/合计 over other numbers
  extractAmount(text) {
    // Priority 1: 价税合计 (total with tax) - MUST be highest priority
    const priceTaxTotal = text.match(/价\s*税\s*合\s*计[（(￥¥]?\s*[：:]*\s*[￥¥]?\s*[（(]?\s*(\d+\.?\d{0,2})/i);
    if (priceTaxTotal) return parseFloat(priceTaxTotal[1]);

    // Priority 2: 合计/总计 (look for the LAST occurrence, which is usually the final total)
    const totalKeywords = [
      /[合总]\s*计[（(￥¥]?\s*[：:]*\s*[￥¥]?\s*[（(]?\s*(\d+\.?\d{0,2})/g,
      /总\s*额[（(￥¥]?\s*[：:]*\s*[￥¥]?\s*[（(]?\s*(\d+\.?\d{0,2})/g,
    ];
    let lastTotal = null;
    for (const p of totalKeywords) {
      const matches = [...text.matchAll(p)];
      if (matches.length > 0) {
        const val = parseFloat(matches[matches.length - 1][1]);
        if (val > 0) lastTotal = val;
      }
    }
    if (lastTotal) return lastTotal;

    // Priority 3: 应收/应付
    const payPatterns = [
      /应\s*收[（(￥¥]?\s*[：:]*\s*[￥¥]?\s*(\d+\.?\d{0,2})/,
      /应\s*付[（(￥¥]?\s*[：:]*\s*[￥¥]?\s*(\d+\.?\d{0,2})/,
    ];
    for (const p of payPatterns) {
      const m = text.match(p);
      if (m) return parseFloat(m[1]);
    }

    // Priority 4: ¥ symbol - pick the largest (most likely total)
    const currencyMatches = [...text.matchAll(/[￥¥]\s*(\d+\.?\d{0,2})/g)];
    if (currencyMatches.length > 0) {
      const values = currencyMatches.map(m => parseFloat(m[1])).filter(v => v > 0);
      if (values.length > 0) return Math.max(...values);
    }

    // Priority 5: 金额 keyword
    const amountMatch = text.match(/金额[（(￥¥]?\s*[：:]*\s*[￥¥]?\s*(\d+\.?\d{0,2})/);
    if (amountMatch) return parseFloat(amountMatch[1]);

    // Priority 6: English keywords
    const enPatterns = [/Amount[：:]*\s*[￥¥]?\s*(\d+\.?\d{0,2})/i, /Total[：:]*\s*[￥¥]?\s*(\d+\.?\d{0,2})/i];
    for (const p of enPatterns) {
      const m = text.match(p);
      if (m) return parseFloat(m[1]);
    }

    // Priority 7: Standalone decimal numbers - pick the largest
    const allNums = [...text.matchAll(/\b(\d+\.?\d{0,2})\b/g)];
    if (allNums.length > 0) {
      const values = allNums.map(m => parseFloat(m[1])).filter(v => v > 0 && v < 1000000);
      if (values.length > 0) {
        values.sort((a, b) => b - a);
        return values[0];
      }
    }

    return null;
  },

  // Extract date from OCR text - support more formats
  extractDate(text) {
    const patterns = [
      // 2026年04月15日
      /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
      // 2026-04-15 or 2026/04/15
      /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
      // 26-04-15 or 26/04/15
      /(\d{2})[-/](\d{1,2})[-/](\d{1,2})/,
      // 20260415
      /(\d{4})(\d{2})(\d{2})/,
    ];

    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        let year = parseInt(m[1]);
        let month = parseInt(m[2]);
        let day = parseInt(m[3]);
        if (year < 100) year += 2000;
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return new Date(year, month - 1, day).getTime();
        }
      }
    }

    // Try to find date near keywords
    const dateKeywordPatterns = [
      /(?:开票日期|日期|时间|Date)[：:]*\s*(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/i,
    ];
    for (const p of dateKeywordPatterns) {
      const m = text.match(p);
      if (m) {
        let year = parseInt(m[1]);
        let month = parseInt(m[2]);
        let day = parseInt(m[3]);
        if (year < 100) year += 2000;
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return new Date(year, month - 1, day).getTime();
        }
      }
    }

    return null;
  },

  // Extract company title (buyer/purchaser)
  extractCompanyTitle(text) {
    const patterns = [
      /购买方[：:]*\s*名\s*称[：:]*\s*(.{2,30}?)[\n\r\s]/,
      /购\s*买\s*方[：:]*\s*(.{2,30}?)[\n\r\s]/,
      /买\s*方[：:]*\s*(.{2,30}?)[\n\r\s]/,
      /抬头[：:]*\s*(.{2,30}?)[\n\r\s]/,
      /购\s*方[：:]*\s*(.{2,30}?)[\n\r\s]/,
      /购买方名称[：:]*\s*(.{2,30}?)[\n\r\s]/,
      /名\s*称[：:]*\s*(.{2,30}?)[\n\r]/,
      /公司[：:]*\s*(.{2,30}?)[\n\r\s]/,
    ];

    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        let name = m[1].trim();
        // Clean up common OCR artifacts
        name = name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9（）()有限公司]/g, '').trim();
        if (name.length >= 2) return name;
      }
    }

    // Fallback: look for company-like names ending with 公司/有限公司
    const companyMatch = text.match(/([\u4e00-\u9fa5]{2,20}(?:有限)?公司)/);
    if (companyMatch) return companyMatch[1];

    return null;
  },

  // Extract invoice number
  extractInvoiceNumber(text) {
    const patterns = [
      /发票号码[：:]*\s*(\d{8,20})/,
      /No[.：:]*\s*(\d{8,20})/i,
      /号码[：:]*\s*(\d{8,20})/,
      /编号[：:]*\s*(\d{8,20})/,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[1];
    }
    return null;
  },

  // Extract seller name
  extractSellerName(text) {
    const patterns = [
      /销售方[：:]*\s*名\s*称[：:]*\s*(.{2,30}?)[\n\r\s]/,
      /销\s*售\s*方[：:]*\s*(.{2,30}?)[\n\r\s]/,
      /卖\s*方[：:]*\s*(.{2,30}?)[\n\r\s]/,
      /收款单位[：:]*\s*(.{2,30}?)[\n\r\s]/,
      /销售方名称[：:]*\s*(.{2,30}?)[\n\r]/,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        let name = m[1].trim();
        name = name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9（）()有限公司]/g, '').trim();
        if (name.length >= 2) return name;
      }
    }
    return null;
  },

  // Guess category from OCR text keywords
  guessCategory(text, categories) {
    const keywordMap = {
      '交通费': ['出租', '滴滴', '地铁', '公交', '加油', '停车', '高铁', '火车', '机票', '航班', '铁路', 'taxi', 'uber', '快车', '专车', '代驾'],
      '餐饮费': ['餐', '食', '饮', '饭', '外卖', '美团', '饿了么', '咖啡', '奶茶', '茶饮', '火锅', '烧烤', '小吃', '快餐'],
      '住宿费': ['酒店', '宾馆', '住宿', '民宿', '旅店', 'hotel', 'inn', '旅馆', '公寓'],
      '通讯费': ['话费', '流量', '通讯', '移动', '联通', '电信', '手机费'],
      '办公用品': ['办公', '文具', '打印', '复印', '纸张', '墨盒'],
      '差旅费': ['差旅', '出差', '机票', '报销', '行程'],
      '招待费': ['招待', '宴请', '礼品', '送礼', '商务'],
    };

    for (const cat of categories) {
      const keywords = keywordMap[cat.name];
      if (keywords) {
        for (const kw of keywords) {
          if (text.includes(kw)) return cat;
        }
      }
    }
    return categories.find(c => c.name === '其他') || categories[0];
  },

  // Process image using Tesseract.js
  async recognizeText(imageDataURI) {
    try {
      if (typeof Tesseract === 'undefined') {
        await this.loadTesseract();
      }
      const result = await Tesseract.recognize(imageDataURI, 'chi_sim+eng', {
        logger: () => {}
      });
      return result.data.text;
    } catch (e) {
      console.warn('OCR failed:', e);
      return null;
    }
  },

  async loadTesseract() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  },

  // Full OCR pipeline: image → parsed result
  async processImage(imageDataURI, categories) {
    const text = await this.recognizeText(imageDataURI);
    if (!text) {
      return { success: false, text: null, amount: null, date: null, category: null, company_title: null, invoice_number: null, seller_name: null };
    }
    return {
      success: true,
      text,
      amount: this.extractAmount(text),
      date: this.extractDate(text),
      category: this.guessCategory(text, categories),
      company_title: this.extractCompanyTitle(text),
      invoice_number: this.extractInvoiceNumber(text),
      seller_name: this.extractSellerName(text),
    };
  }
};
