import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '~/lib/supabase';
import { retryMetadataFetch } from '~/lib/nft-metadata';

// Initialize Supabase client
const supabase = getSupabaseClient();

// Helper function to get failed metadata fetches
async function getFailedMetadataFetches(limit: number = 50) {
  try {
    const { data: errors, error } = await supabase
      .from('nft_fetch_errors')
      .select(`
        id,
        collection_id,
        token_id,
        error_type,
        error_message,
        retry_count,
        created_at,
        collections!inner(name, contract_address)
      `)
      .eq('error_type', 'metadata_fetch')
      .lt('retry_count', 3) // Only retry if less than 3 attempts
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error fetching failed metadata:', error);
      return [];
    }

    return errors || [];
  } catch (error) {
    console.error('❌ Error in getFailedMetadataFetches:', error);
    return [];
  }
}

// Helper function to update error record
async function updateErrorRecord(
  errorId: string, 
  retryCount: number, 
  success: boolean, 
  newErrorMessage?: string
) {
  try {
    const updateData: {
      retry_count: number;
      updated_at: string;
      error_message?: string;
    } = {
      retry_count: retryCount,
      updated_at: new Date().toISOString(),
    };

    if (success) {
      // If successful, we could delete the error record or mark it as resolved
      await supabase
        .from('nft_fetch_errors')
        .delete()
        .eq('id', errorId);
    } else {
      // If failed, update the error message
      updateData.error_message = newErrorMessage || 'Retry failed';
      await supabase
        .from('nft_fetch_errors')
        .update(updateData)
        .eq('id', errorId);
    }
  } catch (error) {
    console.error('❌ Error updating error record:', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    console.log('🔍 [NFT Retry] Getting failed metadata fetches...');
    const failedFetches = await getFailedMetadataFetches(limit);

    return NextResponse.json({
      success: true,
      data: {
        failedFetches,
        count: failedFetches.length,
        limit,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [NFT Retry] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get failed metadata fetches',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, errorId, contractAddress, tokenId, collectionId } = await request.json();

    switch (action) {
      case 'retry-single':
        if (!errorId || !contractAddress || !tokenId || !collectionId) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Missing required parameters',
              message: 'Required: errorId, contractAddress, tokenId, collectionId'
            },
            { status: 400 }
          );
        }

        console.log(`🔄 [NFT Retry] Retrying single metadata fetch:`, {
          errorId,
          contractAddress,
          tokenId,
          collectionId,
        });

        try {
          const metadata = await retryMetadataFetch(contractAddress, tokenId, collectionId, 3);
          
          if (metadata) {
            // Store the successfully fetched metadata
            const { error: upsertError } = await supabase
              .from('nfts')
              .upsert(metadata, { onConflict: 'collection_id,token_id' });

            if (upsertError) {
              throw new Error(`Failed to store metadata: ${upsertError.message}`);
            }

            // Update error record as successful
            await updateErrorRecord(errorId, 1, true);

            return NextResponse.json({
              success: true,
              message: 'Metadata fetch retry successful',
              data: {
                errorId,
                contractAddress,
                tokenId,
                metadata: {
                  title: metadata.title,
                  hasImage: !!metadata.image_url,
                  hasAttributes: Array.isArray(metadata.attributes),
                },
              },
              timestamp: new Date().toISOString(),
            });
          } else {
            // Update error record as failed
            await updateErrorRecord(errorId, 1, false, 'Retry failed - no metadata returned');
            
            return NextResponse.json({
              success: false,
              message: 'Metadata fetch retry failed',
              data: {
                errorId,
                contractAddress,
                tokenId,
              },
              timestamp: new Date().toISOString(),
            });
          }
        } catch (error) {
          // Update error record as failed
          await updateErrorRecord(errorId, 1, false, `Retry error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          
          throw error;
        }

      case 'retry-batch':
        const requestBody = await request.json();
        const batchSize = parseInt(requestBody.batchSize || '10', 10);
        
        console.log(`🔄 [NFT Retry] Retrying batch of failed metadata fetches (batch size: ${batchSize})...`);
        
        const failedFetches = await getFailedMetadataFetches(batchSize);
        const results = {
          successful: 0,
          failed: 0,
          errors: [] as Array<{ errorId: string; error: string }>,
        };

        for (const failedFetch of failedFetches) {
          try {
            const metadata = await retryMetadataFetch(
              failedFetch.collections.contract_address,
              failedFetch.token_id,
              failedFetch.collection_id,
              2 // Reduced retries for batch processing
            );

            if (metadata) {
              // Store the successfully fetched metadata
              const { error: upsertError } = await supabase
                .from('nfts')
                .upsert(metadata, { onConflict: 'collection_id,token_id' });

              if (upsertError) {
                throw new Error(`Failed to store metadata: ${upsertError.message}`);
              }

              // Update error record as successful
              await updateErrorRecord(failedFetch.id, failedFetch.retry_count + 1, true);
              results.successful++;
            } else {
              // Update error record as failed
              await updateErrorRecord(failedFetch.id, failedFetch.retry_count + 1, false, 'Retry failed - no metadata returned');
              results.failed++;
            }
          } catch (error) {
            // Update error record as failed
            await updateErrorRecord(
              failedFetch.id, 
              failedFetch.retry_count + 1, 
              false, 
              `Retry error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            
            results.failed++;
            results.errors.push({
              errorId: failedFetch.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }

          // Add small delay between retries to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        return NextResponse.json({
          success: true,
          message: 'Batch retry completed',
          data: {
            batchSize,
            processed: failedFetches.length,
            results,
          },
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid action',
            message: 'Supported actions: retry-single, retry-batch'
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('❌ [NFT Retry] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to perform retry action',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 