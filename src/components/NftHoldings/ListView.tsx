import React, { useState } from 'react';
import { Loader2, Wallet } from 'lucide-react';

interface ListViewProps {
  walletNfts: any[];
  isLoading: boolean;
  onLoadMore?: (walletAddress: string, pageKey?: string) => Promise<void>;
}

const ListView: React.FC<ListViewProps> = ({ walletNfts, isLoading, onLoadMore }) => {
  const [expandedWallets, setExpandedWallets] = useState<Set<number>>(new Set());
  const [loadingMore, setLoadingMore] = useState<Set<number>>(new Set());

  const toggleWalletExpansion = (walletIndex: number) => {
    const newExpanded = new Set(expandedWallets);
    if (newExpanded.has(walletIndex)) {
      newExpanded.delete(walletIndex);
    } else {
      newExpanded.add(walletIndex);
    }
    setExpandedWallets(newExpanded);
  };

  const handleLoadMoreCollections = async (walletIndex: number, walletData: any) => {
    if (!onLoadMore || loadingMore.has(walletIndex)) return;
    
    setLoadingMore(prev => new Set(prev).add(walletIndex));
    try {
      await onLoadMore(walletData.walletAddress, walletData.pageKey);
    } finally {
      setLoadingMore(prev => {
        const newSet = new Set(prev);
        newSet.delete(walletIndex);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-gray-600 dark:text-gray-400">Looking up NFTs...</span>
      </div>
    );
  }
  if (!walletNfts.length) {
    return <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">No NFT holdings found</p>;
  }
  return (
    <div className="space-y-4 max-h-96 overflow-y-auto">
      {walletNfts.map((walletData, walletIndex) => {
        const isExpanded = expandedWallets.has(walletIndex);
        const hasMoreContracts = walletData.contracts.length > 8;
        const visibleContracts = isExpanded ? walletData.contracts : walletData.contracts.slice(0, 8);
        const isLoadingMore = loadingMore.has(walletIndex);
        
        return (
          <div key={walletIndex} className="space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-600">
              <Wallet className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {`${walletData.walletAddress.slice(0, 6)}...${walletData.walletAddress.slice(-4)}`}
              </span>
              <div className="flex items-center gap-1">
                {walletData.status === 'checking' && (
                  <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                )}
                {walletData.status === 'found' && (
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                )}
                {walletData.status === 'none' && (
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                )}
                {walletData.status === 'error' && (
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                )}
              </div>
              <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {walletData.contracts.length} collections
                {walletData.hasMoreCollections && (
                  <span className="ml-1 text-blue-500">+</span>
                )}
              </span>
            </div>
            {walletData.message && (
              <div className="text-xs text-gray-600 dark:text-gray-400 px-2">
                {walletData.message}
                {walletData.message.includes('(cached)') && (
                  <span className="ml-1 text-blue-500">💾</span>
                )}
              </div>
            )}
            {walletData.contracts.length > 0 && (
              <div className="space-y-2">
                {visibleContracts.map((contract, index) => (
                  <div
                    key={contract.address}
                    className="bg-gray-50 dark:bg-gray-700 p-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                    onClick={() => {
                      window.location.href = `/collection/${contract.address}?filter=owned`;
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-gray-900 dark:text-white truncate flex-1 mr-2">
                        {contract.name || `Collection ${index + 1}`}
                      </span>
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        {contract.totalBalance} tokens
                      </span>
                    </div>
                  </div>
                ))}
                {hasMoreContracts && (
                  <div className="flex justify-center pt-2">
                    <button 
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs transition-colors"
                      onClick={() => toggleWalletExpansion(walletIndex)}
                    >
                      {isExpanded ? 'Show Less' : `Load More (${walletData.contracts.length - 8} more)`}
                    </button>
                  </div>
                )}
                {walletData.hasMoreCollections && (
                  <div className="flex justify-center pt-2">
                    <button 
                      className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs transition-colors flex items-center gap-1"
                      onClick={() => handleLoadMoreCollections(walletIndex, walletData)}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        'Load More Collections'
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ListView; 