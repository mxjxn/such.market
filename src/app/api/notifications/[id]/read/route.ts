import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '~/auth';
import { getSupabaseClient } from '~/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const fid = session?.user?.fid;
    const { id } = await params;
    
    if (!fid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const supabase = getSupabaseClient();
    
    // Verify the notification belongs to the user
    const { data: notification, error: fetchError } = await supabase
      .from('seaport_notifications')
      .select('id, fc_user_id')
      .eq('id', id)
      .single();
    
    if (fetchError || !notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }
    
    if (notification.fc_user_id !== fid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    // Mark as read
    const { error: updateError } = await supabase
      .from('seaport_notifications')
      .update({ is_read: true })
      .eq('id', id);
    
    if (updateError) {
      console.error('Error marking notification as read:', updateError);
      return NextResponse.json(
        { error: 'Failed to mark notification as read' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in notification read POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

