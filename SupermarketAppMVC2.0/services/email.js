const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const db = require('../db');

async function createTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: (process.env.SMTP_SECURE === 'true') || false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  // Fallback: use a JSON transport that prints message to console (useful for development)
  return nodemailer.createTransport({ jsonTransport: true });
}

async function fetchOrder(orderId, userId) {
  const sql = `SELECT o.order_id AS id, o.total_amount, o.order_date, o.status, oi.item_id AS order_item_id, oi.product_id, oi.quantity, oi.price_at_time_of_purchase AS price, p.productName
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.order_id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.order_id = ?`;
  return new Promise((resolve, reject) => {
    db.query(sql, [orderId], (err, rows) => {
      if (err) return reject(err);
      if (!rows || rows.length === 0) return resolve(null);
      const order = { id: rows[0].id, total_amount: rows[0].total_amount, order_date: rows[0].order_date, items: [] };
      rows.forEach(r => {
        if (r.order_item_id) order.items.push({ product_id: r.product_id, productName: r.productName, quantity: r.quantity, price: r.price });
      });
      resolve(order);
    });
  });
}

async function sendInvoice(orderId, user) {
  if (!user || !user.email) {
    throw new Error('No recipient email provided');
  }

  const order = await fetchOrder(orderId, user.id).catch(e => { throw e; });
  if (!order) throw new Error('Order not found');

  const invoicePath = path.resolve(__dirname, '..', 'views', 'invoice.ejs');
  const html = await ejs.renderFile(invoicePath, { order, user });

  const transporter = await createTransporter();
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'no-reply@supermarket.local',
    to: user.email,
    subject: `Your SuperMarket Order #${order.id} - Invoice`,
    html,
    text: `Thank you for your purchase. Your order #${order.id} totaling $${Number(order.total_amount).toFixed(2)} is confirmed. Visit your orders page to view details.`
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendInvoice };
