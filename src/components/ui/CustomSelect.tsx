import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  badge?: string;
  icon?: React.ReactNode;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  clearable?: boolean;
}

interface Coords {
  top: number;
  left: number;
  width: number;
  placeAbove: boolean;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = '请选择...',
  className,
  disabled = false,
  size = 'md',
  clearable = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  // Synchronously compute floating menu position relative to trigger button
  const computeCoords = useCallback((): Coords | null => {
    if (!buttonRef.current) return null;
    const rect = buttonRef.current.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const placeAbove = spaceBelow < 200 && rect.top > 200;

    return {
      top: placeAbove ? rect.top + scrollTop - 4 : rect.bottom + scrollTop + 4,
      left: rect.left + scrollLeft,
      width: Math.max(rect.width, 160),
      placeAbove,
    };
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      const initialCoords = computeCoords();
      if (initialCoords) {
        setCoords(initialCoords);
      }
      setIsOpen(true);
      setSearchQuery('');
    } else {
      setIsOpen(false);
    }
  };

  // Keep coordinates perfectly in sync on open / scroll / resize before paint
  useLayoutEffect(() => {
    if (isOpen) {
      const nextCoords = computeCoords();
      if (nextCoords) {
        setCoords(nextCoords);
      }
    }
  }, [isOpen, computeCoords]);

  useEffect(() => {
    if (isOpen) {
      const handleScrollOrResize = () => {
        const nextCoords = computeCoords();
        if (nextCoords) {
          setCoords(nextCoords);
        }
      };

      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          buttonRef.current &&
          !buttonRef.current.contains(target) &&
          menuRef.current &&
          !menuRef.current.contains(target)
        ) {
          setIsOpen(false);
        }
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsOpen(false);
          buttonRef.current?.focus();
        }
      };

      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);

      // Focus search input if rendered
      if (options.length > 5) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 30);
      }

      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, computeCoords, options.length]);

  const filteredOptions = searchQuery.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : options;

  const sizeClasses = {
    sm: 'min-h-8 px-2.5 py-1 text-xs rounded-lg',
    md: 'min-h-10 px-3 py-2 text-sm rounded-xl',
  };

  return (
    <div className={cn('relative inline-block w-full', className)}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          'w-full flex items-center justify-between gap-2 border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-2xs transition-all duration-150 hover:border-stone-300 dark:hover:border-stone-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 disabled:opacity-50 disabled:pointer-events-none text-left select-none',
          sizeClasses[size],
          isOpen && 'ring-2 ring-rose-500/20 border-rose-500 dark:border-rose-500'
        )}
      >
        <span className="flex items-center gap-1.5 truncate">
          {selectedOption?.icon}
          <span className={selectedOption ? 'font-medium truncate' : 'text-stone-400 dark:text-stone-500 truncate'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {clearable && value && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-0.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded transition-colors"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-stone-400 transition-transform duration-150',
              isOpen && 'rotate-180 text-rose-500'
            )}
          />
        </div>
      </button>

      {/* Portal Mounted Menu (Rendered ONLY when exact coordinates are ready) */}
      {isOpen &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              minWidth: `${coords.width}px`,
              maxWidth: '360px',
              transformOrigin: coords.placeAbove ? 'bottom left' : 'top left',
              transform: coords.placeAbove ? 'translateY(-100%)' : 'none',
            }}
            className="fixed z-50 max-h-64 overflow-y-auto rounded-xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-stone-900 p-1.5 shadow-modal text-stone-900 dark:text-stone-100 transition-all duration-150 animate-in fade-in zoom-in-95"
          >
            {/* Search filter if more than 5 options */}
            {options.length > 5 && (
              <div className="relative p-1 mb-1 border-b border-stone-100 dark:border-stone-800">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="搜索选项..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-2 py-1 text-xs rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-200/60 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-stone-400" />
              </div>
            )}

            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-stone-400">无匹配项</div>
            ) : (
              <div className="space-y-0.5">
                {filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-left',
                        isSelected
                          ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 font-bold'
                          : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                      )}
                    >
                      <span className="flex items-center gap-2 truncate">
                        {opt.icon}
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-stone-100 dark:bg-stone-800 text-stone-500">
                            {opt.badge}
                          </span>
                        )}
                      </span>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
