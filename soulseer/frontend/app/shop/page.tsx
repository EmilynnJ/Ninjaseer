'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';

interface Product {
  id: string;
  name: string;
  description: string;
  product_type: string;
  price: number;
  images: string[];
  reader: {
    display_name: string;
  };
  is_active: boolean;
}

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'service' | 'digital' | 'physical'>('all');

  useEffect(() => {
    fetchProducts();
  }, [filter]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/shop/products?type=${filter === 'all' ? '' : filter}&limit=50`
      );

      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProductIcon = (type: string) => {
    switch (type) {
      case 'service': return '🔮';
      case 'digital': return '📱';
      case 'physical': return '📦';
      default: return '🛍️';
    }
  };

  return (
    <div className="min-h-screen">
      <Header />

      {/* Page Header */}
      <section className="container mx-auto px-4 py-12 text-center">
        <h1 className="font-playfair text-5xl text-white mb-4">
          Mystical Marketplace
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Discover spiritual products, services, and exclusive offerings
        </p>

        {/* Filters */}
        <div className="flex justify-center gap-4 mb-8 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-6 py-3 rounded-full transition ${
              filter === 'all'
                ? 'bg-mystical-pink text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            All Products
          </button>
          <button
            onClick={() => setFilter('service')}
            className={`px-6 py-3 rounded-full transition ${
              filter === 'service'
                ? 'bg-mystical-pink text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            🔮 Services
          </button>
          <button
            onClick={() => setFilter('digital')}
            className={`px-6 py-3 rounded-full transition ${
              filter === 'digital'
                ? 'bg-mystical-pink text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            📱 Digital
          </button>
          <button
            onClick={() => setFilter('physical')}
            className={`px-6 py-3 rounded-full transition ${
              filter === 'physical'
                ? 'bg-mystical-pink text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            📦 Physical
          </button>
        </div>
      </section>

      {/* Products Grid */}
      <section className="container mx-auto px-4 pb-20">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="spinner w-16 h-16"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🛍️</div>
            <p className="text-2xl text-gray-400 mb-4">No products available</p>
            <p className="text-gray-500">Check back soon for new items</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="mystical-card overflow-hidden mystical-glow-hover cursor-pointer"
              >
                {/* Product Image */}
                <div className="relative h-64 bg-gradient-to-br from-mystical-purple/30 to-mystical-pink/30 flex items-center justify-center">
                  {product.images && product.images.length > 0 ? (
                    <img 
                      src={product.images[0]} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-6xl">
                      {getProductIcon(product.product_type)}
                    </div>
                  )}
                  <div className="absolute top-4 left-4 bg-mystical-gold text-black px-3 py-1 rounded-full text-xs font-bold">
                    {product.product_type.toUpperCase()}
                  </div>
                </div>

                {/* Product Info */}
                <div className="p-4">
                  <h3 className="font-playfair text-xl text-white mb-2">
                    {product.name}
                  </h3>

                  <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                    {product.description}
                  </p>

                  {product.reader && (
                    <p className="text-mystical-pink text-sm mb-3">
                      by {product.reader.display_name}
                    </p>
                  )}

                  <div className="flex justify-between items-center">
                    <div className="text-2xl font-bold text-mystical-gold">
                      ${product.price.toFixed(2)}
                    </div>
                    <button className="btn-mystical text-sm px-6 py-2">
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Featured Categories */}
      <section className="container mx-auto px-4 pb-20">
        <h2 className="font-playfair text-3xl text-center mb-12 gradient-text">
          Shop by Category
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="mystical-card p-8 text-center mystical-glow-hover cursor-pointer">
            <div className="text-6xl mb-4">🔮</div>
            <h3 className="font-playfair text-2xl text-white mb-3">
              Spiritual Services
            </h3>
            <p className="text-gray-400 mb-4">
              Private readings, custom rituals, and personalized guidance
            </p>
            <button className="btn-mystical">Explore Services</button>
          </div>

          <div className="mystical-card p-8 text-center mystical-glow-hover cursor-pointer">
            <div className="text-6xl mb-4">📱</div>
            <h3 className="font-playfair text-2xl text-white mb-3">
              Digital Products
            </h3>
            <p className="text-gray-400 mb-4">
              Guides, meditations, courses, and downloadable content
            </p>
            <button className="btn-mystical">Browse Digital</button>
          </div>

          <div className="mystical-card p-8 text-center mystical-glow-hover cursor-pointer">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="font-playfair text-2xl text-white mb-3">
              Physical Items
            </h3>
            <p className="text-gray-400 mb-4">
              Crystals, tarot decks, candles, and spiritual tools
            </p>
            <button className="btn-mystical">Shop Physical</button>
          </div>
        </div>
      </section>
    </div>
  );
}