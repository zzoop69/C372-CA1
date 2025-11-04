// ...existing code...
const db = require('../db');

const Users = {
    // Get all users
    getAll(callback) {
        const sql = 'SELECT * FROM users';
        db.query(sql, (err, rows) => {
            if (err) return callback(err);
            return callback(null, rows);
        });
    },

    // Aliases
    findAll(callback) { return Users.getAll(callback); },
    listAll(callback) { return Users.getAll(callback); },
    list(callback) { return Users.getAll(callback); },
    find(callback) { return Users.getAll(callback); },

    // Get user by id
    getById(id, callback) {
        const sql = 'SELECT * FROM users WHERE id = ? LIMIT 1';
        db.query(sql, [id], (err, rows) => {
            if (err) return callback(err);
            return callback(null, rows[0] || null);
        });
    },

    // Aliases
    findById(id, callback) { return Users.getById(id, callback); },
    findOne(id, callback) { return Users.getById(id, callback); },
    get(id, callback) { return Users.getById(id, callback); },

    // Create a new user. payload: { username, password, address, contact, image }
    create(payload, callback) {
        const sql = 'INSERT INTO users (username, password, address, contact, image) VALUES (?, ?, ?, ?, ?)';
        const params = [
            payload.username || null,
            payload.password || null,
            payload.address || null,
            payload.contact != null ? payload.contact : null,
            payload.image || null
        ];
        db.query(sql, params, (err, result) => {
            if (err) return callback(err);
            const insertId = result.insertId;
            return Users.getById(insertId, callback);
        });
    },

    // Aliases
    add(payload, callback) { return Users.create(payload, callback); },
    insert(payload, callback) { return Users.create(payload, callback); },

    // Update user by id. payload may contain username, password, address, contact, image
    updateById(id, payload, callback) {
        const fields = [];
        const values = [];

        if (payload.username !== undefined) { fields.push('username = ?'); values.push(payload.username); }
        if (payload.password !== undefined) { fields.push('password = ?'); values.push(payload.password); }
        if (payload.address !== undefined) { fields.push('address = ?'); values.push(payload.address); }
        if (payload.contact !== undefined) { fields.push('contact = ?'); values.push(payload.contact); }
        if (payload.image !== undefined) { fields.push('image = ?'); values.push(payload.image); }

        if (fields.length === 0) {
            return callback(new Error('No fields to update'));
        }

        const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
        values.push(id);

        db.query(sql, values, (err, result) => {
            if (err) return callback(err);
            if (result.affectedRows === 0) return callback(null, null);
            return Users.getById(id, callback);
        });
    },

    // Aliases
    update(id, payload, callback) { return Users.updateById(id, payload, callback); },
    edit(id, payload, callback) { return Users.updateById(id, payload, callback); },
    findByIdAndUpdate(id, payload, callback) { return Users.updateById(id, payload, callback); },

    // Delete user by id. Returns deleted row or null if not found
    deleteById(id, callback) {
        Users.getById(id, (err, row) => {
            if (err) return callback(err);
            if (!row) return callback(null, null);
            const sql = 'DELETE FROM users WHERE id = ?';
            db.query(sql, [id], (delErr) => {
                if (delErr) return callback(delErr);
                return callback(null, row);
            });
        });
    },

    // Aliases
    remove(id, callback) { return Users.deleteById(id, callback); },
    delete(id, callback) { return Users.deleteById(id, callback); },
    findByIdAndDelete(id, callback) { return Users.deleteById(id, callback); }
};

module.exports = Users;
// ...existing code...