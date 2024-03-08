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

app.post('/api/create_link_token', async function (req, response) {
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
        const data = response.json(createTokenResponse.data);
        console.log(data);
    } catch (error) {
        console.log(error);       
    }
});

app.post('/api/exchange_public_token', async function ( req, res, next) {
    const publicToken = req.body.public_token;
    try {
      const response = await client.itemPublicTokenExchange({
        public_token: publicToken,
      });
      // These values should be saved to a persistent database and
      // associated with the currently signed-in user
      // const accessToken = res.data.access_token;
      // const itemID = res.data.item_id;
      res.json({ public_token_exchange: 'complete' });
      console.log('exchange success!', res.data);
    } catch (error) {
      console.log(error);
    }
});

app.post('/api/set_access_token', async function (req, res) {
    const accessToken = req.body.public_token;
    // In a production app, the access token should be persisted to a
    // safe, long-term storage.
    console.log('access token: ', accessToken);
    res.json({ access_token_set: 'complete' });
})