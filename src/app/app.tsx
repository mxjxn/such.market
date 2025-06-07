"use client";

import dynamic from "next/dynamic";

// Import Main component with proper typing
const Main = dynamic(() => import("~/components/Main").then(mod => ({ default: mod.default })), {
  ssr: false,
});

export default function App() {
  return (
    <div className="min-h-screen bg-black">
      <Main />
    </div>
  );
}
