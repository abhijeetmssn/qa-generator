import React from 'react';
import './Spinner.css';

interface SpinnerProps {
  /** Visual size of the spinner */
  size?: 'small' | 'medium' | 'large';
  /** Optional label shown below the spinner */
  label?: string;
  /** Fill the parent container and center (default false) */
  fullArea?: boolean;
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'medium', label, fullArea = false }) => {
  const spinner = <div className={`spinner spinner-${size}`} aria-label="Loading" role="status" />;

  if (fullArea) {
    return (
      <div className="spinner-area">
        {spinner}
        {label && <p className="spinner-label">{label}</p>}
      </div>
    );
  }

  return (
    <span className="spinner-inline">
      {spinner}
      {label && <span className="spinner-label-inline">{label}</span>}
    </span>
  );
};

export default Spinner;
