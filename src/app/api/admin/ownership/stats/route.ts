import { NextRequest, NextResponse } from 'next/server';
import { getOwnershipStats, syncNFTsOwnership } from '~/lib/db/ownership';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sync = searchParams.get('sync') === 'true';

    if (sync) {
      console.log('🔄 [Ownership Stats] Syncing NFT ownership...');
      await syncNFTsOwnership();
    }

    console.log('📊 [Ownership Stats] Getting ownership statistics...');
    const stats = await getOwnershipStats();

    return NextResponse.json({
      success: true,
      data: stats,
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
        const stats = await getOwnershipStats();
        
        return NextResponse.json({
          success: true,
          message: 'Ownership sync completed',
          data: stats,
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid action',
            message: 'Supported actions: sync'
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