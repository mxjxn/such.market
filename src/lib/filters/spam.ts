/**
 * NFT Spam Filtering
 * Intelligent filtering to remove spam/scam NFTs from user collections
 *
 * Multi-level scoring system based on:
 * - Trading liquidity (LSSVM + Seaport)
 * - Trading volume and activity
 * - Holder count
 * - Verification status
 * - Collection metadata signals
 */

import { createSupabaseClient } from '~/lib/supabase';
import { hasLiquidity as hasPoolLiquidity } from '~/lib/lssvm';
import { getCache, setCache } from '~/lib/redis';

export interface NFTSpamScore {
  contractAddress: string;
  score: number;  // 0-100 (higher = more likely spam)
  reasons: string[];
  metadata: {
    hasLiquidity: boolean;
    tradeVolume: number;
    holderCount: number;
    isVerified: boolean;
    isFeatured: boolean;
  };
}

export interface SpamFilterConfig {
  maxSpamScore: number;      // Default: 50 (filter out scores > 50)
  requireLiquidity: boolean;  // Default: false
  requireVerified: boolean;   // Default: false
  minHolders: number;         // Default: 0
}

const DEFAULT_CONFIG: SpamFilterConfig = {
  maxSpamScore: 50,
  requireLiquidity: false,
  requireVerified: false,
  minHolders: 0,
};

/**
 * Calculate spam score for an NFT collection
 */
export async function calculateSpamScore(
  contractAddress: string
): Promise<NFTSpamScore> {
  // Check cache first (L3 - 24 hour TTL)
  const cacheKey = `such-market:spam-score:${contractAddress.toLowerCase()}`;
  const cached = await getCache<NFTSpamScore>(cacheKey);
  if (cached) return cached;

  const reasons: string[] = [];
  let score = 0;

  // Fetch metadata in parallel
  const [
    hasLiquidity,
    tradeVolume,
    holderCount,
    collectionData,
  ] = await Promise.all([
    checkLiquidity(contractAddress),
    getTradeVolume(contractAddress),
    getHolderCount(contractAddress),
    getCollectionMetadata(contractAddress),
  ]);

  // 1. Check liquidity (30 points if no liquidity)
  if (!hasLiquidity) {
    score += 30;
    reasons.push('No active liquidity (pools or listings)');
  }

  // 2. Check trading volume (25 points if no activity)
  if (tradeVolume === 0) {
    score += 25;
    reasons.push('No trading activity in last 30 days');
  } else if (tradeVolume < 0.01) {
    score += 15;
    reasons.push('Very low trading volume');
  }

  // 3. Check verification status (15 points if not verified)
  const isVerified = collectionData?.featured || false;
  if (!isVerified) {
    score += 15;
    reasons.push('Not verified or featured');
  }

  // 4. Check holder count (20 points if very few holders)
  if (holderCount < 5) {
    score += 20;
    reasons.push(`Very few holders (${holderCount})`);
  } else if (holderCount < 10) {
    score += 10;
    reasons.push(`Low holder count (${holderCount})`);
  }

  // 5. Check for spam keywords in name
  if (collectionData?.name) {
    const spamKeywords = [
      'airdrop',
      'claim',
      'free',
      'reward',
      'bonus',
      'gift',
      'winner',
      'congratulations',
      'voucher',
      'redeem',
    ];

    const nameSpam = spamKeywords.some(kw =>
      collectionData.name.toLowerCase().includes(kw)
    );

    if (nameSpam) {
      score += 10;
      reasons.push('Spam keywords in collection name');
    }
  }

  const result: NFTSpamScore = {
    contractAddress: contractAddress.toLowerCase(),
    score,
    reasons,
    metadata: {
      hasLiquidity,
      tradeVolume,
      holderCount,
      isVerified,
      isFeatured: collectionData?.featured || false,
    },
  };

  // Cache result (L3 - 24 hours)
  await setCache(cacheKey, result, 86400);

  return result;
}

/**
 * Filter collections to remove spam
 */
export async function filterSpamCollections(
  collections: string[],
  config: Partial<SpamFilterConfig> = {}
): Promise<{
  filtered: string[];
  removed: string[];
  scores: Record<string, NFTSpamScore>;
}> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Calculate scores for all collections
  const scores = await Promise.all(
    collections.map(addr => calculateSpamScore(addr))
  );

  const scoreMap: Record<string, NFTSpamScore> = {};
  scores.forEach(s => {
    scoreMap[s.contractAddress] = s;
  });

  // Apply filters
  const filtered: string[] = [];
  const removed: string[] = [];

  for (const score of scores) {
    let shouldFilter = false;

    // Check spam score
    if (score.score > finalConfig.maxSpamScore) {
      shouldFilter = true;
    }

    // Check liquidity requirement
    if (finalConfig.requireLiquidity && !score.metadata.hasLiquidity) {
      shouldFilter = true;
    }

    // Check verification requirement
    if (finalConfig.requireVerified && !score.metadata.isVerified) {
      shouldFilter = true;
    }

    // Check minimum holders
    if (score.metadata.holderCount < finalConfig.minHolders) {
      shouldFilter = true;
    }

    if (shouldFilter) {
      removed.push(score.contractAddress);
    } else {
      filtered.push(score.contractAddress);
    }
  }

  console.log(
    `Spam filter: ${filtered.length} collections kept, ${removed.length} filtered out`
  );

  return { filtered, removed, scores: scoreMap };
}

/**
 * Get filtered collections for a user
 */
export async function getUserFilteredCollections(
  fid: number,
  config?: Partial<SpamFilterConfig>
): Promise<string[]> {
  // Get all user collections from database
  const supabase = createSupabaseClient();

  const { data: userCollections, error } = await supabase
    .from('user_collections')
    .select('contract_address')
    .eq('fid', fid);

  if (error || !userCollections) {
    console.error('Error fetching user collections:', error);
    return [];
  }

  const addresses = userCollections.map(c => c.contract_address);

  // Filter spam
  const { filtered } = await filterSpamCollections(addresses, config);

  return filtered;
}

/**
 * Check if collection has any liquidity (pools or listings)
 */
async function checkLiquidity(contractAddress: string): Promise<boolean> {
  try {
    // Check LSSVM pools
    const poolLiquidity = await hasPoolLiquidity(contractAddress);
    if (poolLiquidity) return true;

    // Check Seaport listings
    const supabase = createSupabaseClient();
    const { data: listings } = await supabase
      .from('seaport_orders')
      .select('order_hash')
      .eq('collection_address', contractAddress.toLowerCase())
      .eq('status', 'ACTIVE')
      .gt('expiration', new Date().toISOString())
      .limit(1);

    return (listings && listings.length > 0) || false;
  } catch (error) {
    console.error('Error checking liquidity:', error);
    return false;
  }
}

/**
 * Get trade volume for collection (last 30 days)
 */
async function getTradeVolume(contractAddress: string): Promise<number> {
  try {
    const supabase = createSupabaseClient();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: fulfillments } = await supabase
      .from('seaport_fulfillments')
      .select('price')
      .eq('collection_address', contractAddress.toLowerCase())
      .gte('fulfilled_at', thirtyDaysAgo.toISOString());

    if (!fulfillments || fulfillments.length === 0) return 0;

    // Sum up total volume in ETH
    const totalVolume = fulfillments.reduce((sum, f) => {
      const price = parseFloat(f.price || '0');
      return sum + price;
    }, 0);

    return totalVolume;
  } catch (error) {
    console.error('Error fetching trade volume:', error);
    return 0;
  }
}

/**
 * Get holder count from NFT ownership table
 */
async function getHolderCount(contractAddress: string): Promise<number> {
  try {
    const supabase = createSupabaseClient();

    const { count, error } = await supabase
      .from('nft_ownership')
      .select('owner_address', { count: 'exact', head: true })
      .eq('contract_address', contractAddress.toLowerCase());

    if (error) {
      console.error('Error fetching holder count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error fetching holder count:', error);
    return 0;
  }
}

/**
 * Get collection metadata from database
 */
async function getCollectionMetadata(contractAddress: string): Promise<{
  name: string;
  featured: boolean;
} | null> {
  try {
    const supabase = createSupabaseClient();

    const { data, error } = await supabase
      .from('collections')
      .select('name, featured')
      .eq('contract_address', contractAddress.toLowerCase())
      .single();

    if (error || !data) return null;

    return data;
  } catch (error) {
    console.error('Error fetching collection metadata:', error);
    return null;
  }
}

/**
 * Batch calculate spam scores with caching
 */
export async function batchCalculateSpamScores(
  addresses: string[]
): Promise<Map<string, NFTSpamScore>> {
  const results = new Map<string, NFTSpamScore>();

  // Process in parallel batches of 10
  const batchSize = 10;
  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);
    const scores = await Promise.all(
      batch.map(addr => calculateSpamScore(addr))
    );

    scores.forEach(score => {
      results.set(score.contractAddress, score);
    });
  }

  return results;
}

/**
 * Get spam statistics for a collection
 */
export async function getSpamStatistics(contractAddress: string): Promise<{
  isLikelySpam: boolean;
  score: NFTSpamScore;
  recommendation: string;
}> {
  const score = await calculateSpamScore(contractAddress);

  let isLikelySpam = score.score > 50;
  let recommendation = '';

  if (score.score >= 80) {
    recommendation = 'Highly likely to be spam. Recommend hiding from users.';
  } else if (score.score >= 50) {
    recommendation = 'Possibly spam. Consider hiding unless user explicitly wants to see.';
  } else if (score.score >= 30) {
    recommendation = 'Low quality collection. Show but deprioritize.';
  } else {
    recommendation = 'Likely legitimate collection. Safe to display.';
  }

  return {
    isLikelySpam,
    score,
    recommendation,
  };
}
