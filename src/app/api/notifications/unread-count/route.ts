import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '~/auth';
import { getSupabaseClient } from '~/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const fid = session?.user?.fid;
    
    if (!fid) {
      return NextResponse.json({ count: 0 });
    }
    
    const supabase = getSupabaseClient();
    
    const { count, error } = await supabase
      .from('seaport_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('fc_user_id', fid)
      .eq('is_read', false);
    
    if (error) {
      console.error('Error fetching unread count:', error);
      return NextResponse.json({ count: 0 });
    }
    
    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    console.error('Error in unread count GET:', error);
    return NextResponse.json({ count: 0 });
  }
}

