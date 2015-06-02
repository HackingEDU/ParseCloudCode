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
    var  mg_keys = require("cloud/keys").mailgun;
    var mg_url = "https://api:" + mg_keys.publicKey + "@" + mg_keys.baseURL +
                 "/address/validate";

    Parse.Cloud.httpRequest(
      {
        method: "GET",
        url: mg_url,
        params: {
          address: req.params.email_address
        },
        success: function(httpRes) {
          /* === Sample response ===
            "is_valid": true,
            "address": "foo@mailgun.net",
            "parts": {
              "display_name": null //Deprecated Field, will always be null
                "local_part": "foo",
                "domain": "mailgun.net",
            },
            "did_you_mean": null
          */
          if(httpRes.data.is_valid) {
            res.success(true);
          } else {
            res.error(false);
          }
        },
        error: function(httpRes) {
          res.error(false);
        }
      }
    );
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
    var email_query = new Parse.Query(EmailTemplates);

    // Look for requested email template
    email_query.get(req.params.template_id)
      .then(
        function(retval) { // email_query for email template success
          // Create email object for sending
          var email =
            {
              to:      req.params.user_email,
              from:    retval.get("sender"),
              subject: retval.get("subject"),
              html:    retval.get("html")
            };

          // Send email object
          return Mailgun.sendEmail(email);
        }
      ).then(
        function(httpRes) { // Email sent success
          res.success(
            {
              // format for message_id response is <12345.12345@blah.com>
              // Need to slice off ends to normalize
              message_id:  httpRes.data.id.slice(1, -1),
              template_id: req.params.template_id
            }
          );
        },
        function(error) {
          // Error returns as http response
          res.error(error.message);
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
                 "/domains/"    + mg_keys.domainURL + "/webhooks";
    var wb_url = "https://" + ps_keys.baseURL + "/domains/" + req.params.hook_url;

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
  // Save email into Emails, Metadata and Events for tracking
  //    @message_id: returned when sending email from mailgun
  //    @template_id:  Parse object to template
  function(req, res) {
    var Emails = Parse.Object.extend("Emails");
    var emails = new Emails();
    var Events = Parse.Object.extend("EmailEvents");
    var events = new Events();
    var Metadata = Parse.Object.extend("EmailMetadata");
    var metadata = new Metadata();

    // Initialize objects
    emails.set({"messageId": req.params.message_id});
    if(req.params.template_id !== undefined) {
      emails.set(
        {
          "templateId":
          {
            "__type": "Pointer",
            "className": "EmailTemplates",
            "objectId": req.params.template_id
          }
        }
      );
    }

    events.set(
      {
        "messageId":    req.params.message_id,
        "emailId":      {
                          "__type":       "Pointer",
                          "className":    "Emails",
                          "objectId":     emails.id,
                        },
        "bounced":      { "value": false, "timestamp": null },
        "delivered":    { "value": false, "timestamp": null },
        "dropped":      { "value": false, "timestamp": null },
        "spam":         { "value": false, "timestamp": null },
        "clicked":      { "value": false, "timestamp": null },
        "opened":       { "value": false, "timestamp": null },
        "unsubscribed": { "value": false, "timestamp": null }
      }
    );

    metadata.set({"messageId": req.params.message_id});
    metadata.set(
      {
        "emailId":
          {
            "__type": "Pointer",
            "className": "Emails",
            "objectId": emails.id
          },
        "messageId":   req.params.message_id,
        "ip":          undefined,
        "country":     undefined,
        "region":      undefined,
        "city":        undefined,
        "userAgent":   undefined,
        "deviceType":  undefined,
        "clientType":  undefined,
        "clientName":  undefined,
        "clientOs":    undefined
      }
    );

    var ajaxCounter = 3;
    emails.save({}, {
      success: function(email_obj) {
        //Object saved successfully
        if(--ajaxCounter <= 0) {
          res.success(emails);
        }
      }
    });
    events.save({}, {
      success: function(events_obj) {
        //Object saved successfully
        if(--ajaxCounter <= 0) {
          res.success(emails);
        }
      }
    });
    metadata.save({}, {
      success: function(metadata_obj) {
        //Object saved successfully
        if(--ajaxCounter <= 0) {
          res.success(emails);
        }
      }
    });
  }
);

Parse.Cloud.define("updateEmailEvent",
  // Update an email with data from webhook
  //    @body: Post event's body
  function(req, res) {
    var body = req.params.body;
    // Dumb Mailgun inconsistency sh**
    if(body["body"] !== undefined) { body = body["body"]; }

    if(body["message-id"] !== undefined) {
      body["Message-Id"] = body["message-id"]; // More inconsistency
    } else {
      // Slice off < and > for delivery webhook
      body["Message-Id"] = body["Message-Id"].slice(1, -1);
    }

    // Event and Metadata queries
    var Events = Parse.Object.extend("EmailEvents");
    var event_query = new Parse.Query(Events);
    event_query.equalTo("messageId", body["Message-Id"]);

    var Meta   = Parse.Object.extend("EmailMetadata");
    var meta_query  = new Parse.Query(Meta);
    meta_query.equalTo("messageId", body["Message-Id"]);

    event_query.first().then(
      function eventFound(event_query) {
        console.log(body["event"]);
        event_query.set(body["event"], { timestamp: null, value: true });
        return event_query.save(null);
      }
    ).then(
      function eventSaved(event_obj) {
        return meta_query.first();
      }
    ).then(
      function metaQuery(meta_found) {
        meta_found.set(
          {
            "ip":          body["ip"],
            "country":     body["country"],
            "region":      body["region"],
            "city":        body["city"],
            "userAgent":   body["user-agent"],
            "deviceType":  body["device-type"],
            "clientType":  body["client-type"],
            "clientName":  body["client-name"],
            "clientOs":    body["client-os"]
          }
        );
        return meta_found.save(null);
      }
    ).then(
      function (meta_obj) {
        res.success("Events and Metadata saved");
      },
      function (meta_obj, error) {
        res.error("Events and Metadata unable to be saved");
      }
    );
  }
);
