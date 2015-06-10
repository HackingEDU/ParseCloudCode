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
              text:    retval.get("strippedText"),
              html:    retval.get("bodyHTML")
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

Parse.Cloud.define("emailCreateTemplate",
  // Save email into Emails, Metadata and Events for tracking
  //    @body: returned when sending email from mailgun
  //    @sender:  Parse object to template
  function(req, res) {
    try {
      // Default values
      if(req.params.body === undefined) {
        res.error("No body specified");
      }
      if(req.params.sender === undefined) {
        req.params.sender = "no-reply@hackingedu.co";
      }

      // Create new template
      var Templates = Parse.Object.extend("EmailTemplates");
      var template = new Templates();

      // Populate template fields
      template.set("subject",           req.params.body["subject"]);
      template.set("sender",            req.params.sender);
      template.set("importance",        req.params.body["Importance"]);
      template.set("bodyPlain",         req.params.body["body-plain"]);
      template.set("bodyHTML",          req.params.body["body-html"]);
      template.set("signature",         req.params.body["signature"]);
      template.set("strippedHTML",      req.params.body["stripped-html"]);
      template.set("strippedText",      req.params.body["stripped-text"]);
      template.set("strippedSignature", req.params.body["stripped-signature"]);
      template.save({}).then(
        function(new_template) {
          res.success("Template created.");
        },
        function(new_template, error) {
          res.error("Could not create template.");
        }
      );
    } catch(e) {
      res.error("Exception occured.");
    }
  }
);



Parse.Cloud.define("saveEmail",
  // Save email into Emails, Metadata and Events for tracking
  //    @message_id: returned when sending email from mailgun
  //    @template_id:  Parse object to template
  function(req, res) {
    var Emails = Parse.Object.extend("Emails");
    var emails = new Emails();

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
    emails.save({}).then(
      function emailSaved(email_obj) {
        var Events = Parse.Object.extend("EmailEvents");
        var events = new Events();
        var Metadata = Parse.Object.extend("EmailMetadata");
        var metadata = new Metadata();

        events.set(
          {
            "messageId":    email_obj.get("messageId"),
            "emailId":      {
                              "__type":       "Pointer",
                              "className":    "Emails",
                              "objectId":     email_obj.id
                            },
            "bounced":      undefined,
            "delivered":    undefined,
            "dropped":      undefined,
            "spam":         undefined,
            "clicked":      undefined,
            "opened":       undefined,
            "unsubscribed": undefined
          }
        );

        metadata.set(
          {
            "emailId":
            {
              "__type": "Pointer",
              "className": "Emails",
              "objectId": email_obj.id
            },
            "messageId":   email_obj.get("messageId"),
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

        events.save({}).then(
          function(ev_obj) {
            email_obj.set({
              "events":
              {
                "__type": "Pointer",
                "className": "EmailEvents",
                "objectId": ev_obj.id
              }
            });
            return metadata.save({});
          }
        ).then(
          function(mt_obj) {
            email_obj.set({
              "metadata":
              {
                "__type": "Pointer",
                "className": "EmailMetadata",
                "objectId": mt_obj.id
              }
            });
            return email_obj.save({});
          }
        ).then(
          function(email_obj_new) {
            res.success(email_obj_new);
          }
        );
      }
    );
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
        switch(body["event"]) {
          case "bounced":
            event_query.set({
                "bounced":
                  {
                    "value":        true,
                    "timestamp":    body["timestamp"],
                    "notification": body["notification"],
                    "code":         body["code"],
                    "error":        body["error"],
                    "campaignId":   body["campaign-id"],
                    "campaignName": body["campaign-name"]
                  }
              }
            );
            break;
          case "delivered":
            event_query.set({
                "delivered":
                  {
                    "value":       true,
                    "timestamp":   body["timestamp"],
                  }
              }
            );
            break;
          case "dropped":
            event_query.set({
                "dropped":
                  {
                    "value":       true,
                    "timestamp":   body["timestamp"],
                    "reason":      body["reason"],
                    "code":        body["code"],
                    "description": body["error"]
                  }
              }
            );
            break;
          case "spam":
            event_query.set({
                "spam":
                  {
                    "value":        true,
                    "timestamp":    body["timestamp"],
                    "campaignId":   body["campaign-id"],
                    "campaignName": body["campaign-name"]
                  }
              }
            );
            break;
          case "unsubscribed":
            event_query.set({
                "unsubscribed":
                  {
                    "value":        true,
                    "timestamp":    body["timestamp"],
                    "campaignId":   body["campaign-id"],
                    "campaignName": body["campaign-name"]
                  }
              }
            );
            break;
          case "clicked":
            event_query.set({
                "clicked":
                  {
                    "value":        true,
                    "timestamp":    body["timestamp"],
                    "campaignId":   body["campaign-id"],
                    "campaignName": body["campaign-name"]
                  }
              }
            );
            break;
          case "opened":
            event_query.set({
                "opened":
                  {
                    "value":        true,
                    "timestamp":    body["timestamp"],
                    "campaignId":   body["campaign-id"],
                    "campaignName": body["campaign-name"]
                  }
              }
            );
            break;
        }

        event_query.set("recipient", body["recipient"]);
        return event_query.save(null);
      }
    ).then(
      function eventSaved(event_obj) {
        var pemail = event_obj.get("emailId");
        pemail.set("recipient", body["recipient"]);
        return pemail.save({});
      }
    ).then(
      function parentSaved(parent_obj) {
        return meta_query.first();
      }
    ).then(
      function metaQuery(meta_found) {
        switch(body["event"]) {
          case "opened":
          case "clicked":
          case "unsubscribed":
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
            break;
          default:
            break;
        }
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
