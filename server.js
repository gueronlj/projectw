const express = require("express")
require('dotenv').config();
const app = express();
const { PlaidApi, Configuration, PlaidEnvironments } = require('plaid')
const user = require('./models/user.js')
const { Sequelize } = require('sequelize')
const cors = require('cors');

const APP_PORT = process.env.APP_PORT || 8000;
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';

const DB = process.env.DB;
const sequelize = new Sequelize(DB)

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

const testDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection to DB has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

const getAccessToken = async (id) => {
  const foundUser = await user.findOne({ where: { user_id: id } });
  return foundUser.access_token;
}

app.use(cors());
app.use(express.json());

app.listen(3000, () => {
  console.log('Prject W is running on port 3000');
  testDB();
});

app.post('/api/create_link_token', async function (req, res) {
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
  } catch (error) {
    res.json({ error: error });       
  }
});

app.post('/api/exchange_public_token', async function ( req, res) {
  let USER_ID = req.body.user_id;
  let PUBLIC_TOKEN = req.body.public_token;
  let ACCESS_TOKEN = null;
  let ITEM_ID = null;

  try {
    const tokenResponse = await client.itemPublicTokenExchange({
      public_token: PUBLIC_TOKEN,
    });
      // These values should be saved to a persistent database and
    // associated with the currently signed-in user
    ACCESS_TOKEN = tokenResponse.data.access_token;
    ITEM_ID = tokenResponse.data.item_id; 
    const newUser = {
      user_id: USER_ID,
      access_token: ACCESS_TOKEN,
      item_id: ITEM_ID,
    }
    const userCreatedResapone = await user.create(newUser);
    res.json({
      // the 'access_token' is a private token, DO NOT pass this token to the frontend in your production environment
      item_id: ITEM_ID,
      error: null,
    });
  } catch (error) {
    res.json({ error: response?.data?.error_message });
  }
});

app.post('/api/accounts', async function (req, res) {
  try {
    const token = await getAccessToken(req.body.user_id);
    const accountsResponse = await client.accountsGet({
      access_token: token,
    });
    res.json(accountsResponse.data);
  } catch(error){
    res.json({ error: error.response?.data?.error_message });    
  }
});

app.post('/api/liabilities', async function (req, res) {
  try{
    const token = await getAccessToken(req.body.user_id);
    const liabilitiesResponse = await client.liabilitiesGet({
      access_token: token,
    });
    res.json({ error: null, liabilities: liabilitiesResponse.data.liabilities });
  } catch(error){
    res.json({ error: error.response?.data?.error_message });
  } 
})

app.post('/api/transactions/recurring', async function (req, res) {
  try{
    const token = await getAccessToken(req.body.user_id);
    const response = await client.transactionsRecurringGet({
      access_token: token,
    });
    const incoming = response.data.inflow_streams;
    const outgoing = response.data.outflow_streams;
    res.json({ incoming: incoming, outgoing: outgoing });
  }catch(error){
    res.json({ error: error.response?.data?.error_message });
  }
})

app.post('/api/balance', async function (req, response) {
  try{
    const token = await getAccessToken(req.body.user_id);
    const balanceResponse = await client.accountsBalanceGet({
      access_token: token,
    });
    response.json(balanceResponse.data);
  }catch(error){
    response.json({ error: error.response?.data?.error_message });
  }
});

app.post('/api/investments', async function (req, res) {
  try {
    const token = await getAccessToken(req.body.user_id);
    const response = await client.investmentsHoldingsGet({
      access_token: token,
    });
    const holdings = response.data.holdings;
    const securities = response.data.securities;
    res.json({holdings: holdings, securities: securities});
  } catch (error) {
    res.json({ error: error.response?.data?.error_message });
  }
})

app.post('/api/item', async function (req, res) {
  try {
    const token = await getAccessToken(req.body.user_id);
    const response = await client.itemGet({
      access_token: token,
    });
    const item = response.data.item;
    const status = response.data.status;
    res.json({ item: item, status: status });
  } catch (error) {
    res.json({ error: error.response?.data?.error_message })
  }
})

app.post('/api/transactions', function (req, response) {
  Promise.resolve()
    .then(async function () {
      const token = await getAccessToken(req.body.user_id);
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
          access_token: token,
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
        added: recently_added
      });
    })
    .catch((error) => {
      response.json({ error: error.response?.data?.error_message });
    });
});