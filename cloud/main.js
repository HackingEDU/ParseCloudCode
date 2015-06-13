
// These two lines are required to initialize Express in Cloud Code.
var express = require("express");
var     app = express();
var parseExpressRawBody = require("parse-express-raw-body");
var  routes = require("cloud/routes");
var mg_webhooks = require("cloud/keys").mailgun.webhooks;

// Global app configuration section
app.set('views', 'cloud/views');  // Specify the folder to find templates
app.set('view engine', 'jade');   // Set the template engine
app.use(express.bodyParser());    // Middleware for reading request body
app.use(parseExpressRawBody());   // Middleware for non JSON/form-urlencoded

// HTTP Routes
// app.get()
app.get("/",          routes.index);
app.get("/index",     routes.index);
app.get("/templates", routes.template);
app.get("/sending",   routes.sending);
app.get("/tracking",  routes.tracking);
app.get("/routing",   routes.routing);

// AJAX routes
app.post("/action/sendTemplate", routes.sendTemplate);
app.get("/action/getTemplates",  routes.getTemplates);
app.get("/action/getEmails",     routes.getEmails);
// TODO: phase this out...
app.get("/initializeHooks",      routes.initializeHooks);

// Mailgun webhook routes
app.post("/" + mg_webhooks["template"],  routes[mg_webhooks["template"]]);
app.post("/" + mg_webhooks["onboard"],   routes[mg_webhooks["onboard"]]);
app.post("/" + mg_webhooks["bounced"],   routes[mg_webhooks["bounced"]]);
app.post("/" + mg_webhooks["delivered"], routes[mg_webhooks["delivered"]]);
app.post("/" + mg_webhooks["dropped"],   routes[mg_webhooks["dropped"]]);
app.post("/" + mg_webhooks["spam"],      routes[mg_webhooks["spam"]]);
app.post("/" + mg_webhooks["clicked"],   routes[mg_webhooks["clicked"]]);
app.post("/" + mg_webhooks["opened"],    routes[mg_webhooks["opened"]]);
app.post("/" + mg_webhooks["unsubscribed"], routes[mg_webhooks["unsubscribed"]]);

// Attach the Express app to Cloud Code.
app.listen();
