'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';

export default function AppShell({ userEmail, children }: { userEmail?: string; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — fixed on mobile, normal on desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-30 transition-transform duration-200 md:relative md:translate-x-0 md:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar userEmail={userEmail} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-gray-50 min-w-0">
        {/* Mobile header bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[#0d2137] sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white/70 hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-[#e87722] px-2 py-0.5 rounded">
              <span className="text-white font-black text-sm tracking-widest">NGU</span>
            </div>
            <span className="text-white font-bold text-sm">BID PLATFORM</span>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
