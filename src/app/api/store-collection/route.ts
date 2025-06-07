import { NextResponse } from 'next/server';
import { addCollectionName } from '~/lib/kv';

export async function POST(request: Request) {
  try {
    const { name, address } = await request.json();

    if (!name || !address) {
      return NextResponse.json(
        { error: 'Name and address are required' },
        { status: 400 }
      );
    }

    // Validate address format
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      );
    }

    await addCollectionName(name, address.toLowerCase());
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error storing collection:', error);
    return NextResponse.json(
      { error: 'Failed to store collection' },
      { status: 500 }
    );
  }
} 