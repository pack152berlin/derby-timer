import React from 'react';
import { cn } from '@/lib/utils';

export interface Section {
  id: string;
  title: string;
}

export interface Page {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  sections: Section[];
  component: React.FC;
}

export function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-20 pt-2">
      <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-1">
        {children}
      </h2>
      <div className="h-0.5 w-12 bg-[#003F87] rounded-full mb-4" />
    </div>
  );
}

export function Callout({
  children,
  variant = 'navy',
}: {
  children: React.ReactNode;
  variant?: 'navy' | 'amber' | 'blue';
}) {
  const styles = {
    navy: 'border-[#003F87] bg-[#003F87]/5 text-[#003F87]',
    amber: 'border-yellow-400 bg-yellow-50 text-yellow-800',
    blue: 'border-blue-300 bg-blue-50/80 text-blue-900',
  };
  return (
    <div className={cn('border-l-4 rounded-r-lg px-4 py-3 text-sm font-medium', styles[variant])}>
      {children}
    </div>
  );
}

export function StepList({ steps }: { steps: { title: string; desc: string }[] }) {
  return (
    <div className="space-y-3 my-3">
      {steps.map((step, i) => (
        <div key={step.title} className="flex gap-3">
          <div className="shrink-0 w-7 h-7 rounded-full bg-[#003F87] text-white text-xs font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">{step.title}</p>
            <p className="text-slate-600 text-sm">{step.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageTocMobile({ sections }: { sections: Section[] }) {
  if (sections.length === 0) return null;
  return (
    <nav className="rounded-lg border border-slate-200 bg-white px-4 py-3 mb-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-2">
        On this page
      </p>
      <ul className="space-y-0.5">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="group flex items-center gap-2 text-sm text-slate-600 hover:text-[#003F87] font-medium py-0.5 transition-colors"
            >
              <span className="w-1 h-1 rounded-full bg-slate-300 group-hover:bg-[#003F87] transition-colors" />
              {s.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
