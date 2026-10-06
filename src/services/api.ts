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

export class SubscriptionExpiredError extends Error {
  subscriptionExpiresAt: string;
  constructor(message: string, subscriptionExpiresAt: string) {
    super(message);
    this.name = 'SubscriptionExpiredError';
    this.subscriptionExpiresAt = subscriptionExpiresAt;
  }
}

export interface Company {
  id?: number;
  name: string;
  logo?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  scanAnalyticsEnabled?: boolean;
  perPackQrEnabled?: boolean; // admin has allowed one QR per pack for this company
  subscriptionExpiresAt?: string;
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
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 403 && data.subscriptionExpiresAt) {
      throw new SubscriptionExpiredError(data.error, data.subscriptionExpiresAt);
    }
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  localStorage.setItem('token', data.token);
  localStorage.setItem('currentUser', JSON.stringify(data.user));
  return data as AuthResponse;
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

export async function apiChangePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  return request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
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
  manufacturer?: string;
  manufacturerAddress?: string;
  technicalName?: string;
  registrationNumber?: string;
  packingSize?: string;
  manufacturerLicence?: string;
  marketedBy?: string;
  imageUrl?: string;
  hazardSymbol?: string;
  hazardId?: number;
  productImage?: string;
  leafletUrl?: string;
  hasOwnImage?: boolean;
  hasOwnLeaflet?: boolean;
  companyId?: number;
  companyName?: string;
  is_master?: boolean;
  createdDate?: string;
  updatedDate?: string;
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

// Public product page (QR scan). Location is mandatory — the server refuses without it
// and logs the scan with these coordinates.
export async function apiViewProduct(uniqueId: string, coords: { latitude: number; longitude: number }): Promise<Product> {
  const data = await request<{ product: Product }>(`/products/${uniqueId}/view`, {
    method: 'POST',
    body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }),
  });
  return data.product;
}

// Pack QR codes created for a batch (one QR per pack)
export interface PackCodeRun {
  fromSerial: number;
  toSerial: number;
  count: number;
}

// packCount (optional): also create one QR per pack — only allowed when the admin has enabled it for the company
export async function apiAddProduct(product: Partial<Product> & { packCount?: number }): Promise<Product & { packCodes?: PackCodeRun }> {
  const data = await request<{ product: Product; packCodes?: PackCodeRun }>('/products', {
    method: 'POST',
    body: JSON.stringify(product),
  });
  return data.packCodes ? { ...data.product, packCodes: data.packCodes } : data.product;
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

export async function apiUploadProductLeaflet(uniqueId: string, file: File): Promise<{ message: string; leafletUrl: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append('leaflet', file);

  const res = await fetch(`${API_BASE}/products/${uniqueId}/upload-leaflet`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Leaflet upload failed');
  }
  return data;
}

export async function apiDeleteProductImage(uniqueId: string): Promise<void> {
  await request(`/products/${uniqueId}/image`, { method: 'DELETE' });
}

export async function apiDeleteProductLeaflet(uniqueId: string): Promise<void> {
  await request(`/products/${uniqueId}/leaflet`, { method: 'DELETE' });
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
export async function apiGetCompanyPublic(id: number): Promise<{ id: number; name: string; phone?: string; email?: string; website?: string; address?: string; facebookUrl?: string; instagramUrl?: string; scanAnalyticsEnabled?: boolean; subscriptionExpiresAt?: string }> {
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

export async function apiRenewSubscription(id: number): Promise<Company> {
  return request<Company>(`/companies/${id}/renew`, { method: 'POST' });
}

// ── Admin ──
export interface LockedUser {
  uid: string;
  email: string;
  lockedAt: string;
  companyId?: number;
}

export interface ManagedUser {
  uid: string;
  email: string;
  role: string;
  companyId?: number;
  companyName?: string;
  lockedAt: string | null;
  createdDate: string;
}

export async function apiGetAllUsers(): Promise<ManagedUser[]> {
  const data = await request<{ users: ManagedUser[] }>('/admin/users');
  return data.users;
}

export async function apiGetLockedUsers(): Promise<LockedUser[]> {
  const data = await request<{ users: LockedUser[] }>('/admin/locked-users');
  return data.users;
}

export async function apiUnlockUser(uid: string): Promise<void> {
  await request(`/admin/users/${uid}/unlock`, { method: 'POST' });
}

export async function apiLockUser(uid: string): Promise<void> {
  await request(`/admin/users/${uid}/lock`, { method: 'POST' });
}

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

// ── Scan Analytics ──
export interface ScanRecentEntry {
  scannedAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface ScanSummary {
  productId: string;
  productName: string;
  totalScans: number;
  lastScanned: string | null;
  recentScans: ScanRecentEntry[];
}

export interface ScanAnalyticsResponse {
  summary: ScanSummary[];
  totalScans: number;
  totalProducts: number;
}

export interface ScanDetailResponse {
  scans: ScanRecentEntry[];
  total: number;
}

export async function apiGetScanAnalytics(params?: { page?: number; limit?: number; search?: string }): Promise<ScanAnalyticsResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.search) qs.set('search', params.search);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request<ScanAnalyticsResponse>(`/products/scan-analytics${query}`);
}

export async function apiGetProductScanDetails(productId: string, params?: { page?: number; limit?: number }): Promise<ScanDetailResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request<ScanDetailResponse>(`/products/scan-analytics/${productId}/scans${query}`);
}

// ── Pack QR codes (one QR per pack) ──
// Public product page for a pack QR (#c/<code>). Location is mandatory, like the batch QR page.
export async function apiViewPackProduct(code: string, scan: { latitude: number; longitude: number; deviceId: string }): Promise<Product> {
  const data = await request<{ product: Product }>(`/pack-codes/${encodeURIComponent(code)}/view`, {
    method: 'POST',
    body: JSON.stringify(scan),
  });
  return data.product;
}

export async function apiGetPackCodeSummary(uniqueId: string): Promise<{ total: number; lastSerial: number }> {
  return request(`/pack-codes/product/${uniqueId}`);
}

export async function apiGetPackCodes(uniqueId: string, from: number, to: number): Promise<{ serialNo: number; code: string; url: string }[]> {
  const data = await request<{ codes: { serialNo: number; code: string; url: string }[] }>(
    `/pack-codes/product/${uniqueId}/codes?from=${from}&to=${to}`
  );
  return data.codes;
}

export async function apiDownloadPackCodesCsv(uniqueId: string, from: number, to: number): Promise<Blob> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/pack-codes/product/${uniqueId}/codes?from=${from}&to=${to}&format=csv`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to download pack QR codes');
  }
  return res.blob();
}
