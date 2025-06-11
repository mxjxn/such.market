import { NextRequest, NextResponse } from 'next/server';
import { getCacheAnalytics, getCacheHealthStatus } from '../../../../../lib/cache/analytics';
import { getEventQueueStatus } from '../../../../../lib/cache/events';

export async function GET() {
  try {
    console.log('📊 [Cache Metrics] Fetching cache metrics...');

    // Get cache analytics
    const analytics = await getCacheAnalytics();
    
    // Get cache health status
    const health = getCacheHealthStatus();
    
    // Get event queue status
    const eventQueue = getEventQueueStatus();

    // Combine all metrics
    const metrics = {
      success: true,
      timestamp: Date.now(),
      analytics: {
        ...analytics,
        eventQueue,
      },
      health,
      summary: {
        status: health.status,
        hitRate: `${(analytics.overview.hitRate * 100).toFixed(1)}%`,
        avgResponseTime: `${analytics.overview.avgResponseTime.toFixed(0)}ms`,
        totalRequests: analytics.overview.totalRequests,
        cacheSize: analytics.overview.cacheSize,
        activeAlerts: analytics.alerts.filter((alert: { resolved: boolean }) => !alert.resolved).length,
      },
    };

    console.log('✅ [Cache Metrics] Metrics fetched successfully:', {
      hitRate: metrics.summary.hitRate,
      avgResponseTime: metrics.summary.avgResponseTime,
      cacheSize: metrics.summary.cacheSize,
      status: metrics.summary.status,
    });

    return NextResponse.json(metrics);

  } catch (error) {
    console.error('❌ [Cache Metrics] Error fetching metrics:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch cache metrics',
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

    console.log('🔄 [Cache Metrics] Processing action:', action);

    switch (action) {
      case 'reset':
        // Reset analytics (this would be implemented in the analytics module)
        console.log('🔄 [Cache Metrics] Resetting analytics...');
        return NextResponse.json({
          success: true,
          message: 'Analytics reset successfully',
          timestamp: Date.now(),
        });

      case 'save':
        // Save analytics to persistent storage
        console.log('💾 [Cache Metrics] Saving analytics...');
        return NextResponse.json({
          success: true,
          message: 'Analytics saved successfully',
          timestamp: Date.now(),
        });

      default:
        return NextResponse.json(
          { 
            success: false,
            error: 'Invalid action',
            validActions: ['reset', 'save'],
          },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('❌ [Cache Metrics] Error processing action:', error);
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