import { redis, isRedisConfigured, getCachedData, setCachedData } from '../redis';
import { trackCacheRequest } from './analytics';

// Performance test result types
export interface PerformanceTestResult {
  testName: string;
  duration: number;
  operations: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  successRate: number;
  errors: string[];
  timestamp: number;
}

export interface LoadTestResult {
  concurrentUsers: number;
  requestsPerSecond: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
  timestamp: number;
}

export interface StressTestResult {
  maxConcurrentUsers: number;
  maxRequestsPerSecond: number;
  breakingPoint: number;
  recoveryTime: number;
  errors: string[];
  timestamp: number;
}

export interface PerformanceResults {
  cacheHealth: {
    isConfigured: boolean;
    connectionTime: number;
    pingTime: number;
  };
  basicTests: PerformanceTestResult[];
  loadTests: LoadTestResult[];
  stressTests: StressTestResult[];
  recommendations: string[];
  timestamp: number;
}

// Performance testing utilities
class CachePerformanceTester {
  private results: PerformanceResults = {
    cacheHealth: {
      isConfigured: false,
      connectionTime: 0,
      pingTime: 0,
    },
    basicTests: [],
    loadTests: [],
    stressTests: [],
    recommendations: [],
    timestamp: Date.now(),
  };

  // Test Redis connection health
  async testCacheHealth(): Promise<void> {
    if (!isRedisConfigured || !redis) {
      this.results.cacheHealth = {
        isConfigured: false,
        connectionTime: 0,
        pingTime: 0,
      };
      this.results.recommendations.push('Redis is not configured. Configure KV_REST_API_URL and KV_REST_API_TOKEN.');
      return;
    }

    try {
      // Test connection
      const connectionStart = Date.now();
      await redis.ping();
      const connectionTime = Date.now() - connectionStart;

      // Test ping
      const pingStart = Date.now();
      await redis.ping();
      const pingTime = Date.now() - pingStart;

      this.results.cacheHealth = {
        isConfigured: true,
        connectionTime,
        pingTime,
      };

      console.log('✅ [Cache Performance] Health check passed:', {
        connectionTime: `${connectionTime}ms`,
        pingTime: `${pingTime}ms`,
      });
    } catch (error) {
      console.error('❌ [Cache Performance] Health check failed:', error);
      this.results.cacheHealth = {
        isConfigured: true,
        connectionTime: -1,
        pingTime: -1,
      };
      this.results.recommendations.push('Redis connection failed. Check configuration and network.');
    }
  }

  // Basic cache operations test
  async testBasicOperations(): Promise<PerformanceTestResult> {
    const testName = 'Basic Cache Operations';
    const operations = 100;
    const responseTimes: number[] = [];
    const errors: string[] = [];

    console.log(`🧪 [Cache Performance] Running ${testName}...`);

    for (let i = 0; i < operations; i++) {
      const startTime = Date.now();
      
      try {
        const testKey = `test:basic:${i}`;
        const testData = { id: i, data: `test-data-${i}`, timestamp: Date.now() };

        // Test set operation
        await setCachedData(testKey, testData, 60);
        
        // Test get operation
        const retrieved = await getCachedData(testKey);
        
        // Test cache hit tracking
        trackCacheRequest('/test/basic', 'test', !!retrieved, Date.now() - startTime);

        if (!retrieved) {
          errors.push(`Cache miss for key: ${testKey}`);
        }

        responseTimes.push(Date.now() - startTime);
      } catch (error) {
        errors.push(`Operation ${i} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const result: PerformanceTestResult = {
      testName,
      duration: responseTimes.reduce((a, b) => a + b, 0),
      operations,
      avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      successRate: ((operations - errors.length) / operations) * 100,
      errors,
      timestamp: Date.now(),
    };

    this.results.basicTests.push(result);
    console.log(`✅ [Cache Performance] ${testName} completed:`, result);
    return result;
  }

  // Concurrent access test
  async testConcurrentAccess(concurrentUsers: number = 10): Promise<LoadTestResult> {
    const testName = 'Concurrent Access Test';
    const totalRequests = concurrentUsers * 10;
    const responseTimes: number[] = [];
    let errors = 0;
    let cacheHits = 0;

    console.log(`🧪 [Cache Performance] Running ${testName} with ${concurrentUsers} concurrent users...`);

    // Pre-populate cache
    for (let i = 0; i < totalRequests; i++) {
      const testKey = `test:concurrent:${i}`;
      await setCachedData(testKey, { id: i, data: `concurrent-data-${i}` }, 60);
    }

    // Run concurrent requests
    const startTime = Date.now();
    const promises = Array.from({ length: concurrentUsers }, async (_, userIndex) => {
      for (let i = 0; i < 10; i++) {
        const requestIndex = userIndex * 10 + i;
        const requestStart = Date.now();
        
        try {
          const testKey = `test:concurrent:${requestIndex}`;
          const retrieved = await getCachedData(testKey);
          
          if (retrieved) {
            cacheHits++;
          }
          
          responseTimes.push(Date.now() - requestStart);
          trackCacheRequest('/test/concurrent', 'concurrent', !!retrieved, Date.now() - requestStart);
        } catch (error) {
          errors++;
          console.error(`Concurrent request ${requestIndex} failed:`, error);
        }
      }
    });

    await Promise.all(promises);
    const duration = Date.now() - startTime;

    const result: LoadTestResult = {
      concurrentUsers,
      requestsPerSecond: (totalRequests / duration) * 1000,
      avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      p95ResponseTime: this.calculatePercentile(responseTimes, 95),
      p99ResponseTime: this.calculatePercentile(responseTimes, 99),
      errorRate: (errors / totalRequests) * 100,
      cacheHitRate: (cacheHits / totalRequests) * 100,
      timestamp: Date.now(),
    };

    this.results.loadTests.push(result);
    console.log(`✅ [Cache Performance] ${testName} completed:`, result);
    return result;
  }

  // Stress test
  async testStressTest(): Promise<StressTestResult> {
    const testName = 'Stress Test';
    console.log(`🧪 [Cache Performance] Running ${testName}...`);

    let maxConcurrentUsers = 0;
    let maxRequestsPerSecond = 0;
    let breakingPoint = 0;
    const errors: string[] = [];

    // Gradually increase load until breaking point
    for (let users = 1; users <= 100; users *= 2) {
      try {
        const result = await this.testConcurrentAccess(users);
        
        if (result.errorRate > 5) {
          breakingPoint = users;
          break;
        }

        maxConcurrentUsers = Math.max(maxConcurrentUsers, users);
        maxRequestsPerSecond = Math.max(maxRequestsPerSecond, result.requestsPerSecond);
      } catch (error) {
        breakingPoint = users;
        errors.push(`Stress test failed at ${users} users: ${error instanceof Error ? error.message : 'Unknown error'}`);
        break;
      }
    }

    // Test recovery
    const recoveryStart = Date.now();
    await this.testBasicOperations();
    const recoveryTime = Date.now() - recoveryStart;

    const result: StressTestResult = {
      maxConcurrentUsers,
      maxRequestsPerSecond,
      breakingPoint,
      recoveryTime,
      errors,
      timestamp: Date.now(),
    };

    this.results.stressTests.push(result);
    console.log(`✅ [Cache Performance] ${testName} completed:`, result);
    return result;
  }

  // Calculate percentile
  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  // Generate recommendations
  private generateRecommendations(): void {
    this.results.recommendations = [];

    // Health recommendations
    if (!this.results.cacheHealth.isConfigured) {
      this.results.recommendations.push('Configure Redis for optimal performance');
    } else if (this.results.cacheHealth.connectionTime > 100) {
      this.results.recommendations.push('Redis connection is slow. Check network latency.');
    }

    // Basic test recommendations
    const basicTest = this.results.basicTests[this.results.basicTests.length - 1];
    if (basicTest) {
      if (basicTest.avgResponseTime > 50) {
        this.results.recommendations.push('Cache operations are slow. Consider optimizing Redis configuration.');
      }
      if (basicTest.successRate < 95) {
        this.results.recommendations.push('Cache reliability is low. Check Redis stability.');
      }
    }

    // Load test recommendations
    const loadTest = this.results.loadTests[this.results.loadTests.length - 1];
    if (loadTest) {
      if (loadTest.avgResponseTime > 100) {
        this.results.recommendations.push('Concurrent performance is poor. Consider Redis clustering.');
      }
      if (loadTest.cacheHitRate < 90) {
        this.results.recommendations.push('Cache hit rate is low. Review cache key strategy.');
      }
    }

    // Stress test recommendations
    const stressTest = this.results.stressTests[this.results.stressTests.length - 1];
    if (stressTest) {
      if (stressTest.breakingPoint < 50) {
        this.results.recommendations.push('System breaks under moderate load. Consider scaling Redis.');
      }
      if (stressTest.recoveryTime > 5000) {
        this.results.recommendations.push('Recovery time is slow. Implement better error handling.');
      }
    }
  }

  // Run all performance tests
  async runAllTests(): Promise<PerformanceResults> {
    console.log('🚀 [Cache Performance] Starting comprehensive performance tests...');
    
    this.results.timestamp = Date.now();

    // Test cache health
    await this.testCacheHealth();

    // Run basic tests
    await this.testBasicOperations();

    // Run load tests
    await this.testConcurrentAccess(5);
    await this.testConcurrentAccess(20);

    // Run stress test
    await this.testStressTest();

    // Generate recommendations
    this.generateRecommendations();

    console.log('✅ [Cache Performance] All tests completed');
    return this.results;
  }

  // Get latest results
  getResults(): PerformanceResults {
    return { ...this.results };
  }

  // Reset results
  resetResults(): void {
    this.results = {
      cacheHealth: {
        isConfigured: false,
        connectionTime: 0,
        pingTime: 0,
      },
      basicTests: [],
      loadTests: [],
      stressTests: [],
      recommendations: [],
      timestamp: Date.now(),
    };
  }
}

// Global performance tester instance
export const cachePerformanceTester = new CachePerformanceTester();

// Helper function to run all tests
export async function runCachePerformanceTest(): Promise<PerformanceResults> {
  return cachePerformanceTester.runAllTests();
}

// Helper function to get test results
export function getPerformanceResults(): PerformanceResults {
  return cachePerformanceTester.getResults();
}

// Helper function to reset test results
export function resetPerformanceResults(): void {
  cachePerformanceTester.resetResults();
} 