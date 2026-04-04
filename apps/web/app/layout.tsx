import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "../components/providers";
import { TopNav } from "../components/top-nav";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HumanAsAService",
  description: "Verified human execution layer for AI systems",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${plexSans.variable} ${plexMono.variable}`}>
      <body className="grain-texture min-h-full flex flex-col bg-[var(--color-background)]">
        <Providers>
          <TopNav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
