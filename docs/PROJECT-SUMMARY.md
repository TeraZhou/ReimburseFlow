# ReimburseFlow - 项目总结文档

> 最后更新：2026-04-21

---

## 一、项目概述

**ReimburseFlow** 是一个个人报销准备工具，帮助用户快速记录消费、管理发票、准备报销材料。

| 项目 | 说明 |
|------|------|
| 定位 | 个人报销辅助工具（MVP 阶段） |
| 技术方案 | Web App（纯前端，无后端） |
| 访问地址 | https://terazhou.github.io/ReimburseFlow/ |
| 代码仓库 | https://github.com/TeraZhou/ReimburseFlow |
| 费用 | 完全免费 |
| 数据存储 | 浏览器本地（IndexedDB） |
| 离线使用 | 支持（首次 OCR 需联网下载引擎） |

---

## 二、功能清单（MVP 已完成）

### 交易记录
- [x] 手动录入交易（日期、金额、分类、公司抬头、备注）
- [x] 拍照/选图录入交易（OCR 自动识别金额、日期、公司抬头、分类）
- [x] 交易列表展示（按月分组、按分类筛选）
- [x] 交易详情查看（含凭证原图放大）
- [x] 交易编辑、删除
- [x] 底部显示合计金额

### 发票管理
- [x] 发票新增（拍照/选图 + OCR 自动识别）
- [x] 发票列表展示（全部/未报销/已报销筛选）
- [x] 一键切换已报销/未报销状态
- [x] 发票详情查看（含原图放大）
- [x] 发票编辑、删除
- [x] 底部显示未报销合计

### 分类管理
- [x] 8 个内置默认分类（不可删除）
- [x] 用户自定义分类（新增、编辑、删除）

### 数据导出
- [x] 导出交易记录为 CSV 文件（Excel 可打开）

### OCR 识别
- [x] 基于 Tesseract.js 的端侧 OCR（中文+英文）
- [x] 自动提取：金额（优先价税合计）、日期、公司抬头（购买方）、发票号码、销售方名称、分类推断
- [x] 图片预处理（灰度 + 对比度增强）
- [x] 识别结果预填表单，用户可对照原图修改
- [x] 查看原始 OCR 识别文本（调试用）

### PWA 支持
- [x] 添加到手机主屏幕，全屏运行无浏览器地址栏

---

## 三、OCR 识别能力说明

### 推荐使用方式
**从相册选择清晰照片** >> 拍照。相册照片通常光线充足、对焦清晰，识别率显著高于实时拍照。

### 各字段识别情况（相册选图）

| 字段 | 识别可靠性 | 说明 |
|------|-----------|------|
| 发票号码 | 高 | 20 位数字串，通常能准确识别 |
| 公司抬头（购买方） | 中高 | 能识别，偶尔个别字出错 |
| 日期 | 中高 | 支持"年月日"格式及纯数字格式 |
| 分类 | 中 | 基于关键词匹配（"餐"→餐饮费等） |
| 金额 | 中低 | 取决于发票上金额区域的识别质量 |
| 销售方名称 | 中 | 类似公司抬头 |

### 拍照识别
拍照受光线、角度、手抖影响，识别准确率明显低于相册选图。建议先拍照保存到相册，再从相册选择。

### 局限性
- Tesseract.js 对中文发票的识别质量有上限
- 复杂排版、模糊、反光的图片识别效果差
- 部分字段可能识别不到，需手动补齐

---

## 四、技术架构

### 文件结构
```
ReimburseFlow/
├── docs/                          # Web 应用代码（GitHub Pages 部署目录）
│   ├── index.html                 # 入口页面
│   ├── manifest.json              # PWA 配置
│   ├── css/style.css              # 全局样式
│   ├── js/
│   │   ├── db.js                  # IndexedDB 数据库层
│   │   ├── utils.js               # 工具函数（日期、金额、CSV、图片预处理）
│   │   ├── app.js                 # 路由 + 所有页面渲染逻辑
│   │   └── services/
│   │       ├── category.js        # 分类 CRUD
│   │       ├── transaction.js     # 交易记录 CRUD
│   │       ├── invoice.js         # 发票 CRUD
│   │       └── ocr.js             # OCR 识别服务（Tesseract.js）
│   └── icons/                     # 应用图标
├── docs/
│   ├── PRD-MVP-v1.md              # 原始产品需求文档（鸿蒙版）
│   └── PROJECT-SUMMARY.md         # 本文档
├── build-profile.json5            # 鸿蒙项目配置（预留）
└── oh-package.json5               # 鸿蒙依赖管理（预留）
```

### 数据库设计（IndexedDB）

#### category（分类表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer | 自增主键 |
| name | text | 分类名称（唯一索引） |
| icon | text | 图标标识（预留） |
| is_default | integer | 1=系统内置 0=用户自建 |
| sort_order | integer | 排序序号 |
| created_at | integer | 创建时间戳 |
| updated_at | integer | 更新时间戳 |

#### transaction（交易记录表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer | 自增主键 |
| amount | float | 金额（元） |
| category_id | integer | 分类 ID |
| transaction_date | integer | 交易日期（时间戳） |
| company_title | text | 公司抬头 |
| description | text | 备注 |
| receipt_uris | array | 凭证图片（Base64） |
| is_from_ocr | integer | 1=OCR 录入 0=手动录入 |
| created_at | integer | 创建时间戳 |
| updated_at | integer | 更新时间戳 |

#### invoice（发票表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer | 自增主键 |
| amount | float | 发票金额 |
| invoice_date | integer | 开票日期（时间戳） |
| company_title | text | 公司抬头（购买方） |
| invoice_number | text | 发票号码 |
| seller_name | text | 销售方名称 |
| image_uri | text | 发票图片（Base64） |
| is_reimbursed | integer | 0=未报销 1=已报销 |
| reimbursed_at | integer | 标记报销时间 |
| remarks | text | 备注 |
| tax_amount | float | 税额（预留） |
| created_at | integer | 创建时间戳 |
| updated_at | integer | 更新时间戳 |

### 依赖说明

| 依赖 | 用途 | 加载方式 |
|------|------|---------|
| Tesseract.js v5 | OCR 文字识别 | CDN 动态加载（首次使用时） |

无其他外部依赖，纯原生 HTML/CSS/JavaScript。

---

## 五、部署方式

- **平台**：GitHub Pages（免费）
- **方式**：代码放在 `docs/` 目录，GitHub Pages 设置 Source 为 `main` 分支 `/docs` 目录
- **更新流程**：本地修改 → `git push` → 1-2 分钟自动部署生效
- **缓存管理**：通过文件引用后的 `?v=N` 参数控制版本

---

## 六、已知限制

1. **数据不跨设备**：数据存在浏览器 IndexedDB 中，换浏览器/换手机数据不跟随
2. **OCR 质量上限**：Tesseract.js 中文发票识别准确率有限，部分字段需手动补齐
3. **图片存储**：凭证图片以 Base64 存在 IndexedDB 中，大量图片可能导致存储压力
4. **无云备份**：清除浏览器数据会丢失所有记录
5. **CSV 仅为交易记录**：暂不支持导出发票数据
