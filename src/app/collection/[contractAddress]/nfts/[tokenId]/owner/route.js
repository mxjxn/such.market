import { NextResponse } from "next/server";
import { Alchemy, Network } from "alchemy-sdk";

const alchemy = new Alchemy({
  apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

export async function GET(request, { params }) {
  const { contractAddress, tokenId } = params;
  if (!contractAddress || !tokenId) {
    return NextResponse.json({ error: "Missing contract address or tokenId." }, { status: 400 });
  }
  try {
    const response = await alchemy.nft.getOwnersForNft(contractAddress, tokenId);
    if (!response.owners || response.owners.length === 0) {
      return NextResponse.json({ error: "Owner not found." }, { status: 404 });
    }
    // Return the first owner (ERC721) or all owners (ERC1155)
    return NextResponse.json({ owner: response.owners[0] });
  } catch (err) {
    if (err && err.status === 404) {
      return NextResponse.json({ error: "Owner not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to fetch owner." }, { status: 500 });
  }
} 