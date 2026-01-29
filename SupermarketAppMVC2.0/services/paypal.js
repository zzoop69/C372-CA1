const https = require('https');

const mode = process.env.PAYPAL_MODE === 'live' ? 'api-m.paypal.com' : 'api-m.sandbox.paypal.com';

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(parsed);
          return reject({ statusCode: res.statusCode, body: parsed });
        } catch (ex) {
          return reject(ex);
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error('PayPal credentials not configured');

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const postData = 'grant_type=client_credentials';
  const options = {
    hostname: mode,
    path: '/v1/oauth2/token',
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  const resp = await request(options, postData);
  return resp.access_token;
}

async function createOrder(total, currency = 'USD') {
  const token = await getAccessToken();
  const body = {
    intent: 'CAPTURE',
    purchase_units: [{ amount: { currency_code: currency, value: Number(total).toFixed(2) } }]
  };
  const postData = JSON.stringify(body);
  const options = {
    hostname: mode,
    path: '/v2/checkout/orders',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  return await request(options, postData);
}

async function captureOrder(orderId) {
  const token = await getAccessToken();
  const options = {
    hostname: mode,
    path: `/v2/checkout/orders/${orderId}/capture`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
  return await request(options, null);
}

module.exports = { getAccessToken, createOrder, captureOrder };
