const express = require('express');
require('dotenv').config();
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); 
    }
});

const upload = multer({ storage: storage });

// add controller imports
const ProductsController = require('./controllers/ProductsControllers');
const AuthControllers = require('./controllers/AuthControllers');
const stripesService = require('./services/stripes');
const Transaction = require('./models/Transaction');
const emailService = require('./services/email');

// Load database connection from centralized `db.js` which reads from `.env`
const db = require('./db');

// --- Cart persistence helpers (DB-backed) ---
function loadCartForUser(userId, session, cb) {
    db.query('SELECT ci.product_id AS id, p.productName, p.price, ci.quantity, p.image FROM cart_items ci LEFT JOIN products p ON p.id = ci.product_id WHERE ci.user_id = ?', [userId], (err, rows) => {
        if (err) return cb(err);
        // normalize to session item shape
        session.cart = (rows || []).map(r => ({ id: r.id, productName: r.productName, price: r.price, quantity: r.quantity, image: r.image }));
        return cb(null, session.cart);
    });
}

function upsertCartItem(userId, productId, quantity, cb) {
    // if quantity <= 0 delete
    if (!userId) return cb && cb();
    if (quantity <= 0) {
        return db.query('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, productId], (dErr) => cb && cb(dErr));
    }
    db.query('SELECT id FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, productId], (err, rows) => {
        if (err) return cb && cb(err);
        if (rows && rows.length > 0) {
            return db.query('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?', [quantity, userId, productId], (uErr) => cb && cb(uErr));
        }
        return db.query('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)', [userId, productId, quantity], (iErr) => cb && cb(iErr));
    });
}

function deleteCartItemForUser(userId, productId, cb) {
    if (!userId) return cb && cb();
    db.query('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, productId], (err) => cb && cb(err));
}

function recordTransaction({ processor, transactionId, paymentMethod, amount, currency, status, userId }) {
    const time = new Date();
    const normalizedUserId = Number.isInteger(userId) ? userId : Number(userId) || 0;
    Transaction.create({
        processor,
        transactionId: String(transactionId || 'unknown'),
        paymentMethod,
        amount,
        currency,
        status,
        userId: normalizedUserId,
        time
    });
}

// Set up view engine
app.set('view engine', 'ejs');
//  enable static files
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({
    extended: false
}));
// enable JSON parsing for AJAX endpoints
app.use(express.json());

//TO DO: Insert code for Session Middleware below 
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } 
}));

app.use(flash());

const { checkAuthenticated, checkAdmin, validateRegistration } = require('./middleware');

// Define routes
app.get('/',  (req, res) => {
    // If the user is not logged in, send them to the login page as the app start page
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('index', { user: req.session.user, cart: req.session && req.session.cart ? req.session.cart : [] } );
});

// Use controller for inventory (admin) listing
app.get('/inventory', checkAuthenticated, checkAdmin, (req, res, next) => {
    ProductsController.listAll(req, res, next);
});

// Admin dashboard (revenue summary)
app.get('/admin/dashboard', checkAuthenticated, checkAdmin, (req, res) => {
    const totalSql = `SELECT COALESCE(SUM(amount), 0) AS totalRevenue
                      FROM transactions
                      WHERE status = 'completed'`;
    const seriesSql = `SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') AS period, COALESCE(SUM(amount), 0) AS total
                       FROM transactions
                       WHERE status = 'completed'
                       GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00')
                       ORDER BY DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00')`;

    db.query(totalSql, (tErr, tRows) => {
        if (tErr) {
            console.error('Admin dashboard total revenue error:', tErr);
            req.flash('error', 'Unable to load dashboard');
            return res.redirect('/inventory');
        }

        db.query(seriesSql, (sErr, sRows) => {
            if (sErr) {
                console.error('Admin dashboard revenue series error:', sErr);
                req.flash('error', 'Unable to load dashboard');
                return res.redirect('/inventory');
            }

            const totalRevenue = tRows && tRows[0] ? Number(tRows[0].totalRevenue) : 0;
            const labels = (sRows || []).map(r => r.period);
            const values = (sRows || []).map(r => Number(r.total));

            // Fetch popular items (top and least selling)
            const popularSql = `SELECT p.id, p.productName, COALESCE(SUM(oi.quantity),0) AS total_sold
                                FROM products p
                                LEFT JOIN order_items oi ON oi.product_id = p.id
                                GROUP BY p.id, p.productName
                                ORDER BY total_sold DESC`;

            db.query(popularSql, (pErr, pRows) => {
                if (pErr) {
                    console.error('Admin dashboard popular items error:', pErr);
                    // Still render dashboard without popular items
                    return res.render('adminDashboard', {
                        user: req.session.user,
                        cart: req.session.cart || [],
                        totalRevenue,
                        labels,
                        values,
                        popularItems: [] ,
                        leastSelling: []
                    });
                }

                const allItems = (pRows || []).map(r => ({ id: r.id, productName: r.productName, total_sold: Number(r.total_sold || 0) }));
                const popularItems = allItems.slice(0, 10);
                const leastSelling = allItems.slice(-10).reverse();

                return res.render('adminDashboard', {
                    user: req.session.user,
                    cart: req.session.cart || [],
                    totalRevenue,
                    labels,
                    values,
                    popularItems,
                    leastSelling
                });
            });
        });
    });
});

// Auth routes using AuthControllers
app.get('/register', AuthControllers.renderRegister);
app.post('/register', validateRegistration, AuthControllers.register);

app.get('/login', AuthControllers.renderLogin);
app.post('/login', AuthControllers.login);

// Use controller for shopping listing (public/customer view)
app.get('/shopping', checkAuthenticated, (req, res, next) => {
    // let controller decide how to render for shopping; controller can use req.session.user to select view
    ProductsController.listAll(req, res, next);
});

// cart and add-to-cart keep using connection (user/cart logic)
app.post('/add-to-cart/:id', checkAuthenticated, (req, res) => {
    const productId = parseInt(req.params.id);
    const quantity = parseInt(req.body.quantity) || 1;
    db.query('SELECT * FROM products WHERE id = ?', [productId], (error, results) => {
        if (error) throw error;

        if (results.length === 0) {
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return res.status(404).json({ error: 'Product not found' });
            }
            return res.status(404).send('Product not found');
        }

        const product = results[0];
        // Validate requested quantity does not exceed available
        if (quantity > product.quantity) {
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return res.status(400).json({ error: 'Not enough stock', available: product.quantity });
            }
            req.flash('error', 'Not enough stock for that product');
            return res.redirect('/shopping');
        }

        // Initialize cart in session if not exists
        if (!req.session.cart) {
            req.session.cart = [];
        }

        // Check if product already in cart and ensure combined qty doesn't exceed stock
        const existingItem = req.session.cart.find(item => item.id === productId);
        if (existingItem) {
            const newQty = existingItem.quantity + quantity;
            if (newQty > product.quantity) {
                if (req.headers.accept && req.headers.accept.includes('application/json')) {
                    return res.status(400).json({ error: 'Not enough stock', available: product.quantity });
                }
                req.flash('error', 'Not enough stock for that product');
                return res.redirect('/shopping');
            }
            existingItem.quantity = newQty;
        } else {
            req.session.cart.push({
                id: product.id,
                productName: product.productName,
                price: product.price,
                quantity: quantity,
                image: product.image
            });
        }

        // If AJAX request, return JSON so client can update UI without reload
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            const cartTotal = (req.session.cart || []).reduce((s, it) => s + (it.price * it.quantity), 0);
            // persist for logged-in user
            if (req.session.user && req.session.user.id) {
                const added = req.session.cart.find(it => it.id === product.id);
                if (added) upsertCartItem(req.session.user.id, product.id, added.quantity, (e) => { if (e) console.error('Error saving cart item', e); });
            }
            return res.json({ message: 'Added to cart', cart: req.session.cart, cartTotal });
        }

        // Fallback: redirect for non-AJAX clients
        return res.redirect('/shopping');
    });
});

app.get('/cart', checkAuthenticated, (req, res) => {
    const cart = req.session.cart || [];
    const errors = req.flash ? req.flash('error') : [];
    res.render('cart', { cart, user: req.session.user, errors });
});

// Increase quantity of an item in cart
app.post('/cart/increase/:id', checkAuthenticated, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!req.session.cart) return res.redirect('/cart');
    const item = req.session.cart.find(i => i.id === id);

    // Ensure product exists and there's enough stock before increasing
    db.query('SELECT quantity FROM products WHERE id = ?', [id], (err, results) => {
        if (err) throw err;
        if (!results || results.length === 0) {
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return res.status(404).json({ error: 'Product not found' });
            }
            req.flash('error', 'Product not found');
            return res.redirect('/cart');
        }

        const available = results[0].quantity || 0;
        const currentQty = item ? item.quantity : 0;
        const newQty = currentQty + 1;

        if (newQty > available) {
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return res.status(400).json({ error: 'Not enough stock', available });
            }
            req.flash('error', 'Not enough stock for that product');
            return res.redirect('/cart');
        }

        if (item) {
            item.quantity = newQty;
        }
        // persist change for logged-in users
        if (req.session.user && req.session.user.id) {
            const sessQty = item ? item.quantity : 0;
            upsertCartItem(req.session.user.id, id, sessQty, (e) => { if (e) console.error('Error updating cart item', e); });
        }
        const cartTotal = (req.session.cart || []).reduce((s, it) => s + (it.price * it.quantity), 0);
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.json({ cart: req.session.cart, cartTotal });
        }
        res.redirect('/cart');
    });
});

// Decrease quantity of an item in cart
app.post('/cart/decrease/:id', checkAuthenticated, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!req.session.cart) return res.redirect('/cart');
    const idx = req.session.cart.findIndex(i => i.id === id);
    if (idx !== -1) {
        req.session.cart[idx].quantity -= 1;
        if (req.session.cart[idx].quantity <= 0) {
            // remove when quantity falls to 0
            const removedId = req.session.cart[idx].id;
            req.session.cart.splice(idx, 1);
            if (req.session.user && req.session.user.id) {
                deleteCartItemForUser(req.session.user.id, removedId, (e) => { if (e) console.error('Error deleting cart item', e); });
            }
        }
        // persist updated quantity if still exists
        if (req.session.user && req.session.user.id) {
            const itemNow = (req.session.cart || []).find(i => i.id === id);
            if (itemNow) {
                upsertCartItem(req.session.user.id, itemNow.id, itemNow.quantity, (e) => { if (e) console.error('Error updating cart item after decrease', e); });
            }
        }
    }
    const cartTotal = (req.session.cart || []).reduce((s, it) => s + (it.price * it.quantity), 0);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json({ cart: req.session.cart, cartTotal });
    }
    res.redirect('/cart');
});

// Remove an item from the cart
app.post('/cart/remove/:id', checkAuthenticated, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!req.session.cart) return res.redirect('/cart');
    req.session.cart = req.session.cart.filter(i => i.id !== id);
    if (req.session.user && req.session.user.id) {
        deleteCartItemForUser(req.session.user.id, id, (e) => { if (e) console.error('Error deleting cart item', e); });
    }
    const cartTotal = (req.session.cart || []).reduce((s, it) => s + (it.price * it.quantity), 0);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json({ cart: req.session.cart, cartTotal });
    }
    res.redirect('/cart');
});

// Clear entire cart for current session and persisted user cart
app.post('/cart/clear', checkAuthenticated, (req, res) => {
    // clear session
    req.session.cart = [];
    const cartTotal = 0;
    // clear persisted cart_items for logged-in user
    if (req.session.user && req.session.user.id) {
        db.query('DELETE FROM cart_items WHERE user_id = ?', [req.session.user.id], (err) => {
            if (err) console.error('Error clearing cart_items for user:', err);
            if (req.headers.accept && req.headers.accept.includes('application/json')) return res.json({ cart: [], cartTotal });
            return res.redirect('/cart');
        });
    } else {
        if (req.headers.accept && req.headers.accept.includes('application/json')) return res.json({ cart: [], cartTotal });
        return res.redirect('/cart');
    }
});

// Checkout: if posted from cart with selected items, render confirmation for those items.
app.get('/checkout', checkAuthenticated, (req, res) => {
    const cart = req.session.cart || [];
    res.render('checkout', { cart, user: req.session.user, paypalClientId: process.env.PAYPAL_CLIENT_ID, stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

app.get('/payment', checkAuthenticated, (req, res) => {
    const cart = req.session.selectedCart || req.session.cart || [];
    res.render('payment', { cart, user: req.session.user, paypalClientId: process.env.PAYPAL_CLIENT_ID, stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

app.post('/checkout', checkAuthenticated, (req, res) => {
    const selected = req.body.selected;
    if (selected) {
        const selectedIds = Array.isArray(selected) ? selected.map(Number) : [Number(selected)];
        const selectedCart = (req.session.cart || []).filter(item => selectedIds.includes(item.id));
        req.session.selectedCart = selectedCart;
        return res.render('checkout', { cart: selectedCart, user: req.session.user, paypalClientId: process.env.PAYPAL_CLIENT_ID, stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
    }

    // No selection sent: full checkout (legacy behavior) — clear cart
    req.session.cart = [];
    req.flash('success', 'Checkout complete — thank you for your purchase!');
    res.redirect('/shopping');
});

// Validate cart items against current stock (AJAX)
app.post('/cart/validate', checkAuthenticated, (req, res) => {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items || items.length === 0) return res.json({ ok: true, insufficient: [] });

    const ids = items.map(it => Number(it.id));
    // query product availability
    db.query('SELECT id, productName, quantity FROM products WHERE id IN (?)', [ids], (err, rows) => {
        if (err) return res.status(500).json({ ok: false, error: 'Server error' });
        const map = new Map((rows || []).map(r => [r.id, r]));
        const insufficient = [];
        items.forEach(it => {
            const pid = Number(it.id);
            const requested = Number(it.quantity) || 0;
            const prod = map.get(pid);
            const available = prod ? Number(prod.quantity) : 0;
            if (available < requested) {
                insufficient.push({ id: pid, productName: prod ? prod.productName : ('#' + pid), requested, available });
            }
        });
        return res.json({ ok: insufficient.length === 0, insufficient });
    });
});

const OrdersControllers = require('./controllers/OrdersControllers');

// PayPal helper service
const paypalService = require('./services/paypal');

// single order view route (renders a single order by id)
app.get('/order/:id', checkAuthenticated, (req, res, next) => {
    return OrdersControllers.getOrderById(req, res, next);
});

// Confirm purchase endpoint: create order, decrement product inventory and clear purchased items from session cart
// Helper: finalize order in DB (used by both normal confirm and PayPal capture)
function finalizeOrder(req, selectedCart) {
    return new Promise((resolve, reject) => {
        if (!selectedCart || selectedCart.length === 0) return reject({ code: 'NO_ITEMS' });

        db.beginTransaction(err => {
            if (err) return reject(err);

            const validations = selectedCart.map(item => new Promise((resolveV, rejectV) => {
                db.query('SELECT id, productName, quantity FROM products WHERE id = ? FOR UPDATE', [item.id], (qErr, results) => {
                    if (qErr) return rejectV(qErr);
                    if (!results || results.length === 0) return rejectV({ code: 'NOT_FOUND', id: item.id });
                    const prod = results[0];
                    if (prod.quantity < item.quantity) return rejectV({ code: 'OUT_OF_STOCK', id: prod.id, available: prod.quantity });
                    resolveV(prod);
                });
            }));

            Promise.allSettled(validations).then(results => {
                for (const r of results) {
                    if (r.status === 'rejected') {
                        const reason = r.reason;
                        return db.rollback(() => reject(reason));
                    }
                }

                const updates = selectedCart.map(item => new Promise((resolveU, rejectU) => {
                    db.query('UPDATE products SET quantity = quantity - ? WHERE id = ? AND quantity >= ?', [item.quantity, item.id, item.quantity], (uErr, result) => {
                        if (uErr) return rejectU(uErr);
                        if (!result || result.affectedRows === 0) return rejectU({ code: 'UPDATE_FAILED', id: item.id });
                        resolveU();
                    });
                }));

                Promise.all(updates).then(() => {
                    const totalAmount = selectedCart.reduce((s, it) => s + (Number(it.price) * Number(it.quantity)), 0);
                    const userId = req.session.user && req.session.user.id ? req.session.user.id : null;

                    db.query('INSERT INTO orders (user_id, total_amount, order_date, status) VALUES (?, ?, NOW(), ?)', [userId, totalAmount, 'completed'], (oErr, oRes) => {
                        if (oErr) {
                            return db.rollback(() => reject(oErr));
                        }

                        const orderId = oRes.insertId;
                        const values = selectedCart.map(it => [orderId, it.id, it.quantity, it.price]);
                        db.query('INSERT INTO order_items (order_id, product_id, quantity, price_at_time_of_purchase) VALUES ?', [values], (oiErr) => {
                            if (oiErr) return db.rollback(() => reject(oiErr));

                            db.commit(commitErr => {
                                if (commitErr) return db.rollback(() => reject(commitErr));

                                // Remove purchased items from session cart
                                const purchasedIds = selectedCart.map(i => i.id);
                                if (req.session.cart) {
                                    req.session.cart = req.session.cart.filter(it => !purchasedIds.includes(it.id));
                                }
                                // Also remove from persisted user cart
                                if (req.session.user && req.session.user.id && purchasedIds.length > 0) {
                                    const userId = req.session.user.id;
                                    const placeholders = purchasedIds.map(() => '?').join(',');
                                    const sql = `DELETE FROM cart_items WHERE user_id = ? AND product_id IN (${placeholders})`;
                                    db.query(sql, [userId, ...purchasedIds], (dErr) => { if (dErr) console.error('Error deleting purchased items from cart_items', dErr); });
                                }
                                delete req.session.selectedCart;

                                resolve(orderId);
                            });
                        });
                    });
                }).catch(upErr => {
                    db.rollback(() => reject(upErr));
                });
            }).catch(err => {
                db.rollback(() => reject(err));
            });
        });
    });
}

// Confirm-purchase endpoint removed: payment flows (PayPal/Stripe) handle finalization.

// NETS integration removed

// Stripe: create Checkout Session endpoint
app.post('/stripe/create-checkout-session', checkAuthenticated, async (req, res) => {
    try {
        const cart = req.session.selectedCart || req.session.cart || [];
        if (!cart || cart.length === 0) return res.status(400).json({ error: 'No items to checkout' });
        const session = await stripesService.createCheckoutSession(req, cart);
        return res.json({ id: session.id, url: session.url });
    } catch (err) {
        console.error('Stripe create-checkout-session error:', err);
        return res.status(500).json({ error: 'Unable to create Stripe session' });
    }
});

// Simple success page: finalize order and redirect to order view (note: webhooks recommended for production)
app.get('/stripe/success', checkAuthenticated, async (req, res) => {
    try {
        const selectedCart = req.session.selectedCart || req.session.cart || [];
        if (!selectedCart || selectedCart.length === 0) return res.redirect('/orders');
        const orderId = await finalizeOrder(req, selectedCart);
        const totalAmount = selectedCart.reduce((s, it) => s + (Number(it.price) * Number(it.quantity)), 0);
        const currency = process.env.STRIPE_CURRENCY || 'USD';
        const sessionId = req.query.session_id || 'unknown';
        const payerEmail = req.session.user && req.session.user.email ? req.session.user.email : 'unknown';
        recordTransaction({
            processor: 'stripe',
            transactionId: sessionId,
            paymentMethod: 'card',
            amount: totalAmount,
            currency,
            status: 'completed',
            userId: req.session.user && req.session.user.id
        });
        // attempt to send invoice email (non-blocking)
        if (req.session.user && req.session.user.email) {
            emailService.sendInvoice(orderId, req.session.user).catch(e => console.error('Invoice email error (Stripe):', e));
        }
        req.flash('success', 'Payment completed and order placed');
        return res.redirect(`/payment-success?orderId=${orderId}`);
    } catch (err) {
        console.error('Stripe success finalize error:', err);
        req.flash('error', 'Payment processed but order finalization failed');
        return res.redirect('/cart');
    }
});

app.get('/stripe/cancel', checkAuthenticated, (req, res) => {
    req.flash('error', 'Payment was not successful. Please try again.');
    res.redirect('/cart');
});

// NETS SSE polling removed

// PayPal create/capture endpoints
app.post('/paypal/create-order', checkAuthenticated, async (req, res) => {
    try {
        const cart = req.session.selectedCart || req.session.cart || [];
        if (!cart || cart.length === 0) return res.status(400).json({ error: 'No items to checkout' });
        const total = cart.reduce((s, it) => s + (Number(it.price) * Number(it.quantity)), 0);
        const order = await paypalService.createOrder(total, process.env.PAYPAL_CURRENCY || 'USD');
        return res.json(order);
    } catch (err) {
        console.error('PayPal create-order error:', err);
        return res.status(500).json({ error: 'Unable to create PayPal order' });
    }
});

app.post('/paypal/capture-order', checkAuthenticated, async (req, res) => {
    try {
        const { orderID } = req.body || req;
        if (!orderID) return res.status(400).json({ error: 'orderID required' });
        const capture = await paypalService.captureOrder(orderID);
        // Check for capture status
        const status = (capture && capture.status) || (capture && capture.purchase_units && capture.purchase_units[0] && capture.purchase_units[0].payments && capture.purchase_units[0].payments.captures && capture.purchase_units[0].payments.captures[0] && capture.purchase_units[0].payments.captures[0].status) || 'UNKNOWN';
        if (status === 'COMPLETED' || status === 'COMPLETED') {
            const selectedCart = req.session.selectedCart || req.session.cart || [];
            const orderId = await finalizeOrder(req, selectedCart);
            const totalAmount = selectedCart.reduce((s, it) => s + (Number(it.price) * Number(it.quantity)), 0);
            const currency = process.env.PAYPAL_CURRENCY || 'USD';
            const captureId = (capture && capture.id)
                || (capture && capture.purchase_units && capture.purchase_units[0] && capture.purchase_units[0].payments && capture.purchase_units[0].payments.captures && capture.purchase_units[0].payments.captures[0] && capture.purchase_units[0].payments.captures[0].id)
                || orderID;
            const payer = (capture && capture.payer) || {};
            const payerId = payer.payer_id || 'paypal';
            const payerEmail = payer.email_address || (req.session.user && req.session.user.email) || 'unknown';
            recordTransaction({
                processor: 'paypal',
                transactionId: orderID || captureId,
                paymentMethod: 'paypal',
                amount: totalAmount,
                currency,
                status: 'completed',
                userId: req.session.user && req.session.user.id
            });
            // send invoice email if possible (do not block response)
            if (req.session.user && req.session.user.email) {
                emailService.sendInvoice(orderId, req.session.user).catch(e => console.error('Invoice email error (PayPal):', e));
            }
            req.flash('success', 'Payment completed and order placed');
            return res.json({ status: 'COMPLETED', orderId });
        }
        return res.status(400).json({ error: 'Payment not completed', capture });
    } catch (err) {
        console.error('PayPal capture error:', err);
        return res.status(500).json({ error: 'Unable to capture PayPal order' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Payment success landing page
app.get('/payment-success', checkAuthenticated, (req, res) => {
    const orderId = parseInt(req.query.orderId, 10);
    if (!orderId) return res.redirect('/orders');
    return res.render('paymentSuccess', { orderId, user: req.session.user });
});

// Invoice view for a single order (printable)
app.get('/invoice/:id', checkAuthenticated, (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    const userId = req.session.user && req.session.user.id;
    if (!userId) return res.redirect('/login');
    const sql = `SELECT o.order_id AS id, o.total_amount, o.order_date, oi.item_id AS order_item_id, oi.product_id, oi.quantity, oi.price_at_time_of_purchase AS price, p.productName
           FROM orders o
           LEFT JOIN order_items oi ON oi.order_id = o.order_id
           LEFT JOIN products p ON p.id = oi.product_id
           WHERE o.order_id = ? AND o.user_id = ?`;
    db.query(sql, [orderId, userId], (err, rows) => {
        if (err) {
            console.error('Error fetching order for invoice:', err);
            req.flash('error', 'Unable to load invoice');
            return res.redirect('/orders');
        }
        if (!rows || rows.length === 0) {
            req.flash('error', 'Invoice not found');
            return res.redirect('/orders');
        }
        // group rows into order
        const map = new Map();
        rows.forEach(r => {
            if (!map.has(r.id)) map.set(r.id, { id: r.id, total_amount: r.total_amount, order_date: r.order_date, items: [] });
            if (r.order_item_id) map.get(r.id).items.push({ product_id: r.product_id, productName: r.productName, quantity: r.quantity, price: r.price });
        });
        const order = Array.from(map.values())[0];
        return res.render('invoice', { order, user: req.session.user });
    });
});

// Use controller to get single product (product details)
app.get('/product/:id', checkAuthenticated, (req, res, next) => {
    ProductsController.getById(req, res, next);
});

// My Orders - show past orders for logged-in user
app.get('/orders', checkAuthenticated, (req, res) => {
    const userId = req.session.user && req.session.user.id;
    if (!userId) return res.redirect('/login');

    // fetch orders and items
    const sql = `SELECT o.order_id AS id, o.total_amount, o.order_date,
                  oi.item_id AS order_item_id, oi.product_id, oi.quantity, oi.price_at_time_of_purchase AS price,
                  p.productName
                 FROM orders o
                 LEFT JOIN order_items oi ON oi.order_id = o.order_id
                 LEFT JOIN products p ON p.id = oi.product_id
                 WHERE o.user_id = ?
                 ORDER BY o.order_date DESC, o.order_id DESC`;

    db.query(sql, [userId], (err, rows) => {
        if (err) {
            console.error('Error fetching orders:', err);
            req.flash('error', 'Unable to load orders');
            return res.redirect('/shopping');
        }

        // group rows by order id
        const ordersMap = new Map();
        rows.forEach(r => {
            if (!ordersMap.has(r.id)) {
                ordersMap.set(r.id, { id: r.id, total_amount: r.total_amount, order_date: r.order_date, items: [] });
            }
            if (r.order_item_id) {
                ordersMap.get(r.id).items.push({ product_id: r.product_id, productName: r.productName, quantity: r.quantity, price: r.price });
            }
        });

        const orders = Array.from(ordersMap.values());
        res.render('orders', { orders, user: req.session.user });
    });
});

    // --- Admin order management routes ---
    app.get('/admin/orders', checkAuthenticated, checkAdmin, (req, res, next) => {
        return OrdersControllers.listAllOrders(req, res, next);
    });

    app.post('/admin/orders/:id/status', checkAuthenticated, checkAdmin, (req, res) => {
        return OrdersControllers.updateOrderStatus(req, res);
    });

    app.post('/admin/orders/:id/cancel', checkAuthenticated, checkAdmin, (req, res) => {
        return OrdersControllers.cancelOrder(req, res);
    });

    app.get('/admin/customer/:id', checkAuthenticated, checkAdmin, (req, res) => {
        return OrdersControllers.getCustomerDetails(req, res);
    });

app.get('/addProduct', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addProduct', {user: req.session.user } ); 
});

// Use controller to add product (handle file upload via multer)
app.post('/addProduct', checkAuthenticated, checkAdmin, upload.single('image'), (req, res, next) => {
    ProductsController.add(req, res, next);
});

// Use controller to render update form for a product
app.get('/updateProduct/:id', checkAuthenticated, checkAdmin, (req, res, next) => {
    ProductsController.renderEdit(req, res, next);
});

// Use controller to update product (handle file upload)
app.post('/updateProduct/:id', checkAuthenticated, checkAdmin, upload.single('image'), (req, res, next) => {
    ProductsController.update(req, res, next);
});

// Use controller to delete product
app.get('/deleteProduct/:id', checkAuthenticated, checkAdmin, (req, res, next) => {
    ProductsController.remove(req, res, next);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
