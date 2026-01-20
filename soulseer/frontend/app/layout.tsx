import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "SoulSeer - Psychic Readings & Spiritual Guidance",
  description: "Connect with gifted psychic readers for personalized spiritual guidance through video, voice, and chat readings.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      dynamic
    >
      <html lang="en">
        <body className="bg-gray-900 text-white antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}