'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import Header from '../components/Header';

// Types
interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  thumbnailUrl: string;
  category: string;
  type: 'physical' | 'digital' | 'service';
  rating: number;
  reviewCount: number;
  inStock: boolean;
  quantity: number;
  tags: string[];
  seller?: {
    id: string;
    name: string;
    imageUrl: string;
    isVerified: boolean;
  };
  isFeatured: boolean;
  isNew: boolean;
  isBestSeller: boolean;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  productCount: number;
  description: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

// Mock data
const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Mystic Moon Tarot Deck',
    slug: 'mystic-moon-tarot-deck',
    description: 'A beautifully illustrated 78-card tarot deck featuring celestial imagery and gold foil accents. Perfect for both beginners and experienced readers.',
    shortDescription: 'Beautiful 78-card tarot deck with celestial imagery',
    price: 45.99,
    compareAtPrice: 59.99,
    images: [
      'https://images.unsplash.com/photo-1601158935942-52255782d322?w=800',
      'https://images.unsplash.com/photo-1601158935942-52255782d322?w=800'
    ],
    thumbnailUrl: 'https://images.unsplash.com/photo-1601158935942-52255782d322?w=400',
    category: 'Tarot Decks',
    type: 'physical',
    rating: 4.9,
    reviewCount: 234,
    inStock: true,
    quantity: 50,
    tags: ['tarot', 'divination', 'celestial', 'gold foil'],
    seller: {
      id: '1',
      name: 'Mystic Aurora',
      imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
      isVerified: true
    },
    isFeatured: true,
    isNew: false,
    isBestSeller: true
  },
  {
    id: '2',
    name: 'Amethyst Crystal Cluster',
    slug: 'amethyst-crystal-cluster',
    description: 'Natural amethyst crystal cluster from Brazil. Known for its calming and protective properties. Each piece is unique.',
    shortDescription: 'Natural Brazilian amethyst for spiritual protection',
    price: 34.99,
    images: [
      'https://images.unsplash.com/photo-1615486511484-92e172cc4fe0?w=800'
    ],
    thumbnailUrl: 'https://images.unsplash.com/photo-1615486511484-92e172cc4fe0?w=400',
    category: 'Crystals',
    type: 'physical',
    rating: 4.8,
    reviewCount: 156,
    inStock: true,
    quantity: 25,
    tags: ['crystal', 'amethyst', 'healing', 'protection'],
    isFeatured: true,
    isNew: false,
    isBestSeller: true
  },
  {
    id: '3',
    name: 'Spiritual Awakening Guide (eBook)',
    slug: 'spiritual-awakening-guide-ebook',
    description: 'A comprehensive digital guide to spiritual awakening. Includes meditation techniques, chakra work, and exercises for developing your intuition.',
    shortDescription: 'Digital guide to spiritual awakening and intuition',
    price: 19.99,
    images: [
      'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800'
    ],
    thumbnailUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400',
    category: 'Digital Guides',
    type: 'digital',
    rating: 4.7,
    reviewCount: 89,
    inStock: true,
    quantity: 999,
    tags: ['ebook', 'spiritual', 'meditation', 'chakra'],
    seller: {
      id: '3',
      name: 'Luna Starweaver',
      imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      isVerified: true
    },
    isFeatured: false,
    isNew: true,
    isBestSeller: false
  },
  {
    id: '4',
    name: 'Sacred Sage Smudge Kit',
    slug: 'sacred-sage-smudge-kit',
    description: 'Complete smudging kit with white sage bundle, palo santo sticks, abalone shell, and feather. Perfect for energy cleansing rituals.',
    shortDescription: 'Complete kit for energy cleansing rituals',
    price: 28.99,
    images: [
      'https://images.unsplash.com/photo-1602524816037-a8c597f1de6c?w=800'
    ],
    thumbnailUrl: 'https://images.unsplash.com/photo-1602524816037-a8c597f1de6c?w=400',
    category: 'Altar Supplies',
    type: 'physical',
    rating: 4.9,
    reviewCount: 312,
    inStock: true,
    quantity: 40,
    tags: ['sage', 'smudge', 'cleansing', 'ritual'],
    isFeatured: true,
    isNew: false,
    isBestSeller: true
  },
  {
    id: '5',
    name: 'Celestial Oracle Cards',
    slug: 'celestial-oracle-cards',
    description: '44-card oracle deck featuring stunning cosmic artwork. Includes guidebook with card meanings and spread suggestions.',
    shortDescription: '44-card oracle deck with cosmic artwork',
    price: 32.99,
    images: [
      'https://images.unsplash.com/photo-1601158935942-52255782d322?w=800'
    ],
    thumbnailUrl: 'https://images.unsplash.com/photo-1601158935942-52255782d322?w=400',
    category: 'Oracle Cards',
    type: 'physical',
    rating: 4.8,
    reviewCount: 178,
    inStock: true,
    quantity: 35,
    tags: ['oracle', 'cards', 'divination', 'cosmic'],
    isFeatured: false,
    isNew: true,
    isBestSeller: false
  },
  {
    id: '6',
    name: 'Rose Quartz Heart Stone',
    slug: 'rose-quartz-heart-stone',
    description: 'Polished rose quartz carved into a heart shape. The stone of unconditional love, perfect for heart chakra work.',
    shortDescription: 'Heart-shaped rose quartz for love and healing',
    price: 18.99,
    images: [
      'https://images.unsplash.com/photo-1615486511484-92e172cc4fe0?w=800'
    ],
    thumbnailUrl: 'https://images.unsplash.com/photo-1615486511484-92e172cc4fe0?w=400',
    category: 'Crystals',
    type: 'physical',
    rating: 4.9,
    reviewCount: 267,
    inStock: true,
    quantity: 60,
    tags: ['crystal', 'rose quartz', 'love', 'heart chakra'],
    isFeatured: false,
    isNew: false,
    isBestSeller: true
  },
  {
    id: '7',
    name: 'Zodiac Candle Collection',
    slug: 'zodiac-candle-collection',
    description: 'Set of 12 hand-poured soy candles, one for each zodiac sign. Each candle features a unique scent blend aligned with the sign\'s energy.',
    shortDescription: '12 zodiac-themed soy candles',
    price: 89.99,
    compareAtPrice: 119.99,
    images: [
      'https://images.unsplash.com/photo-1602607688066-d5d6aa9892c2?w=800'
    ],
    thumbnailUrl: 'https://images.unsplash.com/photo-1602607688066-d5d6aa9892c2?w=400',
    category: 'Candles',
    type: 'physical',
    rating: 4.7,
    reviewCount: 98,
    inStock: true,
    quantity: 15,
    tags: ['candles', 'zodiac', 'astrology', 'soy'],
    isFeatured: true,
    isNew: false,
    isBestSeller: false
  },
  {
    id: '8',
    name: 'Chakra Healing Bracelet',
    slug: 'chakra-healing-bracelet',
    description: 'Handmade bracelet featuring 7 genuine gemstones representing each chakra. Adjustable size fits most wrists.',
    shortDescription: '7-stone chakra bracelet for energy balance',
    price: 24.99,
    images: [
      'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800'
    ],
    thumbnailUrl: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400',
    category: 'Jewelry',
    type: 'physical',
    rating: 4.8,
    reviewCount: 445,
    inStock: true,
    quantity: 80,
    tags: ['bracelet', 'chakra', 'gemstones', 'healing'],
    isFeatured: false,
    isNew: false,
    isBestSeller: true
  }
];

const categories: Category[] = [
  { id: 'all', name: 'All Products', icon: '🛍️', productCount: 156, description: 'Browse all spiritual products' },
  { id: 'tarot-decks', name: 'Tarot Decks', icon: '🃏', productCount: 24, description: 'Traditional and modern tarot decks' },
  { id: 'oracle-cards', name: 'Oracle Cards', icon: '✨', productCount: 18, description: 'Intuitive oracle card decks' },
  { id: 'crystals', name: 'Crystals', icon: '💎', productCount: 45, description: 'Healing crystals and stones' },
  { id: 'candles', name: 'Candles', icon: '🕯️', productCount: 22, description: 'Ritual and intention candles' },
  { id: 'jewelry', name: 'Jewelry', icon: '📿', productCount: 31, description: 'Spiritual jewelry and accessories' },
  { id: 'altar-supplies', name: 'Altar Supplies', icon: '🌿', productCount: 28, description: 'Sage, incense, and ritual tools' },
  { id: 'digital-guides', name: 'Digital Guides', icon: '📚', productCount: 15, description: 'eBooks and digital courses' }
];

// Components
const ProductCard = ({ product, onAddToCart }: { product: Product; onAddToCart: (product: Product) => void }) => {
  const [isHovered, setIsHovered] = useState(false);
  const discount = product.compareAtPrice 
    ? Math.round((1 - product.price / product.compareAtPrice) * 100)
    : 0;

  return (
    <div 
      className="group bg-gray-800/30 rounded-2xl overflow-hidden border border-gray-700 hover:border-pink-500/50 transition-all duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image */}
      <Link href={`/shop/${product.slug}`} className="block relative aspect-square overflow-hidden">
        <Image
          src={product.thumbnailUrl}
          alt={product.name}
          fill
          className={`object-cover transition-transform duration-500 ${isHovered ? 'scale-110' : 'scale-100'}`}
        />
        
        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {product.isNew && (
            <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded">NEW</span>
          )}
          {product.isBestSeller && (
            <span className="px-2 py-1 bg-yellow-500 text-black text-xs font-bold rounded">BEST SELLER</span>
          )}
          {discount > 0 && (
            <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">-{discount}%</span>
          )}
        </div>
        
        {/* Quick actions */}
        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center gap-3 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <button 
            onClick={(e) => {
              e.preventDefault();
              onAddToCart(product);
            }}
            className="p-3 bg-pink-500 text-white rounded-full hover:bg-pink-600 transition-colors"
            title="Add to Cart"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>
          <button 
            className="p-3 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors"
            title="Add to Wishlist"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
          <Link 
            href={`/shop/${product.slug}`}
            className="p-3 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors"
            title="Quick View"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </Link>
        </div>
        
        {/* Out of stock overlay */}
        {!product.inStock && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="px-4 py-2 bg-gray-800 text-white font-medium rounded-full">Out of Stock</span>
          </div>
        )}
      </Link>
      
      {/* Info */}
      <div className="p-4">
        {/* Category & Type */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-pink-400 text-xs">{product.category}</span>
          {product.type === 'digital' && (
            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">Digital</span>
          )}
        </div>
        
        {/* Name */}
        <Link href={`/shop/${product.slug}`}>
          <h3 className="text-white font-medium line-clamp-2 group-hover:text-pink-400 transition-colors mb-2">
            {product.name}
          </h3>
        </Link>
        
        {/* Rating */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <svg
                key={i}
                className={`w-4 h-4 ${i < Math.floor(product.rating) ? 'text-yellow-400' : 'text-gray-600'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-gray-500 text-sm">({product.reviewCount})</span>
        </div>
        
        {/* Seller */}
        {product.seller && (
          <div className="flex items-center gap-2 mb-3">
            <Image
              src={product.seller.imageUrl}
              alt={product.seller.name}
              width={20}
              height={20}
              className="rounded-full"
            />
            <span className="text-gray-400 text-sm">{product.seller.name}</span>
            {product.seller.isVerified && (
              <svg className="w-4 h-4 text-pink-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        )}
        
        {/* Price */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white">${product.price.toFixed(2)}</span>
            {product.compareAtPrice && (
              <span className="text-gray-500 line-through text-sm">${product.compareAtPrice.toFixed(2)}</span>
            )}
          </div>
          
          <button
            onClick={() => onAddToCart(product)}
            disabled={!product.inStock}
            className={`p-2 rounded-full transition-colors ${
              product.inStock
                ? 'bg-pink-500/20 text-pink-400 hover:bg-pink-500 hover:text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

const FeaturedProduct = ({ product, onAddToCart }: { product: Product; onAddToCart: (product: Product) => void }) => {
  const discount = product.compareAtPrice 
    ? Math.round((1 - product.price / product.compareAtPrice) * 100)
    : 0;

  return (
    <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-2xl overflow-hidden border border-purple-500/30">
      <div className="grid md:grid-cols-2 gap-6 p-6">
        {/* Image */}
        <div className="relative aspect-square rounded-xl overflow-hidden">
          <Image
            src={product.thumbnailUrl}
            alt={product.name}
            fill
            className="object-cover"
          />
          {discount > 0 && (
            <div className="absolute top-4 left-4">
              <span className="px-3 py-1 bg-red-500 text-white font-bold rounded-full">
                Save {discount}%
              </span>
            </div>
          )}
        </div>
        
        {/* Info */}
        <div className="flex flex-col justify-center">
          <span className="text-pink-400 text-sm mb-2">Featured Product</span>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">{product.name}</h2>
          <p className="text-gray-300 mb-4">{product.description}</p>
          
          {/* Rating */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className={`w-5 h-5 ${i < Math.floor(product.rating) ? 'text-yellow-400' : 'text-gray-600'}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-white">{product.rating}</span>
            <span className="text-gray-500">({product.reviewCount} reviews)</span>
          </div>
          
          {/* Price */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl font-bold text-white">${product.price.toFixed(2)}</span>
            {product.compareAtPrice && (
              <span className="text-xl text-gray-500 line-through">${product.compareAtPrice.toFixed(2)}</span>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => onAddToCart(product)}
              className="flex-1 py-3 bg-pink-500 text-white font-semibold rounded-full hover:bg-pink-600 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Add to Cart
            </button>
            <Link
              href={`/shop/${product.slug}`}
              className="px-6 py-3 bg-gray-800 text-white font-semibold rounded-full hover:bg-gray-700 transition-colors"
            >
              View Details
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

const CartSidebar = ({ 
  isOpen, 
  onClose, 
  items, 
  onUpdateQuantity, 
  onRemove 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}) => {
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-gray-900 border-l border-gray-800 z-50 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="text-xl font-bold text-white">Shopping Cart ({items.length})</h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Items */}
          <div className="flex-1 overflow-y-auto p-4">
            {items.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🛒</div>
                <p className="text-gray-400">Your cart is empty</p>
                <button
                  onClick={onClose}
                  className="mt-4 px-6 py-2 bg-pink-500 text-white rounded-full hover:bg-pink-600 transition-colors"
                >
                  Continue Shopping
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.product.id} className="flex gap-4 bg-gray-800/50 rounded-xl p-3">
                    <Image
                      src={item.product.thumbnailUrl}
                      alt={item.product.name}
                      width={80}
                      height={80}
                      className="rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">{item.product.name}</h3>
                      <p className="text-pink-400">${item.product.price.toFixed(2)}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                          className="w-8 h-8 bg-gray-700 text-white rounded-full hover:bg-gray-600"
                        >
                          -
                        </button>
                        <span className="text-white w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                          className="w-8 h-8 bg-gray-700 text-white rounded-full hover:bg-gray-600"
                        >
                          +
                        </button>
                        <button
                          onClick={() => onRemove(item.product.id)}
                          className="ml-auto text-red-400 hover:text-red-300"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Footer */}
          {items.length > 0 && (
            <div className="p-4 border-t border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-400">Subtotal</span>
                <span className="text-xl font-bold text-white">${subtotal.toFixed(2)}</span>
              </div>
              <Link
                href="/checkout"
                className="block w-full py-3 bg-pink-500 text-white font-semibold rounded-full text-center hover:bg-pink-600 transition-colors"
              >
                Checkout
              </Link>
              <button
                onClick={onClose}
                className="block w-full py-3 mt-2 text-gray-400 hover:text-white transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// Main Page Component
export default function ShopPage() {
  const searchParams = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('featured');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 200]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    // Get category from URL
    const category = searchParams.get('category');
    if (category) {
      setSelectedCategory(category);
    }

    // Simulate API call
    const fetchProducts = async () => {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      setProducts(mockProducts);
      setIsLoading(false);
    };

    fetchProducts();
  }, [searchParams]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = [...products];
    
    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => 
        p.category.toLowerCase().replace(/\s+/g, '-') === selectedCategory
      );
    }
    
    // Filter by price
    filtered = filtered.filter(p => 
      p.price >= priceRange[0] && p.price <= priceRange[1]
    );
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.tags.some(t => t.toLowerCase().includes(query))
      );
    }
    
    // Sort
    switch (sortBy) {
      case 'price-low':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        filtered.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
        break;
      case 'best-selling':
        filtered.sort((a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0));
        break;
      default: // featured
        filtered.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
    }
    
    return filtered;
  }, [products, selectedCategory, priceRange, searchQuery, sortBy]);

  const featuredProduct = products.find(p => p.isFeatured);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.product.id === productId
          ? { ...item, quantity }
          : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              Spiritual Shop
            </h1>
            <p className="text-gray-400">
              Discover tools for your spiritual journey
            </p>
          </div>
          
          {/* Cart button */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-3 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          {/* Search */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-12 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-pink-500 focus:outline-none"
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:border-pink-500 focus:outline-none"
          >
            <option value="featured">Featured</option>
            <option value="newest">Newest</option>
            <option value="best-selling">Best Selling</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
          </select>
          
          {/* View mode */}
          <div className="flex items-center gap-2 bg-gray-800 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-pink-500 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-pink-500 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
          
          {/* Filter toggle (mobile) */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="lg:hidden px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
          </button>
        </div>

        <div className="flex gap-8">
          {/* Sidebar Filters */}
          <aside className={`w-64 flex-shrink-0 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            {/* Categories */}
            <div className="bg-gray-800/30 rounded-2xl border border-gray-700 p-4 mb-6">
              <h3 className="text-lg font-semibold text-white mb-4">Categories</h3>
              <div className="space-y-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-pink-500/20 text-pink-400'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{category.icon}</span>
                      <span>{category.name}</span>
                    </span>
                    <span className="text-sm">({category.productCount})</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Price Range */}
            <div className="bg-gray-800/30 rounded-2xl border border-gray-700 p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Price Range</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([parseInt(e.target.value) || 0, priceRange[1]])}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                    placeholder="Min"
                  />
                  <span className="text-gray-500">-</span>
                  <input
                    type="number"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value) || 200])}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                    placeholder="Max"
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                  className="w-full accent-pink-500"
                />
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-400">Loading products...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Featured Product */}
                {featuredProduct && selectedCategory === 'all' && !searchQuery && (
                  <section className="mb-8">
                    <FeaturedProduct product={featuredProduct} onAddToCart={addToCart} />
                  </section>
                )}

                {/* Results count */}
                <div className="flex items-center justify-between mb-6">
                  <p className="text-gray-400">
                    Showing {filteredProducts.length} products
                  </p>
                </div>

                {/* Products Grid */}
                {filteredProducts.length > 0 ? (
                  <div className={`grid gap-6 ${
                    viewMode === 'grid' 
                      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' 
                      : 'grid-cols-1'
                  }`}>
                    {filteredProducts.map((product) => (
                      <ProductCard 
                        key={product.id} 
                        product={product} 
                        onAddToCart={addToCart}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-800/30 rounded-2xl border border-gray-700">
                    <div className="text-6xl mb-4">🔍</div>
                    <h3 className="text-xl font-semibold text-white mb-2">No Products Found</h3>
                    <p className="text-gray-400 mb-4">
                      Try adjusting your filters or search terms
                    </p>
                    <button
                      onClick={() => {
                        setSelectedCategory('all');
                        setSearchQuery('');
                        setPriceRange([0, 200]);
                      }}
                      className="px-6 py-2 bg-pink-500 text-white rounded-full hover:bg-pink-600 transition-colors"
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Cart Sidebar */}
      <CartSidebar
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={updateCartQuantity}
        onRemove={removeFromCart}
      />

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              © 2024 SoulSeer. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link href="/terms" className="text-gray-500 hover:text-gray-300 text-sm">
                Terms
              </Link>
              <Link href="/privacy" className="text-gray-500 hover:text-gray-300 text-sm">
                Privacy
              </Link>
              <Link href="/help" className="text-gray-500 hover:text-gray-300 text-sm">
                Help
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}