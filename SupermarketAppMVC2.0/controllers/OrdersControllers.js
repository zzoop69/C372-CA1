const db = require('../db');

function groupOrders(rows) {
  const map = new Map();
  rows.forEach(r => {
    if (!map.has(r.id)) {
      map.set(r.id, {
        id: r.id,
        total_amount: r.total_amount,
        order_date: r.order_date,
        status: r.status || null,
        user_id: r.user_id || null,
        customerName: r.username || null,
        customerEmail: r.email || null,
        shippingAddress: r.address || null,
        items: []
      });
    }
    if (r.order_item_id) {
      map.get(r.id).items.push({ product_id: r.product_id, productName: r.productName, quantity: r.quantity, price: r.price });
    }
  });
  return Array.from(map.values());
}

const OrdersControllers = {
  // createOrder removed: confirm-purchase logic disabled per user request

  // List orders for logged-in user
  listUserOrders: (req, res) => {
    const userId = req.session.user && req.session.user.id;
    if (!userId) {
      if (req.headers.accept && req.headers.accept.includes('application/json')) return res.status(401).json({ error: 'Not authenticated' });
      return res.redirect('/login');
    }

    const sql = `SELECT o.order_id AS id, o.total_amount, o.order_date, oi.item_id AS order_item_id, oi.product_id, oi.quantity, oi.price_at_time_of_purchase AS price, p.productName
           FROM orders o
           LEFT JOIN order_items oi ON oi.order_id = o.order_id
           LEFT JOIN products p ON p.id = oi.product_id
           WHERE o.user_id = ?
           ORDER BY o.order_date DESC, o.order_id DESC`;

    db.query(sql, [userId], (err, rows) => {
      if (err) {
        console.error('Error fetching orders:', err);
        if (req.headers.accept && req.headers.accept.includes('application/json')) return res.status(500).json({ error: 'Unable to load orders' });
        req.flash('error', 'Unable to load orders');
        return res.redirect('/shopping');
      }

      const orders = groupOrders(rows);
      if (req.headers.accept && req.headers.accept.includes('application/json')) return res.json({ orders });
      return res.render('orders', { orders, user: req.session.user });
    });
  },

  // Admin: list all orders with optional filters
  listAllOrders: (req, res) => {
    // filters: status, startDate, endDate, customer
    const { status, startDate, endDate, customer } = req.query || {};
    const params = [];
    let where = 'WHERE 1=1';
    if (status) {
      where += ' AND o.status = ?';
      params.push(status);
    }
    // Normalize date filters to include full days.
    // When users pick a date (YYYY-MM-DD), we want the filter to include the
    // entire day from 00:00:00 through 23:59:59. Also handle the normal case
    // where start/end are different dates.
    if (startDate) {
      const startParam = startDate.length === 10 ? `${startDate} 00:00:00` : startDate;
      where += ' AND o.order_date >= ?';
      params.push(startParam);
    }
    if (endDate) {
      const endParam = endDate.length === 10 ? `${endDate} 23:59:59` : endDate;
      where += ' AND o.order_date <= ?';
      params.push(endParam);
    }
    if (customer) {
      where += ' AND (u.username LIKE ? OR u.email LIKE ?)';
      params.push('%' + customer + '%', '%' + customer + '%');
    }

    const sql = `SELECT o.order_id AS id, o.total_amount, o.order_date, o.status, u.id AS user_id, u.username, u.email, u.address,
                 oi.item_id AS order_item_id, oi.product_id, oi.quantity, oi.price_at_time_of_purchase AS price, p.productName
                 FROM orders o
                 LEFT JOIN users u ON u.id = o.user_id
                 LEFT JOIN order_items oi ON oi.order_id = o.order_id
                 LEFT JOIN products p ON p.id = oi.product_id
                 ${where}
                 ORDER BY o.order_date DESC, o.order_id DESC`;

    db.query(sql, params, (err, rows) => {
      if (err) {
        console.error('Error fetching all orders:', err);
        if (req.headers.accept && req.headers.accept.includes('application/json')) return res.status(500).json({ error: 'Unable to load orders' });
        req.flash('error', 'Unable to load orders');
        return res.redirect('/inventory');
      }
      const orders = groupOrders(rows);
      if (req.headers.accept && req.headers.accept.includes('application/json')) return res.json({ orders });
      return res.render('adminOrders', { orders, user: req.session.user, filters: { status, startDate, endDate, customer } });
    });
  },

  // Admin: update order status
  updateOrderStatus: (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    const { status } = req.body;
    if (!orderId || !status) {
      req.flash('error', 'Invalid request');
      return res.redirect('/admin/orders');
    }
    db.query('UPDATE orders SET status = ? WHERE order_id = ?', [status, orderId], (err) => {
      if (err) {
        console.error('Error updating order status:', err);
        req.flash('error', 'Unable to update status');
        return res.redirect('/admin/orders');
      }
      req.flash('success', 'Order status updated');
      return res.redirect('/admin/orders');
    });
  },

  // Admin: cancel an order (set status to 'cancelled')
  cancelOrder: (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    if (!orderId) {
      req.flash('error', 'Invalid request');
      return res.redirect('/admin/orders');
    }
    db.query('UPDATE orders SET status = ? WHERE order_id = ?', ['cancelled', orderId], (err) => {
      if (err) {
        console.error('Error cancelling order:', err);
        req.flash('error', 'Unable to cancel order');
        return res.redirect('/admin/orders');
      }
      req.flash('success', 'Order cancelled');
      return res.redirect('/admin/orders');
    });
  },

  // Admin: return customer details as JSON
  getCustomerDetails: (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (!userId) return res.status(400).json({ error: 'Invalid user id' });
    db.query('SELECT id, username, email, address, contact, role FROM users WHERE id = ?', [userId], (err, rows) => {
      if (err) {
        console.error('Error fetching customer details:', err);
        return res.status(500).json({ error: 'Unable to fetch customer details' });
      }
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'User not found' });
      return res.json({ customer: rows[0] });
    });
  }
,

  // View single order (ensure ownership)
  getOrderById: (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    const userId = req.session.user && req.session.user.id;
    if (!userId) return res.redirect('/login');

    const sql = `SELECT o.order_id AS id, o.total_amount, o.order_date, oi.item_id AS order_item_id, oi.product_id, oi.quantity, oi.price_at_time_of_purchase AS price, p.productName
           FROM orders o
           LEFT JOIN order_items oi ON oi.order_id = o.order_id
           LEFT JOIN products p ON p.id = oi.product_id
           WHERE o.order_id = ? AND o.user_id = ?`;

    db.query(sql, [orderId, userId], (err, rows) => {
      if (err) {
        console.error('Error fetching order:', err);
        req.flash('error', 'Unable to load order');
        return res.redirect('/orders');
      }
      if (!rows || rows.length === 0) {
        req.flash('error', 'Order not found');
        return res.redirect('/orders');
      }
      const orders = groupOrders(rows);
      const order = orders[0];
      return res.render('order', { order, user: req.session.user });
    });
  }
};

module.exports = OrdersControllers;
