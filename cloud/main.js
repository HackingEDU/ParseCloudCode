
// These two lines are required to initialize Express in Cloud Code.
var     express = require("express");
var         app = express();
var      routes = require("cloud/routes");
var mg_webhooks = require("cloud/keys").mailgun.webhooks;

// Global app configuration section
app.set('views', 'cloud/views');  // Specify the folder to find templates
app.set('view engine', 'jade');   // Set the template engine
app.use(express.bodyParser());    // Middleware for reading request body

// HTTP Routes
app.use("/mailgun", routes.mailgun);

// AJAX routes
app.use("/actions", routes.actions);

// Webhook routes
app.use("/webhooks", routes.webhooks);

// Attach the Express app to Cloud Code.
app.listen();
