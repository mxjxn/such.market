import type { Metadata } from "next";

import { getSession } from "~/auth"
import "~/app/globals.css";
import { Providers } from "~/app/providers";
import { APP_NAME, APP_DESCRIPTION } from "~/lib/constants";
import { HomeButton } from "~/components/HomeButton";

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
    <html lang="en">
      <body>
        <Providers session={session}>
          <HomeButton />
          {children}
        </Providers>
      </body>
    </html>
  );
}
