// ===== Company Title Service =====
const CompanyTitleService = {
  async getAll() {
    return await dbGetAll('company_title');
  },

  async getById(id) {
    return await dbGet('company_title', id);
  },

  async add(name) {
    const all = await this.getAll();
    if (all.some(c => c.name === name)) {
      throw new Error('公司抬头名称已存在');
    }
    const now = Date.now();
    return await dbAdd('company_title', {
      name,
      created_at: now,
      updated_at: now
    });
  },

  async update(id, name) {
    const item = await dbGet('company_title', id);
    if (!item) return;
    // Check uniqueness (exclude self)
    const all = await this.getAll();
    if (all.some(c => c.name === name && c.id !== id)) {
      throw new Error('公司抬头名称已存在');
    }
    item.name = name;
    item.updated_at = Date.now();
    await dbPut('company_title', item);
  },

  async delete(id) {
    await dbDelete('company_title', id);
  }
};
