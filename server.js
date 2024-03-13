const express = require("express")
require('dotenv').config();
const app = express();
const { PlaidApi, Configuration, PlaidEnvironments } = require('plaid')
;
const cors = require('cors');

const APP_PORT = process.env.APP_PORT || 8000;
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';

let PUBLIC_TOKEN = null
let ACCESS_TOKEN = null
let ITEM_ID = null

const user = { id: "USER_GOOD" }

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
      'PLAID-SECRET': PLAID_SECRET,
      'Plaid-Version': '2020-09-14',
    },
  },
});

const client = new PlaidApi(configuration);

app.use(cors());
app.use(express.json());

app.listen(3000, () => {
  console.log('Prject W is running on port 3000');
});

app.post('/api/create_link_token', async function (req, res) {
  // Get the client_user_id by searching for the current user
  //const user = await User.find(...);
  const clientUserId = req.body.user_id;
  const request = {
    user: {
    // This should correspond to a unique id for the current user.
      client_user_id: clientUserId,
    },
    client_name: 'Plaid Test App',
    products: ['auth'],
    language: 'en',
    webhook: 'https://webhook.example.com',
    redirect_uri: 'https://localhost:5173/',
    country_codes: ['US'],
  };
  try {
    const createTokenResponse = await client.linkTokenCreate(request);
    res.json(createTokenResponse.data);
    console.log(createTokenResponse.data);
  } catch (error) {
    console.log(error);       
  }
});


app.post('/api/exchange_public_token', async function ( req, res) {
  PUBLIC_TOKEN = req.body.public_token;
  try {
    const tokenResponse = await client.itemPublicTokenExchange({
      public_token: PUBLIC_TOKEN,
    });
      // These values should be saved to a persistent database and
    // associated with the currently signed-in user
    ACCESS_TOKEN = tokenResponse.data.access_token;
    ITEM_ID = tokenResponse.data.item_id;  
    res.json({
      // the 'access_token' is a private token, DO NOT pass this token to the frontend in your production environment
      item_id: ITEM_ID,
      error: null,
    });
  } catch (error) {
    res.json({ error: error });
  }
});

app.get('/api/accounts', async function (req, res) {
  try {
    const accountsResponse = await client.accountsGet({
      access_token: ACCESS_TOKEN,
    });
    res.json(accountsResponse.data);
  } catch(error){
    res.json({ error: error.response.data.error_message });      
  }
});

app.get('/api/liabilities', async function (req, res) {
  try{
    const liabilitiesResponse = await client.liabilitiesGet({
      access_token: ACCESS_TOKEN,
    });
    res.json({ error: null, liabilities: liabilitiesResponse.data.liabilities });
  } catch(error){
    res.json({ error: error.response.data.error_message });
  } 
})

app.get('/api/transactions/recurring', async function (req, res) {
  try{
    const response = await client.transactionsRecurringGet({
      access_token: ACCESS_TOKEN,
    });
    let incoming = response.data.inflowStreams;
    let outgoing = response.data.outflowStreams;
    res.json({ incoming: incoming, outgoing: outgoing });
  }catch(error){
    res.json({ error: error.response.data.error_message });
  }
})

app.get('/api/balance', async function (req, response) {
  try{
    const balanceResponse = await client.accountsBalanceGet({
      access_token: ACCESS_TOKEN,
    });
    response.json(balanceResponse.data);
  }catch(error){
    response.json({ error: error });
  }
});

app.get('/api/investments', async function (req, res) {
  try {
    const response = await client.investmentsHoldingsGet({
      access_token: ACCESS_TOKEN,
    });
    const holdings = response.data.holdings;
    const securities = response.data.securities;
    res.json({holdings: holdings, securities: securities});
  } catch (error) {
    console.log(error.response.data.error_message);
    res.json({ error: error.response.data.error_message });
  }
})

app.get('/api/item', async function (req, res) {
  try {
    const response = await client.itemGet({
      access_token: ACCESS_TOKEN,
    });
    const item = response.data.item;
    const status = response.data.status;
    res.json({ item: item, status: status });
  } catch (error) {
    res.json({ error: error.response.data.error_message })
  }
})

app.get('/api/transactions', function (request, response) {
  Promise.resolve()
    .then(async function () {
      // Set cursor to empty to receive all historical updates
      let cursor = null;

      // New transaction updates since "cursor"
      let added = [];
      let modified = [];
      // Removed transaction ids
      let removed = [];
      let hasMore = true;
      // Iterate through each page of new transaction updates for item
      while (hasMore) {
        const request = {
          access_token: ACCESS_TOKEN,
          cursor: cursor,
        };
        const response = await client.transactionsSync(request)
        const data = response.data;
        // Add this page of results
        added = added.concat(data.added);
        modified = modified.concat(data.modified);
        removed = removed.concat(data.removed);
        hasMore = data.has_more;
        // Update cursor to the next cursor
        cursor = data.next_cursor;
      }

      const compareTxnsByDateAscending = (a, b) => (a.date < b.date) - (a.date > b.date);
      // Return the 8 most recent transactions
      const recently_added = [...added].sort(compareTxnsByDateAscending);

      response.json({
        added: recently_added,
        modified: modified,
        removed: removed,
        hasMore: hasMore,
      });
    })
    .catch((error) => {
      console.log(error.response.data.error_message);
      response.json({ error: error.response.data.error_message });
    });
});