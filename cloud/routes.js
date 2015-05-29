// Routing module
var api_keys = require("cloud/keys");
var  ps_keys = api_keys.parse;
var  mg_keys = api_keys.mailgun;

module.exports.testEmailHook = function(req, res) {
  // A webhook returns with the following schema:
  // {
  //  "object": {
  //    "column": "value"
  //  },
  //  "triggerName": "afterSave"
  //  }
  // }

  Parse.Cloud.run("emailUsers",
    {
      "user_email": req.body.object.emailAddress,
      "template_id": "sTmfbil4T3"
    },
    {
      success: function(retval) {
        console.log(retval);
        res.send(retval);
      },
      error: function(error) {
        console.log(error);
        res.send(error);
      }
    }
  );
};


module.exports[mg_keys.webhooks["bounce"]]      = function(req, res) {
  res.send(undefined);
};

module.exports[mg_keys.webhooks["deliver"]]     = function(req, res) {
  res.send(undefined);
};

module.exports[mg_keys.webhooks["drop"]]        = function(req, res) {
  res.send(undefined);
};

module.exports[mg_keys.webhooks["spam"]]        = function(req, res) {
  res.send(undefined);
};

module.exports[mg_keys.webhooks["unsubscribe"]] = function(req, res) {
  res.send(undefined);
};

module.exports[mg_keys.webhooks["click"]]       = function(req, res) {
  res.send(undefined);
};

module.exports[mg_keys.webhooks["open"]]        = function(req, res) {
  res.send(undefined);
};
