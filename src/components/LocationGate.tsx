import React, { useEffect, useState } from 'react';
import Icon from './Icon';
import '../ViewProduct.css';

export interface ScanCoords {
  latitude: number;
  longitude: number;
}

type GateState = 'locating' | 'denied' | 'unavailable' | 'timeout' | 'unsupported';

interface LocationGateProps {
  children: (coords: ScanCoords) => React.ReactNode;
}

// Geolocation only works in a secure (https) page with a browser that supports it —
// some QR scanner apps open links in a built-in browser without it.
const canLocate = () => 'geolocation' in navigator && window.isSecureContext;

// Public product pages open only after the phone shares its location. A browser can't be
// forced to share it, so until it does we explain how to turn it on and let the user retry.
const LocationGate: React.FC<LocationGateProps> = ({ children }) => {
  const [coords, setCoords] = useState<ScanCoords | null>(null);
  const [state, setState] = useState<GateState>(() => (canLocate() ? 'locating' : 'unsupported'));
  const [attempt, setAttempt] = useState(0);

  const retry = () => {
    setState('locating');
    setAttempt((a) => a + 1);
  };

  useEffect(() => {
    if (!canLocate()) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        // Keep the first fix — the product page must not reload when a later retry lands
        setCoords((prev) => prev ?? { latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      (err) => {
        if (cancelled) return;
        // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        setState(err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    );
    return () => { cancelled = true; };
  }, [attempt]);

  // Try again by itself as soon as location is allowed in the browser settings
  useEffect(() => {
    let active = true;
    let status: PermissionStatus | null = null;
    const onChange = () => {
      if (status?.state !== 'granted') return;
      setState('locating');
      setAttempt((a) => a + 1);
    };
    navigator.permissions?.query({ name: 'geolocation' })
      .then((s) => {
        if (!active) return;
        status = s;
        s.addEventListener('change', onChange);
      })
      .catch(() => {});
    return () => {
      active = false;
      status?.removeEventListener('change', onChange);
    };
  }, []);

  if (coords) return <>{children(coords)}</>;

  return (
    <div className="public-state">
      <div className="public-state-card">
        {state === 'locating' && (
          <>
            <div className="public-state-icon"><Icon name="map-pin" size={26} /></div>
            <h2 className="public-state-title">Allow location to continue</h2>
            <p className="public-state-text">
              To view this product, we need your location.
              Tap <strong>Allow</strong> when your phone asks.
            </p>
            <div style={{ marginTop: '20px' }}><div className="public-spinner" /></div>
            <p className="public-state-muted">Finding your location…</p>
          </>
        )}

        {state === 'denied' && (
          <>
            <div className="public-state-icon is-danger"><Icon name="map-pin" size={26} /></div>
            <h2 className="public-state-title is-danger">Location is required</h2>
            <p className="public-state-text">This product can only be viewed with location turned on.</p>
            <ol className="public-state-steps">
              <li><strong>Android (Chrome):</strong> tap the lock icon next to the website address → Permissions → Location → Allow.</li>
              <li><strong>iPhone (Safari):</strong> tap <strong>aA</strong> in the address bar → Website Settings → Location → Allow.</li>
              <li>Still blocked on iPhone? Settings → Privacy &amp; Security → Location Services → Safari Websites → While Using the App.</li>
            </ol>
            <button type="button" className="public-state-button" onClick={retry}>Try again</button>
          </>
        )}

        {state === 'unavailable' && (
          <>
            <div className="public-state-icon is-warning"><Icon name="location" size={26} /></div>
            <h2 className="public-state-title">Turn on your phone's location</h2>
            <p className="public-state-text">
              Your phone's location (GPS) seems to be off. Turn it on from the quick settings panel,
              then tap Try again.
            </p>
            <button type="button" className="public-state-button" onClick={retry}>Try again</button>
          </>
        )}

        {state === 'timeout' && (
          <>
            <div className="public-state-icon is-warning"><Icon name="clock" size={26} /></div>
            <h2 className="public-state-title">Couldn't find your location</h2>
            <p className="public-state-text">Move to an open area or near a window, then tap Try again.</p>
            <button type="button" className="public-state-button" onClick={retry}>Try again</button>
          </>
        )}

        {state === 'unsupported' && (
          <>
            <div className="public-state-icon is-warning"><Icon name="alert" size={26} /></div>
            <h2 className="public-state-title">Open this page in Chrome or Safari</h2>
            <p className="public-state-text">
              This app can't share your location. Open the link in Chrome (Android) or
              Safari (iPhone) to view the product.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default LocationGate;
