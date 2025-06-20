import { NextRequest, NextResponse } from 'next/server';
import { getOwnershipStats, syncNFTsOwnership } from '~/lib/db/ownership';
import { getSupabaseClient } from '~/lib/supabase';

// Initialize Supabase client
const supabase = getSupabaseClient();

// Helper function to get NFT discovery statistics
async function getNFTDiscoveryStats() {
  try {
    // Get recent NFT discovery stats
    const { data: discoveryStats } = await supabase
      .from('nfts')
      .select('collection_id, token_id, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);

    // Get error statistics from the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: errorStats } = await supabase
      .from('nft_fetch_errors')
      .select('collection_id, error_type, retry_count, created_at')
      .gte('created_at', twentyFourHoursAgo);

    // Get collection health statistics
    const { data: collections } = await supabase
      .from('collections')
      .select('id, name, total_supply, last_refresh_at, created_at');

    // Calculate discovery metrics
    const totalNFTs = discoveryStats?.length || 0;
    const recentErrors = errorStats?.length || 0;
    
    // Group errors by type
    const errorTypes = errorStats?.reduce((acc, error) => {
      acc[error.error_type] = (acc[error.error_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Calculate collection health metrics
    const collectionHealth = collections?.map(collection => {
      const collectionNFTs = discoveryStats?.filter(nft => nft.collection_id === collection.id) || [];
      const collectionErrors = errorStats?.filter(error => error.collection_id === collection.id) || [];
      
      const nftCount = collectionNFTs.length;
      const expectedTotal = collection.total_supply || 0;
      const completeness = expectedTotal > 0 ? (nftCount / expectedTotal) * 100 : 0;
      const errorRate = nftCount > 0 ? (collectionErrors.length / nftCount) : 0;
      
      let health: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
      if (completeness < 80 || errorRate > 0.1) health = 'poor';
      else if (completeness < 90 || errorRate > 0.05) health = 'fair';
      else if (completeness < 95 || errorRate > 0.02) health = 'good';
      
      return {
        collectionId: collection.id,
        name: collection.name,
        totalDiscovered: nftCount,
        expectedTotal,
        completeness: Math.round(completeness * 100) / 100,
        errorRate: Math.round(errorRate * 10000) / 100, // Convert to percentage
        health,
        lastRefresh: collection.last_refresh_at,
        createdAt: collection.created_at,
      };
    }) || [];

    // Calculate overall health distribution
    const healthDistribution = collectionHealth.reduce((acc, collection) => {
      acc[collection.health] = (acc[collection.health] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalNFTs,
      recentErrors,
      errorTypes,
      collectionHealth,
      healthDistribution,
      collectionsAnalyzed: collectionHealth.length,
      averageCompleteness: collectionHealth.length > 0 
        ? Math.round(collectionHealth.reduce((sum, c) => sum + c.completeness, 0) / collectionHealth.length * 100) / 100
        : 0,
      averageErrorRate: collectionHealth.length > 0
        ? Math.round(collectionHealth.reduce((sum, c) => sum + c.errorRate, 0) / collectionHealth.length * 100) / 100
        : 0,
    };
  } catch (error) {
    console.error('❌ Error getting NFT discovery stats:', error);
    return {
      totalNFTs: 0,
      recentErrors: 0,
      errorTypes: {},
      collectionHealth: [],
      healthDistribution: {},
      collectionsAnalyzed: 0,
      averageCompleteness: 0,
      averageErrorRate: 0,
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sync = searchParams.get('sync') === 'true';

    if (sync) {
      console.log('🔄 [Ownership Stats] Syncing NFT ownership...');
      await syncNFTsOwnership();
    }

    console.log('📊 [Ownership Stats] Getting ownership statistics...');
    const ownershipStats = await getOwnershipStats();

    console.log('🔍 [Ownership Stats] Getting NFT discovery statistics...');
    const discoveryStats = await getNFTDiscoveryStats();

    return NextResponse.json({
      success: true,
      data: {
        ...ownershipStats,
        nftDiscovery: discoveryStats,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [Ownership Stats] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get ownership statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    switch (action) {
      case 'sync':
        console.log('🔄 [Ownership Stats] Manual sync requested...');
        await syncNFTsOwnership();
        const ownershipStats = await getOwnershipStats();
        const discoveryStats = await getNFTDiscoveryStats();
        
        return NextResponse.json({
          success: true,
          message: 'Ownership sync completed',
          data: {
            ...ownershipStats,
            nftDiscovery: discoveryStats,
          },
          timestamp: new Date().toISOString(),
        });

      case 'discovery-stats':
        console.log('🔍 [Ownership Stats] Discovery stats requested...');
        const stats = await getNFTDiscoveryStats();
        
        return NextResponse.json({
          success: true,
          message: 'Discovery statistics retrieved',
          data: {
            nftDiscovery: stats,
          },
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid action',
            message: 'Supported actions: sync, discovery-stats'
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('❌ [Ownership Stats] Error:', error);
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