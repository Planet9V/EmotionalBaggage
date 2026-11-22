import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Shell } from "@/components/Shell";
import { auth2EnabledNow } from "@/lib/auth2/config";

export const metadata: Metadata = {
  title: "Concept to Realization",
  description: "Take a product from concept through prototype to production and sales.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>
          {/* The switch as the proxy last read it for this process (every request passes the proxy first), so the
              layout itself never queries the database. */}
          <Shell auth2={auth2EnabledNow()}>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
