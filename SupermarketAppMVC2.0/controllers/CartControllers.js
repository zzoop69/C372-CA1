const db = require('../db');

function cartTotal(cart) {
  return (cart || []).reduce((s, it) => s + (it.price * it.quantity), 0);
}

const CartControllers = {
  // Render cart page
  viewCart(req, res) {
    const cart = req.session.cart || [];
    return res.render('cart', { cart, user: req.session.user });
  },

  // Add to cart (session-backed). Returns JSON for AJAX (Accept: application/json)
  addToCart(req, res) {
    const productId = parseInt(req.params.id, 10);
    const quantity = parseInt(req.body.quantity, 10) || 1;

    db.query('SELECT * FROM products WHERE id = ?', [productId], (error, results) => {
      if (error) return res.status(500).send('Server error');
      if (!results || results.length === 0) {
        if (req.headers.accept && req.headers.accept.includes('application/json')) return res.status(404).json({ error: 'Product not found' });
        req.flash('error', 'Product not found');
        return res.redirect('/shopping');
      }

      const product = results[0];
      if (quantity > product.quantity) {
        if (req.headers.accept && req.headers.accept.includes('application/json')) return res.status(400).json({ error: 'Not enough stock', available: product.quantity });
        req.flash('error', 'Not enough stock for that product');
        return res.redirect('/shopping');
      }

      if (!req.session.cart) req.session.cart = [];
      const existing = req.session.cart.find(i => i.id === productId);
      if (existing) {
        const newQty = existing.quantity + quantity;
        if (newQty > product.quantity) {
          if (req.headers.accept && req.headers.accept.includes('application/json')) return res.status(400).json({ error: 'Not enough stock', available: product.quantity });
          req.flash('error', 'Not enough stock for that product');
          return res.redirect('/shopping');
        }
        existing.quantity = newQty;
      } else {
        req.session.cart.push({ id: product.id, productName: product.productName, price: product.price, quantity, image: product.image });
      }

      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json({ message: 'Added to cart', cart: req.session.cart, cartTotal: cartTotal(req.session.cart) });
      }
      return res.redirect('/shopping');
    });
  },

  // Increase quantity (by 1) with DB stock check
  increase(req, res) {
    const id = parseInt(req.params.id, 10);
    if (!req.session.cart) return res.redirect('/cart');
    const item = req.session.cart.find(i => i.id === id);

    db.query('SELECT quantity FROM products WHERE id = ?', [id], (err, results) => {
      if (err) return res.status(500).send('Server error');
      if (!results || results.length === 0) {
        if (req.headers.accept && req.headers.accept.includes('application/json')) return res.status(404).json({ error: 'Product not found' });
        req.flash('error', 'Product not found');
        return res.redirect('/cart');
      }
      const available = results[0].quantity || 0;
      const currentQty = item ? item.quantity : 0;
      const newQty = currentQty + 1;
      if (newQty > available) {
        if (req.headers.accept && req.headers.accept.includes('application/json')) return res.status(400).json({ error: 'Not enough stock', available });
        req.flash('error', 'Not enough stock for that product');
        return res.redirect('/cart');
      }
      if (item) item.quantity = newQty;
      const total = cartTotal(req.session.cart);
      if (req.headers.accept && req.headers.accept.includes('application/json')) return res.json({ cart: req.session.cart, cartTotal: total });
      return res.redirect('/cart');
    });
  },

  // Decrease quantity (by 1) and remove if 0
  decrease(req, res) {
    const id = parseInt(req.params.id, 10);
    if (!req.session.cart) return res.redirect('/cart');
    const idx = req.session.cart.findIndex(i => i.id === id);
    if (idx !== -1) {
      req.session.cart[idx].quantity -= 1;
      if (req.session.cart[idx].quantity <= 0) req.session.cart.splice(idx, 1);
    }
    const total = cartTotal(req.session.cart);
    if (req.headers.accept && req.headers.accept.includes('application/json')) return res.json({ cart: req.session.cart, cartTotal: total });
    return res.redirect('/cart');
  },

  // Remove item
  remove(req, res) {
    const id = parseInt(req.params.id, 10);
    if (!req.session.cart) return res.redirect('/cart');
    req.session.cart = (req.session.cart || []).filter(i => i.id !== id);
    const total = cartTotal(req.session.cart);
    if (req.headers.accept && req.headers.accept.includes('application/json')) return res.json({ cart: req.session.cart, cartTotal: total });
    return res.redirect('/cart');
  }
};

module.exports = CartControllers;
