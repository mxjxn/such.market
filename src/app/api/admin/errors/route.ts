import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '~/lib/supabase';

const supabase = getSupabaseClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get('collectionId');
    const errorType = searchParams.get('errorType');
    const tokenId = searchParams.get('tokenId');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('nft_fetch_errors')
      .select(`
        *,
        collections!inner(contract_address, name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (collectionId) {
      query = query.eq('collection_id', collectionId);
    }

    if (errorType) {
      query = query.eq('error_type', errorType);
    }

    if (tokenId) {
      query = query.eq('token_id', tokenId);
    }

    const { data: errors, error } = await query;

    console.log('🪲 [Admin Errors] Fetched errors:', {
      collectionId,
      errorType,
      tokenId,
      limit,
      errorCount: errors?.length || 0,
      errors,
    });

    if (error) {
      console.error('❌ Error fetching NFT fetch errors:', error);
      return NextResponse.json(
        { error: 'Failed to fetch errors' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      errors,
      total: errors?.length || 0,
      filters: {
        collectionId,
        errorType,
        tokenId,
        limit,
      },
    });

  } catch (error) {
    console.error('❌ Error in admin errors endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { collectionId, tokenId, errorType, errorMessage } = body;

    if (!collectionId || !tokenId || !errorType) {
      return NextResponse.json(
        { error: 'Missing required fields: collectionId, tokenId, errorType' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('nft_fetch_errors')
      .upsert({
        collection_id: collectionId,
        token_id: tokenId,
        error_type: errorType,
        error_message: errorMessage,
        retry_count: 0,
      }, {
        onConflict: 'collection_id,token_id,error_type',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error inserting NFT fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to insert error' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      error: data,
    });

  } catch (error) {
    console.error('❌ Error in admin errors POST endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 