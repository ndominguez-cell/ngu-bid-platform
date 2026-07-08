'use client';

export default function PrintActions() {
  return (
    <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
      <button
        onClick={() => window.print()}
        className="bg-[#1a3a5c] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#e87722] transition-colors shadow-lg"
      >
        Print / Save PDF
      </button>
      <button
        onClick={() => window.close()}
        className="bg-white border border-gray-200 text-gray-600 text-sm font-semibold px-4 py-2 rounded-lg hover:border-[#1a3a5c] transition-colors shadow-lg"
      >
        Close
      </button>
    </div>
  );
}
