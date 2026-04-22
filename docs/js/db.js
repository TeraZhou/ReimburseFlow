// ===== IndexedDB Database Layer =====
const DB_NAME = 'ReimburseFlowDB';
const DB_VERSION = 2;

let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      // Category table
      if (!db.objectStoreNames.contains('category')) {
        const categoryStore = db.createObjectStore('category', { keyPath: 'id', autoIncrement: true });
        categoryStore.createIndex('name', 'name', { unique: true });
        categoryStore.createIndex('is_default', 'is_default');
      }

      // Transaction table
      if (!db.objectStoreNames.contains('transaction')) {
        const txStore = db.createObjectStore('transaction', { keyPath: 'id', autoIncrement: true });
        txStore.createIndex('category_id', 'category_id');
        txStore.createIndex('transaction_date', 'transaction_date');
        txStore.createIndex('created_at', 'created_at');
      }

      // Transaction table: v1 -> v2, add is_reimbursed and reimbursed_at
      if (oldVersion < 2 && db.objectStoreNames.contains('transaction')) {
        const txStore = event.target.transaction.objectStore('transaction');
        if (!txStore.indexNames.contains('is_reimbursed')) {
          txStore.createIndex('is_reimbursed', 'is_reimbursed');
        }
        // Migrate existing records: set default is_reimbursed = 0
        const cursorReq = txStore.openCursor();
        cursorReq.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            const record = cursor.value;
            if (record.is_reimbursed === undefined) {
              record.is_reimbursed = 0;
              record.reimbursed_at = null;
              cursor.update(record);
            }
            cursor.continue();
          }
        };
      }

      // Invoice table
      if (!db.objectStoreNames.contains('invoice')) {
        const invStore = db.createObjectStore('invoice', { keyPath: 'id', autoIncrement: true });
        invStore.createIndex('invoice_number', 'invoice_number');
        invStore.createIndex('is_reimbursed', 'is_reimbursed');
        invStore.createIndex('invoice_date', 'invoice_date');
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

async function initDefaultData() {
  const db = await openDB();
  const tx = db.transaction('category', 'readonly');
  const store = tx.objectStore('category');
  const countReq = store.count();

  return new Promise((resolve) => {
    countReq.onsuccess = () => {
      if (countReq.result === 0) {
        // Insert default categories
        const writeTx = db.transaction('category', 'readwrite');
        const writeStore = writeTx.objectStore('category');
        const defaults = [
          { name: '交通费', icon: '', is_default: 1, sort_order: 1 },
          { name: '餐饮费', icon: '', is_default: 1, sort_order: 2 },
          { name: '住宿费', icon: '', is_default: 1, sort_order: 3 },
          { name: '通讯费', icon: '', is_default: 1, sort_order: 4 },
          { name: '办公用品', icon: '', is_default: 1, sort_order: 5 },
          { name: '差旅费', icon: '', is_default: 1, sort_order: 6 },
          { name: '招待费', icon: '', is_default: 1, sort_order: 7 },
          { name: '其他', icon: '', is_default: 1, sort_order: 99 },
        ];
        const now = Date.now();
        defaults.forEach(cat => {
          writeStore.add({ ...cat, created_at: now, updated_at: now });
        });
        writeTx.oncomplete = () => resolve();
      } else {
        resolve();
      }
    };
  });
}

// Generic CRUD helpers
async function dbAdd(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbClearStore(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbGetByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req = index.getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
