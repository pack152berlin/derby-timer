import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className,
}: SearchInputProps) {
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
