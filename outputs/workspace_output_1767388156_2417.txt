import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs'
import "./globals.css";

export const metadata: Metadata = {
  title: "SoulSeer - A Community of Gifted Psychics",
  description: "Connect with spiritual readers for guidance through chat, call, or video readings. Join live streams and explore our mystical community.",
  keywords: "psychic, readings, spiritual guidance, tarot, astrology, live streams",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        </head>
        <body className="antialiased cosmic-bg min-h-screen">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}