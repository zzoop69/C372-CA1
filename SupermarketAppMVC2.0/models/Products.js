const db = require('../db');

const Products = {
  // Get all products
  // callback(err, resultsArray)
  getAll(callback) {
    const sql = `SELECT p.id, p.productName, p.quantity, p.price, p.image,
                        ROUND(AVG(r.rating),2) AS avg_rating,
                        COALESCE((SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.product_id = p.id), 0) AS total_sold
                 FROM products p
                 LEFT JOIN reviews r ON r.product_id = p.id
                 GROUP BY p.id, p.productName, p.quantity, p.price, p.image`;
    db.query(sql, (err, results) => {
      if (err) return callback(err);
      return callback(null, results.map(r => ({
        id: r.id,
        productName: r.productName,
        quantity: r.quantity,
        price: r.price,
        image: r.image,
        avg_rating: r.avg_rating !== null ? Number(r.avg_rating) : 0,
        total_sold: Number(r.total_sold || 0)
      })));
    });
  },

  // Get all products filtered by a search term in productName
  // callback(err, resultsArray)
  getAllFiltered(search, callback) {
    const sql = `SELECT p.id, p.productName, p.quantity, p.price, p.image,
                        ROUND(AVG(r.rating),2) AS avg_rating,
                        COALESCE((SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.product_id = p.id), 0) AS total_sold
                 FROM products p
                 LEFT JOIN reviews r ON r.product_id = p.id
                 WHERE p.productName LIKE ?
                 GROUP BY p.id, p.productName, p.quantity, p.price, p.image`;
    const term = `%${search}%`;
    db.query(sql, [term], (err, results) => {
      if (err) return callback(err);
      return callback(null, results.map(r => ({
        id: r.id,
        productName: r.productName,
        quantity: r.quantity,
        price: r.price,
        image: r.image,
        avg_rating: r.avg_rating !== null ? Number(r.avg_rating) : 0,
        total_sold: Number(r.total_sold || 0)
      })));
    });
  },

  // Get a single product by id
  // callback(err, productObject|null)
  getById(id, callback) {
    const sql = `SELECT p.id, p.productName, p.quantity, p.price, p.image,
                        ROUND(AVG(r.rating),2) AS avg_rating,
                        COALESCE((SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.product_id = p.id), 0) AS total_sold
                 FROM products p
                 LEFT JOIN reviews r ON r.product_id = p.id
                 WHERE p.id = ?
                 GROUP BY p.id, p.productName, p.quantity, p.price, p.image
                 LIMIT 1`;
    db.query(sql, [id], (err, results) => {
      if (err) return callback(err);
      const r = results && results[0];
      if (!r) return callback(null, null);
      return callback(null, {
        id: r.id,
        productName: r.productName,
        quantity: r.quantity,
        price: r.price,
        image: r.image,
        avg_rating: r.avg_rating !== null ? Number(r.avg_rating) : 0,
        total_sold: Number(r.total_sold || 0)
      });
    });
  },

  // Create a new product
  // productData: { productName, quantity, price, image }
  // callback(err, createdRecord)
  create(productData, callback) {
    const sql = 'INSERT INTO products (productName, quantity, price, image) VALUES (?, ?, ?, ?)';
    const params = [
      productData.productName,
      productData.quantity,
      productData.price,
      productData.image || null
    ];
    db.query(sql, params, (err, result) => {
      if (err) return callback(err);
      return callback(null, { id: result.insertId, ...productData });
    });
  },

  // Update an existing product by id
  // productData: { productName, quantity, price, image }
  // callback(err, result)
  update(id, productData, callback) {
    const sql = 'UPDATE products SET productName = ?, quantity = ?, price = ?, image = ? WHERE id = ?';
    const params = [
      productData.productName,
      productData.quantity,
      productData.price,
      productData.image || null,
      id
    ];
    db.query(sql, params, (err, result) => {
      if (err) return callback(err);
      return callback(null, result);
    });
  },

  // Delete a product by id
  // callback(err, result)
  delete(id, callback) {
    const sql = 'DELETE FROM products WHERE id = ?';
    db.query(sql, [id], (err, result) => {
      if (err) return callback(err);
      return callback(null, result);
    });
  }
};

module.exports = Products;