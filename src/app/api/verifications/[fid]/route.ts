import { NextRequest, NextResponse } from 'next/server';

interface VerificationMessage {
  data?: {
    type?: string;
    verificationAddEthAddressBody?: {
      address?: string;
      protocol?: string;
      chainId?: number;
    };
    verificationAddAddressBody?: {
      address?: string;
      protocol?: string;
      chainId?: number;
    };
    timestamp?: number;
  };
  hash?: string;
}

interface NeynarResponse {
  messages?: VerificationMessage[];
  nextPageToken?: string;
}

interface VerifiedAddress {
  address: string;
  protocol: string;
  chainId?: number;
  timestamp?: number;
  hash?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fid: string }> }
) {
  try {
    const { fid } = await params;
    
    if (!fid) {
      return NextResponse.json(
        { error: 'FID is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEYNAR_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Neynar API key not configured' },
        { status: 500 }
      );
    }

    const url = `https://hub-api.neynar.com/v1/verificationsByFid?fid=${fid}`;
    
    const response = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Neynar API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Failed to fetch verifications: ${response.status}` },
        { status: response.status }
      );
    }

    const data: NeynarResponse = await response.json();
    
    // Extract verified addresses from the response
    const verifiedAddresses: VerifiedAddress[] = data.messages
      ?.filter((message: VerificationMessage) => 
        message.data?.type === 'MESSAGE_TYPE_VERIFICATION_ADD_ETH_ADDRESS' ||
        message.data?.type === 'MESSAGE_TYPE_VERIFICATION_ADD_ADDRESS'
      )
      ?.map((message: VerificationMessage): VerifiedAddress | null => {
        const verificationData = message.data?.verificationAddEthAddressBody || 
                                message.data?.verificationAddAddressBody;
        
        if (!verificationData?.address) return null;
        
        return {
          address: verificationData.address,
          protocol: verificationData.protocol || 'PROTOCOL_ETHEREUM',
          chainId: verificationData.chainId,
          timestamp: message.data?.timestamp,
          hash: message.hash,
        };
      })
      ?.filter((address): address is VerifiedAddress => address !== null) || [];

    return NextResponse.json({
      fid: parseInt(fid),
      verifiedAddresses,
      total: verifiedAddresses.length,
    });

  } catch (error) {
    console.error('Error fetching verifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 