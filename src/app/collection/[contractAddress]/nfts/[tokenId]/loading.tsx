export default function NFTLoading() {
  return (
    <main className="max-w-md mx-auto p-4 flex flex-col gap-4">
      {/* NFT Image & Metadata Skeleton */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
        <div className="w-full aspect-square bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" style={{ maxWidth: 320 }}></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2 animate-pulse"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2 animate-pulse"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-2 animate-pulse"></div>
        <div className="flex flex-wrap gap-2 mb-2">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
        </div>
      </div>

      {/* Listing/Action Section Skeleton */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-col gap-2">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse"></div>
      </div>

      {/* Offers List Skeleton */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2 animate-pulse"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse"></div>
        </div>
      </div>
    </main>
  );
} 