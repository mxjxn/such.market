import type { Metadata } from "next";

import { getSession } from "~/auth"
import "~/app/globals.css";
import { Providers } from "~/app/providers";
import { APP_NAME, APP_DESCRIPTION } from "~/lib/constants";
import { TopNavigation } from "~/components/TopNavigation";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {  
  console.log('🎨 Rendering root layout');
  const session = await getSession()
  console.log('🔐 Session status:', session ? 'Authenticated' : 'Not authenticated');

  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <Providers session={session}>
          <div className="flex flex-col min-h-screen">
            <TopNavigation />
            <main className="flex-1 transition-all duration-300 ease-in-out">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
