"use client";

import { useEffect, useState, useCallback } from "react";
import sdk, { type Context, type FrameNotificationDetails, AddMiniApp } from "@farcaster/frame-sdk";
import { createStore } from "mipd";
import React from "react";
import { FrameLoading } from "~/components/ui/LoadingSkeleton";

interface FrameContextType {
  isSDKLoaded: boolean;
  context: Context.FrameContext | undefined;
  openUrl: (url: string) => Promise<void>;
  close: () => Promise<void>;
  added: boolean;
  notificationDetails: FrameNotificationDetails | null;
  lastEvent: string;
  addFrame: () => Promise<void>;
  addFrameResult: string;
  sdkError: string | null;
  loadingTimeout: boolean;
}

const FrameContext = React.createContext<FrameContextType | undefined>(undefined);

export function useFrame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [added, setAdded] = useState(false);
  const [notificationDetails, setNotificationDetails] = useState<FrameNotificationDetails | null>(null);
  const [lastEvent, setLastEvent] = useState("");
  const [addFrameResult, setAddFrameResult] = useState("");
  const [sdkError, setSDKError] = useState<string | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // SDK actions only work in mini app clients, so this pattern supports browser actions as well
  const openUrl = useCallback(async (url: string) => {
    if (context) {
      await sdk.actions.openUrl(url);
    } else {
      window.open(url, '_blank');
    }
  }, [context]);

  const close = useCallback(async () => {
    if (context) {
      await sdk.actions.close();
    } else {
      window.close();
    }
  }, [context]);

  const addFrame = useCallback(async () => {
    try {
      setNotificationDetails(null);
      const result = await sdk.actions.addFrame();

      if (result.notificationDetails) {
        setNotificationDetails(result.notificationDetails);
      }
      setAddFrameResult(
        result.notificationDetails
          ? `Added, got notificaton token ${result.notificationDetails.token} and url ${result.notificationDetails.url}`
          : "Added, got no notification details"
      );
    } catch (error) {
      if (error instanceof AddMiniApp.RejectedByUser || error instanceof AddMiniApp.InvalidDomainManifest) {
        setAddFrameResult(`Not added: ${error.message}`);
      }else {
        setAddFrameResult(`Error: ${error}`);
      }
    }
  }, []);

  useEffect(() => {
    // Set timeout for SDK loading (5 seconds)
    const timeout = setTimeout(() => {
      if (!isSDKLoaded) {
        console.warn('⚠️  Farcaster SDK failed to load within 5 seconds. Continuing with limited functionality.');
        setLoadingTimeout(true);
        setSDKError('SDK initialization timed out');
      }
    }, 5000);

    const load = async () => {
      try {
        console.log('📡 Loading Farcaster SDK context...');
        const context = await sdk.context;
        setContext(context);
        setIsSDKLoaded(true);
        clearTimeout(timeout);
        console.log('✅ Farcaster SDK loaded successfully');

        // Set up event listeners
        sdk.on("frameAdded", ({ notificationDetails }) => {
          console.log("Frame added", notificationDetails);
          setAdded(true);
          setNotificationDetails(notificationDetails ?? null);
          setLastEvent("Frame added");
        });

        sdk.on("frameAddRejected", ({ reason }) => {
          console.log("Frame add rejected", reason);
          setAdded(false);
          setLastEvent(`Frame add rejected: ${reason}`);
        });

        sdk.on("frameRemoved", () => {
          console.log("Frame removed");
          setAdded(false);
          setLastEvent("Frame removed");
        });

        sdk.on("notificationsEnabled", ({ notificationDetails }) => {
          console.log("Notifications enabled", notificationDetails);
          setNotificationDetails(notificationDetails ?? null);
          setLastEvent("Notifications enabled");
        });

        sdk.on("notificationsDisabled", () => {
          console.log("Notifications disabled");
          setNotificationDetails(null);
          setLastEvent("Notifications disabled");
        });

        sdk.on("primaryButtonClicked", () => {
          console.log("Primary button clicked");
          setLastEvent("Primary button clicked");
        });

        // ✅ Call ready action ONCE (this is the ONLY place it should be called)
        console.log("Calling sdk.actions.ready()");
        sdk.actions.ready({});

        // Set up MIPD Store
        const store = createStore();
        store.subscribe((providerDetails) => {
          console.log("PROVIDER DETAILS", providerDetails);
        });
      } catch (error) {
        console.error('❌ Error loading Farcaster SDK:', error);
        setSDKError(error instanceof Error ? error.message : 'Unknown error occurred');
        setLoadingTimeout(true);
        clearTimeout(timeout);
      }
    };

    if (sdk && !isSDKLoaded && !loadingTimeout) {
      load();
    }

    return () => {
      clearTimeout(timeout);
      if (isSDKLoaded) {
        sdk.removeAllListeners();
      }
    };
  }, [isSDKLoaded, loadingTimeout]);

  return {
    isSDKLoaded,
    context,
    added,
    notificationDetails,
    lastEvent,
    addFrame,
    addFrameResult,
    openUrl,
    close,
    sdkError,
    loadingTimeout,
  };
}

export function FrameProvider({ children }: { children: React.ReactNode }) {
  const frameContext = useFrame();

  // Show loading state with timeout
  if (!frameContext.isSDKLoaded && !frameContext.loadingTimeout) {
    return <FrameLoading message="Connecting to Farcaster..." />;
  }

  // If SDK failed to load, log warning but continue rendering
  if (frameContext.sdkError && !frameContext.isSDKLoaded) {
    console.warn('⚠️  Continuing without full Farcaster functionality');
  }

  // Always render children (even if SDK didn't load properly)
  return (
    <FrameContext.Provider value={frameContext}>
      {children}
    </FrameContext.Provider>
  );
}

// Export hook to access Frame context
export function useFrameContext() {
  const context = React.useContext(FrameContext);
  if (!context) {
    throw new Error('useFrameContext must be used within a FrameProvider');
  }
  return context;
}
