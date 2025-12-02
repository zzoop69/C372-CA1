/**
 * Session-backed Cart helper
 * Provides simple helpers to manage a cart stored on `req.session.cart`.
 * Items are plain objects with at least: { id, name, price, quantity, image }
 */

function init(session) {
  if (!session) throw new Error('Session object required');
  if (!session.cart) session.cart = [];
  return session.cart;
}

function findIndex(cart, id) {
  return cart.findIndex(i => String(i.id) === String(id));
}

function addItem(session, product, qty = 1) {
  const cart = init(session);
  const id = product.id ?? product.ID ?? product.productId;
  const index = findIndex(cart, id);
  const itemData = {
    id: id,
    name: product.name ?? product.productName ?? product.title ?? '',
    price: Number(product.price ?? product.unit_price ?? 0) || 0,
    quantity: Number(qty) || 1,
    image: product.image ?? product.img ?? product.photo ?? null,
  };

  if (index !== -1) {
    cart[index].quantity += itemData.quantity;
  } else {
    cart.push(itemData);
  }
  return cart;
}

function increase(session, id, maxAvailable = Infinity) {
  const cart = init(session);
  const idx = findIndex(cart, id);
  if (idx === -1) return null;
  if (cart[idx].quantity + 1 > maxAvailable) {
    return { error: 'exceeds', available: maxAvailable };
  }
  cart[idx].quantity += 1;
  return cart[idx];
}

function decrease(session, id) {
  const cart = init(session);
  const idx = findIndex(cart, id);
  if (idx === -1) return null;
  cart[idx].quantity -= 1;
  if (cart[idx].quantity <= 0) {
    cart.splice(idx, 1);
    return null;
  }
  return cart[idx];
}

function removeItem(session, id) {
  const cart = init(session);
  const idx = findIndex(cart, id);
  if (idx === -1) return false;
  cart.splice(idx, 1);
  return true;
}

function clear(session) {
  if (!session) throw new Error('Session object required');
  session.cart = [];
  return session.cart;
}

function getItems(session) {
  return init(session);
}

function getTotal(session) {
  const cart = init(session);
  return cart.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
}

function getItemCount(session) {
  const cart = init(session);
  return cart.reduce((n, it) => n + (Number(it.quantity) || 0), 0);
}

module.exports = {
  init,
  addItem,
  increase,
  decrease,
  removeItem,
  clear,
  getItems,
  getTotal,
  getItemCount,
};
