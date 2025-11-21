"use client";

import dynamic from "next/dynamic";
import type { Session } from "next-auth"
import { SessionProvider } from "next-auth/react"
import { FrameProvider } from "~/components/providers/FrameProvider";

const WagmiProvider = dynamic(
  () => import("~/components/providers/WagmiProvider"),
  {
    ssr: false,
  }
);

/**
 * Providers Component
 *
 * Provider nesting order (important to avoid race conditions):
 * 1. FrameProvider - Must be outermost to initialize Farcaster SDK first
 * 2. SessionProvider - NextAuth session management
 * 3. WagmiProvider - Wallet connection (uses farcasterFrame() connector)
 *
 * This order ensures:
 * - Frame SDK loads before Wagmi tries to use farcasterFrame() connector
 * - Session is available before wallet connection attempts
 * - All providers are ready before children render
 */
export function Providers({ session, children }: { session: Session | null, children: React.ReactNode }) {
  return (
    <FrameProvider>
      <SessionProvider session={session}>
        <WagmiProvider>
          {children}
        </WagmiProvider>
      </SessionProvider>
    </FrameProvider>
  );
}
