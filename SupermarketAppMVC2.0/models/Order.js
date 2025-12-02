const db = require('../db');

/**
 * Order model helpers — lightweight wrapper around DB operations used by controllers.
 * This file is additive: controllers currently use raw queries, but these helpers
 * provide a single place to put order-related queries for future refactor.
 */

function createOrder(userId, totalAmount, items, cb) {
  // items: [{ product_id, quantity, price }]
  db.beginTransaction(err => {
    if (err) return cb(err);

    db.query('INSERT INTO orders (user_id, total_amount, order_date, status) VALUES (?, ?, NOW(), ?)', [userId, totalAmount, 'completed'], (oErr, oRes) => {
      if (oErr) return db.rollback(() => cb(oErr));
      const orderId = oRes.insertId;
      if (!items || items.length === 0) {
        return db.commit(commitErr => {
          if (commitErr) return db.rollback(() => cb(commitErr));
          return cb(null, { orderId });
        });
      }

      const values = items.map(it => [orderId, it.product_id, it.quantity, it.price]);
      db.query('INSERT INTO order_items (order_id, product_id, quantity, price_at_time_of_purchase) VALUES ?', [values], (oiErr) => {
        if (oiErr) return db.rollback(() => cb(oiErr));
        db.commit(commitErr => {
          if (commitErr) return db.rollback(() => cb(commitErr));
          return cb(null, { orderId });
        });
      });
    });
  });
}

function getOrderById(orderId, cb) {
  const sql = `SELECT o.order_id AS id, o.total_amount, o.order_date, o.status, o.user_id,
    oi.item_id AS order_item_id, oi.product_id, oi.quantity, oi.price_at_time_of_purchase AS price, p.productName
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.order_id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.order_id = ?`;
  db.query(sql, [orderId], (err, rows) => {
    if (err) return cb(err);
    if (!rows || rows.length === 0) return cb(null, null);
    // group items
    const order = {
      id: rows[0].id,
      total_amount: rows[0].total_amount,
      order_date: rows[0].order_date,
      status: rows[0].status,
      user_id: rows[0].user_id,
      items: []
    };
    rows.forEach(r => {
      if (r.order_item_id) order.items.push({ product_id: r.product_id, productName: r.productName, quantity: r.quantity, price: r.price });
    });
    return cb(null, order);
  });
}

function listOrdersByUser(userId, cb) {
  const sql = `SELECT o.order_id AS id, o.total_amount, o.order_date, oi.item_id AS order_item_id, oi.product_id, oi.quantity, oi.price_at_time_of_purchase AS price, p.productName
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.order_id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.user_id = ?
    ORDER BY o.order_date DESC, o.order_id DESC`;
  db.query(sql, [userId], (err, rows) => {
    if (err) return cb(err);
    const map = new Map();
    rows.forEach(r => {
      if (!map.has(r.id)) map.set(r.id, { id: r.id, total_amount: r.total_amount, order_date: r.order_date, items: [] });
      if (r.order_item_id) map.get(r.id).items.push({ product_id: r.product_id, productName: r.productName, quantity: r.quantity, price: r.price });
    });
    return cb(null, Array.from(map.values()));
  });
}

function listAllOrders(filters, cb) {
  // filters: { status, startDate, endDate, customer }
  const { status, startDate, endDate, customer } = filters || {};
  const params = [];
  let where = 'WHERE 1=1';
  if (status) { where += ' AND o.status = ?'; params.push(status); }
  if (startDate) { where += ' AND o.order_date >= ?'; params.push(startDate); }
  if (endDate) { where += ' AND o.order_date <= ?'; params.push(endDate); }
  if (customer) { where += ' AND (u.username LIKE ? OR u.email LIKE ?)'; params.push('%' + customer + '%', '%' + customer + '%'); }

  const sql = `SELECT o.order_id AS id, o.total_amount, o.order_date, o.status, u.id AS user_id, u.username, u.email, u.address,
    oi.item_id AS order_item_id, oi.product_id, oi.quantity, oi.price_at_time_of_purchase AS price, p.productName
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN order_items oi ON oi.order_id = o.order_id
    LEFT JOIN products p ON p.id = oi.product_id
    ${where}
    ORDER BY o.order_date DESC, o.order_id DESC`;
  db.query(sql, params, (err, rows) => {
    if (err) return cb(err);
    const map = new Map();
    rows.forEach(r => {
      if (!map.has(r.id)) map.set(r.id, { id: r.id, total_amount: r.total_amount, order_date: r.order_date, status: r.status, user_id: r.user_id, customerName: r.username, customerEmail: r.email, shippingAddress: r.address, items: [] });
      if (r.order_item_id) map.get(r.id).items.push({ product_id: r.product_id, productName: r.productName, quantity: r.quantity, price: r.price });
    });
    return cb(null, Array.from(map.values()));
  });
}

function updateOrderStatus(orderId, status, cb) {
  db.query('UPDATE orders SET status = ? WHERE order_id = ?', [status, orderId], (err, res) => cb(err, res));
}

module.exports = {
  createOrder,
  getOrderById,
  listOrdersByUser,
  listAllOrders,
  updateOrderStatus
};
