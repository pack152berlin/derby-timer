import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useApp } from '../context';

export function AdminBanner() {
  const { canEdit } = useApp();
  if (canEdit) return null;

  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800">
      <ShieldAlert className="w-4 h-4 shrink-0" />
      Admin access required to make changes
    </div>
  );
}
