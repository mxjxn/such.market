'use client';

import Link from 'next/link';

export function HomeButton() {
  return (
    <Link 
      href="/" 
      className="fixed top-4 left-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 hover:shadow-xl transition-shadow duration-200"
    >
      {/* Placeholder logo - you can replace this with your actual logo */}
      <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center text-white font-bold">
        CA
      </div>
    </Link>
  );
} 