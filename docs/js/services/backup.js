// ===== GitHub Gist Backup Service =====
const GistBackupService = (() => {
  const TOKEN_KEY = 'rf_github_token';
  const GIST_ID_KEY = 'rf_gist_id';
  const LAST_BACKUP_KEY = 'rf_last_backup';

  let _debounceTimer = null;

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  function getGistId() {
    return localStorage.getItem(GIST_ID_KEY);
  }

  function setGistId(id) {
    if (id) {
      localStorage.setItem(GIST_ID_KEY, id);
    } else {
      localStorage.removeItem(GIST_ID_KEY);
    }
  }

  function getLastBackup() {
    return localStorage.getItem(LAST_BACKUP_KEY);
  }

  // Strip image data from records to keep JSON small
  function stripImages(item) {
    const copy = { ...item };
    if ('receipt_uris' in copy) copy.receipt_uris = [];
    if ('image_uri' in copy) copy.image_uri = null;
    return copy;
  }

  async function exportAllData() {
    const categories = (await dbGetAll('category')).map(stripImages);
    const transactions = (await dbGetAll('transaction')).map(stripImages);
    const invoices = (await dbGetAll('invoice')).map(stripImages);
    return {
      version: 2,
      exported_at: Date.now(),
      categories,
      transactions,
      invoices,
    };
  }

  async function importAllData(json) {
    if (!json || !json.categories || !json.transactions || !json.invoices) {
      throw new Error('备份数据格式无效');
    }

    const ok = await showConfirm('恢复将覆盖当前所有数据，确定继续吗？');
    if (!ok) return;

    // Clear stores then import
    await dbClearStore('category');
    await dbClearStore('transaction');
    await dbClearStore('invoice');

    for (const cat of json.categories) {
      await dbPut('category', cat);
    }
    for (const tx of json.transactions) {
      await dbPut('transaction', tx);
    }
    for (const inv of json.invoices) {
      await dbPut('invoice', inv);
    }
  }

  async function backupToGist() {
    const token = getToken();
    if (!token) throw new Error('请先设置 GitHub Token');

    const data = await exportAllData();
    const content = JSON.stringify(data, null, 2);
    const gistId = getGistId();

    const filename = 'reimburseflow_backup.json';
    const body = {
      description: 'ReimburseFlow Backup',
      files: {
        [filename]: { content },
      },
    };

    let response;
    if (gistId) {
      // Update existing gist
      response = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify(body),
      });
    } else {
      // Create new gist
      body.public = false;
      response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify(body),
      });
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `GitHub API 错误 (${response.status})`);
    }

    const result = await response.json();
    if (!gistId) {
      setGistId(result.id);
    }
    const now = new Date().toLocaleString('zh-CN');
    localStorage.setItem(LAST_BACKUP_KEY, now);

    return result;
  }

  async function restoreFromGist() {
    const token = getToken();
    const gistId = getGistId();
    if (!token) throw new Error('请先设置 GitHub Token');
    if (!gistId) throw new Error('尚未创建过备份');

    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `GitHub API 错误 (${response.status})`);
    }

    const gist = await response.json();
    const filename = 'reimburseflow_backup.json';
    const file = gist.files[filename];
    if (!file || !file.content) {
      throw new Error('备份文件不存在或为空');
    }

    const json = JSON.parse(file.content);
    await importAllData(json);
  }

  function autoBackup() {
    const token = getToken();
    if (!token) return; // No token configured, skip silently

    if (_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(async () => {
      try {
        await backupToGist();
      } catch (e) {
        // Silent fail — don't disturb user
        console.warn('Auto backup failed:', e.message);
      }
    }, 5000);
  }

  return {
    getToken,
    setToken,
    getGistId,
    getLastBackup,
    exportAllData,
    importAllData,
    backupToGist,
    restoreFromGist,
    autoBackup,
  };
})();
