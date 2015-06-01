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
    Parse.Cloud.run("validateEmail",
      { email_address: req.body.object.emailAddress }
      // Email validation error is propagated to end of promise chain
    ).then(
      function(retval) { // email was validated
        return Parse.Cloud.run("emailUsers",
          {
            "user_email":  req.body.object.emailAddress,
            "template_id": template_id
          }
        );
      }
    ).then(
      function(retval) {
        return Parse.Cloud.run("saveEmail",
          {
            message_id:  retval.message_id,
            template_id: retval.template_id
          }
        );
      }
    ).then(
      function(retval) {
        // email object saved, sent reg email saved
        // Respond success object with updated keys
        res.send(
          {
            "success":
            {
              "verifiedEmail": true,
              "sentRegEmail": true,
              "emailAddress": req.body.object.emailAddress,
              "regEmail":
                {
                     "__type": "Pointer",
                  "className": "Emails",
                   "objectId": retval.id
                }
            }
          }
        );
      },
      function(error) {
        console.log(error);

        res.send(
          {
            "success":
            {
              "verifiedEmail": false,
              "sentRegEmail": false,
              "emailAddress": req.body.object.emailAddress,
            }
          }
        );
      }
    );
  } else {
    console.log("Registration email already exists");
    res.status(406).send();
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
            res.send(200).send();
          }
        },
        error: function(err) {
          --ajaxCalls;
          if(ajaxCalls <= 0) {
            res.send(406).send();
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
      res.status(200).send();
    },
    function(err) {
      res.status(406).send();
    }
  );
};

module.exports[mg_keys.webhooks["bounced"]]      = function(req, res) {
  res.status(406).send();
};

module.exports[mg_keys.webhooks["dropped"]]        = function(req, res) {
  res.status(406).send();
};

module.exports[mg_keys.webhooks["spam"]]        = function(req, res) {
  res.status(406).send();
};

module.exports[mg_keys.webhooks["unsubscribed"]] = function(req, res) {
  res.status(406).send();
};

module.exports[mg_keys.webhooks["clicked"]]       = function(req, res) {
  Parse.Cloud.run("updateEmailEvent", { body: req.body }).then(
    function(retval) {
      res.status(200).send();
    },
    function(err) {
      res.status(406).send();
    }
  );
};

module.exports[mg_keys.webhooks["opened"]]        = function(req, res) {
  Parse.Cloud.run("updateEmailEvent", { body: req.body }).then(
    function(retval) {
      res.status(200).send();
    },
    function(err) {
      res.status(406).send();
    }
  );
};
