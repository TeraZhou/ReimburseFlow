// ===== Transaction Service =====
const TransactionService = {
  async getAll() {
    const list = await dbGetAll('transaction');
    return list.sort((a, b) => b.transaction_date - a.transaction_date);
  },

  async getById(id) {
    return await dbGet('transaction', id);
  },

  async add(data) {
    const now = Date.now();
    data.created_at = now;
    data.updated_at = now;
    data.receipt_uris = data.receipt_uris || [];
    data.is_reimbursed = data.is_reimbursed || 0;
    data.reimbursed_at = data.reimbursed_at || null;
    return await dbAdd('transaction', data);
  },

  async update(data) {
    data.updated_at = Date.now();
    await dbPut('transaction', data);
  },

  async delete(id) {
    await dbDelete('transaction', id);
  },

  async toggleReimbursed(id) {
    const tx = await dbGet('transaction', id);
    if (!tx) return;
    tx.is_reimbursed = tx.is_reimbursed ? 0 : 1;
    tx.reimbursed_at = tx.is_reimbursed ? Date.now() : null;
    tx.updated_at = Date.now();
    await dbPut('transaction', tx);
    return tx;
  },

  async getByMonth(year, month) {
    const start = new Date(year, month, 1).getTime();
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
    const all = await this.getAll();
    return all.filter(t => t.transaction_date >= start && t.transaction_date <= end);
  },

  async getThisMonthTotal() {
    const now = new Date();
    const list = await this.getByMonth(now.getFullYear(), now.getMonth());
    return safeSum(list);
  },

  async getThisMonthReimbursedTotal() {
    const now = new Date();
    const list = await this.getByMonth(now.getFullYear(), now.getMonth());
    return safeSum(list.filter(t => t.is_reimbursed));
  },

  async getThisMonthUnreimbursedTotal() {
    const now = new Date();
    const list = await this.getByMonth(now.getFullYear(), now.getMonth());
    return safeSum(list.filter(t => !t.is_reimbursed));
  },

  async getAllTotal() {
    const all = await this.getAll();
    return safeSum(all);
  },

  async getAllReimbursedTotal() {
    const all = await this.getAll();
    return safeSum(all.filter(t => t.is_reimbursed));
  },

  async getAllUnreimbursedTotal() {
    const all = await this.getAll();
    return safeSum(all.filter(t => !t.is_reimbursed));
  },

  async getRecent(limit = 5) {
    const all = await this.getAll();
    return all.slice(0, limit);
  },

  async getByCategory(categoryId) {
    const all = await this.getAll();
    if (!categoryId) return all;
    return all.filter(t => t.category_id === categoryId);
  },

  // Group transactions by month
  groupByMonth(transactions) {
    const groups = {};
    transactions.forEach(t => {
      const key = DateUtil.formatMonth(t.transaction_date);
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  }
};

// Safe sum: use integer cents to avoid floating point errors
function safeSum(list) {
  let cents = 0;
  list.forEach(item => {
    cents += Math.round((item.amount || 0) * 100);
  });
  return cents / 100;
}
