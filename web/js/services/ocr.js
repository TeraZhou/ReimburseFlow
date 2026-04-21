// ===== OCR Service =====
const OcrService = {
  // Extract amount from OCR text
  extractAmount(text) {
    // Try patterns like ¥123.45, ￥123.45
    const patterns = [
      /[¥￥]\s*(\d+\.?\d*)/,
      /金额[：:]\s*[¥￥]?\s*(\d+\.?\d*)/,
      /合计[：:]\s*[¥￥]?\s*(\d+\.?\d*)/,
      /总计[：:]\s*[¥￥]?\s*(\d+\.?\d*)/,
      /amount[：:]\s*[¥￥]?\s*(\d+\.?\d*)/i,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return parseFloat(m[1]);
    }
    // Fallback: look for standalone decimal numbers that could be amounts
    const nums = text.match(/\d+\.\d{2}/g);
    if (nums && nums.length > 0) {
      // Return the largest one (likely the total)
      return Math.max(...nums.map(Number));
    }
    return null;
  },

  // Extract date from OCR text
  extractDate(text) {
    const patterns = [
      /(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?/,
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
    return null;
  },

  // Guess category from OCR text keywords
  guessCategory(text, categories) {
    const keywordMap = {
      '交通费': ['出租', '滴滴', '地铁', '公交', '加油', '停车', '高铁', '火车', '机票', '航班', '铁路', 'taxi', 'uber'],
      '餐饮费': ['餐', '食', '饮', '饭', '外卖', '美团', '饿了么', '咖啡', '奶茶', '茶'],
      '住宿费': ['酒店', '宾馆', '住宿', '民宿', '旅店', 'hotel', 'inn'],
      '通讯费': ['话费', '流量', '通讯', '移动', '联通', '电信', '手机'],
      '办公用品': ['办公', '文具', '打印', '复印', '纸', '笔'],
      '差旅费': ['差旅', '出差', '机票', '报销'],
      '招待费': ['招待', '宴请', '礼品', '送礼'],
    };

    for (const cat of categories) {
      const keywords = keywordMap[cat.name];
      if (keywords) {
        for (const kw of keywords) {
          if (text.includes(kw)) return cat;
        }
      }
    }
    // Default to "其他"
    return categories.find(c => c.name === '其他') || categories[0];
  },

  // Process image using browser-native text recognition or fallback
  async recognizeText(imageDataURI) {
    // Try native text recognition API if available (rare)
    if ('TextDecoder' in window) {
      // Use a simple approach: we'll process with canvas OCR simulation
      // For real OCR, we'd need Tesseract.js, but for MVP let's use a simpler approach
    }

    // For production, load Tesseract.js dynamically
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
      return { success: false, text: null, amount: null, date: null, category: null };
    }
    return {
      success: true,
      text,
      amount: this.extractAmount(text),
      date: this.extractDate(text),
      category: this.guessCategory(text, categories)
    };
  }
};
