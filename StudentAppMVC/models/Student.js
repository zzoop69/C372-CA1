const db = require('../db');

module.exports = {
    // Get all students
    list(callback) {
        const sql = 'SELECT * FROM students';
        db.query(sql, (err, results) => {
            if (err) return callback(err);
            return callback(null, results);
        });
    },

    // Get a student by ID
    getById(studentId, callback) {
        const sql = 'SELECT * FROM students WHERE studentId = ? LIMIT 1';
        db.query(sql, [studentId], (err, results) => {
            if (err) return callback(err);
            return callback(null, results.length ? results[0] : null);
        });
    },

    // Add a new student
    add(student, callback) {
        const sql = 'INSERT INTO students (name, dob, contact, image) VALUES (?, ?, ?, ?)';
        const params = [
            student.name || null,
            student.dob || null,
            student.contact || null,
            student.image || null
        ];
        db.query(sql, params, (err, result) => {
            if (err) return callback(err);
            // return the inserted id and provided data
            return callback(null, { insertId: result.insertId, ...student });
        });
    },

    // Update an existing student
    update(studentId, student, callback) {
        const sql = 'UPDATE students SET name = ?, dob = ?, contact = ?, image = ? WHERE studentId = ?';
        const params = [
            student.name || null,
            student.dob || null,
            student.contact || null,
            student.image || null,
            studentId
        ];
        db.query(sql, params, (err, result) => {
            if (err) return callback(err);
            return callback(null, { affectedRows: result.affectedRows });
        });
    },

    // Delete a student
    delete(studentId, callback) {
        const sql = 'DELETE FROM students WHERE studentId = ?';
        db.query(sql, [studentId], (err, result) => {
            if (err) return callback(err);
            return callback(null, { affectedRows: result.affectedRows });
        });
    }
};