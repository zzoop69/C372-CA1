const Student = require('../models/Student');

module.exports = {
    // List all students -> render index.ejs
    listStudents(req, res) {
        const listFn = Student.list || Student.getAll || Student.findAll || Student.find || Student.listAll;
        if (typeof listFn !== 'function') return res.status(500).type('text/plain').send('No list method on Student model');
        listFn.call(Student, (err, students) => {
            if (err) return res.status(500).type('text/plain').send(err?.message || 'Failed to list students');
            return res.render('index', { students: students || [] });
        });
    },

    // Get a student by ID -> render student.ejs or editStudent.ejs when editing
    getStudentById(req, res) {
        const { id } = req.params;
        if (!id) return res.status(400).type('text/plain').send('Missing id');
        const getFn = Student.getById || Student.findById || Student.get || Student.findOne;
        if (typeof getFn !== 'function') return res.status(500).type('text/plain').send('No getById method on Student model');

        getFn.call(Student, id, (err, student) => {
            if (err) return res.status(500).type('text/plain').send(err?.message || 'Failed to get student');
            if (!student) return res.status(404).type('text/plain').send('Student not found.');

            // normalize id field names for templates
            student.studentId = student.studentId || student.id || student.student_id || id;

            // If the route is the edit route, render the edit view
            if (req.originalUrl && req.originalUrl.includes('/editStudent')) {
                return res.render('editStudent', { student });
            }

            // Default: render student detail view
            return res.render('student', { student });
        });
    },

    // Add a new student -> handle multipart (req.file) and redirect to list
    addStudent(req, res) {
        const student = {
            name: req.body.name || null,
            dob: req.body.dob || null,
            contact: req.body.contact || null,
            image: req.file ? req.file.filename : (req.body.image || null)
        };

        const addFn = Student.add || Student.create || Student.insert;
        if (typeof addFn !== 'function') return res.status(500).type('text/plain').send('No add/create method on Student model');

        addFn.call(Student, student, (err /*, created */) => {
            if (err) return res.status(500).type('text/plain').send(err?.message || 'Failed to add student');
            return res.redirect('/');
        });
    },

    // Update an existing student -> handle multipart and redirect to student page
    updateStudent(req, res) {
        const { id } = req.params;
        if (!id) return res.status(400).type('text/plain').send('Missing id');
        const student = {
            name: req.body.name || null,
            dob: req.body.dob || null,
            contact: req.body.contact || null,
            image: req.file ? req.file.filename : (req.body.currentImage || null)
        };

        const updateFn = Student.update || Student.updateById || Student.findByIdAndUpdate || Student.edit;
        if (typeof updateFn !== 'function') return res.status(500).type('text/plain').send('No update method on Student model');

        // Call as (id, payload, cb)
        updateFn.call(Student, id, student, (err, result) => {
            if (err) return res.status(500).type('text/plain').send(err?.message || 'Failed to update student');

            // Common response shapes:
            // - null => not found
            // - object with affectedRows property => check affectedRows
            // - returned updated row/object => treat as success
            if (result == null) return res.status(404).type('text/plain').send('Student not found.');
            if (typeof result === 'object' && 'affectedRows' in result && result.affectedRows === 0) {
                return res.status(404).type('text/plain').send('Student not found.');
            }

            return res.redirect(`/student/${id}`);
        });
    },

    // Delete a student -> redirect to list
    deleteStudent(req, res) {
        const { id } = req.params;
        if (!id) return res.status(400).type('text/plain').send('Missing id');

        const delFn = Student.delete || Student.deleteById || Student.remove || Student.findByIdAndDelete;
        if (typeof delFn !== 'function') return res.status(500).type('text/plain').send('No delete method on Student model');

        delFn.call(Student, id, (err, result) => {
            if (err) {
                console.error('Delete error:', err);
                return res.status(500).type('text/plain').send(err?.message || 'Failed to delete student');
            }

            // result shapes:
            // - null -> not found
            // - deleted row object -> success
            // - result object with affectedRows -> check it
            if (result == null) return res.status(404).type('text/plain').send('Student not found.');
            if (typeof result === 'object' && 'affectedRows' in result && result.affectedRows === 0) {
                return res.status(404).type('text/plain').send('Student not found.');
            }

            return res.redirect('/');
        });
    }
};