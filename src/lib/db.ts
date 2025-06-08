import { createClient, SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type { Database } from '../../db/types/database.types';

// Create a wrapper around the Supabase client that logs all operations
class LoggedSupabaseClient {
  private client: SupabaseClient<Database>;

  constructor(url: string, key: string) {
    this.client = createClient<Database>(url, key);
  }

  private logOperation(operation: string, table: string, params?: unknown) {
    const timestamp = new Date().toISOString();
    console.log(`[DB ${timestamp}] ${operation} on ${table}`, params ? { params } : '');
  }

  private logError(operation: string, table: string, error: PostgrestError | Error) {
    const timestamp = new Date().toISOString();
    console.error(`[DB ERROR ${timestamp}] ${operation} on ${table} failed:`, {
      error: error instanceof Error ? error.message : error,
      code: 'code' in error ? error.code : undefined,
      details: 'details' in error ? error.details : undefined,
      hint: 'hint' in error ? error.hint : undefined,
    });
  }

  from<T extends keyof Database['public']['Tables']>(table: T) {
    const queryBuilder = this.client.from(table);
    const originalMethods = {
      select: queryBuilder.select.bind(queryBuilder),
      insert: queryBuilder.insert.bind(queryBuilder),
      update: queryBuilder.update.bind(queryBuilder),
      upsert: queryBuilder.upsert.bind(queryBuilder),
      delete: queryBuilder.delete.bind(queryBuilder),
    };

    // Create a new query builder with logged methods
    const loggedBuilder = {
      select: (query?: string) => {
        this.logOperation('SELECT', table, query);
        return originalMethods.select(query).then(result => {
          if (result.error) this.logError('SELECT', table, result.error);
          return result;
        });
      },
      insert: (values: Database['public']['Tables'][T]['Insert']) => {
        this.logOperation('INSERT', table, values);
        return originalMethods.insert(values).then(result => {
          if (result.error) this.logError('INSERT', table, result.error);
          return result;
        });
      },
      update: (values: Database['public']['Tables'][T]['Update']) => {
        this.logOperation('UPDATE', table, values);
        return originalMethods.update(values).then(result => {
          if (result.error) this.logError('UPDATE', table, result.error);
          return result;
        });
      },
      upsert: (values: Database['public']['Tables'][T]['Insert']) => {
        this.logOperation('UPSERT', table, values);
        return originalMethods.upsert(values).then(result => {
          if (result.error) this.logError('UPSERT', table, result.error);
          return result;
        });
      },
      delete: () => {
        this.logOperation('DELETE', table);
        return originalMethods.delete().then(result => {
          if (result.error) this.logError('DELETE', table, result.error);
          return result;
        });
      },
    };

    // Create a proxy to handle all other methods
    return new Proxy(loggedBuilder, {
      get: (target, prop) => {
        // If the method is in our logged methods, use that
        if (prop in target) {
          return target[prop as keyof typeof target];
        }
        // Otherwise, pass through to the original query builder
        return queryBuilder[prop as keyof typeof queryBuilder];
      },
    });
  }

  // Proxy all other methods to the original client
  get auth() {
    return this.client.auth;
  }

  get storage() {
    return this.client.storage;
  }

  get functions() {
    return this.client.functions;
  }

  get channel() {
    return this.client.channel;
  }

  get removeChannel() {
    return this.client.removeChannel;
  }

  get removeAllChannels() {
    return this.client.removeAllChannels;
  }

  get getChannels() {
    return this.client.getChannels;
  }
}

// Create and export a singleton instance
export const supabase = new LoggedSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
); 