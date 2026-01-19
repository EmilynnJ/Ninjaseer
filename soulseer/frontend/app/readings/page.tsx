'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import Header from '../components/Header';

// Types
interface Reader {
  id: string;
  displayName: string;
  profileImageUrl: string;
  coverImageUrl?: string;
  specialties: string[];
  rating: number;
  reviewCount: number;
  ratePerMinute: number;
  ratePerMinuteVoice: number;
  ratePerMinuteVideo: number;
  status: 'online' | 'offline' | 'busy';
  bio: string;
  yearsExperience: number;
  totalReadings: number;
  isFeatured: boolean;
  isVerified: boolean;
  languages: string[];
  responseTime: string;
  lastOnline?: string;
}

interface FilterState {
  category: string;
  specialty: string;
  status: string;
  priceRange: [number, number];
  minRating: number;
  sortBy: string;
  search: string;
}

// Mock data
const mockReaders: Reader[] = [
  {
    id: '1',
    displayName: 'Mystic Aurora',
    profileImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    specialties: ['Tarot', 'Love & Relationships', 'Career', 'Life Path'],
    rating: 4.9,
    reviewCount: 1247,
    ratePerMinute: 5.99,
    ratePerMinuteVoice: 6.99,
    ratePerMinuteVideo: 7.99,
    status: 'online',
    bio: 'Gifted psychic with 15 years of experience helping souls find their path. I specialize in love readings and career guidance using tarot and intuitive abilities.',
    yearsExperience: 15,
    totalReadings: 8500,
    isFeatured: true,
    isVerified: true,
    languages: ['English', 'Spanish'],
    responseTime: 'Usually responds within 1 minute'
  },
  {
    id: '2',
    displayName: 'Celestial Rose',
    profileImageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
    specialties: ['Mediumship', 'Spirit Guides', 'Past Lives', 'Grief Counseling'],
    rating: 4.8,
    reviewCount: 892,
    ratePerMinute: 7.99,
    ratePerMinuteVoice: 8.99,
    ratePerMinuteVideo: 9.99,
    status: 'online',
    bio: 'Connecting you with loved ones who have passed and your spirit guides. I bring messages of love, healing, and closure.',
    yearsExperience: 12,
    totalReadings: 6200,
    isFeatured: true,
    isVerified: true,
    languages: ['English'],
    responseTime: 'Usually responds within 2 minutes'
  },
  {
    id: '3',
    displayName: 'Luna Starweaver',
    profileImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    specialties: ['Astrology', 'Numerology', 'Life Path', 'Birth Chart'],
    rating: 4.9,
    reviewCount: 1563,
    ratePerMinute: 6.99,
    ratePerMinuteVoice: 7.99,
    ratePerMinuteVideo: 8.99,
    status: 'busy',
    bio: 'Expert astrologer revealing the cosmic blueprint of your destiny. Detailed birth chart analysis and transit readings.',
    yearsExperience: 20,
    totalReadings: 12000,
    isFeatured: true,
    isVerified: true,
    languages: ['English', 'French'],
    responseTime: 'Usually responds within 5 minutes'
  },
  {
    id: '4',
    displayName: 'Phoenix Heart',
    profileImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    specialties: ['Energy Healing', 'Chakra', 'Aura Reading', 'Reiki'],
    rating: 4.7,
    reviewCount: 654,
    ratePerMinute: 4.99,
    ratePerMinuteVoice: 5.99,
    ratePerMinuteVideo: 6.99,
    status: 'online',
    bio: 'Healing energy worker specializing in chakra alignment and aura cleansing. Let me help restore your energetic balance.',
    yearsExperience: 8,
    totalReadings: 3800,
    isFeatured: false,
    isVerified: true,
    languages: ['English'],
    responseTime: 'Usually responds within 1 minute'
  },
  {
    id: '5',
    displayName: 'Sage Moonlight',
    profileImageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
    specialties: ['Tarot', 'Oracle Cards', 'Intuitive Reading', 'Spiritual Guidance'],
    rating: 4.8,
    reviewCount: 789,
    ratePerMinute: 5.49,
    ratePerMinuteVoice: 6.49,
    ratePerMinuteVideo: 7.49,
    status: 'online',
    bio: 'Intuitive tarot reader with a gentle approach. I help you navigate life\'s challenges with compassion and clarity.',
    yearsExperience: 10,
    totalReadings: 5200,
    isFeatured: false,
    isVerified: true,
    languages: ['English', 'German'],
    responseTime: 'Usually responds within 3 minutes'
  },
  {
    id: '6',
    displayName: 'Crystal Seer',
    profileImageUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400',
    specialties: ['Crystal Ball', 'Clairvoyance', 'Future Predictions', 'Dream Analysis'],
    rating: 4.6,
    reviewCount: 432,
    ratePerMinute: 6.49,
    ratePerMinuteVoice: 7.49,
    ratePerMinuteVideo: 8.49,
    status: 'offline',
    bio: 'Third-generation crystal ball reader with the gift of clairvoyance. I see what others cannot.',
    yearsExperience: 18,
    totalReadings: 7800,
    isFeatured: false,
    isVerified: true,
    languages: ['English', 'Italian'],
    responseTime: 'Usually responds within 10 minutes',
    lastOnline: '2 hours ago'
  },
  {
    id: '7',
    displayName: 'Divine Whisper',
    profileImageUrl: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=400',
    specialties: ['Angel Cards', 'Divine Messages', 'Spiritual Healing', 'Life Purpose'],
    rating: 4.9,
    reviewCount: 1102,
    ratePerMinute: 7.49,
    ratePerMinuteVoice: 8.49,
    ratePerMinuteVideo: 9.49,
    status: 'online',
    bio: 'Channel for divine messages and angelic guidance. Let the angels speak to you through me.',
    yearsExperience: 14,
    totalReadings: 9100,
    isFeatured: true,
    isVerified: true,
    languages: ['English'],
    responseTime: 'Usually responds within 2 minutes'
  },
  {
    id: '8',
    displayName: 'Raven Shadow',
    profileImageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
    specialties: ['Dark Arts', 'Protection Spells', 'Hex Removal', 'Shadow Work'],
    rating: 4.7,
    reviewCount: 567,
    ratePerMinute: 8.99,
    ratePerMinuteVoice: 9.99,
    ratePerMinuteVideo: 10.99,
    status: 'busy',
    bio: 'Specialist in protection and hex removal. I help you clear negative energies and protect your spirit.',
    yearsExperience: 16,
    totalReadings: 4500,
    isFeatured: false,
    isVerified: true,
    languages: ['English', 'Portuguese'],
    responseTime: 'Usually responds within 5 minutes'
  }
];

const specialties = [
  'All Specialties',
  'Tarot',
  'Astrology',
  'Mediumship',
  'Love & Relationships',
  'Career',
  'Energy Healing',
  'Numerology',
  'Dream Analysis',
  'Past Lives',
  'Spirit Guides',
  'Clairvoyance',
  'Angel Cards',
  'Oracle Cards'
];

const sortOptions = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'reviews', label: 'Most Reviews' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'experience', label: 'Most Experienced' },
  { value: 'readings', label: 'Most Readings' }
];

// Components
const FilterSidebar = ({ 
  filters, 
  setFilters,
  onlineCount,
  totalCount
}: { 
  filters: FilterState; 
  setFilters: (filters: FilterState) => void;
  onlineCount: number;
  totalCount: number;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile filter button */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed bottom-4 right-4 z-40 bg-pink-500 text-white p-4 rounded-full shadow-lg"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 lg:top-24 left-0 h-full lg:h-auto w-80 lg:w-64
        bg-[#1a1a2e] lg:bg-transparent p-6 z-50 lg:z-auto
        transform transition-transform lg:transform-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        overflow-y-auto
      `}>
        <div className="flex items-center justify-between lg:hidden mb-6">
          <h3 className="text-xl font-semibold text-white">Filters</h3>
          <button onClick={() => setIsOpen(false)} className="text-gray-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Status filter */}
        <div className="mb-6">
          <h4 className="text-white font-semibold mb-3">Availability</h4>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                name="status"
                checked={filters.status === 'all'}
                onChange={() => setFilters({ ...filters, status: 'all' })}
                className="w-4 h-4 text-pink-500 bg-gray-700 border-gray-600 focus:ring-pink-500"
              />
              <span className="text-gray-300 group-hover:text-white">All Readers ({totalCount})</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                name="status"
                checked={filters.status === 'online'}
                onChange={() => setFilters({ ...filters, status: 'online' })}
                className="w-4 h-4 text-pink-500 bg-gray-700 border-gray-600 focus:ring-pink-500"
              />
              <span className="text-gray-300 group-hover:text-white flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Online Now ({onlineCount})
              </span>
            </label>
          </div>
        </div>

        {/* Specialty filter */}
        <div className="mb-6">
          <h4 className="text-white font-semibold mb-3">Specialty</h4>
          <select
            value={filters.specialty}
            onChange={(e) => setFilters({ ...filters, specialty: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 focus:ring-pink-500 focus:border-pink-500"
          >
            {specialties.map((specialty) => (
              <option key={specialty} value={specialty === 'All Specialties' ? '' : specialty}>
                {specialty}
              </option>
            ))}
          </select>
        </div>

        {/* Price range filter */}
        <div className="mb-6">
          <h4 className="text-white font-semibold mb-3">Price Range</h4>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              value={filters.priceRange[0] || ''}
              onChange={(e) => setFilters({ 
                ...filters, 
                priceRange: [Number(e.target.value), filters.priceRange[1]] 
              })}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 focus:ring-pink-500 focus:border-pink-500"
            />
            <span className="text-gray-500">-</span>
            <input
              type="number"
              placeholder="Max"
              value={filters.priceRange[1] || ''}
              onChange={(e) => setFilters({ 
                ...filters, 
                priceRange: [filters.priceRange[0], Number(e.target.value)] 
              })}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 focus:ring-pink-500 focus:border-pink-500"
            />
          </div>
          <p className="text-gray-500 text-sm mt-1">Per minute (USD)</p>
        </div>

        {/* Rating filter */}
        <div className="mb-6">
          <h4 className="text-white font-semibold mb-3">Minimum Rating</h4>
          <div className="space-y-2">
            {[4.5, 4.0, 3.5, 0].map((rating) => (
              <label key={rating} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="rating"
                  checked={filters.minRating === rating}
                  onChange={() => setFilters({ ...filters, minRating: rating })}
                  className="w-4 h-4 text-pink-500 bg-gray-700 border-gray-600 focus:ring-pink-500"
                />
                <span className="text-gray-300 group-hover:text-white flex items-center gap-1">
                  {rating > 0 ? (
                    <>
                      {rating}+ <span className="text-yellow-400">★</span>
                    </>
                  ) : (
                    'Any Rating'
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Clear filters */}
        <button
          onClick={() => setFilters({
            category: '',
            specialty: '',
            status: 'all',
            priceRange: [0, 0],
            minRating: 0,
            sortBy: 'recommended',
            search: ''
          })}
          className="w-full py-2 text-pink-400 hover:text-pink-300 font-semibold"
        >
          Clear All Filters
        </button>
      </aside>
    </>
  );
};

const ReaderCard = ({ reader }: { reader: Reader }) => {
  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-500',
    busy: 'bg-yellow-500'
  };

  const statusText = {
    online: 'Available Now',
    offline: reader.lastOnline || 'Offline',
    busy: 'In a Reading'
  };

  return (
    <div className="bg-gradient-to-b from-purple-900/30 to-black/30 rounded-2xl overflow-hidden border border-purple-500/20 hover:border-pink-500/40 transition-all group">
      <div className="flex flex-col md:flex-row">
        {/* Image section */}
        <div className="relative md:w-48 lg:w-56 flex-shrink-0">
          <div className="aspect-square md:aspect-auto md:h-full relative">
            <Image
              src={reader.profileImageUrl}
              alt={reader.displayName}
              fill
              className="object-cover"
            />
          </div>
          
          {/* Status badge */}
          <div className={`absolute top-3 left-3 ${statusColors[reader.status]} text-white text-xs px-2 py-1 rounded-full flex items-center gap-1`}>
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
            {statusText[reader.status]}
          </div>

          {/* Featured badge */}
          {reader.isFeatured && (
            <div className="absolute top-3 right-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs px-2 py-1 rounded-full">
              ⭐ Featured
            </div>
          )}
        </div>

        {/* Content section */}
        <div className="flex-1 p-5">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-playfair text-xl text-white group-hover:text-pink-400 transition-colors">
                  {reader.displayName}
                </h3>
                {reader.isVerified && (
                  <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                <span className="flex items-center gap-1">
                  <span className="text-yellow-400">★</span>
                  {reader.rating} ({reader.reviewCount} reviews)
                </span>
                <span>•</span>
                <span>{reader.yearsExperience} years exp.</span>
                <span>•</span>
                <span>{reader.totalReadings.toLocaleString()} readings</span>
              </div>
            </div>
          </div>

          {/* Specialties */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {reader.specialties.map((specialty, index) => (
              <span 
                key={index}
                className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full"
              >
                {specialty}
              </span>
            ))}
          </div>

          {/* Bio */}
          <p className="text-gray-400 text-sm mb-4 line-clamp-2">{reader.bio}</p>

          {/* Languages & Response time */}
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            <span>🌐 {reader.languages.join(', ')}</span>
            <span>⏱️ {reader.responseTime}</span>
          </div>

          {/* Pricing & Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-pink-400 font-semibold">${reader.ratePerMinute}</div>
                <div className="text-xs text-gray-500">Chat/min</div>
              </div>
              <div className="text-center">
                <div className="text-pink-400 font-semibold">${reader.ratePerMinuteVoice}</div>
                <div className="text-xs text-gray-500">Voice/min</div>
              </div>
              <div className="text-center">
                <div className="text-pink-400 font-semibold">${reader.ratePerMinuteVideo}</div>
                <div className="text-xs text-gray-500">Video/min</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/readings/${reader.id}`}
                className="px-4 py-2 text-pink-400 border border-pink-400 rounded-full hover:bg-pink-400/10 transition-colors text-sm font-semibold"
              >
                View Profile
              </Link>
              {reader.status === 'online' && (
                <Link
                  href={`/readings/${reader.id}?action=start`}
                  className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full hover:from-pink-600 hover:to-purple-700 transition-colors text-sm font-semibold"
                >
                  Start Reading
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SearchBar = ({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (value: string) => void;
}) => {
  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search readers by name or specialty..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-full px-5 py-3 pl-12 focus:ring-pink-500 focus:border-pink-500 placeholder-gray-500"
      />
      <svg 
        className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500"
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
  );
};

const SortDropdown = ({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (value: string) => void;
}) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-gray-800/50 border border-gray-700 text-white rounded-full px-4 py-3 focus:ring-pink-500 focus:border-pink-500"
    >
      {sortOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

const Pagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange 
}: { 
  currentPage: number; 
  totalPages: number; 
  onPageChange: (page: number) => void;
}) => {
  const pages = [];
  const maxVisiblePages = 5;
  
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {startPage > 1 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            className="w-10 h-10 rounded-lg bg-gray-800 text-white hover:bg-gray-700"
          >
            1
          </button>
          {startPage > 2 && <span className="text-gray-500">...</span>}
        </>
      )}

      {pages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`w-10 h-10 rounded-lg ${
            page === currentPage
              ? 'bg-pink-500 text-white'
              : 'bg-gray-800 text-white hover:bg-gray-700'
          }`}
        >
          {page}
        </button>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="text-gray-500">...</span>}
          <button
            onClick={() => onPageChange(totalPages)}
            className="w-10 h-10 rounded-lg bg-gray-800 text-white hover:bg-gray-700"
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
};

// Main Page Component
export default function ReadingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [readers, setReaders] = useState<Reader[]>(mockReaders);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const readersPerPage = 10;

  const [filters, setFilters] = useState<FilterState>({
    category: searchParams.get('category') || '',
    specialty: searchParams.get('specialty') || '',
    status: searchParams.get('status') || 'all',
    priceRange: [0, 0],
    minRating: 0,
    sortBy: 'recommended',
    search: searchParams.get('search') || ''
  });

  // Filter and sort readers
  const filteredReaders = useMemo(() => {
    let result = [...readers];

    // Filter by status
    if (filters.status === 'online') {
      result = result.filter(r => r.status === 'online');
    }

    // Filter by specialty
    if (filters.specialty) {
      result = result.filter(r => 
        r.specialties.some(s => s.toLowerCase().includes(filters.specialty.toLowerCase()))
      );
    }

    // Filter by price range
    if (filters.priceRange[0] > 0) {
      result = result.filter(r => r.ratePerMinute >= filters.priceRange[0]);
    }
    if (filters.priceRange[1] > 0) {
      result = result.filter(r => r.ratePerMinute <= filters.priceRange[1]);
    }

    // Filter by rating
    if (filters.minRating > 0) {
      result = result.filter(r => r.rating >= filters.minRating);
    }

    // Filter by search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(r => 
        r.displayName.toLowerCase().includes(searchLower) ||
        r.specialties.some(s => s.toLowerCase().includes(searchLower)) ||
        r.bio.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    switch (filters.sortBy) {
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'reviews':
        result.sort((a, b) => b.reviewCount - a.reviewCount);
        break;
      case 'price-low':
        result.sort((a, b) => a.ratePerMinute - b.ratePerMinute);
        break;
      case 'price-high':
        result.sort((a, b) => b.ratePerMinute - a.ratePerMinute);
        break;
      case 'experience':
        result.sort((a, b) => b.yearsExperience - a.yearsExperience);
        break;
      case 'readings':
        result.sort((a, b) => b.totalReadings - a.totalReadings);
        break;
      default:
        // Recommended: featured first, then by rating
        result.sort((a, b) => {
          if (a.isFeatured && !b.isFeatured) return -1;
          if (!a.isFeatured && b.isFeatured) return 1;
          if (a.status === 'online' && b.status !== 'online') return -1;
          if (a.status !== 'online' && b.status === 'online') return 1;
          return b.rating - a.rating;
        });
    }

    return result;
  }, [readers, filters]);

  // Paginate
  const paginatedReaders = useMemo(() => {
    const start = (currentPage - 1) * readersPerPage;
    return filteredReaders.slice(start, start + readersPerPage);
  }, [filteredReaders, currentPage]);

  // Update total pages when filtered results change
  useEffect(() => {
    setTotalPages(Math.ceil(filteredReaders.length / readersPerPage));
    setCurrentPage(1);
  }, [filteredReaders.length]);

  // Counts
  const onlineCount = readers.filter(r => r.status === 'online').length;
  const totalCount = readers.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#1a1a2e] to-[#0a0a0f] text-white">
      <Header />
      
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Page header */}
          <div className="text-center mb-12">
            <h1 className="font-alex-brush text-5xl md:text-6xl text-pink-400 mb-4">
              Find Your Reader
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Connect with gifted psychics for guidance, clarity, and spiritual insight
            </p>
          </div>

          {/* Search and sort bar */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="flex-1">
              <SearchBar 
                value={filters.search} 
                onChange={(value) => setFilters({ ...filters, search: value })}
              />
            </div>
            <SortDropdown 
              value={filters.sortBy}
              onChange={(value) => setFilters({ ...filters, sortBy: value })}
            />
          </div>

          {/* Main content */}
          <div className="flex gap-8">
            {/* Sidebar */}
            <FilterSidebar 
              filters={filters}
              setFilters={setFilters}
              onlineCount={onlineCount}
              totalCount={totalCount}
            />

            {/* Reader list */}
            <div className="flex-1">
              {/* Results count */}
              <div className="flex items-center justify-between mb-6">
                <p className="text-gray-400">
                  Showing {paginatedReaders.length} of {filteredReaders.length} readers
                </p>
                {filters.status === 'online' && (
                  <span className="flex items-center gap-2 text-green-400 text-sm">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    {onlineCount} readers online
                  </span>
                )}
              </div>

              {/* Reader cards */}
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-gray-800/50 rounded-2xl h-48 animate-pulse" />
                  ))}
                </div>
              ) : paginatedReaders.length > 0 ? (
                <div className="space-y-4">
                  {paginatedReaders.map((reader) => (
                    <ReaderCard key={reader.id} reader={reader} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">🔮</div>
                  <h3 className="text-xl text-white mb-2">No readers found</h3>
                  <p className="text-gray-400 mb-6">Try adjusting your filters or search terms</p>
                  <button
                    onClick={() => setFilters({
                      category: '',
                      specialty: '',
                      status: 'all',
                      priceRange: [0, 0],
                      minRating: 0,
                      sortBy: 'recommended',
                      search: ''
                    })}
                    className="text-pink-400 hover:text-pink-300 font-semibold"
                  >
                    Clear all filters
                  </button>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}