'use client';

import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { PlaceOffer, ListThisItem } from '../../../components/Seaport';

export default function SeaportTestPage() {
  const [testResult, setTestResult] = useState<string>('');

  const testOrderCreation = async () => {
    try {
      const response = await fetch('/api/seaport/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType: 'listing',
          offererAddress: '0x1234567890123456789012345678901234567890',
          tokenAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          tokenId: '123',
          price: '0.1',
          currency: '0x0000000000000000000000000000000000000000', // ETH
          duration: 7 * 24 * 60 * 60, // 7 days
          fcUserId: 12345
        })
      });

      const result = await response.json();
      setTestResult(JSON.stringify(result, null, 2));
    } catch (error) {
      setTestResult(`Error: ${error}`);
    }
  };

  const testNFT = {
    contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    tokenId: '123',
    name: 'Test NFT #123',
    image: 'https://via.placeholder.com/150',
    owner: '0x1234567890123456789012345678901234567890'
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Seaport Integration Test</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Test API Endpoint */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">API Test</h2>
          <Button onClick={testOrderCreation} className="mb-4">
            Test Order Creation
          </Button>
          
          {testResult && (
            <div className="bg-gray-100 p-4 rounded-md">
              <h3 className="font-semibold mb-2">Result:</h3>
              <pre className="text-sm overflow-auto">{testResult}</pre>
            </div>
          )}
        </div>

        {/* UI Components Test */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Place Offer Component</h2>
            <PlaceOffer 
              nft={testNFT}
              onSuccess={() => alert('Offer placed successfully!')}
              onCancel={() => alert('Offer cancelled')}
            />
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">List Item Component</h2>
            <ListThisItem 
              nft={testNFT}
              onSuccess={() => alert('Item listed successfully!')}
              onCancel={() => alert('Listing cancelled')}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 bg-blue-50 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Integration Status</h2>
        <ul className="space-y-2 text-sm">
          <li>✅ Database migration file created</li>
          <li>✅ Seaport configuration setup</li>
          <li>✅ Database integration layer (placeholder)</li>
          <li>✅ Order creation utilities</li>
          <li>✅ API endpoint for order creation</li>
          <li>✅ UI components (PlaceOffer, ListThisItem)</li>
          <li>⏳ Database migration needs to be run</li>
          <li>⏳ Seaport SDK needs to be installed</li>
          <li>⏳ Real database integration needs to be implemented</li>
        </ul>
      </div>
    </div>
  );
} 