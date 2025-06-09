import { AbortController } from 'node-abort-controller';

export class RateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly minDelay: number;
  private abortController: AbortController | null = null;

  constructor(minDelay: number) {
    this.minDelay = minDelay;
    this.setupShutdownHandlers();
  }

  private setupShutdownHandlers() {
    // Handle graceful shutdown
    process.on('SIGINT', () => this.handleShutdown('SIGINT'));
    process.on('SIGTERM', () => this.handleShutdown('SIGTERM'));
  }

  private handleShutdown(signal: string) {
    console.log(`\n🛑 Received ${signal}, initiating graceful shutdown...`);
    
    // Abort any in-flight requests
    if (this.abortController) {
      console.log('Aborting in-flight requests...');
      this.abortController.abort();
    }

    // Give a small grace period for cleanup
    setTimeout(() => {
      console.log('Shutdown complete');
      process.exit(0);
    }, 1000);
  }

  async add<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          // Create new abort controller for this request
          this.abortController = new AbortController();
          const result = await fn(this.abortController.signal);
          resolve(result);
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('Request was aborted');
          }
          reject(error);
        } finally {
          this.abortController = null;
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const now = Date.now();
        const timeToWait = Math.max(0, this.lastRequestTime + this.minDelay - now);
        
        if (timeToWait > 0) {
          console.log(`⏳ Rate limiting: waiting ${timeToWait}ms before next request`);
          await new Promise(resolve => setTimeout(resolve, timeToWait));
        }
        
        const next = this.queue.shift();
        if (next) {
          this.lastRequestTime = Date.now();
          await next();
        }
      }
    } finally {
      this.processing = false;
    }
  }

  // Helper to check if we're currently processing requests
  isProcessing(): boolean {
    return this.processing || this.queue.length > 0;
  }

  // Helper to get current queue length
  getQueueLength(): number {
    return this.queue.length;
  }
}

// Create a singleton instance with 1 second delay
export const globalRateLimiter = new RateLimiter(1000);

// Helper function to create a rate-limited fetch
export async function rateLimitedFetch(
  url: string,
  options: RequestInit & { signal?: AbortSignal } = {}
): Promise<Response> {
  return globalRateLimiter.add(async (signal) => {
    const response = await fetch(url, {
      ...options,
      signal: options.signal || signal,
    });

    if (response.status === 429) {
      console.log('⚠️ Rate limit hit, backing off...');
      // Add exponential backoff for rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
      throw new Error('Rate limit exceeded');
    }

    return response;
  });
} 