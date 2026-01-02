'use client';

import Link from 'next/link';
import { UserButton, useUser } from '@clerk/nextjs';

export default function Header() {
  const { isSignedIn, user } = useUser();

  return (
    <header className="container mx-auto px-4 py-6">
      <nav className="flex justify-between items-center">
        <Link href="/">
          <h1 className="font-alex-brush text-5xl text-mystical-pink cursor-pointer">
            SoulSeer
          </h1>
        </Link>
        <div className="flex gap-6 items-center">
          <Link href="/readings" className="text-white hover:text-mystical-pink transition">
            Readings
          </Link>
          <Link href="/live" className="text-white hover:text-mystical-pink transition">
            Live
          </Link>
          <Link href="/shop" className="text-white hover:text-mystical-pink transition">
            Shop
          </Link>
          <Link href="/community" className="text-white hover:text-mystical-pink transition">
            Community
          </Link>
          
          {isSignedIn ? (
            <>
              <Link href="/dashboard">
                <button className="btn-mystical">Dashboard</button>
              </Link>
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: "w-10 h-10 border-2 border-mystical-pink"
                  }
                }}
                afterSignOutUrl="/"
              />
            </>
          ) : (
            <>
              <Link href="/sign-in">
                <button className="text-white hover:text-mystical-pink transition">
                  Sign In
                </button>
              </Link>
              <Link href="/sign-up">
                <button className="btn-mystical">Sign Up</button>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}