import { createClient } from '@supabase/supabase-js';
import { Database } from '../../db/types/database.types';

// Types for our Supabase client
export type SupabaseClient = ReturnType<typeof createClient<Database>>;

// Environment variable validation
function validateEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase environment variables not configured:', {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? '✅ Set' : '❌ Missing',
      SUPABASE_SERVICE_ROLE_KEY: supabaseKey ? '✅ Set' : '❌ Missing',
      availableEnvKeys: Object.keys(process.env).filter(key => key.includes('SUPABASE'))
    });
    throw new Error(
      'Missing required Supabase environment variables. Please check your .env.local file.'
    );
  }

  return { supabaseUrl, supabaseKey };
}

// Singleton instance
let supabaseInstance: SupabaseClient | null = null;

/**
 * Get or create a Supabase client instance.
 * Uses the service role key for admin access.
 * 
 * @returns {SupabaseClient} A configured Supabase client instance
 * @throws {Error} If environment variables are not configured
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const { supabaseUrl, supabaseKey } = validateEnv();
    
    supabaseInstance = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      }
    });
  }
  return supabaseInstance;
}

/**
 * Get a Supabase client instance for public access.
 * This should be used in client-side code where the service role key should not be exposed.
 * 
 * @returns {SupabaseClient} A configured Supabase client instance with public access
 * @throws {Error} If environment variables are not configured
 */
export function getPublicSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing required public Supabase environment variables. Please check your .env.local file.'
    );
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    },
    db: {
      schema: 'public'
    }
  });
}

// Remove the immediate initialization
// export const supabase = getSupabaseClient(); 