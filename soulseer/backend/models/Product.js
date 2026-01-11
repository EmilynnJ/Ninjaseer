/**
 * Product Model
 * Handles shop product operations
 */

import { query } from '../config/database.js';

class Product {
  /**
   * Create a new product
   */
  static async create({
    name,
    description,
    price,
    imageUrl = null,
    category,
    stockQuantity = 0
  }) {
    const result = await query(
      `INSERT INTO products (
        name, description, price, image_url, category,
        stock_quantity, is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
      RETURNING *`,
      [name, description, price, imageUrl, category, stockQuantity]
    );
    return result.rows[0];
  }

  /**
   * Find product by ID
   */
  static async findById(productId) {
    const result = await query(
      'SELECT * FROM products WHERE id = $1',
      [productId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update product
   */
  static async update(productId, updates) {
    const allowedFields = [
      'name', 'description', 'price', 'image_url', 'category',
      'stock_quantity', 'is_active'
    ];
    
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [productId, ...fields.map(field => updates[field])];

    const result = await query(
      `UPDATE products 
       SET ${setClause}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Get all products with filters
   */
  static async findAll({ category = null, isActive = true, limit = 50, offset = 0 }) {
    let queryText = `
      SELECT *,
             COUNT(*) OVER() as total_count
      FROM products
      WHERE 1=1
    `;
    const params = [];

    if (isActive !== null) {
      params.push(isActive);
      queryText += ` AND is_active = $${params.length}`;
    }

    if (category) {
      params.push(category);
      queryText += ` AND category = $${params.length}`;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);
    
    return {
      products: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Get products by category
   */
  static async getByCategory(category, { limit = 50, offset = 0 }) {
    const result = await query(
      `SELECT *,
              COUNT(*) OVER() as total_count
       FROM products
       WHERE category = $1 AND is_active = true
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [category, limit, offset]
    );

    return {
      products: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Search products
   */
  static async search(searchTerm, { limit = 20, offset = 0 }) {
    const result = await query(
      `SELECT *,
              COUNT(*) OVER() as total_count
       FROM products
       WHERE (name ILIKE $1 OR description ILIKE $1)
         AND is_active = true
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [`%${searchTerm}%`, limit, offset]
    );

    return {
      products: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Update stock quantity
   */
  static async updateStock(productId, quantityChange) {
    return await query(
      `UPDATE products 
       SET stock_quantity = stock_quantity + $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [quantityChange, productId]
    ).then(res => res.rows[0]);
  }

  /**
   * Check stock availability
   */
  static async checkStock(productId, quantity) {
    const result = await query(
      `SELECT stock_quantity >= $1 as available,
              stock_quantity,
              name
       FROM products
       WHERE id = $2`,
      [quantity, productId]
    );

    return result.rows[0];
  }

  /**
   * Delete product (soft delete)
   */
  static async delete(productId) {
    const result = await query(
      `UPDATE products 
       SET is_active = false,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [productId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all categories
   */
  static async getCategories() {
    const result = await query(
      `SELECT DISTINCT category,
              COUNT(*) as product_count
       FROM products
       WHERE is_active = true
       GROUP BY category
       ORDER BY category`
    );

    return result.rows;
  }

  /**
   * Get featured products
   */
  static async getFeatured(limit = 10) {
    const result = await query(
      `SELECT *
       FROM products
       WHERE is_active = true AND stock_quantity > 0
       ORDER BY RANDOM()
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }
}

export default Product;