const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();

// Import MVC controller (function-based supermarket controller)
const SupermarketController = require('./controllers/SupermarketController');

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

// Set up view engine
app.set('view engine', 'ejs');
// enable static files
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({
    extended: false
}));

// Session & flash middleware
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use(flash());

// Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/shopping');
    }
};

// Middleware for form validation
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact, role } = req.body;

    if (!username || !email || !password || !address || !contact || !role) {
        return res.status(400).send('All fields are required.');
    }

    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

// Routes that are not related to products (authentication / pages)
app.get('/',  (req, res) => {
    res.render('index', { user: req.session.user } );
});

app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});

app.post('/register', validateRegistration, (req, res) => {
    const { username, email, password, address, contact, role } = req.body;
    // Delegate registration DB logic to a model/controller if you have one.
    // For now keep simple direct SQL-free approach is expected to be moved into model/controller.
    // Example: UserController.register(req, res);
    res.status(501).send('Register endpoint should be implemented in a user controller.');
});

app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    // NOTE: Authentication logic should be moved to an auth controller/model.
    // Keep placeholder behavior so app structure remains MVC-ready.
    res.status(501).send('Login handling should be implemented in an auth controller.');
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Product / supermarket routes — delegate to SupermarketController methods
// Controller methods are expected to handle rendering/redirecting or JSON responses as appropriate.

// Inventory (admin) - list all items
app.get('/inventory', checkAuthenticated, checkAdmin, (req, res) => {
    // Let controller decide how to render/return the list
    return SupermarketController.listAll(req, res);
});

// Shopping (user) - list all items
app.get('/shopping', checkAuthenticated, (req, res) => {
    return SupermarketController.listAll(req, res);
});

// View single product page
app.get('/product/:id', checkAuthenticated, (req, res) => {
    return SupermarketController.getById(req, res);
});

// Add to cart - uses controller to fetch product then manages session cart
// If your controller's getById responds directly, consider adding a model method or a controller helper
// that returns the product object without sending response. Here we assume getById will return JSON when used as API.
// To avoid changing controller, call it and then rely on JSON response is not practical in this sync handler.
// Best practice: implement a model method to fetch single item for server-side cart management.
// For now delegate to controller and instruct it to handle cart addition when route hits it.
app.post('/add-to-cart/:id', checkAuthenticated, (req, res) => {
    // Let controller handle adding to cart and redirecting (controller should inspect req.path / route)
    if (typeof SupermarketController.addToCart === 'function') {
        return SupermarketController.addToCart(req, res);
    }
    // Fallback: ask controller to provide item and then app handles cart (not implemented)
    return res.status(501).send('Add-to-cart should be handled by SupermarketController.addToCart.');
});

// Cart view (session-managed)
app.get('/cart', checkAuthenticated, (req, res) => {
    const cart = req.session.cart || [];
    res.render('cart', { cart, user: req.session.user });
});

// Add product (admin) - display form
app.get('/addProduct', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addProduct', { user: req.session.user } );
});

// Add product (admin) - process form and upload
app.post('/addProduct', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
    return SupermarketController.add(req, res);
});

// Update product - display edit form
app.get('/updateProduct/:id', checkAuthenticated, checkAdmin, (req, res) => {
    return SupermarketController.getById(req, res);
});

// Update product - process update (with optional image)
app.post('/updateProduct/:id', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
    return SupermarketController.update(req, res);
});

// Delete product
app.get('/deleteProduct/:id', checkAuthenticated, checkAdmin, (req, res) => {
    return SupermarketController.delete(req, res);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
