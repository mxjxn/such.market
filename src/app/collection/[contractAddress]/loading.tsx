export default function CollectionLoading() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Search Bar Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>

        {/* Collection Info Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="space-y-2">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse"></div>
            </div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20 mb-2 animate-pulse"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-16 animate-pulse"></div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-24 mb-2 animate-pulse"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-20 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* NFTs Section Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
            <div className="flex gap-2">
              <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
          </div>

          {/* NFT Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <div className="aspect-square bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="flex gap-1">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 