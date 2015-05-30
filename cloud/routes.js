// Routing module
var cloud_code = require("cloud/cloudcode");
var api_keys = require("cloud/keys");
var  ps_keys = api_keys.parse;
var  mg_keys = api_keys.mailgun;

module.exports[mg_keys.webhooks["onboard"]] = function(req, res) {
  // Parse beforeSave webhook when object is created or modified
  // Sends a predefined template email to an email in emailAddress
  var template_id = "sTmfbil4T3"; // Manually selected from Parse database

  if(req.body.object.sentRegEmail == undefined ||
     req.body.object.sentRegEmail == false) { // Object is newly created
    Parse.Cloud.run("emailUsers",
      {
        "user_email": req.body.object.emailAddress,
        "template_id": template_id
      },
      {
        success: function(retval) {
          // Set sentRegEmail to true by responding with JSON object
          res.status(200).send(
            {
              "success": {
                "sentRegEmail": true,
                "emailAddress": req.body.object.emailAddress
              }
            }
          );
        },
        error: function(error) {
          console.log("Error saving object...");
          res.status(200).send( { "error": {} } );
        }
      }
    );
  } else {
    // Do not change any fields
    res.status(200).send( { "success": req.body.object } );
  }
};




/**** ******** ****\
 **** ******** ****
 **** Webhooks ****
 **** ******** ****
\**** ******** ****/
module.exports.initializeHooks = function(req, res) {
  // TODO: place for loop here because of successive callbacks within function
  var  webhooks = require("cloud/keys").mailgun.webhooksInit;
  var ajaxCalls = mg_keys.webhooks.length;

  for(var key in webhooks) {
    Parse.Cloud.run("emailCreateWebHook",
      {
        hook_key: key,
        hook_url: webhooks[key]
      },
      {
        success: function(retval) {
          --ajaxCalls;
          if(ajaxCalls <= 0) {
            res.send(200);
          }
        },
        error: function(err) {
          --ajaxCalls;
          if(ajaxCalls <= 0) {
            res.send(406);
          }
        }
      }
    );
  }
};

module.exports[mg_keys.webhooks["delivered"]]     = function(req, res) {
  // Mailgun email webhook when email is delivered
  Parse.Cloud.run("updateEmailEvent", { body: req.body }).then(
    function(retval) {
      res.status(200);
    },
    function(err) {
      res.status(406);
    }
  );
};

module.exports[mg_keys.webhooks["bounced"]]      = function(req, res) {
  res.status(406);
};

module.exports[mg_keys.webhooks["dropped"]]        = function(req, res) {
  res.status(406);
};

module.exports[mg_keys.webhooks["spam"]]        = function(req, res) {
  res.status(406);
};

module.exports[mg_keys.webhooks["unsubscribed"]] = function(req, res) {
  res.status(406);
};

module.exports[mg_keys.webhooks["clicked"]]       = function(req, res) {
  Parse.Cloud.run("updateEmailEvent", { body: req.body }).then(
    function(retval) {
      res.status(200);
    },
    function(err) {
      res.status(406);
    }
  );
};

module.exports[mg_keys.webhooks["opened"]]        = function(req, res) {
  Parse.Cloud.run("updateEmailEvent", { body: req.body }).then(
    function(retval) {
      res.status(200);
    },
    function(err) {
      res.status(406);
    }
  );
};
