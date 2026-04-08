// API client — talks to the Node.js backend

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data as T;
}

// ── Auth ──
export type UserRole = 'admin' | 'editor' | 'viewer';

export interface Company {
  id?: number;
  name: string;
  logo?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface AuthResponse {
  token: string;
  user: {
    uid: string;
    email: string;
    companyId?: number;
    companyName?: string;
    companyAddress?: string;
    role?: UserRole;
  };
}

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  const data = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem('token', data.token);
  localStorage.setItem('currentUser', JSON.stringify(data.user));
  return data;
}

export async function apiSignup(
  _email: string,
  _password: string,
  _companyName?: string,
  _companyLogo?: string,
  _companyAddress?: string
): Promise<AuthResponse> {
  // Signup disabled - always throw error
  throw new Error('Self-registration is disabled. Contact your administrator to create an account.');
}

export async function apiGetMe(): Promise<{
  user: {
    uid: string;
    email: string;
    companyId?: number;
    companyName?: string;
    companyLogo?: string;
    companyAddress?: string;
    role?: UserRole;
  };
}> {
  return request('/auth/me');
}

export async function apiCreateUser(
  email: string,
  password: string,
  companyId?: number,
  role?: UserRole
): Promise<{ message: string; user: { uid: string; email: string; role: string } }> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Not authenticated');
  }
  return request('/auth/create-user', {
    method: 'POST',
    body: JSON.stringify({ email, password, companyId, role }),
    headers: { 'Authorization': `Bearer ${token}` },
  });
}

export async function apiUploadLogo(file: File, companyId: number): Promise<{ message: string; companyId: number }> {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('logo', file);
  formData.append('companyId', String(companyId));

  const res = await fetch(`${API_BASE}/auth/upload-logo`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Logo upload failed');
  }
  return data;
}

export function apiLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
}

// ── Products ──
export interface Product {
  id: number | string;
  uniqueId: string;
  name: string;
  batch: string;
  mfg: string;
  expiry: string;
  shortUrl: string;
  manufacturer?: string;
  manufacturerAddress?: string;
  technicalName?: string;
  registrationNumber?: string;
  packingSize?: string;
  manufacturerLicence?: string;
  imageUrl?: string;
  hazardSymbol?: string;
  hazardId?: number;
  quantity?: string;
  productImage?: string;
  companyId?: number;
  companyName?: string;
}

export async function apiGetProducts(): Promise<Product[]> {
  const data = await request<{ products: Product[] }>('/products');
  return data.products;
}

export async function apiGetMasterProducts(): Promise<Product[]> {
  const data = await request<{ products: Product[] }>('/products/master');
  return data.products;
}

export async function apiGetProduct(uniqueId: string): Promise<Product> {
  const data = await request<{ product: Product }>(`/products/${uniqueId}`);
  return data.product;
}

// Alias for clarity when fetching a public product
export const apiGetProductByUniqueId = apiGetProduct;

export async function apiAddProduct(product: Partial<Product>): Promise<Product> {
  const data = await request<{ product: Product }>('/products', {
    method: 'POST',
    body: JSON.stringify(product),
  });
  return data.product;
}

export async function apiUpdateProduct(uniqueId: string, updates: Partial<Product>): Promise<Product> {
  const data = await request<{ product: Product }>(`/products/${uniqueId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return data.product;
}

export async function apiDeleteProduct(uniqueId: string): Promise<void> {
  await request(`/products/${uniqueId}`, { method: 'DELETE' });
}

export async function apiUploadProductImage(uniqueId: string, file: File): Promise<{ message: string; productImage: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append('productImage', file);

  const res = await fetch(`${API_BASE}/products/${uniqueId}/upload-image`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Image upload failed');
  }
  return data;
}

export async function apiGetTrashProducts(): Promise<Product[]> {
  const data = await request<{ products: Product[] }>('/products/trash/list');
  return data.products;
}

export async function apiRestoreProduct(uniqueId: string): Promise<void> {
  await request(`/products/${uniqueId}/restore`, { method: 'POST' });
}

export async function apiPermanentDeleteProduct(uniqueId: string): Promise<void> {
  await request(`/products/${uniqueId}/permanent`, { method: 'DELETE' });
}

export interface BulkUploadResult {
  message: string;
  inserted: number;
  skipped: number;
  errors: string[];
  totalRows: number;
}

export async function apiBulkUploadProducts(file: File, companyId?: number): Promise<BulkUploadResult> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);
  if (companyId) formData.append('companyId', String(companyId));

  const res = await fetch(`${API_BASE}/products/bulk-upload`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData, // don't set Content-Type — browser sets multipart boundary
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Upload failed (${res.status})`);
  }
  return data as BulkUploadResult;
}

// ── Companies ──
export async function apiAddCompany(company: Company): Promise<Company> {
  return request('/companies', {
    method: 'POST',
    body: JSON.stringify(company),
  });
}

export async function apiGetAllCompanies(): Promise<Company[]> {
  return request('/companies');
}


export async function apiGetCompanyById(id: number): Promise<Company> {
  return request(`/companies/${id}`);
}

// Public company info (no auth required)
export async function apiGetCompanyPublic(id: number): Promise<{ id: number; name: string }> {
  const res = await fetch(`${API_BASE}/companies/${id}/public`);
  if (!res.ok) {
    throw new Error('Company not found');
  }
  return res.json();
}

export async function apiCreateCompany(company: Company): Promise<Company> {
  return request('/companies', {
    method: 'POST',
    body: JSON.stringify(company),
  });
}

export async function apiUpdateCompany(id: number, updates: Partial<Company>): Promise<Company> {
  return request(`/companies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function apiDeleteCompany(id: number): Promise<void> {
  await request(`/companies/${id}`, { method: 'DELETE' });
}

// ── Admin ──
export async function apiExportDatabase(): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/admin/export-sql`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Export failed');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `db-export-${new Date().toISOString().slice(0, 10)}.sql`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Hazards ──
export interface Hazard {
  id?: number;
  name: string;
  hasImage?: boolean;
}

export async function apiGetHazards(): Promise<Hazard[]> {
  const data = await request<{ hazards: Hazard[] }>('/hazards');
  return data.hazards;
}

export async function apiCreateHazard(name: string, imageFile?: File): Promise<Hazard> {
  const token = getToken();
  const formData = new FormData();
  formData.append('name', name);
  if (imageFile) formData.append('image', imageFile);
  const res = await fetch(`${API_BASE}/hazards`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create hazard');
  return data as Hazard;
}

export async function apiUpdateHazard(id: number, name: string, imageFile?: File): Promise<Hazard> {
  const token = getToken();
  const formData = new FormData();
  formData.append('name', name);
  if (imageFile) formData.append('image', imageFile);
  const res = await fetch(`${API_BASE}/hazards/${id}`, {
    method: 'PUT',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update hazard');
  return data as Hazard;
}

export async function apiDeleteHazard(id: number): Promise<void> {
  await request(`/hazards/${id}`, { method: 'DELETE' });
}
