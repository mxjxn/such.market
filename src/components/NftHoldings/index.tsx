import React, { useState } from 'react';
import ListView from './ListView';
import GridView from './GridView';

interface NftHoldingsProps {
  walletNfts: any[];
  isLoading: boolean;
  nftProcessingTime?: number | null;
  onLoadMore?: (walletAddress: string, pageKey?: string) => Promise<void>;
}

const NftHoldings: React.FC<NftHoldingsProps> = ({ walletNfts, isLoading, nftProcessingTime, onLoadMore }) => {
  const [view, setView] = useState<'list' | 'grid'>('list');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">NFT Holdings</h2>
        <div className="flex items-center gap-2">
          {nftProcessingTime && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{nftProcessingTime}ms</span>
          )}
          <button
            className={`px-2 py-1 rounded text-xs ${view === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            onClick={() => setView('list')}
          >
            List
          </button>
          <button
            className={`px-2 py-1 rounded text-xs ${view === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            onClick={() => setView('grid')}
          >
            Grid
          </button>
        </div>
      </div>
      {view === 'list' ? (
        <ListView walletNfts={walletNfts} isLoading={isLoading} onLoadMore={onLoadMore} />
      ) : (
        <GridView walletNfts={walletNfts} isLoading={isLoading} />
      )}
    </div>
  );
};

export default NftHoldings; 