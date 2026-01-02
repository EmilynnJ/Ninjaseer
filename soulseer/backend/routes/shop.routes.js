import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { query } from '../config/database.js';
import stripeService from '../services/stripe.service.js';

const router = express.Router();

// Get all products
router.get('/products', async (req, res) => {
  try {
    const { type, limit = 50, offset = 0 } = req.query;

    let queryText = `
      SELECT p.*, r.display_name as reader_name
      FROM products p
      LEFT JOIN reader_profiles r ON p.reader_id = r.user_id
      WHERE p.is_active = true
    `;
    const params = [];
    let paramCount = 1;

    if (type) {
      queryText += ` AND p.product_type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    queryText += ` ORDER BY p.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    res.json({ products: result.rows });
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ error: 'Failed to get products' });
  }
});

// Get product by ID
router.get('/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;

    const result = await query(
      `SELECT p.*, r.display_name as reader_name, r.profile_picture_url
       FROM products p
       LEFT JOIN reader_profiles r ON p.reader_id = r.user_id
       WHERE p.id = $1`,
      [productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product: result.rows[0] });
  } catch (error) {
    console.error('Error getting product:', error);
    res.status(500).json({ error: 'Failed to get product' });
  }
});

// Create order
router.post('/orders', requireAuth, async (req, res) => {
  try {
    const { items, shippingAddress } = req.body;
    const userId = req.dbUserId;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items in order' });
    }

    // Calculate total
    let totalAmount = 0;
    for (const item of items) {
      const productResult = await query(
        'SELECT price FROM products WHERE id = $1',
        [item.productId]
      );
      
      if (productResult.rows.length > 0) {
        totalAmount += productResult.rows[0].price * item.quantity;
      }
    }

    // Create payment intent
    const paymentIntent = await stripeService.createPaymentIntent(
      totalAmount,
      userId,
      { orderType: 'shop', items }
    );

    // Create order
    const orderResult = await query(
      `INSERT INTO orders (user_id, total_amount, shipping_address, stripe_payment_intent_id, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [userId, totalAmount, JSON.stringify(shippingAddress), paymentIntent.id]
    );

    const orderId = orderResult.rows[0].id;

    // Create order items
    for (const item of items) {
      const productResult = await query(
        'SELECT * FROM products WHERE id = $1',
        [item.productId]
      );

      if (productResult.rows.length > 0) {
        const product = productResult.rows[0];
        const itemTotal = product.price * item.quantity;
        const revenueSplit = stripeService.calculateRevenueSplit(itemTotal);

        await query(
          `INSERT INTO order_items 
           (order_id, product_id, quantity, price_per_unit, total_price, reader_earnings, platform_fee)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            orderId,
            item.productId,
            item.quantity,
            product.price,
            itemTotal,
            revenueSplit.readerEarnings,
            revenueSplit.platformFee
          ]
        );
      }
    }

    res.json({
      order: orderResult.rows[0],
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Get user orders
router.get('/orders/me', requireAuth, async (req, res) => {
  try {
    const userId = req.dbUserId;
    const { limit = 20, offset = 0 } = req.query;

    const result = await query(
      `SELECT o.*, 
              json_agg(json_build_object(
                'product_name', p.name,
                'quantity', oi.quantity,
                'price', oi.price_per_unit
              )) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({ orders: result.rows });
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

export default router;