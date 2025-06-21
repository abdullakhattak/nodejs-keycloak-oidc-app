const express = require('express');
const session = require('express-session');
const openidClient = require('openid-client');
console.log('openid-client exports:', Object.keys(openidClient));
const Issuer = openidClient.Issuer;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'my-secret',
  resave: false,
  saveUninitialized: true,
}));

async function initKeycloak() {
  try {
    if (!Issuer) {
      console.error('Issuer not found, attempting manual configuration');
      const keycloakIssuer = new openidClient.Issuer({
        issuer: 'http://localhost:8080/realms/taskflow-realm',
        authorization_endpoint: 'http://localhost:8080/realms/taskflow-realm/protocol/openid-connect/auth',
        token_endpoint: 'http://localhost:8080/realms/taskflow-realm/protocol/openid-connect/token',
        userinfo_endpoint: 'http://localhost:8080/realms/taskflow-realm/protocol/openid-connect/userinfo',
        end_session_endpoint: 'http://localhost:8080/realms/taskflow-realm/protocol/openid-connect/logout',
        jwks_uri: 'http://localhost:8080/realms/taskflow-realm/protocol/openid-connect/certs',
      });
      const client = new keycloakIssuer.Client({
        client_id: 'taskflow-app',
        client_secret: 'YOUR_CLIENT_SECRET', // Replace with Keycloak client secret
        redirect_uris: ['http://localhost:3000/callback'],
        response_types: ['code'],
      });
      return client;
    }
    let keycloakIssuer;
    try {
      keycloakIssuer = await Issuer.discover('http://localhost:8080/realms/taskflow-realm/.well-known/openid-configuration');
    } catch (error) {
      console.warn('Discovery failed, trying legacy URL:', error.message);
      keycloakIssuer = await Issuer.discover('http://localhost:8080/auth/realms/taskflow-realm/.well-known/openid-configuration');
    }
    const client = new keycloakIssuer.Client({
      client_id: 'taskflow-app',
      client_secret: 'N4kl5ylHMIfWw9HzhabcWxvuSVxm6Vnx', // Replace with Keycloak client secret
      redirect_uris: ['http://localhost:3000/callback'],
      response_types: ['code'],
    });
    return client;
  } catch (error) {
    console.error('Keycloak initialization failed:', error);
    process.exit(1);
  }
}

let client;
initKeycloak().then(c => {
  client = c;
}).catch(err => {
  console.error('Failed to initialize client:', err);
  process.exit(1);
});

app.get('/', (req, res) => {
  if (!client) {
    return res.status(500).send('Keycloak client not initialized');
  }
  if (req.session.user) {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to TaskFlow</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gradient-to-r from-blue-500 to-indigo-600 min-h-screen flex items-center justify-center">
        <div class="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center">
          <h1 class="text-3xl font-bold text-gray-800 mb-4">Welcome, ${req.session.user.name}!</h1>
          <p class="text-gray-800 text-lg font-semibold mb-2">Signed in to <span class="text-blue-700">TaskFlow</span> through <span class="text-blue-700">Keycloak SSO</span></p>
          <p class="text-gray-800 text-base font-semibold mb-2">
          Secure authentication implemented using <span class="text-blue-700">OpenID Connect Authorization Code Flow</span>
          </p>
          <a href="/logout" class="inline-block bg-red-500 text-white font-semibold py-2 px-6 rounded-lg hover:bg-red-600 transition duration-300">Logout</a>
        </div>
      </body>
      </html>
    `);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TaskFlow Login</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gradient-to-r from-blue-500 to-indigo-600 min-h-screen flex items-center justify-center">
        <div class="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center">
          <h1 class="text-3xl font-bold text-gray-800 mb-4">TaskFlow</h1>
          <p class="text-gray-600 mb-6">Sign in to continue</p>
          <a href="/login" class="inline-block bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-blue-700 transition duration-300">Login with Keycloak</a>
        </div>
      </body>
      </html>
    `);
  }
});

app.get('/login', (req, res) => {
  if (!client) {
    return res.status(500).send('Keycloak client not initialized');
  }
  const authUrl = client.authorizationUrl({
    scope: 'openid profile email',
    response_type: 'code',
  });
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  if (!client) {
    return res.status(500).send('Keycloak client not initialized');
  }
  try {
    const params = client.callbackParams(req);
    console.log('Callback params:', params);
    const tokenSet = await client.callback('http://localhost:3000/callback', params);
    console.log('Token set:', tokenSet);
    const userInfo = await client.userinfo(tokenSet.access_token);
    console.log('User info:', userInfo);
    req.session.user = userInfo;
    res.redirect('/');
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).send(`Authentication failed: ${error.message}`);
  }
});

app.get('/logout', async (req, res) => {
  if (!client) {
    return res.status(500).send('Keycloak client not initialized');
  }
  try {
    const logoutUrl = client.endSessionUrl();
    console.log('Logout URL:', logoutUrl);
    req.session.destroy();
    res.redirect(logoutUrl);
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).send('Logout failed');
  }
});

app.listen(3000, () => console.log('App running on http://localhost:3000'));