import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '~/auth';
import { getSupabaseClient } from '~/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const fid = session?.user?.fid;
    
    if (!fid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const supabase = getSupabaseClient();
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
    const unreadOnly = request.nextUrl.searchParams.get('unread_only') === 'true';
    
    let query = supabase
      .from('seaport_notifications')
      .select(`
        id,
        notification_type,
        message,
        is_read,
        created_at,
        seaport_orders!inner(
          id,
          order_hash,
          order_type,
          offerer_address
        )
      `)
      .eq('fc_user_id', fid)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (unreadOnly) {
      query = query.eq('is_read', false);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json(
        { error: 'Failed to fetch notifications' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ notifications: data || [] });
  } catch (error) {
    console.error('Error in notifications GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

