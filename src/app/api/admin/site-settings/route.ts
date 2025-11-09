import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '~/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .order('key');
    
    if (error) {
      console.error('Error fetching site settings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch site settings' },
        { status: 500 }
      );
    }
    
    // Convert array to object for easier access
    const settings = data?.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {} as Record<string, string>) || {};
    
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error in site settings GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value, updated_by_fid } = body;
    
    if (!key || value === undefined) {
      return NextResponse.json(
        { error: 'key and value are required' },
        { status: 400 }
      );
    }
    
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('site_settings')
      .upsert({
        key,
        value,
        updated_by_fid: updated_by_fid || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key',
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error upserting site setting:', error);
      return NextResponse.json(
        { error: 'Failed to update site setting' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, setting: data });
  } catch (error) {
    console.error('Error in site settings POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

