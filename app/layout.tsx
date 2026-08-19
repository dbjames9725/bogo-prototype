import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Header from '@/components/Header';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BOGO Split - Share Deals & Split Costs',
  description: 'Split Buy 1 Get 1 Free and Buy 1 Get 1 50% Off deals with partners easily.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-gray-50 text-gray-900 flex flex-col`}>
        <Header />
        <main className="flex-grow py-6">{children}</main>
        <footer className="bg-white border-t border-gray-200 py-4 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} BOGO Split Prototype. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
