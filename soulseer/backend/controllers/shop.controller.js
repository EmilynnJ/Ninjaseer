/**
 * Shop Controller - Enterprise Level
 * Complete e-commerce management endpoints for SoulSeer marketplace
 */

const Product = require('../models/Product');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { logger } = require('../utils/logger');

class ShopController {
  /**
   * Get all products with filters
   * GET /api/shop/products
   */
  static async getProducts(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        type,
        min_price,
        max_price,
        sort_by = 'created_at',
        sort_order = 'DESC',
        search,
        seller_id,
        is_featured
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 50),
        category: category || null,
        type: type || null,
        minPrice: min_price ? parseFloat(min_price) : null,
        maxPrice: max_price ? parseFloat(max_price) : null,
        sortBy: sort_by,
        sortOrder: sort_order,
        search: search || null,
        sellerId: seller_id || null,
        isFeatured: is_featured === 'true' ? true : null
      };

      const result = await Product.getProducts(options);

      return paginatedResponse(res, result.products, result.pagination);

    } catch (error) {
      logger.error('Error getting products', { error: error.message });
      return errorResponse(res, 'Failed to get products', 500);
    }
  }

  /**
   * Get featured products
   * GET /api/shop/products/featured
   */
  static async getFeaturedProducts(req, res) {
    try {
      const { limit = 10, category } = req.query;

      const products = await Product.getFeaturedProducts({
        limit: parseInt(limit),
        category: category || null
      });

      return successResponse(res, { products });

    } catch (error) {
      logger.error('Error getting featured products', { error: error.message });
      return errorResponse(res, 'Failed to get featured products', 500);
    }
  }

  /**
   * Get new arrivals
   * GET /api/shop/products/new
   */
  static async getNewArrivals(req, res) {
    try {
      const { limit = 10, category } = req.query;

      const products = await Product.getNewArrivals({
        limit: parseInt(limit),
        category: category || null
      });

      return successResponse(res, { products });

    } catch (error) {
      logger.error('Error getting new arrivals', { error: error.message });
      return errorResponse(res, 'Failed to get new arrivals', 500);
    }
  }

  /**
   * Get best sellers
   * GET /api/shop/products/best-sellers
   */
  static async getBestSellers(req, res) {
    try {
      const { limit = 10, category, period = '30d' } = req.query;

      const products = await Product.getBestSellers({
        limit: parseInt(limit),
        category: category || null,
        period
      });

      return successResponse(res, { products });

    } catch (error) {
      logger.error('Error getting best sellers', { error: error.message });
      return errorResponse(res, 'Failed to get best sellers', 500);
    }
  }

  /**
   * Get product categories
   * GET /api/shop/categories
   */
  static async getCategories(req, res) {
    try {
      const categories = await Product.getCategories();

      return successResponse(res, { categories });

    } catch (error) {
      logger.error('Error getting categories', { error: error.message });
      return errorResponse(res, 'Failed to get categories', 500);
    }
  }

  /**
   * Get product by ID
   * GET /api/shop/products/:productId
   */
  static async getProduct(req, res) {
    try {
      const { productId } = req.params;
      const userId = req.auth?.userId;

      const product = await Product.findById(productId);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      // Increment view count
      await Product.incrementViewCount(productId);

      // Get related products
      const relatedProducts = await Product.getRelatedProducts(productId, 4);

      // Get reviews
      const Review = require('../models/Review');
      const reviews = await Review.getByTarget('product', productId, { limit: 5 });

      // Check if user has purchased
      let hasPurchased = false;
      if (userId) {
        hasPurchased = await Product.hasUserPurchased(userId, productId);
      }

      return successResponse(res, {
        product,
        relatedProducts,
        reviews: reviews.reviews,
        hasPurchased
      });

    } catch (error) {
      logger.error('Error getting product', { error: error.message });
      return errorResponse(res, 'Failed to get product', 500);
    }
  }

  /**
   * Get product by slug
   * GET /api/shop/products/slug/:slug
   */
  static async getProductBySlug(req, res) {
    try {
      const { slug } = req.params;
      const userId = req.auth?.userId;

      const product = await Product.findBySlug(slug);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      // Increment view count
      await Product.incrementViewCount(product.id);

      // Get related products
      const relatedProducts = await Product.getRelatedProducts(product.id, 4);

      // Get reviews
      const Review = require('../models/Review');
      const reviews = await Review.getByTarget('product', product.id, { limit: 5 });

      return successResponse(res, {
        product,
        relatedProducts,
        reviews: reviews.reviews
      });

    } catch (error) {
      logger.error('Error getting product by slug', { error: error.message });
      return errorResponse(res, 'Failed to get product', 500);
    }
  }

  /**
   * Search products
   * GET /api/shop/search
   */
  static async searchProducts(req, res) {
    try {
      const {
        q,
        page = 1,
        limit = 20,
        category,
        min_price,
        max_price,
        sort_by = 'relevance'
      } = req.query;

      if (!q || q.trim().length < 2) {
        return errorResponse(res, 'Search query must be at least 2 characters', 400);
      }

      const result = await Product.search({
        query: q.trim(),
        page: parseInt(page),
        limit: parseInt(limit),
        category: category || null,
        minPrice: min_price ? parseFloat(min_price) : null,
        maxPrice: max_price ? parseFloat(max_price) : null,
        sortBy: sort_by
      });

      return paginatedResponse(res, result.products, result.pagination);

    } catch (error) {
      logger.error('Error searching products', { error: error.message });
      return errorResponse(res, 'Failed to search products', 500);
    }
  }

  // ============================================
  // CART MANAGEMENT
  // ============================================

  /**
   * Get user's cart
   * GET /api/shop/cart
   */
  static async getCart(req, res) {
    try {
      const userId = req.auth.userId;

      const cart = await Product.getCart(userId);

      return successResponse(res, { cart });

    } catch (error) {
      logger.error('Error getting cart', { error: error.message });
      return errorResponse(res, 'Failed to get cart', 500);
    }
  }

  /**
   * Add item to cart
   * POST /api/shop/cart
   */
  static async addToCart(req, res) {
    try {
      const userId = req.auth.userId;
      const { product_id, quantity = 1, variant_id } = req.body;

      if (!product_id) {
        return errorResponse(res, 'Product ID is required', 400);
      }

      // Verify product exists and is available
      const product = await Product.findById(product_id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      if (product.status !== 'active') {
        return errorResponse(res, 'Product is not available', 400);
      }

      // Check stock
      if (product.trackInventory && product.quantity < quantity) {
        return errorResponse(res, 'Insufficient stock', 400);
      }

      const cart = await Product.addToCart(userId, {
        productId: product_id,
        quantity,
        variantId: variant_id
      });

      return successResponse(res, {
        message: 'Item added to cart',
        cart
      });

    } catch (error) {
      logger.error('Error adding to cart', { error: error.message });
      return errorResponse(res, error.message || 'Failed to add to cart', 500);
    }
  }

  /**
   * Update cart item quantity
   * PUT /api/shop/cart/:itemId
   */
  static async updateCartItem(req, res) {
    try {
      const userId = req.auth.userId;
      const { itemId } = req.params;
      const { quantity } = req.body;

      if (!quantity || quantity < 1) {
        return errorResponse(res, 'Valid quantity is required', 400);
      }

      const cart = await Product.updateCartItem(userId, itemId, quantity);

      return successResponse(res, {
        message: 'Cart updated',
        cart
      });

    } catch (error) {
      logger.error('Error updating cart item', { error: error.message });
      return errorResponse(res, error.message || 'Failed to update cart', 500);
    }
  }

  /**
   * Remove item from cart
   * DELETE /api/shop/cart/:itemId
   */
  static async removeFromCart(req, res) {
    try {
      const userId = req.auth.userId;
      const { itemId } = req.params;

      const cart = await Product.removeFromCart(userId, itemId);

      return successResponse(res, {
        message: 'Item removed from cart',
        cart
      });

    } catch (error) {
      logger.error('Error removing from cart', { error: error.message });
      return errorResponse(res, 'Failed to remove from cart', 500);
    }
  }

  /**
   * Clear cart
   * DELETE /api/shop/cart
   */
  static async clearCart(req, res) {
    try {
      const userId = req.auth.userId;

      await Product.clearCart(userId);

      return successResponse(res, {
        message: 'Cart cleared'
      });

    } catch (error) {
      logger.error('Error clearing cart', { error: error.message });
      return errorResponse(res, 'Failed to clear cart', 500);
    }
  }

  // ============================================
  // WISHLIST MANAGEMENT
  // ============================================

  /**
   * Get user's wishlist
   * GET /api/shop/wishlist
   */
  static async getWishlist(req, res) {
    try {
      const userId = req.auth.userId;
      const { page = 1, limit = 20 } = req.query;

      const result = await Product.getWishlist(userId, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return paginatedResponse(res, result.items, result.pagination);

    } catch (error) {
      logger.error('Error getting wishlist', { error: error.message });
      return errorResponse(res, 'Failed to get wishlist', 500);
    }
  }

  /**
   * Add to wishlist
   * POST /api/shop/wishlist
   */
  static async addToWishlist(req, res) {
    try {
      const userId = req.auth.userId;
      const { product_id } = req.body;

      if (!product_id) {
        return errorResponse(res, 'Product ID is required', 400);
      }

      await Product.addToWishlist(userId, product_id);

      return successResponse(res, {
        message: 'Added to wishlist'
      });

    } catch (error) {
      logger.error('Error adding to wishlist', { error: error.message });
      return errorResponse(res, error.message || 'Failed to add to wishlist', 500);
    }
  }

  /**
   * Remove from wishlist
   * DELETE /api/shop/wishlist/:productId
   */
  static async removeFromWishlist(req, res) {
    try {
      const userId = req.auth.userId;
      const { productId } = req.params;

      await Product.removeFromWishlist(userId, productId);

      return successResponse(res, {
        message: 'Removed from wishlist'
      });

    } catch (error) {
      logger.error('Error removing from wishlist', { error: error.message });
      return errorResponse(res, 'Failed to remove from wishlist', 500);
    }
  }

  // ============================================
  // ORDER MANAGEMENT
  // ============================================

  /**
   * Create order (checkout)
   * POST /api/shop/orders
   */
  static async createOrder(req, res) {
    try {
      const userId = req.auth.userId;
      const {
        shipping_address,
        billing_address,
        payment_method = 'balance',
        shipping_method,
        notes,
        coupon_code
      } = req.body;

      // Get cart
      const cart = await Product.getCart(userId);
      if (!cart || cart.items.length === 0) {
        return errorResponse(res, 'Cart is empty', 400);
      }

      // Validate shipping address for physical products
      const hasPhysicalProducts = cart.items.some(item => item.product.type === 'physical');
      if (hasPhysicalProducts && !shipping_address) {
        return errorResponse(res, 'Shipping address is required for physical products', 400);
      }

      // Calculate totals
      let subtotal = cart.total;
      let discount = 0;
      let shippingCost = 0;
      let tax = 0;

      // Apply coupon if provided
      if (coupon_code) {
        const couponResult = await Product.validateCoupon(coupon_code, subtotal);
        if (couponResult.valid) {
          discount = couponResult.discount;
        }
      }

      // Calculate shipping
      if (hasPhysicalProducts && shipping_method) {
        shippingCost = await Product.calculateShipping(cart.items, shipping_address, shipping_method);
      }

      // Calculate tax
      tax = await Product.calculateTax(subtotal - discount, shipping_address);

      const total = subtotal - discount + shippingCost + tax;

      // Check balance if paying with balance
      if (payment_method === 'balance') {
        const user = await User.findById(userId);
        if (user.balance < total) {
          return errorResponse(res, 'Insufficient balance', 400);
        }
      }

      // Create order
      const order = await Product.createOrder({
        userId,
        items: cart.items,
        subtotal,
        discount,
        shippingCost,
        tax,
        total,
        shippingAddress: shipping_address,
        billingAddress: billing_address || shipping_address,
        paymentMethod: payment_method,
        shippingMethod: shipping_method,
        notes,
        couponCode: coupon_code
      });

      // Process payment
      if (payment_method === 'balance') {
        await User.deductBalance(userId, total);

        // Create transaction
        await Transaction.create({
          user_id: userId,
          order_id: order.id,
          type: Transaction.TYPES.PRODUCT_PURCHASE,
          amount: total,
          status: Transaction.STATUSES.COMPLETED,
          description: `Order #${order.orderNumber}`
        });

        // Update order status
        await Product.updateOrderStatus(order.id, 'confirmed');
      } else {
        // Create Stripe payment intent
        const stripeService = require('../services/stripe.service');
        const paymentIntent = await stripeService.createPaymentIntent(
          Math.round(total * 100),
          'usd',
          null,
          {
            order_id: order.id,
            user_id: userId,
            type: 'product_purchase'
          }
        );

        order.paymentIntentId = paymentIntent.id;
        order.clientSecret = paymentIntent.client_secret;
      }

      // Clear cart
      await Product.clearCart(userId);

      // Send confirmation notification
      await Notification.create({
        user_id: userId,
        type: Notification.TYPES.ORDER_CONFIRMED,
        title: 'Order Confirmed',
        content: `Your order #${order.orderNumber} has been confirmed`,
        target_type: 'order',
        target_id: order.id
      });

      return successResponse(res, {
        message: 'Order created successfully',
        order
      }, 201);

    } catch (error) {
      logger.error('Error creating order', { error: error.message });
      return errorResponse(res, error.message || 'Failed to create order', 500);
    }
  }

  /**
   * Get user's orders
   * GET /api/shop/orders
   */
  static async getOrders(req, res) {
    try {
      const userId = req.auth.userId;
      const {
        page = 1,
        limit = 20,
        status
      } = req.query;

      const result = await Product.getUserOrders(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        status: status || null
      });

      return paginatedResponse(res, result.orders, result.pagination);

    } catch (error) {
      logger.error('Error getting orders', { error: error.message });
      return errorResponse(res, 'Failed to get orders', 500);
    }
  }

  /**
   * Get order by ID
   * GET /api/shop/orders/:orderId
   */
  static async getOrder(req, res) {
    try {
      const userId = req.auth.userId;
      const { orderId } = req.params;

      const order = await Product.getOrderById(orderId);
      if (!order) {
        return errorResponse(res, 'Order not found', 404);
      }

      // Verify ownership
      if (order.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      return successResponse(res, { order });

    } catch (error) {
      logger.error('Error getting order', { error: error.message });
      return errorResponse(res, 'Failed to get order', 500);
    }
  }

  /**
   * Cancel order
   * POST /api/shop/orders/:orderId/cancel
   */
  static async cancelOrder(req, res) {
    try {
      const userId = req.auth.userId;
      const { orderId } = req.params;
      const { reason } = req.body;

      const order = await Product.getOrderById(orderId);
      if (!order) {
        return errorResponse(res, 'Order not found', 404);
      }

      // Verify ownership
      if (order.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      // Check if cancellable
      const cancellableStatuses = ['pending', 'confirmed', 'processing'];
      if (!cancellableStatuses.includes(order.status)) {
        return errorResponse(res, 'Order cannot be cancelled', 400);
      }

      // Cancel order
      const cancelledOrder = await Product.cancelOrder(orderId, reason);

      // Refund if paid
      if (order.paymentStatus === 'paid') {
        await User.addBalance(userId, order.total);

        await Transaction.create({
          user_id: userId,
          order_id: orderId,
          type: Transaction.TYPES.PRODUCT_REFUND,
          amount: order.total,
          status: Transaction.STATUSES.COMPLETED,
          description: `Refund for cancelled order #${order.orderNumber}`
        });
      }

      // Restore inventory
      for (const item of order.items) {
        await Product.updateStock(item.productId, item.quantity);
      }

      return successResponse(res, {
        message: 'Order cancelled successfully',
        order: cancelledOrder
      });

    } catch (error) {
      logger.error('Error cancelling order', { error: error.message });
      return errorResponse(res, error.message || 'Failed to cancel order', 500);
    }
  }

  /**
   * Track order
   * GET /api/shop/orders/:orderId/tracking
   */
  static async trackOrder(req, res) {
    try {
      const userId = req.auth.userId;
      const { orderId } = req.params;

      const order = await Product.getOrderById(orderId);
      if (!order) {
        return errorResponse(res, 'Order not found', 404);
      }

      // Verify ownership
      if (order.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      const tracking = await Product.getOrderTracking(orderId);

      return successResponse(res, {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status
        },
        tracking
      });

    } catch (error) {
      logger.error('Error tracking order', { error: error.message });
      return errorResponse(res, 'Failed to track order', 500);
    }
  }

  // ============================================
  // PRODUCT REVIEWS
  // ============================================

  /**
   * Get product reviews
   * GET /api/shop/products/:productId/reviews
   */
  static async getProductReviews(req, res) {
    try {
      const { productId } = req.params;
      const { page = 1, limit = 10, sort_by = 'created_at' } = req.query;

      const Review = require('../models/Review');
      const result = await Review.getByTarget('product', productId, {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy: sort_by
      });

      return paginatedResponse(res, result.reviews, result.pagination);

    } catch (error) {
      logger.error('Error getting product reviews', { error: error.message });
      return errorResponse(res, 'Failed to get reviews', 500);
    }
  }

  /**
   * Create product review
   * POST /api/shop/products/:productId/reviews
   */
  static async createProductReview(req, res) {
    try {
      const userId = req.auth.userId;
      const { productId } = req.params;
      const { rating, title, content, pros, cons, images } = req.body;

      // Verify user has purchased the product
      const hasPurchased = await Product.hasUserPurchased(userId, productId);
      if (!hasPurchased) {
        return errorResponse(res, 'You must purchase this product before reviewing', 400);
      }

      const Review = require('../models/Review');
      const review = await Review.create({
        reviewer_id: userId,
        type: 'product',
        target_id: productId,
        rating,
        title,
        content,
        pros: pros || [],
        cons: cons || [],
        images: images || []
      });

      return successResponse(res, {
        message: 'Review submitted successfully',
        review
      }, 201);

    } catch (error) {
      logger.error('Error creating product review', { error: error.message });
      return errorResponse(res, error.message || 'Failed to create review', 500);
    }
  }

  // ============================================
  // SELLER MANAGEMENT (for readers selling products)
  // ============================================

  /**
   * Get seller dashboard
   * GET /api/shop/seller/dashboard
   */
  static async getSellerDashboard(req, res) {
    try {
      const userId = req.auth.userId;

      // Verify user is a reader/seller
      const Reader = require('../models/Reader');
      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Not authorized as seller', 403);
      }

      const dashboard = await Product.getSellerDashboard(reader.id);

      return successResponse(res, { dashboard });

    } catch (error) {
      logger.error('Error getting seller dashboard', { error: error.message });
      return errorResponse(res, 'Failed to get dashboard', 500);
    }
  }

  /**
   * Get seller products
   * GET /api/shop/seller/products
   */
  static async getSellerProducts(req, res) {
    try {
      const userId = req.auth.userId;
      const { page = 1, limit = 20, status } = req.query;

      const Reader = require('../models/Reader');
      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Not authorized as seller', 403);
      }

      const result = await Product.getSellerProducts(reader.id, {
        page: parseInt(page),
        limit: parseInt(limit),
        status: status || null
      });

      return paginatedResponse(res, result.products, result.pagination);

    } catch (error) {
      logger.error('Error getting seller products', { error: error.message });
      return errorResponse(res, 'Failed to get products', 500);
    }
  }

  /**
   * Create seller product
   * POST /api/shop/seller/products
   */
  static async createSellerProduct(req, res) {
    try {
      const userId = req.auth.userId;

      const Reader = require('../models/Reader');
      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Not authorized as seller', 403);
      }

      const productData = {
        ...req.body,
        seller_id: reader.id
      };

      const product = await Product.create(productData);

      return successResponse(res, {
        message: 'Product created successfully',
        product
      }, 201);

    } catch (error) {
      logger.error('Error creating seller product', { error: error.message });
      return errorResponse(res, error.message || 'Failed to create product', 500);
    }
  }

  /**
   * Update seller product
   * PUT /api/shop/seller/products/:productId
   */
  static async updateSellerProduct(req, res) {
    try {
      const userId = req.auth.userId;
      const { productId } = req.params;

      const Reader = require('../models/Reader');
      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Not authorized as seller', 403);
      }

      // Verify ownership
      const product = await Product.findById(productId);
      if (!product || product.sellerId !== reader.id) {
        return errorResponse(res, 'Product not found or not authorized', 404);
      }

      const updatedProduct = await Product.update(productId, req.body);

      return successResponse(res, {
        message: 'Product updated successfully',
        product: updatedProduct
      });

    } catch (error) {
      logger.error('Error updating seller product', { error: error.message });
      return errorResponse(res, error.message || 'Failed to update product', 500);
    }
  }

  /**
   * Delete seller product
   * DELETE /api/shop/seller/products/:productId
   */
  static async deleteSellerProduct(req, res) {
    try {
      const userId = req.auth.userId;
      const { productId } = req.params;

      const Reader = require('../models/Reader');
      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Not authorized as seller', 403);
      }

      // Verify ownership
      const product = await Product.findById(productId);
      if (!product || product.sellerId !== reader.id) {
        return errorResponse(res, 'Product not found or not authorized', 404);
      }

      await Product.delete(productId);

      return successResponse(res, {
        message: 'Product deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting seller product', { error: error.message });
      return errorResponse(res, error.message || 'Failed to delete product', 500);
    }
  }

  /**
   * Get seller orders
   * GET /api/shop/seller/orders
   */
  static async getSellerOrders(req, res) {
    try {
      const userId = req.auth.userId;
      const { page = 1, limit = 20, status } = req.query;

      const Reader = require('../models/Reader');
      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Not authorized as seller', 403);
      }

      const result = await Product.getSellerOrders(reader.id, {
        page: parseInt(page),
        limit: parseInt(limit),
        status: status || null
      });

      return paginatedResponse(res, result.orders, result.pagination);

    } catch (error) {
      logger.error('Error getting seller orders', { error: error.message });
      return errorResponse(res, 'Failed to get orders', 500);
    }
  }

  /**
   * Update order status (seller)
   * PUT /api/shop/seller/orders/:orderId/status
   */
  static async updateOrderStatus(req, res) {
    try {
      const userId = req.auth.userId;
      const { orderId } = req.params;
      const { status, tracking_number, tracking_url, notes } = req.body;

      const Reader = require('../models/Reader');
      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Not authorized as seller', 403);
      }

      // Verify order belongs to seller
      const order = await Product.getOrderById(orderId);
      if (!order) {
        return errorResponse(res, 'Order not found', 404);
      }

      // Check if any items belong to this seller
      const sellerItems = order.items.filter(item => item.sellerId === reader.id);
      if (sellerItems.length === 0) {
        return errorResponse(res, 'Not authorized', 403);
      }

      const updatedOrder = await Product.updateOrderStatus(orderId, status, {
        trackingNumber: tracking_number,
        trackingUrl: tracking_url,
        notes
      });

      // Notify customer
      const notificationType = status === 'shipped' 
        ? Notification.TYPES.ORDER_SHIPPED 
        : status === 'delivered' 
          ? Notification.TYPES.ORDER_DELIVERED 
          : Notification.TYPES.ACCOUNT_UPDATE;

      await Notification.create({
        user_id: order.userId,
        type: notificationType,
        title: `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        content: `Your order #${order.orderNumber} has been ${status}`,
        target_type: 'order',
        target_id: orderId
      });

      return successResponse(res, {
        message: 'Order status updated',
        order: updatedOrder
      });

    } catch (error) {
      logger.error('Error updating order status', { error: error.message });
      return errorResponse(res, error.message || 'Failed to update order', 500);
    }
  }

  // ============================================
  // COUPONS
  // ============================================

  /**
   * Validate coupon
   * POST /api/shop/coupons/validate
   */
  static async validateCoupon(req, res) {
    try {
      const { code, subtotal } = req.body;

      if (!code) {
        return errorResponse(res, 'Coupon code is required', 400);
      }

      const result = await Product.validateCoupon(code, subtotal || 0);

      if (!result.valid) {
        return errorResponse(res, result.message, 400);
      }

      return successResponse(res, {
        valid: true,
        discount: result.discount,
        discountType: result.discountType,
        message: result.message
      });

    } catch (error) {
      logger.error('Error validating coupon', { error: error.message });
      return errorResponse(res, 'Failed to validate coupon', 500);
    }
  }
}

module.exports = ShopController;