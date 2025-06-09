"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "../components/ui/input";
import { signIn, signOut, getCsrfToken } from "next-auth/react";
import sdk from "@farcaster/frame-sdk";
import {
  useAccount,
  useSendTransaction,
  useSignMessage,
  useSignTypedData,
  useWaitForTransactionReceipt,
  useDisconnect,
  useConnect,
  useSwitchChain,
  useChainId,
} from "wagmi";

import { config } from "~/components/providers/WagmiProvider";
import { Button } from "~/components/ui/Button";
import { truncateAddress } from "~/lib/truncateAddress";
import { base, degen, mainnet, optimism, unichain } from "wagmi/chains";
import { BaseError, UserRejectedRequestError } from "viem";
import { useSession } from "next-auth/react";
import { Label } from "~/components/ui/label";
import { useFrame } from "~/components/providers/FrameProvider";
import { SearchBar } from "./SearchBar";

export default function Main() {
  console.log('🎯 Main component mounting');
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();
  const { data: session } = useSession();
  const frameContext = useFrame();

  // Notify Farcaster that the app is ready
  useEffect(() => {
    console.log('🔄 Main component mounted, checking frame context:', {
      isSDKLoaded: frameContext.isSDKLoaded,
      hasContext: !!frameContext.context,
      isConnected,
      chainId
    });
    if (frameContext.isSDKLoaded) {
      sdk.actions.ready();
    }
  }, [frameContext.isSDKLoaded, frameContext.context, isConnected, chainId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            CryptoArt Marketplace
          </h1>
          <p className="text-gray-400">
            Browse and trade NFTs on Base
          </p>
        </header>

        {/* Search Section */}
        <section className="space-y-4">
          <SearchBar />
        </section>

        {/* Wallet Connection Section */}
        <section className="bg-gray-800/50 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">Wallet Connection</h2>
          {!isConnected ? (
            <div className="space-y-4">
              {connectors.map((connector) => (
                <Button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  className="w-full"
                >
                  Connect {connector.name}
                </Button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-gray-400">Connected Address</p>
                  <p className="font-mono">{address ? truncateAddress(address) : 'Not connected'}</p>
                </div>
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => disconnect()}
                >
                  Disconnect
                </Button>
              </div>
              
              {/* Chain Selection */}
              <div className="space-y-2">
                <Label>Network</Label>
                <div className="flex gap-2 flex-wrap">
                  {[base, optimism, mainnet, degen, unichain].map((chain) => (
                    <Button
                      key={chain.id}
                      className={`flex-1 min-w-[120px] ${
                        chainId === chain.id 
                          ? 'bg-blue-600 hover:bg-blue-700' 
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                      onClick={() => switchChain({ chainId: chain.id })}
                    >
                      {chain.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Farcaster Frame Section */}
        {frameContext.context && (
          <section className="bg-gray-800/50 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold">Farcaster Frame</h2>
            <div className="space-y-2">
              <p className="text-sm text-gray-400">Frame Status</p>
              <p className="font-mono">{frameContext.lastEvent}</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
