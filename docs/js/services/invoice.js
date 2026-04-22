// ===== Invoice Service =====
const InvoiceService = {
  async getAll() {
    const list = await dbGetAll('invoice');
    return list.sort((a, b) => b.invoice_date - a.invoice_date);
  },

  async getById(id) {
    return await dbGet('invoice', id);
  },

  async add(data) {
    const now = Date.now();
    data.created_at = now;
    data.updated_at = now;
    return await dbAdd('invoice', data);
  },

  async update(data) {
    data.updated_at = Date.now();
    await dbPut('invoice', data);
  },

  async delete(id) {
    await dbDelete('invoice', id);
  },

  async toggleReimbursed(id) {
    const inv = await dbGet('invoice', id);
    if (!inv) return;
    inv.is_reimbursed = inv.is_reimbursed ? 0 : 1;
    inv.reimbursed_at = inv.is_reimbursed ? Date.now() : null;
    inv.updated_at = Date.now();
    await dbPut('invoice', inv);
    return inv;
  },

  async getFiltered(status) {
    const all = await this.getAll();
    if (status === 'all') return all;
    const val = status === 'reimbursed' ? 1 : 0;
    return all.filter(i => i.is_reimbursed === val);
  },

  async getUnreimbursedTotal() {
    const all = await this.getFiltered('unreimbursed');
    return safeSum(all);
  },

  async getThisMonthTotal() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    const all = await this.getAll();
    return safeSum(all.filter(i => i.invoice_date >= start && i.invoice_date <= end));
  },

  async getThisMonthReimbursedTotal() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    const all = await this.getAll();
    return safeSum(all.filter(i => i.invoice_date >= start && i.invoice_date <= end && i.is_reimbursed));
  },

  async getThisMonthUnreimbursedTotal() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    const all = await this.getAll();
    return safeSum(all.filter(i => i.invoice_date >= start && i.invoice_date <= end && !i.is_reimbursed));
  },

  async getAllTotal() {
    const all = await this.getAll();
    return safeSum(all);
  },

  async getAllReimbursedTotal() {
    const all = await this.getAll();
    return safeSum(all.filter(i => i.is_reimbursed));
  },

  async getAllUnreimbursedTotal() {
    const all = await this.getAll();
    return safeSum(all.filter(i => !i.is_reimbursed));
  }
};
