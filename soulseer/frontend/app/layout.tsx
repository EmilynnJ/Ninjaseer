import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs';
import { Providers } from './providers';
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
  // Get the publishable key from environment
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // If no key is available during build, render without Clerk
  if (!publishableKey) {
    return (
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        </head>
        <body className="antialiased cosmic-bg min-h-screen">
          <Providers>
            {children}
          </Providers>
        </body>
      </html>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        </head>
        <body className="antialiased cosmic-bg min-h-screen">
          <Providers>
            {children}
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}