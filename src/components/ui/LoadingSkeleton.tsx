/**
 * Loading Skeleton Component
 * Beautiful loading states while content loads
 */

interface LoadingSkeletonProps {
  variant?: 'default' | 'app' | 'card' | 'text' | 'avatar';
  className?: string;
}

export function LoadingSkeleton({ variant = 'default', className = '' }: LoadingSkeletonProps) {
  const baseClasses = 'animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 rounded';

  if (variant === 'app') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8 text-center">
          {/* Logo pulse */}
          <div className="flex justify-center">
            <div className={`${baseClasses} w-20 h-20 rounded-full`}></div>
          </div>

          {/* Title */}
          <div className="space-y-3">
            <div className={`${baseClasses} h-8 w-3/4 mx-auto`}></div>
            <div className={`${baseClasses} h-4 w-1/2 mx-auto`}></div>
          </div>

          {/* Loading bars */}
          <div className="space-y-2">
            <div className={`${baseClasses} h-12 w-full`}></div>
            <div className={`${baseClasses} h-12 w-full`}></div>
          </div>

          {/* Status text */}
          <div className="pt-4">
            <div className="relative flex justify-center">
              <div className="flex space-x-1">
                <div className={`${baseClasses} w-2 h-2 rounded-full`} style={{ animationDelay: '0ms' }}></div>
                <div className={`${baseClasses} w-2 h-2 rounded-full`} style={{ animationDelay: '150ms' }}></div>
                <div className={`${baseClasses} w-2 h-2 rounded-full`} style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-400">Initializing Such.Market...</p>
          </div>

          {/* Subtle hint */}
          <div className="pt-8 text-xs text-gray-500">
            <p>Loading Farcaster Frame SDK</p>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`${className} space-y-3`}>
        <div className={`${baseClasses} h-48 w-full`}></div>
        <div className={`${baseClasses} h-4 w-3/4`}></div>
        <div className={`${baseClasses} h-4 w-1/2`}></div>
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <div className={`${className} space-y-2`}>
        <div className={`${baseClasses} h-4 w-full`}></div>
        <div className={`${baseClasses} h-4 w-5/6`}></div>
        <div className={`${baseClasses} h-4 w-4/6`}></div>
      </div>
    );
  }

  if (variant === 'avatar') {
    return <div className={`${baseClasses} ${className} rounded-full`}></div>;
  }

  // Default variant
  return <div className={`${baseClasses} ${className}`}></div>;
}

interface FrameLoadingProps {
  message?: string;
  showError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
}

/**
 * Specialized loading component for Frame SDK initialization
 */
export function FrameLoading({ message, showError, errorMessage, onRetry }: FrameLoadingProps) {
  if (showError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6 text-center">
          {/* Error icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-red-900/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>

          {/* Error message */}
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-red-400">Unable to Load Frame</h2>
            <p className="text-sm text-gray-400">
              {errorMessage || 'The Farcaster Frame SDK failed to initialize.'}
            </p>
          </div>

          {/* Retry button */}
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors duration-200"
            >
              Retry
            </button>
          )}

          {/* Continue anyway option */}
          <p className="text-xs text-gray-500">
            The app will continue loading with limited functionality
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Animated logo */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse"></div>
            <div className="absolute inset-0 w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-ping opacity-30"></div>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Such.Market
          </h1>
          <p className="text-gray-400 text-sm">NFT Trading on Base</p>
        </div>

        {/* Loading dots */}
        <div className="flex justify-center space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>

        {/* Status message */}
        <p className="text-sm text-gray-500">
          {message || 'Initializing Farcaster Frame...'}
        </p>
      </div>
    </div>
  );
}
