const Products = require('../models/products');

/**
 * Helper to find the first available model method from a list of common names.
 * Returns the function or throws if none found.
 */
function findModelMethod(names) {
    for (const n of names) {
        if (typeof Products[n] === 'function') return Products[n];
    }
    throw new Error(`No supported model method found among: ${names.join(', ')}`);
}

const SupermarketController = {
    // List all products
    listAll(req, res) {
        try {
            const fn = findModelMethod(['getAll', 'findAll', 'listAll', 'list', 'find']);
            fn((err, items) => {
                if (err) return res.status(500).json({ error: err.message || err });
                return res.status(200).json(items);
            });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    // Get a product by ID (req.params.id)
    getById(req, res) {
        const id = req.params && req.params.id;
        if (!id) return res.status(400).json({ error: 'Missing id parameter' });

        try {
            const fn = findModelMethod(['getById', 'findById', 'findOne', 'get']);
            fn(id, (err, item) => {
                if (err) return res.status(500).json({ error: err.message || err });
                if (!item) return res.status(404).json({ error: 'Product not found' });
                return res.status(200).json(item);
            });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    // Add a new product (req.body)
    add(req, res) {
        const payload = req.body;
        if (!payload || Object.keys(payload).length === 0) {
            return res.status(400).json({ error: 'Missing request body' });
        }

        try {
            const fn = findModelMethod(['create', 'add', 'insert', 'addItem']);
            fn(payload, (err, created) => {
                if (err) return res.status(500).json({ error: err.message || err });
                return res.status(201).json(created);
            });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    // Update a product by ID (req.params.id, req.body)
    update(req, res) {
        const id = req.params && req.params.id;
        const payload = req.body;
        if (!id) return res.status(400).json({ error: 'Missing id parameter' });
        if (!payload || Object.keys(payload).length === 0) {
            return res.status(400).json({ error: 'Missing request body' });
        }

        try {
            const fn = findModelMethod(['updateById', 'update', 'findByIdAndUpdate', 'edit']);
            fn(id, payload, (err, updated) => {
                if (err) return res.status(500).json({ error: err.message || err });
                if (!updated) return res.status(404).json({ error: 'Product not found or not updated' });
                return res.status(200).json(updated);
            });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    // Delete a product by ID (req.params.id)
    delete(req, res) {
        const id = req.params && req.params.id;
        if (!id) return res.status(400).json({ error: 'Missing id parameter' });

        try {
            const fn = findModelMethod(['deleteById', 'remove', 'delete', 'findByIdAndDelete']);
            fn(id, (err, result) => {
                if (err) return res.status(500).json({ error: err.message || err });
                if (result === null || result === false) return res.status(404).json({ error: 'Product not found' });
                return res.status(200).json({ success: true, result });
            });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
};

module.exports = SupermarketController;