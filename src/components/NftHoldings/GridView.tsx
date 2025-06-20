import React, { useState } from 'react';
import NftCard from './NftCard';

interface GridViewProps {
  walletNfts: any[];
  isLoading: boolean;
}

const GridView: React.FC<GridViewProps> = ({ walletNfts, isLoading }) => {
  const [showAll, setShowAll] = useState(false);
  // Flatten all contracts into a single array
  const allContracts = walletNfts.flatMap(w => w.contracts.map((c: any) => ({ ...c, walletAddress: w.walletAddress })));
  const visibleContracts = showAll ? allContracts : allContracts.slice(0, 24);

  if (isLoading) {
    return <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-square bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}</div>;
  }
  if (!allContracts.length) {
    return <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">No NFT holdings found</p>;
  }
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {visibleContracts.map((contract, i) => (
          <NftCard key={contract.address + i} contract={contract} />
        ))}
      </div>
      <div className="flex justify-center mt-4">
        {!showAll && allContracts.length > 24 ? (
          <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" onClick={() => setShowAll(true)}>
            Load More ({allContracts.length - 24} more)
          </button>
        ) : showAll && allContracts.length > 24 ? (
          <button className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600" onClick={() => setShowAll(false)}>
            Show Less
          </button>
        ) : (
          <button className="px-4 py-2 bg-gray-300 text-gray-500 rounded cursor-not-allowed" disabled>
            All Items Loaded
          </button>
        )}
      </div>
    </>
  );
};

export default GridView;