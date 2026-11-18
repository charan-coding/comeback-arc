import React from 'react';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-dungeon-500 bg-dungeon-700/80 p-4 shadow-lg shadow-black/30 ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 text-xs uppercase tracking-widest text-ember-400">{children}</h2>;
}
