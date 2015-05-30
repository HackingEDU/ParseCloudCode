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
          res.status(200).send( { "success": { "sentRegEmail": true } } );
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
    {
      success: function(retval) {
        res.send(retval);
      },
      error: function(err) {
        res.send(err);
      }
    }
  );
}

module.exports[mg_keys.webhooks["bounce"]]      = function(req, res) {
  res.status(200);
};

module.exports[mg_keys.webhooks["deliver"]]     = function(req, res) {
  res.status(200);
};

module.exports[mg_keys.webhooks["drop"]]        = function(req, res) {
  res.status(200);
};

module.exports[mg_keys.webhooks["spam"]]        = function(req, res) {
  res.status(200);
};

module.exports[mg_keys.webhooks["unsubscribe"]] = function(req, res) {
  res.status(200);
};

module.exports[mg_keys.webhooks["click"]]       = function(req, res) {
  res.status(200);
};

module.exports[mg_keys.webhooks["open"]]        = function(req, res) {
  res.status(200);
};
