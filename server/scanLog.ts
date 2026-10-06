// Scan logging shared by the public product page (batch QR) and pack QR scans
import type { Request } from 'express';
import { getCompanyById, logScanEvent } from './db';
import type { Product } from './db';

export const isCoordinate = (v: unknown, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max;

/**
 * Log one QR scan in scan_events with the scanner's GPS location (reverse-geocoded to a
 * place name). Skipped when the company has Scan Analytics off or its subscription has expired.
 * Call after responding — reverse geocoding can take a few seconds.
 */
export async function recordScan(
  req: Request,
  product: Product,
  gps: { latitude: number; longitude: number },
  pack?: { packCodeId: number; deviceId: string | null }
): Promise<void> {
  // Only log if the company has scan analytics enabled and an active subscription
  if (product.companyId) {
    const company = await getCompanyById(product.companyId);
    if (!company || company.scanAnalyticsEnabled === false) return;
    if (company.subscriptionExpiresAt && new Date(company.subscriptionExpiresAt).getTime() < Date.now()) return;
  }

  const rawIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string)?.trim() ||
    req.socket.remoteAddress ||
    null;

  // Normalise IPv4-mapped IPv6 (::ffff:1.2.3.4 → 1.2.3.4)
  const ipAddress = rawIp?.replace(/^::ffff:/, '') || null;
  const userAgent = req.headers['user-agent'] || null;

  // Reverse-geocode the GPS coordinates via OpenStreetMap Nominatim
  let country: string | null = null;
  let region: string | null = null;
  let city: string | null = null;
  try {
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${gps.latitude}&lon=${gps.longitude}&format=json`,
      { headers: { 'User-Agent': 'qa-generator-scan-tracker/1.0' }, signal: AbortSignal.timeout(4000) }
    );
    if (geoRes.ok) {
      const geoData: any = await geoRes.json();
      country = geoData?.address?.country ?? null;
      region = geoData?.address?.state ?? geoData?.address?.county ?? null;
      city = geoData?.address?.city ?? geoData?.address?.town ?? geoData?.address?.village ?? null;
    }
  } catch {
    // Nominatim unavailable — leave city/country blank, coordinates still saved
  }

  console.log(`[scan] ip=${ipAddress} gps=${gps.latitude},${gps.longitude} resolved=${city},${country}${pack ? ` pack=${pack.packCodeId}` : ''}`);

  await logScanEvent({
    productId: product.uniqueId,
    companyId: product.companyId,
    productName: product.name,
    ipAddress: ipAddress ?? undefined,
    userAgent: userAgent ?? undefined,
    country: country ?? undefined,
    region: region ?? undefined,
    city: city ?? undefined,
    latitude: gps.latitude,
    longitude: gps.longitude,
    packCodeId: pack?.packCodeId,
    deviceId: pack?.deviceId ?? undefined,
  });
}
