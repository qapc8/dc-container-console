import type { ReactNode } from 'react';
import { Header } from './Header';
import { TabBar } from './TabBar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100">
      <Header />
      <TabBar />
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  );
}
