/**
 * Product Model - Enterprise Level
 * Complete e-commerce product management for SoulSeer marketplace
 * Handles products, inventory, orders, and shop analytics
 */

const { pool } = require('../config/database');
const { logger } = require('../utils/logger');

class Product {
  // ============================================
  // PRODUCT TYPES & STATUSES
  // ============================================
  
  static TYPES = {
    PHYSICAL: 'physical',       // Physical products (crystals, cards, etc.)
    DIGITAL: 'digital',         // Digital downloads (ebooks, guides)
    SERVICE: 'service',         // Services (extended readings, courses)
    BUNDLE: 'bundle'            // Product bundles
  };

  static STATUSES = {
    DRAFT: 'draft',
    ACTIVE: 'active',
    OUT_OF_STOCK: 'out_of_stock',
    DISCONTINUED: 'discontinued',
    ARCHIVED: 'archived'
  };

  static CATEGORIES = {
    TAROT_DECKS: 'tarot_decks',
    ORACLE_CARDS: 'oracle_cards',
    CRYSTALS: 'crystals',
    CANDLES: 'candles',
    INCENSE: 'incense',
    JEWELRY: 'jewelry',
    BOOKS: 'books',
    DIGITAL_GUIDES: 'digital_guides',
    COURSES: 'courses',
    READINGS: 'readings',
    ALTAR_SUPPLIES: 'altar_supplies',
    HERBS: 'herbs',
    OILS: 'oils',
    CLOTHING: 'clothing',
    HOME_DECOR: 'home_decor',
    GIFT_SETS: 'gift_sets',
    OTHER: 'other'
  };

  static ORDER_STATUSES = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded',
    RETURNED: 'returned'
  };

  // ============================================
  // CORE CRUD OPERATIONS
  // ============================================

  /**
   * Create a new product
   * @param {Object} productData - Product details
   * @returns {Object} Created product
   */
  static async create(productData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const {
        seller_id = null,  // null for platform products
        name,
        slug = null,
        description,
        short_description = null,
        type = this.TYPES.PHYSICAL,
        category,
        price,
        compare_at_price = null,
        cost_price = null,
        sku = null,
        barcode = null,
        quantity = 0,
        track_inventory = true,
        allow_backorder = false,
        weight = null,
        weight_unit = 'oz',
        dimensions = null,
        images = [],
        thumbnail_url = null,
        digital_file_url = null,
        tags = [],
        metadata = {},
        seo_title = null,
        seo_description = null,
        is_featured = false,
        is_taxable = true,
        tax_code = null
      } = productData;

      // Generate slug if not provided
      const productSlug = slug || this.generateSlug(name);

      // Check for duplicate slug
      const slugCheck = await client.query(
        'SELECT id FROM products WHERE slug = $1',
        [productSlug]
      );
      if (slugCheck.rows.length > 0) {
        throw new Error('Product with this slug already exists');
      }

      // Generate SKU if not provided
      const productSku = sku || this.generateSku(category);

      const query = `
        INSERT INTO products (
          seller_id, name, slug, description, short_description,
          type, category, price, compare_at_price, cost_price,
          sku, barcode, quantity, track_inventory, allow_backorder,
          weight, weight_unit, dimensions, images, thumbnail_url,
          digital_file_url, tags, metadata,
          seo_title, seo_description, is_featured, is_taxable, tax_code,
          status, view_count, sales_count, rating, review_count,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20,
          $21, $22, $23,
          $24, $25, $26, $27, $28,
          $29, 0, 0, 0, 0,
          NOW(), NOW()
        )
        RETURNING *
      `;

      const status = quantity > 0 || !track_inventory 
        ? this.STATUSES.ACTIVE 
        : this.STATUSES.OUT_OF_STOCK;

      const values = [
        seller_id, name, productSlug, description, short_description,
        type, category, price, compare_at_price, cost_price,
        productSku, barcode, quantity, track_inventory, allow_backorder,
        weight, weight_unit, JSON.stringify(dimensions), images, thumbnail_url,
        digital_file_url, tags, JSON.stringify(metadata),
        seo_title, seo_description, is_featured, is_taxable, tax_code,
        status
      ];

      const result = await client.query(query, values);
      const product = result.rows[0];

      // Create inventory record
      if (track_inventory) {
        await client.query(`
          INSERT INTO product_inventory (
            product_id, quantity, reserved_quantity, created_at, updated_at
          ) VALUES ($1, $2, 0, NOW(), NOW())
        `, [product.id, quantity]);
      }

      // Create price history record
      await client.query(`
        INSERT INTO product_price_history (
          product_id, price, compare_at_price, changed_at
        ) VALUES ($1, $2, $3, NOW())
      `, [product.id, price, compare_at_price]);

      await client.query('COMMIT');

      logger.info('Product created', { productId: product.id, name, sku: productSku });

      return this.formatProduct(product);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating product', { error: error.message, productData });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find product by ID
   * @param {string} id - Product ID
   * @returns {Object|null} Product or null
   */
  static async findById(id) {
    try {
      const query = `
        SELECT p.*,
               u.display_name as seller_name,
               u.profile_image_url as seller_image
        FROM products p
        LEFT JOIN users u ON p.seller_id = u.id
        WHERE p.id = $1
      `;

      const result = await pool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.formatProduct(result.rows[0]);

    } catch (error) {
      logger.error('Error finding product by ID', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Find product by slug
   * @param {string} slug - Product slug
   * @returns {Object|null} Product or null
   */
  static async findBySlug(slug) {
    try {
      const query = `
        SELECT p.*,
               u.display_name as seller_name,
               u.profile_image_url as seller_image
        FROM products p
        LEFT JOIN users u ON p.seller_id = u.id
        WHERE p.slug = $1
      `;

      const result = await pool.query(query, [slug]);
      
      if (result.rows.length === 0) {
        return null;
      }

      // Increment view count
      await pool.query(
        'UPDATE products SET view_count = view_count + 1 WHERE id = $1',
        [result.rows[0].id]
      );

      return this.formatProduct(result.rows[0]);

    } catch (error) {
      logger.error('Error finding product by slug', { error: error.message, slug });
      throw error;
    }
  }

  /**
   * Find product by SKU
   * @param {string} sku - Product SKU
   * @returns {Object|null} Product or null
   */
  static async findBySku(sku) {
    try {
      const query = `SELECT * FROM products WHERE sku = $1`;
      const result = await pool.query(query, [sku]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.formatProduct(result.rows[0]);

    } catch (error) {
      logger.error('Error finding product by SKU', { error: error.message, sku });
      throw error;
    }
  }

  /**
   * Update product
   * @param {string} id - Product ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated product
   */
  static async update(id, updates) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get current product for comparison
      const currentProduct = await this.findById(id);
      if (!currentProduct) {
        throw new Error('Product not found');
      }

      const allowedFields = [
        'name', 'slug', 'description', 'short_description', 'type', 'category',
        'price', 'compare_at_price', 'cost_price', 'sku', 'barcode',
        'quantity', 'track_inventory', 'allow_backorder',
        'weight', 'weight_unit', 'dimensions', 'images', 'thumbnail_url',
        'digital_file_url', 'tags', 'metadata',
        'seo_title', 'seo_description', 'is_featured', 'is_taxable', 'tax_code',
        'status'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          if (['metadata', 'dimensions'].includes(key)) {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(JSON.stringify(value));
          } else {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(value);
          }
          paramIndex++;
        }
      }

      if (setClause.length === 0) {
        throw new Error('No valid fields to update');
      }

      setClause.push(`updated_at = NOW()`);
      values.push(id);

      const query = `
        UPDATE products 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);
      const product = result.rows[0];

      // Track price changes
      if (updates.price && updates.price !== currentProduct.price) {
        await client.query(`
          INSERT INTO product_price_history (
            product_id, price, compare_at_price, changed_at
          ) VALUES ($1, $2, $3, NOW())
        `, [id, updates.price, updates.compare_at_price || product.compare_at_price]);
      }

      // Update inventory if quantity changed
      if (updates.quantity !== undefined && currentProduct.trackInventory) {
        await client.query(`
          UPDATE product_inventory 
          SET quantity = $1, updated_at = NOW()
          WHERE product_id = $2
        `, [updates.quantity, id]);

        // Update status based on inventory
        if (updates.quantity <= 0 && !currentProduct.allowBackorder) {
          await client.query(`
            UPDATE products SET status = $1 WHERE id = $2
          `, [this.STATUSES.OUT_OF_STOCK, id]);
        } else if (updates.quantity > 0 && currentProduct.status === this.STATUSES.OUT_OF_STOCK) {
          await client.query(`
            UPDATE products SET status = $1 WHERE id = $2
          `, [this.STATUSES.ACTIVE, id]);
        }
      }

      await client.query('COMMIT');

      logger.info('Product updated', { productId: id, updates: Object.keys(updates) });

      return this.formatProduct(result.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating product', { error: error.message, id, updates });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete product (soft delete by archiving)
   * @param {string} id - Product ID
   * @returns {boolean} Success
   */
  static async delete(id) {
    try {
      const result = await pool.query(`
        UPDATE products 
        SET status = $1, archived_at = NOW(), updated_at = NOW()
        WHERE id = $2
        RETURNING id
      `, [this.STATUSES.ARCHIVED, id]);

      if (result.rows.length === 0) {
        throw new Error('Product not found');
      }

      logger.info('Product archived', { productId: id });
      return true;

    } catch (error) {
      logger.error('Error deleting product', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Permanently delete product
   * @param {string} id - Product ID
   * @returns {boolean} Success
   */
  static async permanentDelete(id) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Delete related records
      await client.query('DELETE FROM product_inventory WHERE product_id = $1', [id]);
      await client.query('DELETE FROM product_price_history WHERE product_id = $1', [id]);
      await client.query('DELETE FROM product_reviews WHERE product_id = $1', [id]);
      await client.query('DELETE FROM cart_items WHERE product_id = $1', [id]);
      await client.query('DELETE FROM wishlist_items WHERE product_id = $1', [id]);
      
      // Delete product
      await client.query('DELETE FROM products WHERE id = $1', [id]);

      await client.query('COMMIT');

      logger.info('Product permanently deleted', { productId: id });
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error permanently deleting product', { error: error.message, id });
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // INVENTORY MANAGEMENT
  // ============================================

  /**
   * Check product availability
   * @param {string} productId - Product ID
   * @param {number} quantity - Requested quantity
   * @returns {Object} Availability info
   */
  static async checkAvailability(productId, quantity = 1) {
    try {
      const query = `
        SELECT p.*, pi.quantity as stock_quantity, pi.reserved_quantity
        FROM products p
        LEFT JOIN product_inventory pi ON p.id = pi.product_id
        WHERE p.id = $1
      `;

      const result = await pool.query(query, [productId]);

      if (result.rows.length === 0) {
        return { available: false, reason: 'Product not found' };
      }

      const product = result.rows[0];

      if (product.status !== this.STATUSES.ACTIVE) {
        return { available: false, reason: 'Product is not available' };
      }

      if (!product.track_inventory) {
        return { available: true, quantity: quantity };
      }

      const availableQuantity = product.stock_quantity - product.reserved_quantity;

      if (availableQuantity >= quantity) {
        return { available: true, quantity: quantity, inStock: availableQuantity };
      }

      if (product.allow_backorder) {
        return { 
          available: true, 
          quantity: quantity, 
          inStock: availableQuantity,
          backorder: quantity - availableQuantity 
        };
      }

      return { 
        available: false, 
        reason: 'Insufficient stock',
        inStock: availableQuantity,
        requested: quantity
      };

    } catch (error) {
      logger.error('Error checking availability', { error: error.message, productId });
      throw error;
    }
  }

  /**
   * Reserve inventory for an order
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity to reserve
   * @returns {boolean} Success
   */
  static async reserveInventory(productId, quantity) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check availability first
      const availability = await this.checkAvailability(productId, quantity);
      if (!availability.available) {
        throw new Error(availability.reason);
      }

      // Reserve inventory
      await client.query(`
        UPDATE product_inventory 
        SET reserved_quantity = reserved_quantity + $1, updated_at = NOW()
        WHERE product_id = $2
      `, [quantity, productId]);

      await client.query('COMMIT');

      logger.info('Inventory reserved', { productId, quantity });
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error reserving inventory', { error: error.message, productId, quantity });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Release reserved inventory
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity to release
   * @returns {boolean} Success
   */
  static async releaseInventory(productId, quantity) {
    try {
      await pool.query(`
        UPDATE product_inventory 
        SET reserved_quantity = GREATEST(0, reserved_quantity - $1), updated_at = NOW()
        WHERE product_id = $2
      `, [quantity, productId]);

      logger.info('Inventory released', { productId, quantity });
      return true;

    } catch (error) {
      logger.error('Error releasing inventory', { error: error.message, productId, quantity });
      throw error;
    }
  }

  /**
   * Deduct inventory after order completion
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity to deduct
   * @returns {boolean} Success
   */
  static async deductInventory(productId, quantity) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Deduct from both quantity and reserved
      await client.query(`
        UPDATE product_inventory 
        SET quantity = quantity - $1,
            reserved_quantity = GREATEST(0, reserved_quantity - $1),
            updated_at = NOW()
        WHERE product_id = $2
      `, [quantity, productId]);

      // Update product sales count
      await client.query(`
        UPDATE products 
        SET sales_count = sales_count + $1, updated_at = NOW()
        WHERE id = $2
      `, [quantity, productId]);

      // Check if out of stock
      const inventoryResult = await client.query(`
        SELECT quantity FROM product_inventory WHERE product_id = $1
      `, [productId]);

      if (inventoryResult.rows.length > 0 && inventoryResult.rows[0].quantity <= 0) {
        const productResult = await client.query(`
          SELECT allow_backorder FROM products WHERE id = $1
        `, [productId]);

        if (!productResult.rows[0]?.allow_backorder) {
          await client.query(`
            UPDATE products SET status = $1 WHERE id = $2
          `, [this.STATUSES.OUT_OF_STOCK, productId]);
        }
      }

      await client.query('COMMIT');

      logger.info('Inventory deducted', { productId, quantity });
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error deducting inventory', { error: error.message, productId, quantity });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Restore inventory (for returns/cancellations)
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity to restore
   * @returns {boolean} Success
   */
  static async restoreInventory(productId, quantity) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      await client.query(`
        UPDATE product_inventory 
        SET quantity = quantity + $1, updated_at = NOW()
        WHERE product_id = $2
      `, [quantity, productId]);

      // Update status if was out of stock
      const productResult = await client.query(`
        SELECT status FROM products WHERE id = $1
      `, [productId]);

      if (productResult.rows[0]?.status === this.STATUSES.OUT_OF_STOCK) {
        await client.query(`
          UPDATE products SET status = $1 WHERE id = $2
        `, [this.STATUSES.ACTIVE, productId]);
      }

      await client.query('COMMIT');

      logger.info('Inventory restored', { productId, quantity });
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error restoring inventory', { error: error.message, productId, quantity });
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // ORDER MANAGEMENT
  // ============================================

  /**
   * Create an order
   * @param {Object} orderData - Order details
   * @returns {Object} Created order
   */
  static async createOrder(orderData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const {
        user_id,
        items,
        shipping_address,
        billing_address = null,
        shipping_method = 'standard',
        shipping_cost = 0,
        tax_amount = 0,
        discount_amount = 0,
        discount_code = null,
        notes = null,
        metadata = {}
      } = orderData;

      // Calculate totals
      let subtotal = 0;
      const orderItems = [];

      for (const item of items) {
        const product = await this.findById(item.product_id);
        if (!product) {
          throw new Error(`Product not found: ${item.product_id}`);
        }

        // Check availability
        const availability = await this.checkAvailability(item.product_id, item.quantity);
        if (!availability.available) {
          throw new Error(`${product.name}: ${availability.reason}`);
        }

        const itemTotal = product.price * item.quantity;
        subtotal += itemTotal;

        orderItems.push({
          product_id: item.product_id,
          product_name: product.name,
          product_sku: product.sku,
          quantity: item.quantity,
          unit_price: product.price,
          total_price: itemTotal,
          product_type: product.type
        });

        // Reserve inventory
        if (product.trackInventory) {
          await this.reserveInventory(item.product_id, item.quantity);
        }
      }

      const total = subtotal + shipping_cost + tax_amount - discount_amount;

      // Generate order number
      const orderNumber = this.generateOrderNumber();

      // Create order
      const orderQuery = `
        INSERT INTO orders (
          user_id, order_number, status,
          subtotal, shipping_cost, tax_amount, discount_amount, total,
          discount_code, shipping_address, billing_address,
          shipping_method, notes, metadata,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6, $7, $8,
          $9, $10, $11,
          $12, $13, $14,
          NOW(), NOW()
        )
        RETURNING *
      `;

      const orderValues = [
        user_id, orderNumber, this.ORDER_STATUSES.PENDING,
        subtotal, shipping_cost, tax_amount, discount_amount, total,
        discount_code, JSON.stringify(shipping_address), JSON.stringify(billing_address || shipping_address),
        shipping_method, notes, JSON.stringify(metadata)
      ];

      const orderResult = await client.query(orderQuery, orderValues);
      const order = orderResult.rows[0];

      // Create order items
      for (const item of orderItems) {
        await client.query(`
          INSERT INTO order_items (
            order_id, product_id, product_name, product_sku,
            quantity, unit_price, total_price, product_type,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        `, [
          order.id, item.product_id, item.product_name, item.product_sku,
          item.quantity, item.unit_price, item.total_price, item.product_type
        ]);
      }

      // Create order history entry
      await this.createOrderHistory(client, order.id, this.ORDER_STATUSES.PENDING, 'Order created');

      await client.query('COMMIT');

      logger.info('Order created', { orderId: order.id, orderNumber, total });

      return this.formatOrder({ ...order, items: orderItems });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating order', { error: error.message, orderData });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get order by ID
   * @param {string} orderId - Order ID
   * @returns {Object|null} Order or null
   */
  static async getOrderById(orderId) {
    try {
      const orderQuery = `
        SELECT o.*,
               u.email as user_email,
               u.display_name as user_name
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.id = $1
      `;

      const orderResult = await pool.query(orderQuery, [orderId]);

      if (orderResult.rows.length === 0) {
        return null;
      }

      // Get order items
      const itemsQuery = `
        SELECT * FROM order_items WHERE order_id = $1
      `;
      const itemsResult = await pool.query(itemsQuery, [orderId]);

      return this.formatOrder({
        ...orderResult.rows[0],
        items: itemsResult.rows
      });

    } catch (error) {
      logger.error('Error getting order', { error: error.message, orderId });
      throw error;
    }
  }

  /**
   * Get order by order number
   * @param {string} orderNumber - Order number
   * @returns {Object|null} Order or null
   */
  static async getOrderByNumber(orderNumber) {
    try {
      const query = `SELECT id FROM orders WHERE order_number = $1`;
      const result = await pool.query(query, [orderNumber]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.getOrderById(result.rows[0].id);

    } catch (error) {
      logger.error('Error getting order by number', { error: error.message, orderNumber });
      throw error;
    }
  }

  /**
   * Update order status
   * @param {string} orderId - Order ID
   * @param {string} status - New status
   * @param {string} note - Status change note
   * @returns {Object} Updated order
   */
  static async updateOrderStatus(orderId, status, note = null) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const order = await this.getOrderById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Validate status transition
      if (!this.isValidStatusTransition(order.status, status)) {
        throw new Error(`Invalid status transition from ${order.status} to ${status}`);
      }

      // Update order
      const updateQuery = `
        UPDATE orders 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const result = await client.query(updateQuery, [status, orderId]);

      // Handle status-specific actions
      if (status === this.ORDER_STATUSES.CONFIRMED) {
        // Deduct inventory
        for (const item of order.items) {
          await this.deductInventory(item.productId, item.quantity);
        }
      } else if (status === this.ORDER_STATUSES.CANCELLED) {
        // Release reserved inventory
        for (const item of order.items) {
          await this.releaseInventory(item.productId, item.quantity);
        }
      } else if (status === this.ORDER_STATUSES.REFUNDED || status === this.ORDER_STATUSES.RETURNED) {
        // Restore inventory
        for (const item of order.items) {
          await this.restoreInventory(item.productId, item.quantity);
        }
      }

      // Create history entry
      await this.createOrderHistory(client, orderId, status, note || `Status changed to ${status}`);

      await client.query('COMMIT');

      logger.info('Order status updated', { orderId, status });

      return this.getOrderById(orderId);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating order status', { error: error.message, orderId, status });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create order history entry
   * @param {Object} client - Database client
   * @param {string} orderId - Order ID
   * @param {string} status - Status
   * @param {string} note - Note
   */
  static async createOrderHistory(client, orderId, status, note) {
    await client.query(`
      INSERT INTO order_history (order_id, status, note, created_at)
      VALUES ($1, $2, $3, NOW())
    `, [orderId, status, note]);
  }

  /**
   * Get user's orders
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated orders
   */
  static async getUserOrders(userId, options = {}) {
    try {
      const { page = 1, limit = 20, status = null } = options;
      const offset = (page - 1) * limit;

      const conditions = ['user_id = $1'];
      const values = [userId];
      let paramIndex = 2;

      if (status) {
        conditions.push(`status = $${paramIndex}`);
        values.push(status);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      const countQuery = `SELECT COUNT(*) FROM orders WHERE ${whereClause}`;
      const countResult = await pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      const query = `
        SELECT * FROM orders
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await pool.query(query, values);

      // Get items for each order
      const orders = await Promise.all(
        result.rows.map(async (order) => {
          const itemsResult = await pool.query(
            'SELECT * FROM order_items WHERE order_id = $1',
            [order.id]
          );
          return this.formatOrder({ ...order, items: itemsResult.rows });
        })
      );

      return {
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };

    } catch (error) {
      logger.error('Error getting user orders', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // PRODUCT QUERIES
  // ============================================

  /**
   * Get all products with filters
   * @param {Object} options - Query options
   * @returns {Object} Paginated products
   */
  static async getProducts(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        category = null,
        type = null,
        status = this.STATUSES.ACTIVE,
        minPrice = null,
        maxPrice = null,
        sellerId = null,
        isFeatured = null,
        search = null,
        sortBy = 'created_at',
        sortOrder = 'DESC',
        tags = null
      } = options;

      const offset = (page - 1) * limit;
      const conditions = [];
      const values = [];
      let paramIndex = 1;

      if (status) {
        conditions.push(`status = $${paramIndex}`);
        values.push(status);
        paramIndex++;
      }

      if (category) {
        conditions.push(`category = $${paramIndex}`);
        values.push(category);
        paramIndex++;
      }

      if (type) {
        conditions.push(`type = $${paramIndex}`);
        values.push(type);
        paramIndex++;
      }

      if (minPrice !== null) {
        conditions.push(`price >= $${paramIndex}`);
        values.push(minPrice);
        paramIndex++;
      }

      if (maxPrice !== null) {
        conditions.push(`price <= $${paramIndex}`);
        values.push(maxPrice);
        paramIndex++;
      }

      if (sellerId) {
        conditions.push(`seller_id = $${paramIndex}`);
        values.push(sellerId);
        paramIndex++;
      }

      if (isFeatured !== null) {
        conditions.push(`is_featured = $${paramIndex}`);
        values.push(isFeatured);
        paramIndex++;
      }

      if (search) {
        conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
        values.push(`%${search}%`);
        paramIndex++;
      }

      if (tags && tags.length > 0) {
        conditions.push(`tags && $${paramIndex}`);
        values.push(tags);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      const validSortFields = ['created_at', 'price', 'name', 'sales_count', 'rating', 'view_count'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const countQuery = `SELECT COUNT(*) FROM products ${whereClause}`;
      const countResult = await pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      const query = `
        SELECT p.*,
               u.display_name as seller_name
        FROM products p
        LEFT JOIN users u ON p.seller_id = u.id
        ${whereClause}
        ORDER BY ${sortField} ${order}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await pool.query(query, values);

      return {
        products: result.rows.map(p => this.formatProduct(p)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };

    } catch (error) {
      logger.error('Error getting products', { error: error.message, options });
      throw error;
    }
  }

  /**
   * Get featured products
   * @param {number} limit - Number of products
   * @returns {Array} Featured products
   */
  static async getFeaturedProducts(limit = 10) {
    try {
      const query = `
        SELECT p.*, u.display_name as seller_name
        FROM products p
        LEFT JOIN users u ON p.seller_id = u.id
        WHERE p.status = $1 AND p.is_featured = true
        ORDER BY p.created_at DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [this.STATUSES.ACTIVE, limit]);
      return result.rows.map(p => this.formatProduct(p));

    } catch (error) {
      logger.error('Error getting featured products', { error: error.message });
      throw error;
    }
  }

  /**
   * Get best selling products
   * @param {number} limit - Number of products
   * @returns {Array} Best selling products
   */
  static async getBestSellers(limit = 10) {
    try {
      const query = `
        SELECT p.*, u.display_name as seller_name
        FROM products p
        LEFT JOIN users u ON p.seller_id = u.id
        WHERE p.status = $1
        ORDER BY p.sales_count DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [this.STATUSES.ACTIVE, limit]);
      return result.rows.map(p => this.formatProduct(p));

    } catch (error) {
      logger.error('Error getting best sellers', { error: error.message });
      throw error;
    }
  }

  /**
   * Get related products
   * @param {string} productId - Product ID
   * @param {number} limit - Number of products
   * @returns {Array} Related products
   */
  static async getRelatedProducts(productId, limit = 6) {
    try {
      const product = await this.findById(productId);
      if (!product) {
        return [];
      }

      const query = `
        SELECT p.*, u.display_name as seller_name
        FROM products p
        LEFT JOIN users u ON p.seller_id = u.id
        WHERE p.id != $1 
          AND p.status = $2
          AND (p.category = $3 OR p.tags && $4)
        ORDER BY 
          CASE WHEN p.category = $3 THEN 0 ELSE 1 END,
          p.sales_count DESC
        LIMIT $5
      `;

      const result = await pool.query(query, [
        productId,
        this.STATUSES.ACTIVE,
        product.category,
        product.tags || [],
        limit
      ]);

      return result.rows.map(p => this.formatProduct(p));

    } catch (error) {
      logger.error('Error getting related products', { error: error.message, productId });
      throw error;
    }
  }

  // ============================================
  // REVIEWS
  // ============================================

  /**
   * Add product review
   * @param {string} productId - Product ID
   * @param {string} userId - User ID
   * @param {Object} reviewData - Review details
   * @returns {Object} Created review
   */
  static async addReview(productId, userId, reviewData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const { rating, title, content, images = [] } = reviewData;

      // Check if user has purchased the product
      const purchaseCheck = await client.query(`
        SELECT o.id FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE o.user_id = $1 AND oi.product_id = $2 AND o.status = $3
        LIMIT 1
      `, [userId, productId, this.ORDER_STATUSES.DELIVERED]);

      const verifiedPurchase = purchaseCheck.rows.length > 0;

      // Check for existing review
      const existingReview = await client.query(`
        SELECT id FROM product_reviews WHERE product_id = $1 AND user_id = $2
      `, [productId, userId]);

      if (existingReview.rows.length > 0) {
        throw new Error('You have already reviewed this product');
      }

      // Create review
      const reviewQuery = `
        INSERT INTO product_reviews (
          product_id, user_id, rating, title, content, images,
          verified_purchase, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *
      `;

      const reviewResult = await client.query(reviewQuery, [
        productId, userId, rating, title, content, images, verifiedPurchase
      ]);

      // Update product rating
      const ratingQuery = `
        SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
        FROM product_reviews
        WHERE product_id = $1
      `;
      const ratingResult = await client.query(ratingQuery, [productId]);

      await client.query(`
        UPDATE products 
        SET rating = $1, review_count = $2, updated_at = NOW()
        WHERE id = $3
      `, [
        ratingResult.rows[0].avg_rating,
        ratingResult.rows[0].review_count,
        productId
      ]);

      await client.query('COMMIT');

      logger.info('Review added', { productId, userId, rating });

      return reviewResult.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error adding review', { error: error.message, productId, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get product reviews
   * @param {string} productId - Product ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated reviews
   */
  static async getProductReviews(productId, options = {}) {
    try {
      const { page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'DESC' } = options;
      const offset = (page - 1) * limit;

      const countQuery = `SELECT COUNT(*) FROM product_reviews WHERE product_id = $1`;
      const countResult = await pool.query(countQuery, [productId]);
      const total = parseInt(countResult.rows[0].count);

      const query = `
        SELECT pr.*, u.display_name, u.profile_image_url
        FROM product_reviews pr
        JOIN users u ON pr.user_id = u.id
        WHERE pr.product_id = $1
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT $2 OFFSET $3
      `;

      const result = await pool.query(query, [productId, limit, offset]);

      return {
        reviews: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      logger.error('Error getting product reviews', { error: error.message, productId });
      throw error;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Generate product slug
   * @param {string} name - Product name
   * @returns {string} Slug
   */
  static generateSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36);
  }

  /**
   * Generate SKU
   * @param {string} category - Product category
   * @returns {string} SKU
   */
  static generateSku(category) {
    const prefix = category.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Generate order number
   * @returns {string} Order number
   */
  static generateOrderNumber() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `SS${year}${month}${day}-${random}`;
  }

  /**
   * Check if status transition is valid
   * @param {string} currentStatus - Current status
   * @param {string} newStatus - New status
   * @returns {boolean} Is valid
   */
  static isValidStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      [this.ORDER_STATUSES.PENDING]: [
        this.ORDER_STATUSES.CONFIRMED,
        this.ORDER_STATUSES.CANCELLED
      ],
      [this.ORDER_STATUSES.CONFIRMED]: [
        this.ORDER_STATUSES.PROCESSING,
        this.ORDER_STATUSES.CANCELLED
      ],
      [this.ORDER_STATUSES.PROCESSING]: [
        this.ORDER_STATUSES.SHIPPED,
        this.ORDER_STATUSES.CANCELLED
      ],
      [this.ORDER_STATUSES.SHIPPED]: [
        this.ORDER_STATUSES.DELIVERED
      ],
      [this.ORDER_STATUSES.DELIVERED]: [
        this.ORDER_STATUSES.RETURNED,
        this.ORDER_STATUSES.REFUNDED
      ]
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Format product for API response
   * @param {Object} product - Raw product data
   * @returns {Object} Formatted product
   */
  static formatProduct(product) {
    if (!product) return null;

    return {
      id: product.id,
      sellerId: product.seller_id,
      sellerName: product.seller_name,
      sellerImage: product.seller_image,
      name: product.name,
      slug: product.slug,
      description: product.description,
      shortDescription: product.short_description,
      type: product.type,
      category: product.category,
      price: parseFloat(product.price),
      compareAtPrice: product.compare_at_price ? parseFloat(product.compare_at_price) : null,
      costPrice: product.cost_price ? parseFloat(product.cost_price) : null,
      sku: product.sku,
      barcode: product.barcode,
      quantity: product.quantity,
      trackInventory: product.track_inventory,
      allowBackorder: product.allow_backorder,
      weight: product.weight ? parseFloat(product.weight) : null,
      weightUnit: product.weight_unit,
      dimensions: typeof product.dimensions === 'string' 
        ? JSON.parse(product.dimensions) 
        : product.dimensions,
      images: product.images,
      thumbnailUrl: product.thumbnail_url,
      digitalFileUrl: product.digital_file_url,
      tags: product.tags,
      metadata: typeof product.metadata === 'string' 
        ? JSON.parse(product.metadata) 
        : product.metadata,
      seoTitle: product.seo_title,
      seoDescription: product.seo_description,
      isFeatured: product.is_featured,
      isTaxable: product.is_taxable,
      taxCode: product.tax_code,
      status: product.status,
      viewCount: product.view_count,
      salesCount: product.sales_count,
      rating: product.rating ? parseFloat(product.rating) : 0,
      reviewCount: product.review_count,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
      archivedAt: product.archived_at
    };
  }

  /**
   * Format order for API response
   * @param {Object} order - Raw order data
   * @returns {Object} Formatted order
   */
  static formatOrder(order) {
    if (!order) return null;

    return {
      id: order.id,
      userId: order.user_id,
      userName: order.user_name,
      userEmail: order.user_email,
      orderNumber: order.order_number,
      status: order.status,
      subtotal: parseFloat(order.subtotal),
      shippingCost: parseFloat(order.shipping_cost),
      taxAmount: parseFloat(order.tax_amount),
      discountAmount: parseFloat(order.discount_amount),
      total: parseFloat(order.total),
      discountCode: order.discount_code,
      shippingAddress: typeof order.shipping_address === 'string'
        ? JSON.parse(order.shipping_address)
        : order.shipping_address,
      billingAddress: typeof order.billing_address === 'string'
        ? JSON.parse(order.billing_address)
        : order.billing_address,
      shippingMethod: order.shipping_method,
      trackingNumber: order.tracking_number,
      notes: order.notes,
      metadata: typeof order.metadata === 'string'
        ? JSON.parse(order.metadata)
        : order.metadata,
      items: order.items?.map(item => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        productSku: item.product_sku,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unit_price),
        totalPrice: parseFloat(item.total_price),
        productType: item.product_type
      })),
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      shippedAt: order.shipped_at,
      deliveredAt: order.delivered_at
    };
  }
}

module.exports = Product;