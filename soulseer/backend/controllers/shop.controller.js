/**
 * Shop Controller
 * Handles shop and product operations
 */

import Product from '../models/Product.js';
import logger from '../utils/logger.js';

class ShopController {
  /**
   * Get all products
   */
  static async getAllProducts(req, res) {
    try {
      const { category, isActive = true, limit = 50, offset = 0 } = req.query;

      const result = await Product.findAll({
        category,
        isActive: isActive === 'false' ? false : true,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json(result);
    } catch (error) {
      logger.error('Error in getAllProducts', error);
      res.status(500).json({ error: 'Failed to get products' });
    }
  }

  /**
   * Get product by ID
   */
  static async getProductById(req, res) {
    try {
      const { productId } = req.params;

      const product = await Product.findById(productId);

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json({ product });
    } catch (error) {
      logger.error('Error in getProductById', error);
      res.status(500).json({ error: 'Failed to get product' });
    }
  }

  /**
   * Get products by category
   */
  static async getProductsByCategory(req, res) {
    try {
      const { category } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const result = await Product.getByCategory(category, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json(result);
    } catch (error) {
      logger.error('Error in getProductsByCategory', error);
      res.status(500).json({ error: 'Failed to get products by category' });
    }
  }

  /**
   * Search products
   */
  static async searchProducts(req, res) {
    try {
      const { q: searchTerm, limit = 20, offset = 0 } = req.query;

      if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required' });
      }

      const result = await Product.search(searchTerm, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json(result);
    } catch (error) {
      logger.error('Error in searchProducts', error);
      res.status(500).json({ error: 'Failed to search products' });
    }
  }

  /**
   * Get all categories
   */
  static async getCategories(req, res) {
    try {
      const categories = await Product.getCategories();

      res.json({ categories });
    } catch (error) {
      logger.error('Error in getCategories', error);
      res.status(500).json({ error: 'Failed to get categories' });
    }
  }

  /**
   * Get featured products
   */
  static async getFeaturedProducts(req, res) {
    try {
      const { limit = 10 } = req.query;

      const products = await Product.getFeatured(parseInt(limit));

      res.json({ products });
    } catch (error) {
      logger.error('Error in getFeaturedProducts', error);
      res.status(500).json({ error: 'Failed to get featured products' });
    }
  }

  /**
   * Create product (admin only)
   */
  static async createProduct(req, res) {
    try {
      const { name, description, price, imageUrl, category, stockQuantity } = req.body;

      // Validate required fields
      if (!name || !description || !price || !category) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['name', 'description', 'price', 'category']
        });
      }

      const product = await Product.create({
        name,
        description,
        price: parseFloat(price),
        imageUrl,
        category,
        stockQuantity: stockQuantity || 0
      });

      res.status(201).json({
        product,
        message: 'Product created successfully'
      });
    } catch (error) {
      logger.error('Error in createProduct', error);
      res.status(500).json({ error: 'Failed to create product' });
    }
  }

  /**
   * Update product (admin only)
   */
  static async updateProduct(req, res) {
    try {
      const { productId } = req.params;
      const updates = req.body;

      const product = await Product.update(productId, updates);

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json({
        product,
        message: 'Product updated successfully'
      });
    } catch (error) {
      logger.error('Error in updateProduct', error);
      res.status(500).json({ error: 'Failed to update product' });
    }
  }

  /**
   * Delete product (admin only)
   */
  static async deleteProduct(req, res) {
    try {
      const { productId } = req.params;

      const product = await Product.delete(productId);

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      logger.error('Error in deleteProduct', error);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  }
}

export default ShopController;