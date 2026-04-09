import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NativeLayer AI — Dashboard',
  description: 'Merchant control plane for NativeLayer AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
