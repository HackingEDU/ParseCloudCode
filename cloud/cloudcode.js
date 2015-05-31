module.exports = {} // Parse cloud definitions do not need to be exported


/*                   *\
 * ***************** *
 * ***************** *
 * Mailgun functions *
 * ***************** *
 * ***************** *
\*                   */
Parse.Cloud.define("validateEmail",
  // Checks if email is valid and can be sent to
  //    @email_address: potentially valid email address
  function(req, res) {
    // Do nothing and return true
    res.success(true);
  }
);

Parse.Cloud.define("emailUsers",
  // Emails a template to a user with a given aray of email addresses
  //    @user_email: array of email addresses
  //    @template_id:  ID of template being used
  function(req, res) {
    var Mailgun = require("mailgun");
    var all_keys = require("cloud/keys");
    var  mg_keys = all_keys.mailgun;
    Mailgun.initialize(mg_keys.domainURL, mg_keys.secretKey);

    // Set up EmailTemplates queries
    var EmailTemplates = Parse.Object.extend("EmailTemplates");
    var query = new Parse.Query(EmailTemplates);

    // Look for requested email template
    query.get(req.params.template_id)
      .then(
        function(retval) { // query for email template success
          // Create email object for sending
          var email =
            {
              to:      req.params.user_email,
              from:    "domain@example.com",
              subject: retval.get("subject"),
              html:    retval.get("html")
            };

          // Send email object
          return Mailgun.sendEmail(email);
        }
      ).then(
        function(httpRes) { // Email sent success
          // TODO: Add email to Emails for tracking
          console.log(httpRes.data.message);

          return Parse.Cloud.run("saveEmail",
            {
              message_id: httpRes.data.id.slice(1, -1),
              template_id: req.params.template_id
            }
          );
        }
      ).then( // Parse function saveEmail success
        function(retval) {
          res.success(retval);
        },
        function(err) { // Error propagation
          res.error(err);
        }
      );
  }
);

Parse.Cloud.define("emailCreateWebHook",
  // Initialize and create all webhook events on Mailgun
  //    @hook_key
  //    @hook_url
  function(req, res) {
    var ps_keys = require("cloud/keys").parse;
    var mg_keys = require("cloud/keys").mailgun;

    // POST https://api:{mgKey}@api.mailgun.net/v3/domains/{domainName}/webhooks
    var mg_url = "https://api:" + mg_keys.secretKey + "@" + mg_keys.baseURL +
                 "/" + mg_keys.domainURL + "/webhooks";
    var wb_url = "https://" + ps_keys.baseURL + "/" + req.params.hook_url;

    Parse.Cloud.httpRequest(
      {
        method: "POST",
        body:
          {
            id: req.params.hook_key,
            url: wb_url
          },
        url: mg_url,
        success: function(httpRes) {
          res.success(wb_url);
        },
        error: function(httpRes) {
          res.error(false);
        }
      }
    );
  }
);


Parse.Cloud.define("saveEmail",
  // Save email into Emails for tracking
  //    @message_id: returned when sending email from mailgun
  //    @template_id:  Parse object to template
  function(req, res) {
    var Emails = Parse.Object.extend("Emails");
    var emails = new Emails();

    // Save email into Emails
    emails.save(
      {
        "messageId": req.params.message_id,
        "templateId":
          {
               "__type": "Pointer",
            "className": "EmailTemplates",
             "objectId": req.params.template_id
          },
        "events": {
          "bounced":      false,
          "delivered":    false,
          "dropped":      false,
          "spam":         false,
          "clicked":      false,
          "opened":       false,
          "unsubscribed": false
        },
        "metadata": {
          "ip":          undefined,
          "country":     undefined,
          "region":      undefined,
          "city":        undefined,
          "user-agent":  undefined,
          "device-type": undefined,
          "client-type": undefined,
          "client-name": undefined,
          "client-os":   undefined
        }
      }
    ).then(
      function(email) {
        //Object saved successfully
        res.success("Email saved!");
      },
      function(email, error) {
        res.error("Email could be not be saved.");
      }
    );
  }
);

Parse.Cloud.define("updateEmailEvent",
  // Update an email with data from webhook
  //    @body: Post event's body
  function(req, res) {
    try {
      var body = req.params.body;
      // Dumb Mailgun inconsistency sh**
      if(body["body"] !== undefined) { body = body["body"]; }

      if(body["message-id"] !== undefined) {
        body["Message-Id"] = body["message-id"]; // More inconsistency
      } else {
        // Slice off < and > for delivery webhook
        body["Message-Id"] = body["Message-Id"].slice(1, -1);
      }

      // Locate email with message_id
      var Emails = Parse.Object.extend("Emails");
      var query = new Parse.Query(Emails);
      query.equalTo("messageId", body["Message-Id"]);

      query.first()
        .then(
          function(retval) {
            // Flag event as true
            var event_obj = retval.get("events");
            event_obj[body["event"]] = true;
            retval.set("events", event_obj);

            if(body["event"] == "delivered") {
              // Set recipient
              retval.set("recipient", body["recipient"]);
              // TODO: Set timestamp
              // retval.set("timeSent", body["timestamp"]);
            }

            // Populate metadata if applicable
            if(body["event"] == "clicked" || body["event"] == "opened") {
              var meta_obj = retval.get("metadata");
              meta_obj["ip"]          = body["ip"];
              meta_obj["country"]     = body["country"];
              meta_obj["region"]      = body["region"];
              meta_obj["city"]        = body["city"];
              meta_obj["user-agent"]  = body["user-agent"];
              meta_obj["device-type"] = body["device-type"];
              meta_obj["client-type"] = body["client-type"];
              meta_obj["client-name"] = body["client-name"];
              meta_obj["client-os"]   = body["client-os"];

              if(body["event"] == "clicked") {
                meta_obj["url"] = body["url"];
                // TODO: Set timestamp
                // retval.set("timeOpened", body["timestamp"]);
              }
              retval.set("metadata", meta_obj);
            }

            return retval.save();
          }
        ).then(
          function(retval) {
            res.success("Event " + body["event"] + " flagged.");
          },
          function(retval, err) {
            res.error("Could not flag event " + body["event"] + ".");
          }
        );
    }
    catch(err) {
      res.error("Exception occured.");
    }
  }
);
