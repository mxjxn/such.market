import React from 'react';
import { Image } from 'lucide-react';

interface NftCardProps {
  contract: {
    address: string;
    name?: string;
    totalBalance: number;
    image_url?: string;
    thumbnail_url?: string;
    walletAddress?: string;
  };
}

const NftCard: React.FC<NftCardProps> = ({ contract }) => {
  return (
    <div className="relative bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden shadow cursor-pointer group" onClick={() => window.location.href = `/collection/${contract.address}?filter=owned`}>
      <div className="aspect-square w-full h-0 pb-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
        <Image className="w-8 h-8 text-gray-400" />
      </div>
      <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs rounded-full px-2 py-0.5 shadow">
        {contract.totalBalance}
      </div>
      <div className="p-2 text-xs font-semibold text-gray-900 dark:text-white truncate">
        {contract.name || 'Unnamed Collection'}
      </div>
    </div>
  );
};

export default NftCard; 