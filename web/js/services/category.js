// ===== Category Service =====
const CategoryService = {
  async getAll() {
    const cats = await dbGetAll('category');
    return cats.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  },

  async getById(id) {
    return await dbGet('category', id);
  },

  async add(name) {
    const all = await this.getAll();
    const maxSort = all.reduce((max, c) => Math.max(max, c.sort_order || 0), 0);
    const now = Date.now();
    return await dbAdd('category', {
      name,
      icon: '',
      is_default: 0,
      sort_order: maxSort + 1,
      created_at: now,
      updated_at: now
    });
  },

  async update(id, name) {
    const cat = await dbGet('category', id);
    if (!cat) return;
    cat.name = name;
    cat.updated_at = Date.now();
    await dbPut('category', cat);
  },

  async delete(id) {
    const cat = await dbGet('category', id);
    if (cat && cat.is_default) {
      throw new Error('系统内置分类不可删除');
    }
    await dbDelete('category', id);
  }
};
