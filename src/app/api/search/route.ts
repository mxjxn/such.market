import { Alchemy, Network } from 'alchemy-sdk';
import { NextResponse } from 'next/server';
import { addCollectionName } from '~/lib/kv';

// Initialize Alchemy SDK on the server side
const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY, // Note: Using server-side env var
  network: Network.BASE_MAINNET,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter is required' },
      { status: 400 }
    );
  }

  try {
    let address: string;
    let collectionName: string | undefined;

    // Case 1: Direct Contract Address
    if (query.match(/^0x[a-fA-F0-9]{40}$/)) {
      address = query.toLowerCase();
      
      // Get collection metadata to store the name
      try {
        const metadata = await alchemy.nft.getContractMetadata(address);
        if (metadata.name) {
          collectionName = metadata.name;
          await addCollectionName(metadata.name, address);
        }
      } catch (error) {
        console.error('Error fetching collection metadata:', error);
      }
      
      return NextResponse.json({ 
        address,
        type: 'address',
        name: collectionName
      });
    }

    // Case 2: ENS Name
    if (query.endsWith('.eth')) {
      const resolvedAddress = await alchemy.core.resolveName(query);
      if (resolvedAddress) {
        address = resolvedAddress.toLowerCase();
        
        // Get collection metadata to store the name
        try {
          const metadata = await alchemy.nft.getContractMetadata(address);
          if (metadata.name) {
            collectionName = metadata.name;
            await addCollectionName(metadata.name, address);
          }
        } catch (error) {
          console.error('Error fetching collection metadata:', error);
        }
        
        return NextResponse.json({ 
          address,
          type: 'ens',
          name: collectionName
        });
      }
      return NextResponse.json(
        { error: 'ENS name not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Invalid input. Please provide a contract address or ENS name' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
} 