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
    res.send(`Hello, ${req.session.user.name}! <a href="/logout">Logout</a>`);
  } else {
    res.send('<a href="/login">Login with Keycloak</a>');
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
    const tokenSet = await client.callback('http://localhost:3000/callback', params);
    const userInfo = await client.userinfo(tokenSet.access_token);
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
    req.session.destroy();
    res.redirect(logoutUrl);
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).send('Logout failed');
  }
});

app.listen(3000, () => console.log('App running on http://localhost:3000'));