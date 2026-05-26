import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NGU Bid Platform',
  description: 'Bid pipeline, estimates, CRM, and proposals for NGU Construction',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
