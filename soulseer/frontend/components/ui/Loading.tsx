/**
 * Loading Components
 * Reusable loading states and skeletons
 */

'use client';

import React from 'react';

export function Spinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeStyles = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <svg
      className={`animate-spin ${sizeStyles[size]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
}

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center cosmic-bg">
      <div className="text-center">
        <Spinner size="lg" className="mx-auto text-pink-600" />
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export function CardLoader() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
      </div>
    </div>
  );
}

export function TableLoader({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 border-b border-gray-200">
          <div className="animate-pulse bg-gray-200 h-4 w-8 rounded"></div>
          <div className="animate-pulse bg-gray-200 h-4 w-1/4 rounded"></div>
          <div className="animate-pulse bg-gray-200 h-4 w-1/3 rounded"></div>
          <div className="animate-pulse bg-gray-200 h-4 w-1/4 rounded"></div>
        </div>
      ))}
    </div>
  );
}

export function ReaderCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="animate-pulse">
        <div className="h-48 bg-gray-200"></div>
        <div className="p-4">
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    </div>
  );
}