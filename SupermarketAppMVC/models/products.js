const db = require('../db');

const Products = {
    // Get all products
    getAll(callback) {
        const sql = 'SELECT * FROM products';
        db.query(sql, (err, rows) => {
            if (err) return callback(err);
            return callback(null, rows);
        });
    },

    // Compatibility aliases
    findAll(callback) { return Products.getAll(callback); },
    listAll(callback) { return Products.getAll(callback); },
    list(callback) { return Products.getAll(callback); },
    find(callback) { return Products.getAll(callback); },

    // Get product by id
    getById(id, callback) {
        const sql = 'SELECT * FROM products WHERE id = ? LIMIT 1';
        db.query(sql, [id], (err, rows) => {
            if (err) return callback(err);
            return callback(null, rows[0] || null);
        });
    },

    // Aliases
    findById(id, callback) { return Products.getById(id, callback); },
    findOne(id, callback) { return Products.getById(id, callback); },
    get(id, callback) { return Products.getById(id, callback); },

    // Create a new product. payload: { productName, quantity, price, image }
    create(payload, callback) {
        const sql = 'INSERT INTO products (productName, quantity, price, image) VALUES (?, ?, ?, ?)';
        const params = [
            payload.productName || null,
            payload.quantity != null ? payload.quantity : null,
            payload.price != null ? payload.price : null,
            payload.image || null
        ];
        db.query(sql, params, (err, result) => {
            if (err) return callback(err);
            const insertId = result.insertId;
            return Products.getById(insertId, callback);
        });
    },

    // Aliases
    add(payload, callback) { return Products.create(payload, callback); },
    insert(payload, callback) { return Products.create(payload, callback); },

    // Update product by id. payload may contain productName, quantity, price, image
    updateById(id, payload, callback) {
        const fields = [];
        const values = [];

        if (payload.productName !== undefined) { fields.push('productName = ?'); values.push(payload.productName); }
        if (payload.quantity !== undefined) { fields.push('quantity = ?'); values.push(payload.quantity); }
        if (payload.price !== undefined) { fields.push('price = ?'); values.push(payload.price); }
        if (payload.image !== undefined) { fields.push('image = ?'); values.push(payload.image); }

        if (fields.length === 0) {
            return callback(new Error('No fields to update'));
        }

        const sql = `UPDATE products SET ${fields.join(', ')} WHERE id = ?`;
        values.push(id);

        db.query(sql, values, (err, result) => {
            if (err) return callback(err);
            if (result.affectedRows === 0) return callback(null, null);
            return Products.getById(id, callback);
        });
    },

    // Aliases
    update(id, payload, callback) { return Products.updateById(id, payload, callback); },
    edit(id, payload, callback) { return Products.updateById(id, payload, callback); },
    findByIdAndUpdate(id, payload, callback) { return Products.updateById(id, payload, callback); },

    // Delete product by id. Returns deleted row or null if not found
    deleteById(id, callback) {
        Products.getById(id, (err, row) => {
            if (err) return callback(err);
            if (!row) return callback(null, null);
            const sql = 'DELETE FROM products WHERE id = ?';
            db.query(sql, [id], (delErr) => {
                if (delErr) return callback(delErr);
                return callback(null, row);
            });
        });
    },

    // Aliases
    remove(id, callback) { return Products.deleteById(id, callback); },
    delete(id, callback) { return Products.deleteById(id, callback); },
    findByIdAndDelete(id, callback) { return Products.deleteById(id, callback); }
};

module.exports = Products;