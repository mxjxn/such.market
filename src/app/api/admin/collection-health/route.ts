import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '~/lib/supabase';

// Initialize Supabase client
const supabase = getSupabaseClient();

// Collection health interface
interface CollectionHealth {
  collectionId: string;
  contractAddress: string;
  name: string;
  totalDiscovered: number;
  expectedTotal: number;
  completeness: number;
  errorRate: number;
  lastUpdated: string;
  health: 'excellent' | 'good' | 'fair' | 'poor';
  issues: string[];
}

// Helper function to get collection health
async function getCollectionHealth(contractAddress?: string): Promise<CollectionHealth[]> {
  try {
    // Get collections
    let collectionsQuery = supabase
      .from('collections')
      .select('id, name, contract_address, total_supply, last_refresh_at, created_at');
    
    if (contractAddress) {
      collectionsQuery = collectionsQuery.eq('contract_address', contractAddress);
    }
    
    const { data: collections, error: collectionsError } = await collectionsQuery;
    
    if (collectionsError) {
      console.error('❌ Error fetching collections:', collectionsError);
      return [];
    }

    if (!collections || collections.length === 0) {
      return [];
    }

    // Get NFT counts for each collection
    const { data: nftCounts, error: nftError } = await supabase
      .from('nfts')
      .select('collection_id, token_id');

    if (nftError) {
      console.error('❌ Error fetching NFT counts:', nftError);
      return [];
    }

    // Get error counts for each collection (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: errors, error: errorsError } = await supabase
      .from('nft_fetch_errors')
      .select('collection_id, error_type, created_at')
      .gte('created_at', twentyFourHoursAgo);

    if (errorsError) {
      console.error('❌ Error fetching errors:', errorsError);
    }

    // Calculate health for each collection
    const healthResults: CollectionHealth[] = collections.map(collection => {
      const collectionNFTs = nftCounts?.filter(nft => nft.collection_id === collection.id) || [];
      const collectionErrors = errors?.filter(error => error.collection_id === collection.id) || [];
      
      const totalDiscovered = collectionNFTs.length;
      const expectedTotal = collection.total_supply || 0;
      const completeness = expectedTotal > 0 ? (totalDiscovered / expectedTotal) * 100 : 0;
      const errorRate = totalDiscovered > 0 ? (collectionErrors.length / totalDiscovered) : 0;
      
      // Determine health status
      let health: CollectionHealth['health'] = 'excellent';
      const issues: string[] = [];
      
      if (completeness < 80) {
        health = 'poor';
        issues.push(`Low completeness: ${Math.round(completeness)}%`);
      } else if (completeness < 90) {
        health = 'fair';
        issues.push(`Moderate completeness: ${Math.round(completeness)}%`);
      } else if (completeness < 95) {
        health = 'good';
        issues.push(`Good completeness: ${Math.round(completeness)}%`);
      }
      
      if (errorRate > 0.1) {
        health = 'poor';
        issues.push(`High error rate: ${Math.round(errorRate * 100)}%`);
      } else if (errorRate > 0.05) {
        health = health === 'excellent' ? 'fair' : health;
        issues.push(`Moderate error rate: ${Math.round(errorRate * 100)}%`);
      } else if (errorRate > 0.02) {
        health = health === 'excellent' ? 'good' : health;
        issues.push(`Low error rate: ${Math.round(errorRate * 100)}%`);
      }
      
      if (!collection.last_refresh_at) {
        health = health === 'excellent' ? 'fair' : health;
        issues.push('No recent refresh');
      }
      
      return {
        collectionId: collection.id,
        contractAddress: collection.contract_address,
        name: collection.name,
        totalDiscovered,
        expectedTotal,
        completeness: Math.round(completeness * 100) / 100,
        errorRate: Math.round(errorRate * 10000) / 100, // Convert to percentage
        lastUpdated: collection.last_refresh_at || collection.created_at,
        health,
        issues,
      };
    });

    return healthResults;
  } catch (error) {
    console.error('❌ Error in getCollectionHealth:', error);
    return [];
  }
}

// Helper function to get health summary
function getHealthSummary(collections: CollectionHealth[]) {
  const healthDistribution = collections.reduce((acc, collection) => {
    acc[collection.health] = (acc[collection.health] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const averageCompleteness = collections.length > 0 
    ? Math.round(collections.reduce((sum, c) => sum + c.completeness, 0) / collections.length * 100) / 100
    : 0;

  const averageErrorRate = collections.length > 0
    ? Math.round(collections.reduce((sum, c) => sum + c.errorRate, 0) / collections.length * 100) / 100
    : 0;

  const totalNFTs = collections.reduce((sum, c) => sum + c.totalDiscovered, 0);
  const totalExpected = collections.reduce((sum, c) => sum + c.expectedTotal, 0);

  return {
    totalCollections: collections.length,
    healthDistribution,
    averageCompleteness,
    averageErrorRate,
    totalNFTs,
    totalExpected,
    overallCompleteness: totalExpected > 0 ? Math.round((totalNFTs / totalExpected) * 100 * 100) / 100 : 0,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractAddress = searchParams.get('contractAddress');
    const healthFilter = searchParams.get('health') as 'excellent' | 'good' | 'fair' | 'poor' | null;

    console.log('🏥 [Collection Health] Getting collection health data...');
    const collections = await getCollectionHealth(contractAddress || undefined);

    // Apply health filter if specified
    const filteredCollections = healthFilter 
      ? collections.filter(c => c.health === healthFilter)
      : collections;

    const summary = getHealthSummary(collections);

    return NextResponse.json({
      success: true,
      data: {
        collections: filteredCollections,
        summary,
        filters: {
          contractAddress,
          health: healthFilter,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [Collection Health] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get collection health data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, contractAddress } = await request.json();

    switch (action) {
      case 'refresh-health':
        console.log('🔄 [Collection Health] Refreshing health data...');
        const collections = await getCollectionHealth(contractAddress);
        const summary = getHealthSummary(collections);

        return NextResponse.json({
          success: true,
          message: 'Collection health data refreshed',
          data: {
            collections,
            summary,
          },
          timestamp: new Date().toISOString(),
        });

      case 'trigger-population':
        if (!contractAddress) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Missing contract address',
              message: 'Required: contractAddress'
            },
            { status: 400 }
          );
        }

        console.log(`🔄 [Collection Health] Triggering population for ${contractAddress}...`);
        
        // Make a non-blocking call to the populate endpoint
        const populateUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/collection/${contractAddress}/populate`;
        
        fetch(populateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }).catch(error => {
          console.warn(`⚠️ [Collection Health] Failed to trigger population:`, error);
        });

        return NextResponse.json({
          success: true,
          message: 'Population triggered for collection',
          data: {
            contractAddress,
          },
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid action',
            message: 'Supported actions: refresh-health, trigger-population'
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('❌ [Collection Health] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to perform action',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 