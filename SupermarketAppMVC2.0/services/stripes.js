const Stripe = require('stripe');

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  console.warn('STRIPE_SECRET_KEY not set; Stripe payments will fail until configured');
}

const stripe = Stripe(stripeSecret);

async function createCheckoutSession(req, cartItems) {
  if (!cartItems || cartItems.length === 0) throw new Error('No items for checkout');

  const line_items = cartItems.map(it => ({
    price_data: {
      currency: process.env.STRIPE_CURRENCY || 'usd',
      product_data: { name: it.productName },
      unit_amount: Math.round(Number(it.price) * 100)
    },
    quantity: Number(it.quantity) || 1
  }));

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items,
    success_url: `${req.protocol}://${req.get('host')}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${req.protocol}://${req.get('host')}/checkout`,
    metadata: {
      created_by_user: req.session.user ? String(req.session.user.id) : 'guest'
    }
  });

  return session;
}

module.exports = { createCheckoutSession };
