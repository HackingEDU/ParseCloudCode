
// These two lines are required to initialize Express in Cloud Code.
var express = require("express");
var     app = express();
var  routes = require("cloud/routes");
var    keys = require("cloud/keys");
var mg_webhooks = keys.mailgun.webhooks;

// Global app configuration section
app.set('views', 'cloud/views');  // Specify the folder to find templates
app.set('view engine', 'jade');    // Set the template engine
app.use(express.bodyParser());    // Middleware for reading request body

// Handle routes
// app.get()
app.post("/testEmailHook", routes.testEmailHook);

// Mailgun webhook routes
app.post("/" + mg_webhooks["bounce"],  routes[mg_webhooks["bounce"]]);
app.post("/" + mg_webhooks["deliver"], routes[mg_webhooks["deliver"]]);
app.post("/" + mg_webhooks["drop"],    routes[mg_webhooks["drop"]]);
app.post("/" + mg_webhooks["spam"],    routes[mg_webhooks["spam"]]);
app.post("/" + mg_webhooks["unsubscribe"], routes[mg_webhooks["unsubscribe"]]);
app.post("/" + mg_webhooks["click"],   routes[mg_webhooks["click"]]);
app.post("/" + mg_webhooks["open"],    routes[mg_webhooks["open"]]);

// Attach the Express app to Cloud Code.
app.listen();
