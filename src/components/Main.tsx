"use client";

import { useEffect, useState } from "react";
import sdk from "@farcaster/frame-sdk";
import {
  useAccount,
  useDisconnect,
  useConnect,
  useSwitchChain,
  useChainId,
} from "wagmi";

import { Button } from "~/components/ui/Button";
import { truncateAddress } from "~/lib/truncateAddress";
import { base, degen, mainnet, optimism, unichain } from "wagmi/chains";
import { Label } from "~/components/ui/label";
import { useFrame } from "~/components/providers/FrameProvider";
import { SearchBar } from "./SearchBar";

interface VerifiedAddress {
  address: string;
  protocol: string;
  chainId?: number;
  timestamp?: number;
  hash?: string;
}

export default function Main() {
  console.log('🎯 Main component mounting');
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();
  const frameContext = useFrame();
  
  // State for verified addresses
  const [verifiedAddresses, setVerifiedAddresses] = useState<VerifiedAddress[]>([]);
  const [loadingVerifications, setLoadingVerifications] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Fetch verified addresses when we have a user FID
  useEffect(() => {
    const fetchVerifications = async (fid: number) => {
      setLoadingVerifications(true);
      setVerificationError(null);
      
      try {
        const response = await fetch(`/api/verifications/${fid}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch verifications: ${response.status}`);
        }
        
        const data = await response.json();
        setVerifiedAddresses(data.verifiedAddresses || []);
      } catch (error) {
        console.error('Error fetching verifications:', error);
        setVerificationError(error instanceof Error ? error.message : 'Failed to fetch verifications');
        setVerifiedAddresses([]);
      } finally {
        setLoadingVerifications(false);
      }
    };

    if (frameContext.context?.user?.fid) {
      fetchVerifications(frameContext.context.user.fid);
    } else {
      setVerifiedAddresses([]);
      setVerificationError(null);
    }
  }, [frameContext.context?.user?.fid]);

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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="max-w-4xl mx-auto p-4 space-y-8">
        {/* Welcome Section */}
        <section className="text-center space-y-4 pt-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Welcome to CryptoArt
          </h1>
          <p className="text-gray-400">
            Browse and trade NFTs on Base
          </p>
        </section>

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
          <section className="bg-gray-800/50 rounded-lg p-6 space-y-6">
            <h2 className="text-xl font-semibold">Farcaster Frame Context</h2>
            
            {/* User Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-blue-400">User Information</h3>
              <div className="bg-gray-700/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center space-x-4">
                  {frameContext.context.user.pfpUrl && (
                    <img 
                      src={frameContext.context.user.pfpUrl} 
                      alt="Profile" 
                      className="w-12 h-12 border border-s-amber-300 object-contain"
                    />
                  )}
                  <div className="space-y-1">
                    <p className="text-sm text-gray-400">FID</p>
                    <p className="font-mono">{frameContext.context.user.fid}</p>
                  </div>
                </div>
                {frameContext.context.user.username && (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-400">Username</p>
                    <p className="font-mono">@{frameContext.context.user.username}</p>
                  </div>
                )}
                {frameContext.context.user.displayName && (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-400">Display Name</p>
                    <p className="font-mono">{frameContext.context.user.displayName}</p>
                  </div>
                )}
                
                {/* Verified Addresses */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-400">Verified Addresses</p>
                    {loadingVerifications && (
                      <span className="text-xs text-yellow-400">Loading...</span>
                    )}
                  </div>
                  
                  {verificationError && (
                    <div className="text-xs text-red-400 bg-red-900/20 rounded p-2">
                      Error: {verificationError}
                    </div>
                  )}
                  
                  {verifiedAddresses.length > 0 ? (
                    <div className="space-y-2">
                      {verifiedAddresses.map((verifiedAddress, index) => (
                        <div key={index} className="bg-gray-600/50 rounded p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="text-xs text-gray-400">Address</p>
                              <p className="font-mono text-xs break-all">{verifiedAddress.address}</p>
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-xs text-gray-400">Protocol</p>
                              <p className="font-mono text-xs">{verifiedAddress.protocol}</p>
                            </div>
                          </div>
                          {verifiedAddress.timestamp && (
                            <div className="space-y-1">
                              <p className="text-xs text-gray-400">Verified</p>
                              <p className="font-mono text-xs">{new Date(verifiedAddress.timestamp * 1000).toLocaleString()}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : !loadingVerifications && !verificationError ? (
                    <p className="text-xs text-gray-500">No verified addresses found</p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Location Context */}
            {frameContext.context.location && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-green-400">Location Context</h3>
                <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-400">Type</p>
                    <p className="font-mono text-green-300">{frameContext.context.location.type}</p>
                  </div>
                  
                  {frameContext.context.location.type === 'cast_embed' && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-sm text-gray-400">Embed URL</p>
                        <p className="font-mono text-xs break-all">{frameContext.context.location.embed}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-gray-400">Cast Details</p>
                        <div className="bg-gray-600/50 rounded p-3 space-y-2">
                          <div className="flex items-center space-x-3">
                            {frameContext.context.location.cast.author.pfpUrl && (
                              <img 
                                src={frameContext.context.location.cast.author.pfpUrl} 
                                alt="Cast Author" 
                                className="w-8 h-8 rounded-full"
                              />
                            )}
                            <div>
                              <p className="font-mono text-sm">@{frameContext.context.location.cast.author.username}</p>
                              <p className="text-xs text-gray-400">FID: {frameContext.context.location.cast.author.fid}</p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-gray-400">Cast Hash</p>
                            <p className="font-mono text-xs break-all">{frameContext.context.location.cast.hash}</p>
                          </div>
                          {frameContext.context.location.cast.timestamp && (
                            <div className="space-y-1">
                              <p className="text-xs text-gray-400">Timestamp</p>
                              <p className="font-mono text-xs">{new Date(frameContext.context.location.cast.timestamp).toLocaleString()}</p>
                            </div>
                          )}
                          {frameContext.context.location.cast.channelKey && (
                            <div className="space-y-1">
                              <p className="text-xs text-gray-400">Channel</p>
                              <p className="font-mono text-xs">{frameContext.context.location.cast.channelKey}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {frameContext.context.location.type === 'cast_share' && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <p className="text-sm text-gray-400">Shared Cast Details</p>
                        <div className="bg-gray-600/50 rounded p-3 space-y-2">
                          <div className="flex items-center space-x-3">
                            {frameContext.context.location.cast.author.pfpUrl && (
                              <img 
                                src={frameContext.context.location.cast.author.pfpUrl} 
                                alt="Cast Author" 
                                className="w-8 h-8 rounded-full"
                              />
                            )}
                            <div>
                              <p className="font-mono text-sm">@{frameContext.context.location.cast.author.username}</p>
                              <p className="text-xs text-gray-400">FID: {frameContext.context.location.cast.author.fid}</p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-gray-400">Cast Hash</p>
                            <p className="font-mono text-xs break-all">{frameContext.context.location.cast.hash}</p>
                          </div>
                          {frameContext.context.location.cast.timestamp && (
                            <div className="space-y-1">
                              <p className="text-xs text-gray-400">Timestamp</p>
                              <p className="font-mono text-xs">{new Date(frameContext.context.location.cast.timestamp).toLocaleString()}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {frameContext.context.location.type === 'notification' && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-sm text-gray-400">Notification ID</p>
                        <p className="font-mono text-xs">{frameContext.context.location.notification.notificationId}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-gray-400">Title</p>
                        <p className="font-mono text-sm">{frameContext.context.location.notification.title}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-gray-400">Body</p>
                        <p className="font-mono text-sm">{frameContext.context.location.notification.body}</p>
                      </div>
                    </div>
                  )}

                  {frameContext.context.location.type === 'channel' && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        {frameContext.context.location.channel.imageUrl && (
                          <img 
                            src={frameContext.context.location.channel.imageUrl} 
                            alt="Channel" 
                            className="w-8 h-8 rounded-full"
                          />
                        )}
                        <div>
                          <p className="font-mono text-sm">{frameContext.context.location.channel.name}</p>
                          <p className="text-xs text-gray-400">Key: {frameContext.context.location.channel.key}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Client Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-purple-400">Client Information</h3>
              <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
                <div className="space-y-1">
                  <p className="text-sm text-gray-400">Client FID</p>
                  <p className="font-mono">{frameContext.context.client.clientFid}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-400">App Added</p>
                  <p className="font-mono">{frameContext.context.client.added ? 'Yes' : 'No'}</p>
                </div>
                
                {frameContext.context.client.safeAreaInsets && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Safe Area Insets</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="space-y-1">
                        <p className="text-gray-400">Top</p>
                        <p className="font-mono">{frameContext.context.client.safeAreaInsets.top}px</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-gray-400">Bottom</p>
                        <p className="font-mono">{frameContext.context.client.safeAreaInsets.bottom}px</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-gray-400">Left</p>
                        <p className="font-mono">{frameContext.context.client.safeAreaInsets.left}px</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-gray-400">Right</p>
                        <p className="font-mono">{frameContext.context.client.safeAreaInsets.right}px</p>
                      </div>
                    </div>
                  </div>
                )}

                {frameContext.context.client.notificationDetails && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Notification Details</p>
                    <div className="bg-gray-600/50 rounded p-3 space-y-2">
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400">URL</p>
                        <p className="font-mono text-xs break-all">{frameContext.context.client.notificationDetails.url}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400">Token</p>
                        <p className="font-mono text-xs break-all">{frameContext.context.client.notificationDetails.token}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Frame Status */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-yellow-400">Frame Status</h3>
              <div className="bg-gray-700/50 rounded-lg p-4 space-y-2">
                <div className="space-y-1">
                  <p className="text-sm text-gray-400">Last Event</p>
                  <p className="font-mono">{frameContext.lastEvent || 'No events yet'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-400">SDK Loaded</p>
                  <p className="font-mono">{frameContext.isSDKLoaded ? 'Yes' : 'No'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-400">Frame Added</p>
                  <p className="font-mono">{frameContext.added ? 'Yes' : 'No'}</p>
                </div>
                {frameContext.addFrameResult && (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-400">Add Frame Result</p>
                    <p className="font-mono text-xs">{frameContext.addFrameResult}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-orange-400">Actions</h3>
              <div className="flex gap-2">
                <Button
                  onClick={frameContext.addFrame}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Add Frame
                </Button>
                <Button
                  onClick={() => frameContext.openUrl('https://farcaster.xyz')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Open Farcaster
                </Button>
                <Button
                  onClick={frameContext.close}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Close
                </Button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
