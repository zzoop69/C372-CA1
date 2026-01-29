const db = require('../db');

const Products = {
  // Get all products
  // callback(err, resultsArray)
  getAll(callback) {
    const sql = 'SELECT id, productName, quantity, price, image FROM products';
    db.query(sql, (err, results) => {
      if (err) return callback(err);
      return callback(null, results);
    });
  },

  // Get all products filtered by a search term in productName
  // callback(err, resultsArray)
  getAllFiltered(search, callback) {
    const sql = 'SELECT id, productName, quantity, price, image FROM products WHERE productName LIKE ?';
    const term = `%${search}%`;
    db.query(sql, [term], (err, results) => {
      if (err) return callback(err);
      return callback(null, results);
    });
  },

  // Get a single product by id
  // callback(err, productObject|null)
  getById(id, callback) {
    const sql = 'SELECT id, productName, quantity, price, image FROM products WHERE id = ? LIMIT 1';
    db.query(sql, [id], (err, results) => {
      if (err) return callback(err);
      return callback(null, results[0] || null);
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