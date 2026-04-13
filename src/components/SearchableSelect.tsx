import React, { useState, useRef, useEffect } from 'react';
import './SearchableSelect.css';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
  emptyMessage?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = '-- Select --',
  title = 'Select',
  disabled = false,
  emptyMessage = 'No results found',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedLabel = options.find(o => o.value === value)?.label ?? '';

  const filtered = search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.trim().toLowerCase()))
    : options;

  const handleOpen = () => {
    if (disabled) return;
    setSearch('');
    setOpen(true);
  };

  // Focus search input after the dropdown is mounted
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => searchRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleSelect = (opt: Option) => {
    onChange(opt.value);
    setOpen(false);
    setSearch('');
  };

  const handleClear = () => {
    onChange('');
    setOpen(false);
    setSearch('');
  };

  const handleClose = () => {
    setOpen(false);
    setSearch('');
  };

  // Close on outside click (desktop)
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Prevent body scroll when sheet is open on mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div className={`ss-container${open ? ' ss-open' : ''}${disabled ? ' ss-disabled' : ''}`} ref={containerRef}>
      {/* Trigger */}
      <button
        type="button"
        className="ss-trigger"
        onClick={handleOpen}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`ss-trigger-label${!value ? ' ss-placeholder' : ''}`}>
          {value ? selectedLabel : placeholder}
        </span>
        <span className="ss-arrow">▼</span>
      </button>

      {open && (
        <>
          {/* Backdrop — dims page on mobile, closes on click */}
          <div className="ss-backdrop" onClick={handleClose} />

          <div className="ss-dropdown" role="listbox">
            {/* Mobile header with title and close button */}
            <div className="ss-dropdown-header">
              <span className="ss-dropdown-title">{title}</span>
              <button type="button" className="ss-close" onClick={handleClose} aria-label="Close">✕</button>
            </div>

            {/* Search input */}
            <div className="ss-search-wrap">
              <span className="ss-search-icon">⌕</span>
              <input
                ref={searchRef}
                type="text"
                className="ss-search"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              {search && (
                <button
                  type="button"
                  className="ss-search-clear"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Options */}
            <ul className="ss-list">
              {value && (
                <li className="ss-option ss-clear-option" onClick={handleClear} role="option" aria-selected={false}>
                  — Clear selection —
                </li>
              )}
              {filtered.length === 0 ? (
                <li className="ss-empty">{emptyMessage}</li>
              ) : (
                filtered.map(opt => (
                  <li
                    key={opt.value}
                    className={`ss-option${opt.value === value ? ' ss-selected' : ''}`}
                    onClick={() => handleSelect(opt)}
                    role="option"
                    aria-selected={opt.value === value}
                  >
                    <span>{opt.label}</span>
                    {opt.value === value && <span className="ss-check">✓</span>}
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default SearchableSelect;
