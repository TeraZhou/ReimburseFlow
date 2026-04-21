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
    // Priority 1: Standard formats with separators or Chinese chars
    const patterns = [
      // 2026年04月15日 (日 may be OCR'd as 晶 or other similar chars, so make it optional)
      /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})/,
      // 2026-04-15 or 2026/04/15
      /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
      // 26-04-15 or 26/04/15
      /(\d{2})[-/](\d{1,2})[-/](\d{1,2})/,
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

    // Priority 2: 8 consecutive digits YYYYMMDD (OCR often merges "2025年02月18日" into "20250218" or "202545020181")
    const dateNums = [...text.matchAll(/\d{8,10}/g)];
    for (const m of dateNums) {
      const s = m[0];
      // Try different split points for YYYY-MM-DD
      for (let yLen = 4; yLen <= 4; yLen++) {
        for (let mLen = 1; mLen <= 2; mLen++) {
          const dStart = yLen + mLen;
          const dLen = s.length - dStart;
          if (dLen < 1 || dLen > 2) continue;
          const year = parseInt(s.substring(0, yLen));
          const month = parseInt(s.substring(yLen, yLen + mLen));
          const day = parseInt(s.substring(dStart));
          if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return new Date(year, month - 1, day).getTime();
          }
        }
      }
    }

    // Priority 3: Date near keywords
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

  // Extract company title (buyer/purchaser) - more flexible
  extractCompanyTitle(text) {
    // Primary patterns: keyword then capture text until newline
    const patterns = [
      /购\s*买\s*方\s*(?:名\s*称)?\s*[：:]*\s*(.{2,40}?)[\n\r]/,
      /买\s*方\s*(?:名\s*称)?\s*[：:]*\s*(.{2,40}?)[\n\r]/,
      /购\s*方\s*(?:名\s*称)?\s*[：:]*\s*(.{2,40}?)[\n\r]/,
      /抬头\s*[：:]*\s*(.{2,40}?)[\n\r]/,
      /购\s*买\s*方\s*[：:]*\s*(.{2,40}?)[\n\r]/,
      /名\s*称\s*[：:]*\s*(.{2,40}?)[\n\r]/,
    ];

    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        let name = m[1].trim();
        // Clean up OCR artifacts but keep Chinese, English, numbers, common punctuation
        name = name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9（）()\s有限责公集团科技发展实业控股股份]/g, '').trim();
        if (name.length >= 2) return name;
      }
    }

    // Fallback 1: find company names ending with 公司/有限公司/有限责任公司
    const companyPatterns = [
      /([\u4e00-\u9fa5]{2,15}(?:有限责任|有限)?公司)/,
      /([\u4e00-\u9fa5]{2,10}(?:集团|集团有限)?公司)/,
    ];
    for (const p of companyPatterns) {
      const matches = [...text.matchAll(p)];
      if (matches.length > 0) {
        // Return first match (buyer company is usually mentioned first)
        return matches[0][1];
      }
    }

    return null;
  },

  // Extract invoice number - more flexible matching
  extractInvoiceNumber(text) {
    // Primary patterns: keyword + number (allow spaces in keyword)
    const patterns = [
      /发\s*票\s*号\s*码\s*[：:]*\s*[￥¥]?\s*[（(]?\s*(\d{8,20})/,
      /发\s*票\s*号\s*[：:]*\s*[￥¥]?\s*[（(]?\s*(\d{8,20})/,
      /号\s*码\s*[：:]*\s*(\d{8,20})/,
      /编\s*号\s*[：:]*\s*(\d{8,20})/,
      /No\s*[.：:]*\s*(\d{8,20})/i,
      /Invoice\s*No\s*[.：:]*\s*(\d{8,20})/i,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[1];
    }

    // Fallback: find the longest digit sequence (8+ digits) - likely the invoice number
    const digitMatches = text.match(/\d{8,20}/g);
    if (digitMatches && digitMatches.length > 0) {
      return digitMatches.reduce((a, b) => a.length >= b.length ? a : b);
    }

    return null;
  },

  // Extract seller name - more flexible
  extractSellerName(text) {
    const patterns = [
      /销\s*售\s*方\s*(?:名\s*称)?\s*[：:]*\s*(.{2,40}?)[\n\r]/,
      /卖\s*方\s*(?:名\s*称)?\s*[：:]*\s*(.{2,40}?)[\n\r]/,
      /收款单位\s*[：:]*\s*(.{2,40}?)[\n\r]/,
      /销\s*售\s*方\s*[：:]*\s*(.{2,40}?)[\n\r]/,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        let name = m[1].trim();
        name = name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9（）()\s有限责公集团科技发展实业控股股份]/g, '').trim();
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

  // Process image using Tesseract.js with preprocessing
  async recognizeText(imageDataURI) {
    try {
      // Preprocess image for better OCR accuracy
      const processed = await preprocessForOCR(imageDataURI);

      if (typeof Tesseract === 'undefined') {
        await this.loadTesseract();
      }
      const result = await Tesseract.recognize(processed, 'chi_sim+eng', {
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
