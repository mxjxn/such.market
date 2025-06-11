import { redis, isRedisConfigured } from '../redis';

// Cache metrics types
export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  avgResponseTime: number;
  totalRequests: number;
  cacheSize: number;
  lastUpdated: number;
}

export interface EndpointMetrics {
  endpoint: string;
  requests: number;
  hits: number;
  misses: number;
  avgResponseTime: number;
  lastUsed: number;
}

export interface CacheTypeMetrics {
  cacheType: string;
  keys: number;
  memoryUsage: number;
  hitRate: number;
  lastAccessed: number;
}

export interface TimeRangeMetrics {
  timeRange: string;
  requests: number;
  hits: number;
  misses: number;
  avgResponseTime: number;
}

export interface CacheAlert {
  id: string;
  type: 'low_hit_rate' | 'high_response_time' | 'cache_full' | 'redis_error';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  resolved: boolean;
}

export interface CacheAnalytics {
  overview: CacheMetrics;
  breakdown: {
    byEndpoint: Record<string, EndpointMetrics>;
    byCacheType: Record<string, CacheTypeMetrics>;
    byTimeRange: TimeRangeMetrics[];
  };
  alerts: CacheAlert[];
  eventQueue: {
    queueLength: number;
    isProcessing: boolean;
    eventsProcessed: number;
  };
}

// Analytics storage keys
const ANALYTICS_KEYS = {
  metrics: 'such-market:analytics:metrics',
  endpoints: 'such-market:analytics:endpoints',
  cacheTypes: 'such-market:analytics:cache_types',
  timeRanges: 'such-market:analytics:time_ranges',
  alerts: 'such-market:analytics:alerts',
  events: 'such-market:analytics:events',
} as const;

// Analytics manager class
class CacheAnalyticsManager {
  private metrics: CacheMetrics = {
    hitRate: 0,
    missRate: 0,
    avgResponseTime: 0,
    totalRequests: 0,
    cacheSize: 0,
    lastUpdated: Date.now(),
  };

  private endpointMetrics: Map<string, EndpointMetrics> = new Map();
  private cacheTypeMetrics: Map<string, CacheTypeMetrics> = new Map();
  private timeRangeMetrics: TimeRangeMetrics[] = [];
  private alerts: CacheAlert[] = [];

  // Track a cache request
  trackRequest(
    endpoint: string,
    cacheType: string,
    isHit: boolean,
    responseTime: number
  ): void {
    // Update overall metrics
    this.metrics.totalRequests++;
    this.metrics.lastUpdated = Date.now();

    if (isHit) {
      this.metrics.hitRate = (this.metrics.hitRate * (this.metrics.totalRequests - 1) + 1) / this.metrics.totalRequests;
    } else {
      this.metrics.missRate = (this.metrics.missRate * (this.metrics.totalRequests - 1) + 1) / this.metrics.totalRequests;
    }

    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * (this.metrics.totalRequests - 1) + responseTime) / this.metrics.totalRequests;

    // Update endpoint metrics
    const endpointKey = endpoint;
    const currentEndpoint = this.endpointMetrics.get(endpointKey) || {
      endpoint,
      requests: 0,
      hits: 0,
      misses: 0,
      avgResponseTime: 0,
      lastUsed: Date.now(),
    };

    currentEndpoint.requests++;
    currentEndpoint.lastUsed = Date.now();
    if (isHit) {
      currentEndpoint.hits++;
    } else {
      currentEndpoint.misses++;
    }
    currentEndpoint.avgResponseTime = 
      (currentEndpoint.avgResponseTime * (currentEndpoint.requests - 1) + responseTime) / currentEndpoint.requests;

    this.endpointMetrics.set(endpointKey, currentEndpoint);

    // Update cache type metrics
    const cacheTypeKey = cacheType;
    const currentCacheType = this.cacheTypeMetrics.get(cacheTypeKey) || {
      cacheType,
      keys: 0,
      memoryUsage: 0,
      hitRate: 0,
      lastAccessed: Date.now(),
    };

    currentCacheType.lastAccessed = Date.now();
    if (isHit) {
      currentCacheType.hitRate = (currentCacheType.hitRate * (currentCacheType.keys || 1) + 1) / (currentCacheType.keys || 1);
    }

    this.cacheTypeMetrics.set(cacheTypeKey, currentCacheType);

    // Check for alerts
    this.checkAlerts();
  }

  // Track cache event
  trackEvent(eventType: string, data?: Record<string, unknown>): void {
    console.log('📊 [Cache Analytics] Event tracked:', { eventType, data });
  }

  // Add alert
  addAlert(alert: Omit<CacheAlert, 'id' | 'timestamp'>): void {
    const fullAlert: CacheAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    this.alerts.push(fullAlert);
    console.log('🚨 [Cache Analytics] Alert added:', fullAlert);
  }

  // Check for alert conditions
  private checkAlerts(): void {
    // Low hit rate alert
    if (this.metrics.hitRate < 0.8 && this.metrics.totalRequests > 10) {
      this.addAlert({
        type: 'low_hit_rate',
        message: `Cache hit rate is low: ${(this.metrics.hitRate * 100).toFixed(1)}%`,
        severity: 'medium',
        resolved: false,
      });
    }

    // High response time alert
    if (this.metrics.avgResponseTime > 1000) {
      this.addAlert({
        type: 'high_response_time',
        message: `Average response time is high: ${this.metrics.avgResponseTime.toFixed(0)}ms`,
        severity: 'high',
        resolved: false,
      });
    }
  }

  // Get current analytics
  async getAnalytics(): Promise<CacheAnalytics> {
    // Update cache size if Redis is available
    if (isRedisConfigured && redis) {
      try {
        const keys = await redis.keys('such-market:*');
        this.metrics.cacheSize = keys.length;
      } catch (error) {
        console.error('❌ [Cache Analytics] Error getting cache size:', error);
      }
    }

    return {
      overview: { ...this.metrics },
      breakdown: {
        byEndpoint: Object.fromEntries(this.endpointMetrics),
        byCacheType: Object.fromEntries(this.cacheTypeMetrics),
        byTimeRange: [...this.timeRangeMetrics],
      },
      alerts: [...this.alerts],
      eventQueue: {
        queueLength: 0, // Will be updated by event system
        isProcessing: false,
        eventsProcessed: 0,
      },
    };
  }

  // Save analytics to Redis
  async saveAnalytics(): Promise<void> {
    if (!isRedisConfigured || !redis) {
      console.log('⚠️ [Cache Analytics] Redis not configured, skipping save');
      return;
    }

    try {
      const analytics = await this.getAnalytics();
      
      await redis.setex(ANALYTICS_KEYS.metrics, 3600, analytics.overview);
      await redis.setex(ANALYTICS_KEYS.endpoints, 3600, analytics.breakdown.byEndpoint);
      await redis.setex(ANALYTICS_KEYS.cacheTypes, 3600, analytics.breakdown.byCacheType);
      await redis.setex(ANALYTICS_KEYS.alerts, 3600, analytics.alerts);

      console.log('💾 [Cache Analytics] Analytics saved to Redis');
    } catch (error) {
      console.error('❌ [Cache Analytics] Error saving analytics:', error);
    }
  }

  // Load analytics from Redis
  async loadAnalytics(): Promise<void> {
    if (!isRedisConfigured || !redis) {
      console.log('⚠️ [Cache Analytics] Redis not configured, skipping load');
      return;
    }

    try {
      const [metrics, endpoints, cacheTypes, alerts] = await Promise.all([
        redis.get<CacheMetrics>(ANALYTICS_KEYS.metrics),
        redis.get<Record<string, EndpointMetrics>>(ANALYTICS_KEYS.endpoints),
        redis.get<Record<string, CacheTypeMetrics>>(ANALYTICS_KEYS.cacheTypes),
        redis.get<CacheAlert[]>(ANALYTICS_KEYS.alerts),
      ]);

      if (metrics) this.metrics = metrics;
      if (endpoints) this.endpointMetrics = new Map(Object.entries(endpoints));
      if (cacheTypes) this.cacheTypeMetrics = new Map(Object.entries(cacheTypes));
      if (alerts) this.alerts = alerts;

      console.log('📊 [Cache Analytics] Analytics loaded from Redis');
    } catch (error) {
      console.error('❌ [Cache Analytics] Error loading analytics:', error);
    }
  }

  // Reset analytics
  resetAnalytics(): void {
    this.metrics = {
      hitRate: 0,
      missRate: 0,
      avgResponseTime: 0,
      totalRequests: 0,
      cacheSize: 0,
      lastUpdated: Date.now(),
    };
    this.endpointMetrics.clear();
    this.cacheTypeMetrics.clear();
    this.timeRangeMetrics = [];
    this.alerts = [];

    console.log('🔄 [Cache Analytics] Analytics reset');
  }

  // Get cache health status
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (this.metrics.hitRate < 0.8) {
      issues.push(`Low cache hit rate: ${(this.metrics.hitRate * 100).toFixed(1)}%`);
      recommendations.push('Consider increasing cache TTL or optimizing cache keys');
    }

    if (this.metrics.avgResponseTime > 1000) {
      issues.push(`High average response time: ${this.metrics.avgResponseTime.toFixed(0)}ms`);
      recommendations.push('Check Redis performance and network latency');
    }

    if (this.metrics.cacheSize > 10000) {
      issues.push(`Large cache size: ${this.metrics.cacheSize} keys`);
      recommendations.push('Consider implementing cache eviction policies');
    }

    const status = issues.length === 0 ? 'healthy' : issues.length <= 2 ? 'warning' : 'critical';

    return { status, issues, recommendations };
  }
}

// Global analytics manager instance
export const cacheAnalytics = new CacheAnalyticsManager();

// Helper function to track cache request
export function trackCacheRequest(
  endpoint: string,
  cacheType: string,
  isHit: boolean,
  responseTime: number
): void {
  cacheAnalytics.trackRequest(endpoint, cacheType, isHit, responseTime);
}

// Helper function to track cache event
export function trackCacheEvent(eventType: string, data?: Record<string, unknown>): void {
  cacheAnalytics.trackEvent(eventType, data);
}

// Helper function to get analytics
export async function getCacheAnalytics(): Promise<CacheAnalytics> {
  return cacheAnalytics.getAnalytics();
}

// Helper function to get health status
export function getCacheHealthStatus(): {
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
  recommendations: string[];
} {
  return cacheAnalytics.getHealthStatus();
}

// Initialize analytics when module is imported
if (isRedisConfigured) {
  cacheAnalytics.loadAnalytics();
} 