import { NextRequest, NextResponse } from 'next/server';
import { runCachePerformanceTest, getPerformanceResults, resetPerformanceResults } from '../../../../../../lib/cache/performance';

export async function GET() {
  try {
    console.log('🧪 [Cache Performance] Fetching performance test results...');

    const results = getPerformanceResults();

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      results,
    });

  } catch (error) {
    console.error('❌ [Cache Performance] Error fetching results:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch performance results',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    console.log('🚀 [Cache Performance] Processing action:', action);

    switch (action) {
      case 'run':
        console.log('🧪 [Cache Performance] Running performance tests...');
        const results = await runCachePerformanceTest();
        
        return NextResponse.json({
          success: true,
          message: 'Performance tests completed successfully',
          timestamp: Date.now(),
          results,
        });

      case 'reset':
        console.log('🔄 [Cache Performance] Resetting performance results...');
        resetPerformanceResults();
        
        return NextResponse.json({
          success: true,
          message: 'Performance results reset successfully',
          timestamp: Date.now(),
        });

      default:
        return NextResponse.json(
          { 
            success: false,
            error: 'Invalid action',
            validActions: ['run', 'reset'],
          },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('❌ [Cache Performance] Error processing action:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to process action',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }
} 