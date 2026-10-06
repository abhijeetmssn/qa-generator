import React from 'react';

type ToggleSwitchProps = {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  onLabel: string;  // text shown next to the switch when on
  offLabel: string; // text shown when off
};

// On/off switch used for admin company settings (Scan Analytics, One QR per Pack).
const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, disabled, onLabel, offLabel }) => (
  <div className="toggle-row">
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`toggle-switch${checked ? ' is-on' : ''}`}
      onClick={onChange}
      disabled={disabled}
    >
      <span className="toggle-knob" />
    </button>
    <span className={`toggle-label${checked ? ' is-on' : ''}`}>{checked ? onLabel : offLabel}</span>
  </div>
);

export default ToggleSwitch;
