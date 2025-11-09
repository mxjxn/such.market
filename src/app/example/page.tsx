import { Metadata } from "next";
import { APP_NAME, APP_DESCRIPTION, APP_OG_IMAGE_URL } from "~/lib/constants";
import { getFrameEmbedMetadata } from "~/lib/utils";
import App from "../app";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  console.log('🔍 Generating metadata for example page');
  return {
    title: `${APP_NAME} - Farcaster Frame Example`,
    openGraph: {
      title: `${APP_NAME} - Farcaster Frame Example`,
      description: APP_DESCRIPTION,
      images: [APP_OG_IMAGE_URL],
    },
    other: {
      "fc:frame": JSON.stringify(getFrameEmbedMetadata()),
    },
  };
}

export default function ExamplePage() {
  console.log('🏠 Rendering example page (Farcaster demo)');
  return <App />;
}

