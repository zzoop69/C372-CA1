const db = require('../db');

/**
 * Transaction model helpers for `transactions` table.
 */

function create(data, cb) {
  const time = data.time || new Date();
  const sql = `INSERT INTO transactions (processor, transaction_id, payment_method, amount, currency, status, user_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    data.processor,
    data.transactionId,
    data.paymentMethod,
    data.amount,
    data.currency,
    data.status,
    data.userId,
    time
  ];

  db.query(sql, params, (err, res) => {
    if (err) {
      if (cb) return cb(err);
      console.error('Error recording transaction:', err);
      return;
    }
    if (cb) return cb(null, res);
  });
}

module.exports = { create };
