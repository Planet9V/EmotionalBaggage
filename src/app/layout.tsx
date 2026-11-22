import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Shell } from "@/components/Shell";
import { auth2Enabled } from "@/lib/auth2/config";

export const metadata: Metadata = {
  title: "Concept to Realization",
  description: "Take a product from concept through prototype to production and sales.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>
          {/* Read per request on dynamic pages (every /auth page is), so the switch is the running server's. */}
          <Shell auth2={auth2Enabled()}>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
