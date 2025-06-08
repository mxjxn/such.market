import { NextResponse } from 'next/server';
import { getCollectionNames } from '~/lib/kv';

export async function POST(request: Request) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
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

    const collections = await getCollectionNames();
    const exists = Object.values(collections).includes(address.toLowerCase());

    return NextResponse.json({ exists });
  } catch (error) {
    console.error('Error checking collection existence:', error);
    return NextResponse.json(
      { error: 'Failed to check collection existence' },
      { status: 500 }
    );
  }
} 