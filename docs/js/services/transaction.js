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
    return await dbAdd('transaction', data);
  },

  async update(data) {
    data.updated_at = Date.now();
    await dbPut('transaction', data);
  },

  async delete(id) {
    await dbDelete('transaction', id);
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
    return list.reduce((sum, t) => sum + t.amount, 0);
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

  async getTotalAmount(list) {
    return list.reduce((sum, t) => sum + t.amount, 0);
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
