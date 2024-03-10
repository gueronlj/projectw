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
    const clientUserId = user.id;
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
        const data = res.json(createTokenResponse.data);
    } catch (error) {
        console.log(error);       
    }
});

//TODO: COMPLETE THE FOLLOWING ROUTES (exchange_public_token, set_access_token)
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
      console.log("token:", ACCESS_TOKEN);
      const accountsResponse = await client.accountsGet({
        access_token: ACCESS_TOKEN,
      });
      res.json(accountsResponse.data);
    } catch(error){
      res.json({ error: error });      
    }
});

app.get('/api/liabilities', async function (req, res) {
  try{
    const liabilitiesResponse = await client.liabilitiesGet({
      access_token: ACCESS_TOKEN,
    });
    res.json({ error: null, liabilities: liabilitiesResponse.data });
  } catch(error){
    res.json({ error: error });
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

app.get('/api/transactions', async function (req, res) {
  try{  
    // Set cursor to empty to receive all historical updates
    let cursor = null;
    // New transaction updates since "cursor"
    let added = [];
    let modified = [];
    // Removed transaction ids
    let removed = [];
    let hasMore = true;
    // Iterate through each page of new transaction updates for item'
    while (hasMore) {
      const request = {
        access_token: ACCESS_TOKEN,
        cursor: cursor,
      };
      const response = await client.transactionsSync(request);
      const data = response.data
      console.log(data);
      //store current page of results
      added = added.concat(data.added);
      modified = modified.concat(data.modified);
      removed = removed.concat(data.removed);
      hasMore = data.has_more;
      //update cursor for next page
      cursor = data.next_cursor;
    }
    res.json({
      added: added, 
      modified: modified, 
      removed: removed, 
      cursor: cursor 
    });
  }catch(error){
    res.json({ error: error });
  }
});