"use client";

import { Button } from "./ui/Button";

// Temporary type for auction data - we'll expand this later
type Auction = {
  id: string;
  imageUrl: string;
  currentBid?: number;
  reservePrice: number;
  ticker: string;
  currentBidder?: string;
  timeRemaining?: string;
  minimumBid: number;
};

// Temporary mock data - we'll replace this with real data later
const mockAuctions: Auction[] = [
  {
    id: "1",
    imageUrl: "https://placekitten.com/800/600",
    reservePrice: 0.1,
    ticker: "ETH",
    minimumBid: 0.1,
  },
  {
    id: "2",
    imageUrl: "https://placekitten.com/801/600",
    currentBid: 0.5,
    reservePrice: 0.1,
    ticker: "ETH",
    currentBidder: "@artist1",
    timeRemaining: "2 days left",
    minimumBid: 0.6,
  },
];

function AuctionCard({ auction }: { auction: Auction }) {
  return (
    <div className="w-full mb-6 bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg">
      <div className="relative w-full h-[500px] overflow-hidden">
        <img
          src={auction.imageUrl}
          alt="Artwork"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-4">
        <div className="flex justify-between items-center mb-2">
          <div className="text-lg font-semibold">
            {auction.currentBid ? (
              <>
                {auction.currentBid} {auction.ticker}
              </>
            ) : (
              <>
                Reserve: {auction.reservePrice} {auction.ticker}
              </>
            )}
          </div>
          {auction.currentBidder && (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {auction.currentBidder}
            </div>
          )}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {auction.timeRemaining || "Place a bid to start this auction"}
        </div>
        <Button className="w-full">Minimum Bid ({auction.minimumBid} {auction.ticker})</Button>
      </div>
    </div>
  );
}

export default function Main() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-12">
        <h1 className="text-3xl font-bold">Cryptoart auctionhouse</h1>
        <Button>Create auction</Button>
      </div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-4 italic">Current Auctions</h2>
      </div>
      {/* Auction List */}
      <div className="space-y-6">
        {mockAuctions.map((auction) => (
          <AuctionCard key={auction.id} auction={auction} />
        ))}
      </div>
    </div>
  );
} 