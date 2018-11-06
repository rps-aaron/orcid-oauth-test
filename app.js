// save environment variables in dotenv
require('dotenv').config();

// express set up, handles request, response easily
const express = require('express');
const app = express();

// express session
const session = require('express-session');

// makes sending requests easy
const request = require('request');

// node core module, construct query string
const qs = require('querystring');

// node core module, parses url string into components
const url = require('url');

// generates a random string for the
const randomString = require('randomstring');

// random string, will be used in the workflow later
const csrfString = randomString.generate();

// setting up port and redirect url from process.env
// makes it easier to deploy later
const port = process.env.PORT || 3000;
const redirect_uri = process.env.HOST + '/redirect';

// serves up the contnests of the /views folder as static 
app.use(express.static('views'));

// initializes session
app.use(
  session({
    secret: randomString.generate(),
    cookie: { maxAge: 60000 },
    resave: false,
    saveUninitialized: false
  })
);

app.get('/', (req, res, next) => {
    res.sendFile(__dirname + '/index.html');
});

app.listen(port, () => {
    console.log('Server listening at port ' + port);
});

app.get('/login', (req, res, next) => {
    // generate that csrf_string for your "state" parameter
  req.session.csrf_string = randomString.generate();
    // construct the ORCiD URL you redirect your user to.
    // qs.stringify is a method that creates foo=bar&bar=baz
    // type of string for you.
  const orcidAuthUrl =
    'https://orcid.org/oauth/authorize?' +
    qs.stringify({
      client_id: process.env.CLIENT_ID,
      response_type: process.env.RESPONSE_TYPE,
      scope: '/authenticate',
      redirect_uri: redirect_uri
    });
  // redirect user with express
  res.redirect(orcidAuthUrl);
});

// Handle the response your application gets.
// Using app.all makes sure no matter the provider sent you
// get or post request, they will all be handled
app.all('/redirect', (req, res) => {
    // Here, the req is request object sent by GitHub
    console.log('Request sent by ORCiD: ');
    console.log(req.query);
  
    // req.query should look like this:
    // {
    //   code: '3502d45d9fed81286eba',
    //   state: 'RCr5KXq8GwDyVILFA6Dk7j0LbFNTzJHs'
    // }
    const code = req.query.code;
    console.log(code);
    //const returnedState = req.query.state;

    request.post(
      {
        url:
          'https://orcid.org/oauth/token?' +
          qs.stringify({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirect_uri
          })
      },
      (error, response, body) => {
        // The response will contain your new access token
        // this is where you store the token somewhere safe
        // for this example we're just storing it in session
        console.log('Your Access Token: ');
        console.log(qs.parse(body));
        req.session.access_token = qs.parse(body).access_token;

        // Redirects user to /user page so we can use
        // the token to get some data.
        res.redirect('/user');
      }
    );
  });
  
  app.get('/user', (req, res) => {
    // GET request to get emails
    // this time the token is in header instead of a query string
    request.get(
      {
        url: 'https://orcid.org/oauth/authorize',
        headers: {
          Authorization: 'token ' + req.session.access_token,
          'User-Agent': 'oauth test'
        }
      },
      (error, response, body) => {
        res.send(
          body
        );
      }
    );
  });
