const Products = require('../models/Products');

const ProductsController = {
  // List all products
  listAll(req, res) {
    const q = req.query.q || req.query.search || '';
    const cb = (err, products) => {
      if (err) {
        console.error('Error fetching products:', err);
        return res.status(500).send('Failed to fetch products');
      }
      if (req.headers.accept && req.headers.accept.includes('text/html')) {
        // render admin inventory for admins, shopping view for regular users
        const renderData = {
          products,
          user: req.session && req.session.user,
          cart: req.session && req.session.cart ? req.session.cart : [],
          searchQuery: q,
          messages: req.flash('success'),
          errors: req.flash('error')
        };
        if (req.session && req.session.user && req.session.user.role === 'admin') {
          return res.render('inventory', renderData);
        }
        return res.render('shopping', renderData);
      }
      return res.json(products);
    };

    if (q && q.trim().length > 0) {
      return Products.getAllFiltered(q.trim(), cb);
    }
    return Products.getAll(cb);
  },

  // Get a single product by id
  getById(req, res) {
    const id = req.params.id;
    Products.getById(id, (err, product) => {
      if (err) {
        console.error('Error fetching product:', err);
        return res.status(500).send('Failed to fetch product');
      }
      if (!product) return res.status(404).send('Product not found');

      if (req.headers.accept && req.headers.accept.includes('text/html')) {
        return res.render('product', { product, user: req.session && req.session.user, cart: req.session && req.session.cart ? req.session.cart : [] });
      }
      return res.json(product);
    });
  },

  // Render edit form for a product (admin)
  renderEdit(req, res) {
    const id = req.params.id;
    Products.getById(id, (err, product) => {
      if (err) {
        console.error('Error fetching product for edit:', err);
        return res.status(500).send('Failed to fetch product');
      }
      if (!product) return res.status(404).send('Product not found');

      return res.render('updateProduct', { product, user: req.session && req.session.user, cart: req.session && req.session.cart ? req.session.cart : [] });
    });
  },

  // Add a new product (expects form fields: name, quantity, price and optional file upload req.file)
  add(req, res) {
    const { name, quantity, price } = req.body;
    const image = req.file ? req.file.filename : null;

    const productData = {
      productName: name,
      quantity: parseInt(quantity, 10) || 0,
      price: parseFloat(price) || 0,
      image
    };

    Products.create(productData, (err, created) => {
      if (err) {
        console.error('Error creating product:', err);
        return res.status(500).send('Failed to create product');
      }
      // after creating, redirect to inventory (admin area)
      return res.redirect('/inventory');
    });
  },

  // Update an existing product (expects params.id, form fields and optional req.file)
  update(req, res) {
    const id = req.params.id;
    const { name, quantity, price, currentImage } = req.body;
    const image = req.file ? req.file.filename : currentImage || null;

    const productData = {
      productName: name,
      quantity: parseInt(quantity, 10) || 0,
      price: parseFloat(price) || 0,
      image
    };

    Products.update(id, productData, (err, result) => {
      if (err) {
        console.error('Error updating product:', err);
        return res.status(500).send('Failed to update product');
      }
      return res.redirect('/inventory');
    });
  },

  // Delete a product by id
  remove(req, res) {
    const id = req.params.id;
    Products.delete(id, (err, result) => {
      if (err) {
        console.error('Error deleting product:', err);
        return res.status(500).send('Failed to delete product');
      }
      return res.redirect('/inventory');
    });
  }
};

module.exports = ProductsController;