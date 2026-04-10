// Database service - local data operations (no Firebase needed)

export type Product = {
  id?: string | number;
  uniqueId: string;
  name: string;
  batch: string;
  mfg: string;
  expiry: string;
  manufacturer?: string;
  manufacturerAddress?: string;
  technicalName?: string;
  registrationNumber?: string;
  packingSize?: string;
  manufacturerLicence?: string;
};

class DatabaseService {
  private products: Product[] = [];
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadFromJSON();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      this.initialized = true;
    }
  }

  private async loadFromJSON(): Promise<void> {
    try {
      const response = await import('../data/products.json');
      this.products = (response.default.products || []) as Product[];
    } catch (error) {
      console.error('Failed to load from JSON:', error);
      this.products = [];
    }
  }

  async getAllProducts(): Promise<Product[]> {
    await this.initialize();
    return [...this.products];
  }

  async getProductById(uniqueId: string): Promise<Product | null> {
    await this.initialize();
    return this.products.find(p => p.uniqueId === uniqueId) || null;
  }

  async addProduct(product: Product): Promise<Product> {
    await this.initialize();
    this.products.push(product);
    return product;
  }

  async updateProduct(
    uniqueId: string,
    updates: Partial<Product>
  ): Promise<Product | null> {
    await this.initialize();
    const index = this.products.findIndex(p => p.uniqueId === uniqueId);
    if (index === -1) return null;

    const updatedProduct = { ...this.products[index], ...updates };
    this.products[index] = updatedProduct;
    return updatedProduct;
  }

  async deleteProduct(uniqueId: string): Promise<boolean> {
    await this.initialize();
    const index = this.products.findIndex(p => p.uniqueId === uniqueId);
    if (index === -1) return false;

    this.products.splice(index, 1);
    return true;
  }

  async searchProducts(query: string): Promise<Product[]> {
    await this.initialize();
    const lower = query.toLowerCase();
    return this.products.filter(
      p =>
        p.name.toLowerCase().includes(lower) ||
        p.manufacturer?.toLowerCase().includes(lower) ||
        p.technicalName?.toLowerCase().includes(lower)
    );
  }
}

export const db = new DatabaseService();
