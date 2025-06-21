# Node.js App with Keycloak OIDC Integration

This Node.js application demonstrates secure authentication using Keycloak via OpenID Connect Authorization Code Flow.

## Features

- OpenID Connect Authorization Code Flow
- Client credentials and secret
- Access token handling
- Integration with Keycloak realm and client

## Setup

1. Install dependencies:
   npm install
2. Configure your .env:
   CLIENT_ID=your-client-id
   CLIENT_SECRET=your-secret
   REDIRECT_URI=http://localhost:3000/callback
   KEYCLOAK_BASE_URL=http://localhost:8080/realms/myrealm
3. Run the app:
   node index.js
