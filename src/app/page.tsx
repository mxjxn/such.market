import { Metadata } from "next";
import { APP_NAME, APP_DESCRIPTION, APP_OG_IMAGE_URL } from "~/lib/constants";
import { getFrameEmbedMetadata } from "~/lib/utils";
import { Hero } from "~/components/homepage/Hero";
import { FeaturedCollections } from "~/components/homepage/FeaturedCollections";
import { LatestTrades } from "~/components/homepage/LatestTrades";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  console.log('🔍 Generating metadata for homepage');
  return {
    title: APP_NAME,
    openGraph: {
      title: APP_NAME,
      description: APP_DESCRIPTION,
      images: [APP_OG_IMAGE_URL],
    },
    other: {
      "fc:frame": JSON.stringify(getFrameEmbedMetadata()),
    },
  };
}

export default function Home() {
  console.log('🏠 Rendering homepage component');
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <Hero />
        <FeaturedCollections />
        <LatestTrades />
      </div>
    </div>
  );
}
