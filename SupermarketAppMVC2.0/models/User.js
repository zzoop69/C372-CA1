const db = require('../db');

// Lightweight User model helpers used by controllers. These are additive
// and don't change existing controller behavior which currently uses raw SQL.

function getById(id, cb) {
	db.query('SELECT id, username, email, address, contact, role FROM users WHERE id = ?', [id], (err, rows) => {
		if (err) return cb(err);
		if (!rows || rows.length === 0) return cb(null, null);
		return cb(null, rows[0]);
	});
}

function getByEmail(email, cb) {
	db.query('SELECT id, username, email, address, contact, role FROM users WHERE email = ?', [email], (err, rows) => {
		if (err) return cb(err);
		if (!rows || rows.length === 0) return cb(null, null);
		return cb(null, rows[0]);
	});
}

function create(userData, cb) {
	const { username, email, password, address, contact, role } = userData;
	const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
	db.query(sql, [username, email, password, address, contact, role], (err, res) => {
		if (err) return cb(err);
		return cb(null, { id: res.insertId });
	});
}

function update(id, fields, cb) {
	const sets = [];
	const params = [];
	if (fields.username) { sets.push('username = ?'); params.push(fields.username); }
	if (fields.email) { sets.push('email = ?'); params.push(fields.email); }
	if (fields.address) { sets.push('address = ?'); params.push(fields.address); }
	if (fields.contact) { sets.push('contact = ?'); params.push(fields.contact); }
	if (fields.role) { sets.push('role = ?'); params.push(fields.role); }
	if (fields.password) { sets.push('password = SHA1(?)'); params.push(fields.password); }
	if (sets.length === 0) return cb(null, { affectedRows: 0 });
	params.push(id);
	const sql = `UPDATE users SET ${sets.join(', ')} WHERE id = ?`;
	db.query(sql, params, (err, res) => cb(err, res));
}

module.exports = { getById, getByEmail, create, update };

