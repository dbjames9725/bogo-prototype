'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="bg-blue-600 text-white font-extrabold text-lg px-2.5 py-1 rounded-lg tracking-wider">
              BOGO
            </span>
            <span className="font-bold text-gray-900 text-xl tracking-tight hidden sm:inline">
              Split
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/"
              className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                pathname === '/'
                  ? 'bg-blue-50 text-blue-600 font-semibold'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Create Split
            </Link>

            <Link
              href="/dashboard"
              className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                pathname === '/dashboard'
                  ? 'bg-blue-50 text-blue-600 font-semibold'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Host Dashboard
            </Link>

            <Link
              href="/"
              className="ml-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold px-3 py-2 rounded-lg transition"
            >
              + New Lobby
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
