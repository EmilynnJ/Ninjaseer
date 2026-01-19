'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@clerk/nextjs';
import Header from './components/Header';

// Types
interface Reader {
  id: string;
  displayName: string;
  profileImageUrl: string;
  specialties: string[];
  rating: number;
  reviewCount: number;
  ratePerMinute: number;
  status: 'online' | 'offline' | 'busy';
  bio: string;
  yearsExperience: number;
  totalReadings: number;
  isFeatured: boolean;
}

interface LiveStream {
  id: string;
  title: string;
  thumbnailUrl: string;
  viewerCount: number;
  reader: {
    id: string;
    displayName: string;
    profileImageUrl: string;
  };
  category: string;
  startedAt: string;
}

interface Testimonial {
  id: string;
  content: string;
  rating: number;
  author: {
    name: string;
    imageUrl: string;
  };
  readerName: string;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  readerCount: number;
}

// Mock data for demonstration
const mockFeaturedReaders: Reader[] = [
  {
    id: '1',
    displayName: 'Mystic Aurora',
    profileImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    specialties: ['Tarot', 'Love & Relationships', 'Career'],
    rating: 4.9,
    reviewCount: 1247,
    ratePerMinute: 5.99,
    status: 'online',
    bio: 'Gifted psychic with 15 years of experience helping souls find their path.',
    yearsExperience: 15,
    totalReadings: 8500,
    isFeatured: true
  },
  {
    id: '2',
    displayName: 'Celestial Rose',
    profileImageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
    specialties: ['Mediumship', 'Spirit Guides', 'Past Lives'],
    rating: 4.8,
    reviewCount: 892,
    ratePerMinute: 7.99,
    status: 'online',
    bio: 'Connecting you with loved ones who have passed and your spirit guides.',
    yearsExperience: 12,
    totalReadings: 6200,
    isFeatured: true
  },
  {
    id: '3',
    displayName: 'Luna Starweaver',
    profileImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    specialties: ['Astrology', 'Numerology', 'Life Path'],
    rating: 4.9,
    reviewCount: 1563,
    ratePerMinute: 6.99,
    status: 'busy',
    bio: 'Expert astrologer revealing the cosmic blueprint of your destiny.',
    yearsExperience: 20,
    totalReadings: 12000,
    isFeatured: true
  },
  {
    id: '4',
    displayName: 'Phoenix Heart',
    profileImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    specialties: ['Energy Healing', 'Chakra', 'Aura Reading'],
    rating: 4.7,
    reviewCount: 654,
    ratePerMinute: 4.99,
    status: 'online',
    bio: 'Healing energy worker specializing in chakra alignment and aura cleansing.',
    yearsExperience: 8,
    totalReadings: 3800,
    isFeatured: true
  }
];

const mockLiveStreams: LiveStream[] = [
  {
    id: '1',
    title: 'Full Moon Tarot Readings 🌕',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600',
    viewerCount: 234,
    reader: {
      id: '1',
      displayName: 'Mystic Aurora',
      profileImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100'
    },
    category: 'Tarot',
    startedAt: new Date(Date.now() - 45 * 60000).toISOString()
  },
  {
    id: '2',
    title: 'Connecting with Spirit Guides',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=600',
    viewerCount: 156,
    reader: {
      id: '2',
      displayName: 'Celestial Rose',
      profileImageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100'
    },
    category: 'Mediumship',
    startedAt: new Date(Date.now() - 30 * 60000).toISOString()
  }
];

const mockTestimonials: Testimonial[] = [
  {
    id: '1',
    content: 'Mystic Aurora gave me the clarity I desperately needed about my relationship. Her insights were incredibly accurate and helped me make a life-changing decision. Forever grateful!',
    rating: 5,
    author: { name: 'Sarah M.', imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
    readerName: 'Mystic Aurora',
    createdAt: '2024-01-15'
  },
  {
    id: '2',
    content: 'The connection Celestial Rose made with my grandmother brought me so much peace. She knew things only my grandmother would know. This experience changed my life.',
    rating: 5,
    author: { name: 'Michael R.', imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' },
    readerName: 'Celestial Rose',
    createdAt: '2024-01-10'
  },
  {
    id: '3',
    content: 'Luna\'s astrology reading was mind-blowing. She predicted events that happened exactly as she said. I now consult her before making any major decisions.',
    rating: 5,
    author: { name: 'Jennifer L.', imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' },
    readerName: 'Luna Starweaver',
    createdAt: '2024-01-05'
  }
];

const categories: Category[] = [
  { id: '1', name: 'Tarot Reading', icon: '🃏', description: 'Discover insights through the ancient art of tarot', readerCount: 45 },
  { id: '2', name: 'Astrology', icon: '⭐', description: 'Explore your cosmic blueprint and destiny', readerCount: 32 },
  { id: '3', name: 'Mediumship', icon: '👻', description: 'Connect with loved ones who have passed', readerCount: 28 },
  { id: '4', name: 'Love & Relationships', icon: '💕', description: 'Find clarity in matters of the heart', readerCount: 56 },
  { id: '5', name: 'Career & Finance', icon: '💼', description: 'Navigate your professional path', readerCount: 38 },
  { id: '6', name: 'Energy Healing', icon: '✨', description: 'Balance your chakras and aura', readerCount: 24 },
  { id: '7', name: 'Dream Analysis', icon: '🌙', description: 'Unlock the messages in your dreams', readerCount: 18 },
  { id: '8', name: 'Past Lives', icon: '🔮', description: 'Explore your soul\'s journey through time', readerCount: 15 }
];

// Components
const HeroSection = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    {
      title: 'Discover Your Spiritual Path',
      subtitle: 'Connect with gifted psychics for guidance, clarity, and healing',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920'
    },
    {
      title: 'Live Psychic Readings',
      subtitle: 'Video, voice, and chat readings available 24/7',
      image: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1920'
    },
    {
      title: 'Join Our Spiritual Community',
      subtitle: 'Connect with like-minded souls on their journey',
      image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920'
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <section className="relative h-[80vh] min-h-[600px] overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/50 via-black/70 to-black z-10" />
      <div 
        className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
        style={{ 
          backgroundImage: `url(${slides[currentSlide].image})`,
          filter: 'blur(2px)'
        }}
      />
      
      {/* Animated stars */}
      <div className="absolute inset-0 z-10">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              opacity: Math.random() * 0.7 + 0.3
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-20 h-full flex flex-col items-center justify-center text-center px-4">
        <h1 className="font-alex-brush text-6xl md:text-8xl text-pink-400 mb-4 animate-fade-in">
          SoulSeer
        </h1>
        <h2 className="font-playfair text-3xl md:text-5xl text-white mb-6 max-w-4xl">
          {slides[currentSlide].title}
        </h2>
        <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-2xl">
          {slides[currentSlide].subtitle}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <Link 
            href="/readings"
            className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-full hover:from-pink-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg shadow-pink-500/30"
          >
            Find Your Reader
          </Link>
          <Link 
            href="/live"
            className="px-8 py-4 bg-transparent border-2 border-pink-400 text-pink-400 font-semibold rounded-full hover:bg-pink-400/10 transition-all"
          >
            Watch Live Streams
          </Link>
        </div>

        {/* Slide indicators */}
        <div className="absolute bottom-8 flex gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentSlide ? 'bg-pink-400 w-8' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const StatsSection = () => {
  const stats = [
    { value: '50,000+', label: 'Happy Clients', icon: '😊' },
    { value: '200+', label: 'Gifted Readers', icon: '🔮' },
    { value: '4.9', label: 'Average Rating', icon: '⭐' },
    { value: '24/7', label: 'Available', icon: '🌙' }
  ];

  return (
    <section className="py-16 bg-gradient-to-r from-purple-900/30 to-pink-900/30">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl mb-2">{stat.icon}</div>
              <div className="text-3xl md:text-4xl font-bold text-pink-400 mb-1">
                {stat.value}
              </div>
              <div className="text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const FeaturedReadersSection = ({ readers }: { readers: Reader[] }) => {
  return (
    <section className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-alex-brush text-5xl text-pink-400 mb-4">Featured Readers</h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Connect with our most sought-after psychics, hand-picked for their exceptional gifts and proven accuracy
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {readers.map((reader) => (
            <ReaderCard key={reader.id} reader={reader} />
          ))}
        </div>

        <div className="text-center mt-10">
          <Link 
            href="/readings"
            className="inline-flex items-center gap-2 text-pink-400 hover:text-pink-300 font-semibold text-lg"
          >
            View All Readers
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
};

const ReaderCard = ({ reader }: { reader: Reader }) => {
  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-500',
    busy: 'bg-yellow-500'
  };

  return (
    <Link href={`/readings/${reader.id}`}>
      <div className="bg-gradient-to-b from-purple-900/40 to-black/40 rounded-2xl overflow-hidden border border-purple-500/20 hover:border-pink-500/50 transition-all hover:transform hover:scale-105 hover:shadow-xl hover:shadow-pink-500/20">
        <div className="relative">
          <div className="aspect-square relative">
            <Image
              src={reader.profileImageUrl}
              alt={reader.displayName}
              fill
              className="object-cover"
            />
          </div>
          <div className={`absolute top-3 right-3 ${statusColors[reader.status]} w-4 h-4 rounded-full border-2 border-white`} />
          {reader.isFeatured && (
            <div className="absolute top-3 left-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs px-2 py-1 rounded-full">
              ⭐ Featured
            </div>
          )}
        </div>
        
        <div className="p-5">
          <h3 className="font-playfair text-xl text-white mb-1">{reader.displayName}</h3>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-yellow-400">★</span>
            <span className="text-white">{reader.rating}</span>
            <span className="text-gray-500">({reader.reviewCount} reviews)</span>
          </div>
          
          <div className="flex flex-wrap gap-1 mb-3">
            {reader.specialties.slice(0, 3).map((specialty, index) => (
              <span 
                key={index}
                className="text-xs bg-purple-500/30 text-purple-300 px-2 py-1 rounded-full"
              >
                {specialty}
              </span>
            ))}
          </div>
          
          <p className="text-gray-400 text-sm mb-4 line-clamp-2">{reader.bio}</p>
          
          <div className="flex items-center justify-between">
            <span className="text-pink-400 font-semibold">${reader.ratePerMinute}/min</span>
            <span className={`text-sm capitalize ${
              reader.status === 'online' ? 'text-green-400' : 
              reader.status === 'busy' ? 'text-yellow-400' : 'text-gray-400'
            }`}>
              {reader.status}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

const CategoriesSection = () => {
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-transparent to-purple-900/20">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-alex-brush text-5xl text-pink-400 mb-4">Explore Readings</h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Find the perfect reading type for your spiritual journey
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((category) => (
            <Link 
              key={category.id}
              href={`/readings?category=${category.name.toLowerCase().replace(/ /g, '-')}`}
              className="group bg-gradient-to-br from-purple-900/40 to-black/40 rounded-xl p-6 border border-purple-500/20 hover:border-pink-500/50 transition-all hover:transform hover:scale-105"
            >
              <div className="text-4xl mb-3">{category.icon}</div>
              <h3 className="font-playfair text-lg text-white mb-1 group-hover:text-pink-400 transition-colors">
                {category.name}
              </h3>
              <p className="text-gray-500 text-sm mb-2">{category.description}</p>
              <span className="text-pink-400 text-sm">{category.readerCount} readers</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

const LiveStreamsSection = ({ streams }: { streams: LiveStream[] }) => {
  if (streams.length === 0) return null;

  return (
    <section className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-alex-brush text-5xl text-pink-400 mb-2">Live Now</h2>
            <p className="text-gray-400">Watch free spiritual content from our readers</p>
          </div>
          <Link 
            href="/live"
            className="text-pink-400 hover:text-pink-300 font-semibold flex items-center gap-2"
          >
            View All
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {streams.map((stream) => (
            <Link key={stream.id} href={`/live/${stream.id}`}>
              <div className="relative group rounded-2xl overflow-hidden border border-purple-500/20 hover:border-pink-500/50 transition-all">
                <div className="aspect-video relative">
                  <Image
                    src={stream.thumbnailUrl}
                    alt={stream.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  
                  {/* Live badge */}
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    LIVE
                  </div>
                  
                  {/* Viewer count */}
                  <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                    {stream.viewerCount}
                  </div>
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="flex items-center gap-3">
                    <Image
                      src={stream.reader.profileImageUrl}
                      alt={stream.reader.displayName}
                      width={40}
                      height={40}
                      className="rounded-full border-2 border-pink-500"
                    />
                    <div>
                      <h3 className="text-white font-semibold">{stream.title}</h3>
                      <p className="text-gray-400 text-sm">{stream.reader.displayName}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

const TestimonialsSection = ({ testimonials }: { testimonials: Testimonial[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [testimonials.length]);

  return (
    <section className="py-20 px-4 bg-gradient-to-b from-purple-900/20 to-transparent">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="font-alex-brush text-5xl text-pink-400 mb-12">What Our Clients Say</h2>
        
        <div className="relative">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.id}
              className={`transition-all duration-500 ${
                index === currentIndex ? 'opacity-100' : 'opacity-0 absolute inset-0'
              }`}
            >
              <div className="bg-gradient-to-br from-purple-900/40 to-black/40 rounded-2xl p-8 border border-purple-500/20">
                <div className="flex justify-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <span key={i} className="text-yellow-400 text-2xl">★</span>
                  ))}
                </div>
                
                <p className="text-xl text-gray-300 italic mb-6">"{testimonial.content}"</p>
                
                <div className="flex items-center justify-center gap-4">
                  <Image
                    src={testimonial.author.imageUrl}
                    alt={testimonial.author.name}
                    width={50}
                    height={50}
                    className="rounded-full"
                  />
                  <div className="text-left">
                    <p className="text-white font-semibold">{testimonial.author.name}</p>
                    <p className="text-pink-400 text-sm">Reading with {testimonial.readerName}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-2 mt-6">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentIndex ? 'bg-pink-400' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const HowItWorksSection = () => {
  const steps = [
    {
      number: '01',
      title: 'Choose Your Reader',
      description: 'Browse our verified psychics, read reviews, and find the perfect match for your needs.',
      icon: '🔍'
    },
    {
      number: '02',
      title: 'Select Reading Type',
      description: 'Choose between chat, voice, or video readings based on your comfort level.',
      icon: '💬'
    },
    {
      number: '03',
      title: 'Add Funds',
      description: 'Securely add funds to your account. Pay only for the time you use.',
      icon: '💳'
    },
    {
      number: '04',
      title: 'Get Your Reading',
      description: 'Connect instantly or schedule for later. Receive guidance and clarity.',
      icon: '✨'
    }
  ];

  return (
    <section className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-alex-brush text-5xl text-pink-400 mb-4">How It Works</h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Getting a reading is simple and secure
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-pink-500 to-transparent" />
              )}
              
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center text-4xl">
                  {step.icon}
                </div>
                <div className="text-pink-400 font-bold text-sm mb-2">{step.number}</div>
                <h3 className="font-playfair text-xl text-white mb-3">{step.title}</h3>
                <p className="text-gray-400">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const CTASection = () => {
  return (
    <section className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-pink-600/30 to-purple-600/30 rounded-3xl p-12 text-center border border-pink-500/30 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl" />
          
          <div className="relative z-10">
            <h2 className="font-alex-brush text-5xl text-pink-400 mb-4">
              Ready to Begin Your Journey?
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Join thousands of seekers who have found clarity, guidance, and peace through SoulSeer
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/sign-up"
                className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-full hover:from-pink-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg shadow-pink-500/30"
              >
                Create Free Account
              </Link>
              <Link 
                href="/readings"
                className="px-8 py-4 bg-white/10 text-white font-semibold rounded-full hover:bg-white/20 transition-all border border-white/30"
              >
                Browse Readers
              </Link>
            </div>
            
            <p className="text-gray-500 text-sm mt-6">
              New users get $5 free credit • No subscription required
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  const footerLinks = {
    'Readings': [
      { name: 'Find a Reader', href: '/readings' },
      { name: 'Tarot Readings', href: '/readings?category=tarot' },
      { name: 'Astrology', href: '/readings?category=astrology' },
      { name: 'Mediumship', href: '/readings?category=mediumship' },
      { name: 'Love Readings', href: '/readings?category=love' }
    ],
    'Community': [
      { name: 'Live Streams', href: '/live' },
      { name: 'Forum', href: '/community' },
      { name: 'Shop', href: '/shop' },
      { name: 'Blog', href: '/blog' }
    ],
    'Become a Reader': [
      { name: 'Apply Now', href: '/apply' },
      { name: 'Reader Guidelines', href: '/reader-guidelines' },
      { name: 'Success Stories', href: '/reader-stories' }
    ],
    'Support': [
      { name: 'Help Center', href: '/help' },
      { name: 'Contact Us', href: '/contact' },
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' }
    ]
  };

  return (
    <footer className="bg-black/50 border-t border-purple-500/20 pt-16 pb-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <h3 className="font-alex-brush text-4xl text-pink-400 mb-4">SoulSeer</h3>
            <p className="text-gray-400 text-sm mb-4">
              Connecting souls with gifted psychics for guidance, clarity, and spiritual growth.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-gray-400 hover:text-pink-400 transition-colors">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-pink-400 transition-colors">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-pink-400 transition-colors">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                </svg>
              </a>
            </div>
          </div>
          
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-white font-semibold mb-4">{category}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.name}>
                    <Link href={link.href} className="text-gray-400 hover:text-pink-400 transition-colors text-sm">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        <div className="border-t border-purple-500/20 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} SoulSeer. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Image src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Stripe_Logo%2C_revised_2016.svg/512px-Stripe_Logo%2C_revised_2016.svg.png" alt="Stripe" width={60} height={25} className="opacity-50" />
            <span className="text-gray-500 text-sm">Secure payments</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Main Page Component
export default function HomePage() {
  const { isSignedIn } = useAuth();
  const [featuredReaders, setFeaturedReaders] = useState<Reader[]>(mockFeaturedReaders);
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>(mockLiveStreams);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(mockTestimonials);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    const fetchData = async () => {
      try {
        // In production, fetch from API
        // const [readersRes, streamsRes] = await Promise.all([
        //   fetch('/api/readers/featured'),
        //   fetch('/api/streams/live')
        // ]);
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#1a1a2e] to-[#0a0a0f] text-white">
      <Header />
      
      <main>
        <HeroSection />
        <StatsSection />
        <FeaturedReadersSection readers={featuredReaders} />
        <CategoriesSection />
        <LiveStreamsSection streams={liveStreams} />
        <HowItWorksSection />
        <TestimonialsSection testimonials={testimonials} />
        <CTASection />
      </main>
      
      <Footer />
    </div>
  );
}