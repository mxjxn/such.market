import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center">
        <div className="relative">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 dark:text-purple-400 mx-auto mb-4" />
          <div className="absolute inset-0 w-12 h-12 border-4 border-purple-200 dark:border-purple-800 rounded-full animate-ping opacity-20"></div>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Loading...
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Preparing your NFT experience
        </p>
      </div>
    </div>
  );
} 