# Fantasy Viz

This project scaffolds a TypeScript React frontend using Vite and Visx, as well as a TypeScript Express backend that implements Yahoo OAuth and proxies Yahoo Fantasy API calls.

## Registering a Yahoo App

To use Yahoo OAuth, you first need to register an application:
1. Go to the [Yahoo Developer Network](https://developer.yahoo.com/apps/).
2. Click on 'Create an App'.
3. Fill in the required fields, including:
   - Name of the Application
   - Application URL (can be a placeholder for local development)
   - Callback Domain (set this to your local development URL, e.g., http://localhost:3000)
4. After creating the app, you will receive a `client_id` and `client_secret`. Keep these safe.

### Environment Variables

Create a `.env` file in the `server` directory with the following variables:

```
YAHOO_CLIENT_ID=your_client_id_here
YAHOO_CLIENT_SECRET=your_client_secret_here
BASE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=random_session_secret
PORT=5000
```

## Running Locally

1. Clone the repository and navigate to the project directory.
2. Install dependencies for both client and server:
   ```bash
   npm install
   cd client
   npm install
   cd ../server
   npm install
   ```
3. Start the server:
   ```bash
   npm run dev
   ```
4. Open a new terminal for the client:
   ```bash
   cd client
   npm run dev
   ```
5. Visit `http://localhost:3000` to view the application.

## Next Steps

- Implement OAuth by clicking the Connect Yahoo button in the app.
- To test OAuth locally without a Yahoo app, you can stub tokens in memory or a JSON file until your app is set up.

Enjoy building your Fantasy Viz app!