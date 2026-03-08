import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /**
   * 'default' — tall standalone input (white bg, border) for use outside a pane
   * 'inset'   — shorter white input with border for use inside a filter pane
   * 'compact' — icon + input inside a grey pill wrapper (standings style)
   */
  variant?: 'default' | 'inset' | 'compact';
  className?: string;
}

const inputBaseClass = [
  'w-full bg-white rounded-md border border-slate-300 text-sm text-slate-900',
  'transition-[border-color,box-shadow]',
  'focus:border-slate-400 focus:ring-1 focus:ring-slate-200 focus:outline-none',
  'placeholder:text-slate-400',
].join(' ');

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  variant = 'default',
  className,
}: SearchInputProps) {
  if (variant === 'compact') {
    return (
      <div className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100',
        'transition-[border-color,box-shadow]',
        'focus-within:border-slate-300 focus-within:ring-1 focus-within:ring-slate-200',
        className,
      )}>
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 h-7 bg-transparent border-0 outline-none shadow-none text-sm font-medium text-slate-900 placeholder:text-slate-400"
        />
      </div>
    );
  }

  if (variant === 'inset') {
    return (
      <div className={cn('relative', className)}>
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ outlineStyle: 'none' }}
          className={cn(inputBaseClass, 'pl-8 h-8')}
        />
      </div>
    );
  }

  // default — tall standalone input
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ outlineStyle: 'none' }}
        className={cn(inputBaseClass, 'pl-10 h-12')}
      />
    </div>
  );
}
