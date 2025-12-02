const db = require('../db');

const AuthControllers = {
  renderRegister(req, res) {
    return res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
  },

  register(req, res) {
    const { username, email, password, address, contact, role } = req.body;

    if (!username || !email || !password || !address || !contact || !role) {
      req.flash('error', 'All fields are required.');
      req.flash('formData', req.body);
      return res.redirect('/register');
    }

    if (password.length < 6) {
      req.flash('error', 'Password should be at least 6 or more characters long');
      req.flash('formData', req.body);
      return res.redirect('/register');
    }

    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    db.query(sql, [username, email, password, address, contact, role], (err, result) => {
      if (err) {
        console.error('Error creating user:', err);
        req.flash('error', 'Unable to create account');
        req.flash('formData', req.body);
        return res.redirect('/register');
      }
      req.flash('success', 'Registration successful! Please log in.');
      return res.redirect('/login');
    });
  },

  renderLogin(req, res) {
    return res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
  },

  login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
      req.flash('error', 'All fields are required.');
      return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
      if (err) {
        console.error('Login error:', err);
        req.flash('error', 'Server error');
        return res.redirect('/login');
      }
      if (results.length > 0) {
        req.session.user = results[0];
        req.flash('success', 'Login successful!');
        if (req.session.user.role === 'user') return res.redirect('/shopping');
        return res.redirect('/inventory');
      }
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/login');
    });
  },

  logout(req, res) {
    req.session.destroy(() => {
      res.redirect('/');
    });
  }
};

module.exports = AuthControllers;
