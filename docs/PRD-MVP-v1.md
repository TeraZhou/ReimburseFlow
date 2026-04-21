# ReimburseFlow - 鸿蒙快速报销 App 落地方案

## Context

用户需要一个部署在 HarmonyOS NEXT (纯血鸿蒙) 手机上的个人报销准备工具。核心解决两个痛点：
1. 消费记录分散，月底报销时靠回忆和翻小票
2. 发票管理混乱，难以快速汇总和区分已报/未报

采用分步迭代策略，第一期聚焦 MVP：**能记、能看**。

---

## 技术选型

| 项目 | 选择 | 说明 |
|------|------|------|
| 目标平台 | HarmonyOS NEXT (API 13) | 纯血鸿蒙，不支持安卓 |
| 开发语言 | ArkTS | 基于 TypeScript，华为专为鸿蒙设计 |
| UI 框架 | ArkUI (声明式) | `@Component` + `@Entry` + 声明式布局 |
| 开发 IDE | DevEco Studio 5.x | 需新安装，华为官方 IDE |
| 本地数据库 | @kit.ArkData (relationalStore) | 基于 SQLite 的关系型数据库 |
| OCR 识别 | 华为 ML Kit (端侧) | 离线可用，免费，低延迟 |
| 图片选择 | @kit.MediaLibraryKit (photoAccessHelper) | 相册选择 |
| 拍照 | @kit.CameraKit (camera) 或系统相机 Picker | 拍摄凭证 |
| 数据导出 | 纯文本 CSV（第一期） | 无需引入第三方 Excel 库 |

---

## 第一期 MVP 功能范围

### 包含
- 手动录入交易（日期、金额、分类、备注）
- 拍照识别录入交易（OCR 自动提取金额和日期）
- 交易列表展示（按分类筛选）
- 内置默认分类 + 用户自定义分类
- 发票上传（拍照/相册）+ 手动录入发票信息（日期、金额、公司抬头、发票号码）
- 发票列表展示 + 标记已报销/未报销
- 凭证原图查看
- 导出交易记录为 CSV

### 不包含（后续迭代）
- 云端同步/备份
- 发票汇总报表
- 项目/出差标签
- 报销规则校验
- 高级图表统计

---

## 项目目录结构

```
ReimburseFlow/
├── AppScope/
│   ├── app.json5                          # 应用全局配置（bundleName、版本号）
│   └── resources/
│       └── base/
│           ├── element/
│           │   ├── string.json            # 字符串资源
│           │   └── color.json             # 颜色资源
│           └── profile/
│               └── main_pages.json        # 页面路由配置
├── entry/
│   ├── src/main/
│   │   ├── ets/
│   │   │   ├── entryability/
│   │   │   │   └── EntryAbility.ets       # 应用入口 Ability（生命周期）
│   │   │   ├── common/                    # 公共模块
│   │   │   │   ├── constants/
│   │   │   │   │   └── Constants.ets      # 全局常量（默认分类等）
│   │   │   │   ├── utils/
│   │   │   │   │   ├── DateUtil.ets       # 日期格式化工具
│   │   │   │   │   ├── MoneyUtil.ets      # 金额格式化工具
│   │   │   │   │   └── CsvUtil.ets        # CSV 导出工具
│   │   │   │   └── components/
│   │   │   │       ├── TitleBar.ets       # 通用标题栏组件
│   │   │   │       ├── EmptyView.ets      # 空数据占位组件
│   │   │   │       └── LoadingDialog.ets  # 加载弹窗组件
│   │   │   ├── model/                     # 数据模型定义
│   │   │   │   ├── Transaction.ets        # 交易记录模型
│   │   │   │   ├── Invoice.ets            # 发票模型
│   │   │   │   └── Category.ets           # 分类模型
│   │   │   ├── database/                  # 数据库层
│   │   │   │   ├── RdbHelper.ets          # 数据库初始化与版本管理
│   │   │   │   ├── TransactionDao.ets     # 交易记录 CRUD
│   │   │   │   ├── InvoiceDao.ets         # 发票 CRUD
│   │   │   │   └── CategoryDao.ets        # 分类 CRUD
│   │   │   ├── service/                   # 业务逻辑层
│   │   │   │   ├── TransactionService.ets # 交易记录业务逻辑
│   │   │   │   ├── InvoiceService.ets     # 发票业务逻辑
│   │   │   │   ├── CategoryService.ets    # 分类业务逻辑
│   │   │   │   └── OcrService.ets         # OCR 识别服务
│   │   │   └── pages/                     # 页面
│   │   │       ├── Index.ets              # 首页（底部 Tab 导航）
│   │   │       ├── transaction/
│   │   │       │   ├── TransactionListPage.ets   # 交易记录列表页
│   │   │       │   ├── TransactionAddPage.ets    # 交易记录新增/编辑页
│   │   │       │   └── TransactionDetailPage.ets # 交易记录详情页
│   │   │       ├── invoice/
│   │   │       │   ├── InvoiceListPage.ets       # 发票列表页
│   │   │       │   ├── InvoiceAddPage.ets        # 发票新增/编辑页
│   │   │       │   └── InvoiceDetailPage.ets     # 发票详情页
│   │   │       └── settings/
│   │   │           └── CategoryManagePage.ets    # 分类管理页
│   │   ├── resources/
│   │   │   └── base/
│   │   │       ├── media/                 # 图标、默认分类图标
│   │   │       └── element/
│   │   │           └── string.json
│   │   └── module.json5                   # 模块配置（权限声明、Ability 注册）
│   ├── build-profile.json5
│   ├── hvigorfile.ts
│   └── oh-package.json5
├── build-profile.json5                    # 根构建配置
├── hvigorfile.ts
└── oh-package.json5                       # 根依赖管理
```

---

## 数据库设计

### 表结构

#### 1. category（分类表）
```sql
CREATE TABLE IF NOT EXISTS category (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,              -- 分类名称，如"交通费"
    icon        TEXT,                       -- 图标标识（预留）
    is_default  INTEGER DEFAULT 0,          -- 1=系统内置 0=用户自建
    sort_order  INTEGER DEFAULT 0,          -- 排序序号
    created_at  INTEGER NOT NULL,           -- 创建时间戳
    updated_at  INTEGER                     -- 更新时间戳
);
```

#### 2. transaction（交易记录表）
```sql
CREATE TABLE IF NOT EXISTS transaction (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    amount          REAL NOT NULL,           -- 金额（单位：元）
    category_id     INTEGER NOT NULL,        -- 外键 → category.id
    transaction_date INTEGER NOT NULL,       -- 交易日期（时间戳）
    description     TEXT,                    -- 备注
    receipt_uri     TEXT,                    -- 凭证图片本地 URI（可多张，逗号分隔）
    is_from_ocr     INTEGER DEFAULT 0,       -- 1=OCR识别录入 0=手动录入
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER,
    FOREIGN KEY (category_id) REFERENCES category(id)
);
```

#### 3. invoice（发票表）
```sql
CREATE TABLE IF NOT EXISTS invoice (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number  TEXT,                    -- 发票号码（查重用）
    amount          REAL NOT NULL,           -- 发票金额
    invoice_date    INTEGER NOT NULL,        -- 开票日期（时间戳）
    company_title   TEXT NOT NULL,           -- 公司抬头/购买方名称
    seller_name     TEXT,                    -- 销售方名称
    tax_amount      REAL,                   -- 税额（预留）
    image_uri       TEXT,                    -- 发票图片本地 URI
    is_reimbursed   INTEGER DEFAULT 0,       -- 0=未报销 1=已报销
    reimbursed_at   INTEGER,                -- 标记报销时间
    remarks         TEXT,                    -- 备注
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER
);
```

### 预置数据
```typescript
// 默认分类（is_default = 1）
const DEFAULT_CATEGORIES = [
    { name: '交通费', sort_order: 1 },
    { name: '餐饮费', sort_order: 2 },
    { name: '住宿费', sort_order: 3 },
    { name: '通讯费', sort_order: 4 },
    { name: '办公用品', sort_order: 5 },
    { name: '差旅费', sort_order: 6 },
    { name: '招待费', sort_order: 7 },
    { name: '其他', sort_order: 99 },
];
```

---

## 页面设计

### 1. 首页 Index.ets（底部 Tab 导航）

```
┌──────────────────────────────┐
│  ReimburseFlow               │
├──────────────────────────────┤
│                              │
│  ┌─ 本月概览 ──────────────┐ │
│  │  未报销交易  ¥2,350.00  │ │
│  │  未报销发票  ¥4,800.00  │ │
│  └────────────────────────┘ │
│                              │
│  ┌─ 快捷操作 ──────────────┐ │
│  │  [手动记账]  [拍照记账] │ │
│  │  [上传发票]  [导出记录] │ │
│  └────────────────────────┘ │
│                              │
│  ┌─ 最近记录 ──────────────┐ │
│  │  4/18  餐饮费  -¥45.00  │ │
│  │  4/17  交通费  -¥28.00  │ │
│  │  4/16  住宿费  -¥380.00 │ │
│  │         ...              │ │
│  └────────────────────────┘ │
│                              │
├──────────────────────────────┤
│  [交易]    [发票]    [设置]  │
└──────────────────────────────┘
```

### 2. 交易记录列表页 TransactionListPage.ets

```
┌──────────────────────────────┐
│  ← 交易记录        [+新增]  │
├──────────────────────────────┤
│  [全部] [交通] [餐饮] [住宿] │  ← 分类筛选 chips
├──────────────────────────────┤
│  ── 2026年4月 ──────────── │
│  4/18  餐饮费  ¥45.00  📷  │  ← 📷 表示有凭证图
│  4/17  交通费  ¥28.00      │
│  4/16  住宿费  ¥380.00 📷  │
│  ── 2026年3月 ──────────── │
│  3/28  办公用品 ¥156.00    │
│         ...                 │
├──────────────────────────────┤
│  合计: ¥609.00              │
└──────────────────────────────┘
```

### 3. 交易新增/编辑页 TransactionAddPage.ets

```
┌──────────────────────────────┐
│  ← 新增交易          [保存] │
├──────────────────────────────┤
│                              │
│  金额                        │
│  ┌──────────────────────────┐│
│  │ ¥ 0.00                   ││
│  └──────────────────────────┘│
│                              │
│  日期                        │
│  ┌──────────────────────────┐│
│  │ 2026-04-21        [📅]  ││  ← DatePicker
│  └──────────────────────────┘│
│                              │
│  分类                        │
│  ┌──────────────────────────┐│
│  │ 餐饮费            [▼]   ││  ← 下拉选择
│  └──────────────────────────┘│
│                              │
│  备注                        │
│  ┌──────────────────────────┐│
│  │ 午餐                     ││
│  └──────────────────────────┘│
│                              │
│  凭证                        │
│  ┌──────┐ ┌──────┐ ┌──────┐│
│  │  📷  │ │  +   │ │      ││  ← 点击拍照或选图
│  └──────┘ └──────┘ └──────┘│
│                              │
└──────────────────────────────┘
```

### 4. OCR 拍照识别流程

```
用户点击"拍照记账"
    ↓
启动相机拍照（或从相册选择）
    ↓
显示图片 + "识别中..." 加载状态
    ↓
调用华为 ML Kit 文字识别 API
    ↓
解析识别结果：
  - 尝试提取金额（正则匹配 ¥/￥后面数字）
  - 尝试提取日期（正则匹配 yyyy-MM-dd 等格式）
  - 尝试匹配分类关键词（如"出租"→交通费，"餐"→餐饮费）
    ↓
将识别结果预填到 TransactionAddPage 表单
  - 金额、日期、分类字段标记为"待确认"状态（视觉提示）
  - 用户可修改任何字段
    ↓
用户确认后保存
```

### 5. 发票列表页 InvoiceListPage.ets

```
┌──────────────────────────────┐
│  ← 发票管理        [+新增]  │
├──────────────────────────────┤
│  [全部] [未报销] [已报销]    │  ← 状态筛选
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │ [📷]  发票号: 12345678 │  │
│  │       ¥1,200.00        │  │
│  │       A公司抬头        │  │
│  │       2026-04-15       │  │
│  │       [未报销] ←点击切换│  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ [📷]  发票号: 87654321 │  │
│  │       ¥3,600.00        │  │
│  │       B公司抬头        │  │
│  │       2026-04-10       │  │
│  │       [已报销 ✓]       │  │
│  └────────────────────────┘  │
│         ...                  │
├──────────────────────────────┤
│  未报销合计: ¥1,200.00      │
└──────────────────────────────┘
```

### 6. 分类管理页 CategoryManagePage.ets

```
┌──────────────────────────────┐
│  ← 分类管理                  │
├──────────────────────────────┤
│                              │
│  交通费         [编辑] [删除]│
│  餐饮费         [编辑] [删除]│
│  住宿费         [编辑] [删除]│
│  通讯费         [编辑] [删除]│
│  办公用品       [编辑] [删除]│
│  差旅费         [编辑] [删除]│
│  招待费         [编辑] [删除]│
│  其他           [编辑]       │  ← 系统内置不可删除
│                              │
│  [+ 添加自定义分类]          │
│                              │
└──────────────────────────────┘
```

---

## OCR 识别策略（华为 ML Kit）

### 依赖引入
```
oh-package.json5 中添加 ML Kit 相关依赖
```

### 识别流程
1. 用户拍照或选择图片 → 获取图片 URI
2. 调用 ML Kit 通用文字识别 API，传入图片
3. 获取识别文本结果（按 block/line 结构化返回）
4. 后处理解析：
   - **金额提取**：正则 `/[¥￥]\s*(\d+\.?\d*)/` 或独立数字金额判断
   - **日期提取**：正则匹配 `YYYY-MM-DD`、`YYYY/MM/DD`、`YYYY年MM月DD日` 等格式
   - **分类推断**：关键词匹配（"出租车/地铁/公交/加油" → 交通费，"餐/食/饮" → 餐饮费，"酒店/宾馆/住宿" → 住宿费）
5. 将解析结果预填入表单，标记为"待确认"，用户可修改

### 降级策略
- 如果 ML Kit 不可用或识别失败，提示用户"识别失败，请手动填写"，跳转到手动录入表单
- 始终保留图片原图作为凭证存档

---

## 权限声明（module.json5）

```json5
{
    "requestPermissions": [
        { "name": "ohos.permission.INTERNET" },
        { "name": "ohos.permission.CAMERA" },
        { "name": "ohos.permission.READ_IMAGEVIDEO" },
        { "name": "ohos.permission.WRITE_IMAGEVIDEO" }
    ]
}
```

> 注：CAMERA 和媒体读写权限需要在运行时动态申请（user_grant 类型），需要在代码中调用 `requestPermissionsFromUser()`。

---

## 导出功能设计

### 第一期：CSV 导出
```typescript
// CsvUtil.ets
// 将交易记录导出为 CSV 格式
// 格式: 日期,分类,金额,备注,是否有凭证
// 通过系统分享面板或保存到 Download 目录
```

---

## 开发步骤（按实施顺序）

### Step 1: 环境搭建
- 安装 DevEco Studio 5.x
- 配置 HarmonyOS NEXT SDK (API 13)
- 创建 ArkTS 项目（Empty Ability 模板）
- 确认项目能在模拟器/真机上运行

### Step 2: 数据库层
- 实现 RdbHelper（数据库初始化、建表、版本管理）
- 实现 CategoryDao、TransactionDao、InvoiceDao
- 预置默认分类数据
- 编写单元测试验证 CRUD

### Step 3: 首页框架
- 搭建底部 Tab 导航（交易/发票/设置）
- 实现首页仪表盘 UI（概览卡片 + 快捷操作）
- 接入数据库读取概览数据

### Step 4: 分类管理
- 实现分类列表页
- 实现新增/编辑/删除分类功能
- 内置分类不可删除逻辑

### Step 5: 交易记录模块
- 实现交易列表页（分月分组显示 + 分类筛选）
- 实现手动新增页（表单 + 日期选择 + 分类下拉）
- 实现交易详情页（查看凭证图片）
- 实现交易编辑和删除

### Step 6: OCR 识别
- 接入相机/相册图片获取
- 接入 ML Kit 文字识别
- 实现金额/日期/分类解析逻辑
- 实现识别结果预填表单

### Step 7: 发票管理模块
- 实现发票列表页（状态筛选）
- 实现发票新增页（拍照/选图 + 手动填写）
- 实现已报销/未报销状态切换
- 实现发票详情页

### Step 8: 导出功能
- 实现 CSV 生成工具
- 实现导出到 Download 目录或系统分享

### Step 9: 测试与优化
- 端到端功能测试（真机）
- OCR 识别准确率调优
- UI 细节打磨（动效、空状态、异常提示）
- 性能优化（列表懒加载、图片压缩缓存）

---

## 验证方式

1. **环境验证**：DevEco Studio 创建空项目 → 编译 → 模拟器/真机显示 "Hello World"
2. **数据库验证**：启动 App → 查看默认分类是否正确预置 → 增删改查操作正常
3. **交易录入验证**：手动录入一条交易 → 列表页显示 → 详情页可查看编辑
4. **OCR 验证**：拍摄一张小票 → 识别出金额和日期 → 结果预填入表单 → 保存成功
5. **发票管理验证**：上传发票 → 填写信息 → 标记已报销 → 筛选已报销列表显示正确
6. **导出验证**：导出 CSV → 用 Excel 打开确认数据完整正确

---

## 注意事项

1. **图片存储**：凭证和发票图片存储在应用沙箱目录下，URI 存入数据库。需要在 App 启动时检查 URI 有效性
2. **数据安全**：数据库 securityLevel 设为 S1（适合普通应用数据）
3. **ML Kit 可用性**：需确认目标设备支持 ML Kit 文字识别能力，做好降级处理
4. **内存管理**：图片加载需要做缩略图处理，列表页不要直接加载原图，避免 OOM
5. **后续迭代预留**：数据模型中预留了 tax_amount、seller_name 等字段，方便第二期扩展
