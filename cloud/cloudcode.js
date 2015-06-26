module.exports = {} // Parse cloud definitions do not need to be exported

var Mailgun  = require("mailgun");
var all_keys = require("cloud/keys");
var ps_keys  = all_keys.parse;
var  mg_keys = all_keys.mailgun;
Mailgun.initialize(mg_keys.domainURL, mg_keys.secretKey);

/*                   *\
 * ***************** *
 * ***************** *
 * *****Webhooks**** *
 * ***************** *
 * ***************** *
\*                   */
Parse.Cloud.beforeSave(Parse.User, function(req, res) {
    //  Email user before finally saving
    //  Parse.Cloud.run("validateFields") should be ran before this...
    //
    //  @req: {
    //    installationId: string
    //    master: bool, if master key was used
    //    object: actual Parse object
    //    user: if !=undefined, user that made request
    //    }
    //  @res: {
    //    res.succes()
    //    res.error()
    //  }
    // console.log(req, res); Probably not a good idea
    Parse.Cloud.useMasterKey();
    var acl = new Parse.ACL();
    acl.setPublicReadAccess(true);
    req.object.setACL(acl);

    var user = req.object;
    var template_id = undefined;
    var sent_reg = user.sentRegEmail;

    if(sent_reg == undefined || sent_reg == false) { // Object is newly created
      // Set up template query
      var Templates = Parse.Object.extend("EmailTemplates");
      var tquery = new Parse.Query(Templates);
      // Search for first template email marked type: "onboard"
      tquery.equalTo("type", "onboard");

      tquery.first().then( // Retrieve template email
        function sendEmail(retval) {
          template_id = retval.id;

          return Parse.Cloud.run("emailUsers",
            {
              "user_emails": user.get("username"),
              "template_id": template_id
            }
          );
        }
      ).then( // Save email
        function saveEmails(retval) {
          // Email(s) sent successfully
          var promises = [];

          for(var i = 0; i < retval.length; i++) {
            promises.push(
              Parse.Cloud.run("saveEmail",
                {
                  message_id:  retval[i].id,
                  template_id: template_id
                }
              )
            );
          }

          return Parse.Promise.when(promises);
        }
      ).then( // Save user
        function saveUsers() {
          console.log(arguments);

          // Update user fields
          user.set("verifiedEmail", true);
          user.set("sentRegEmail",  true);
          user.regEmail      =
            {
                 "__type": "Pointer",
              "className": "Emails",
               "objectId": arguments[0].id // Doesn't matter... just save first id
            }
          res.success(user);
        },
        function(error) { // Problems sending email(s)
          // Handle gracefully
          console.log("Error sending/saving email...", error);
          user.set("verifiedEmail", false);
          user.set("sentRegEmail",  false);
          res.success(user);
        }
      );
    } else {
      // No need to change any fields
      res.success(user);
    }
  }
);





Parse.Cloud.define("validateFields",
  // Checks if body is valid
  //    @object: { username: "user", ... }
  function(req, res) {
    try {
      var ajax_counter = 2; // Number of fields to validate
      var rejections   = [];

      function checkEnd() {
        if(--ajax_counter <= 0) {
          if(rejections.length > 0) {
            res.error({
              code: 406,
              message: "Invalid fields",
              fields: rejections
            });
          } else {
            res.success({
              code: 200,
              message: "All fields are valid",
              fields: []
            });
          }
        }
      }

      // Validate email
      Parse.Cloud.httpRequest(
        {
          method: "GET",
             url: "https://api:" + mg_keys.publicKey + "@" + mg_keys.baseURL +
                   "/address/validate",
          params: { address: req.params.body.email },
        }
      ).always(
        function callback(response) {
          if(!response.data.is_valid || response.data.is_valid === undefined) {
            rejections.push("email");
          }
          checkEnd();
        }
      );

      // Validate school
      // TODO: school validation...
      // possibly another HTTP request? or an internal list of schools
      // yeah let's do that
      checkEnd();

      // TODO: additional fields

    } catch(e) {
      console.log("Validation exception occured.");
      res.error(e);
    }
  }
);







/*                   *\
 * ***************** *
 * ***************** *
 * Mailgun functions *
 * ***************** *
 * ***************** *
\*                   */

Parse.Cloud.define("emailUsers",
  // Emails a template to a user with a given aray of email addresses
  //    @user_emails: comma seperated list of email addresses
  //    @template_id:  ID of template being used
  function(req, res) {
    // Set up EmailTemplates queries
    var EmailTemplates = Parse.Object.extend("EmailTemplates");
    var email_query = new Parse.Query(EmailTemplates);
    var user_query  = new Parse.Query(Parse.User);
    var emails      = req.params.user_emails.split(",");

    if(req.params.user_emails === undefined) {
      res.error({ code: 109, message: "Emails not specified" });
    }

    Parse.Promise.when(
      email_query.get(req.params.template_id), // Look for email template
      user_query.containedIn("email", emails)  // Filter only to users in emails
    ).then(
      function sendEmails(template, user_list) {
        // @template:  template object
        // @user_list: list of parse objects
        var promises = [];

        // For now, user list will just be email list...
        // Need to work on filtering by array

        //for(var i = 0; i < user_list.length; i++) {
          var email =
            {
              to:      req.params.user_emails,
              from:    template.get("sender"),
              subject: template.get("subject"),
              text:    template.get("strippedText"),
              html:    template.get("bodyHTML")
            };

          // TODO: Replace template variables here

          // Send email object
          promises.push(Mailgun.sendEmail(email));
        //}
        return Parse.Promise.when(promises);
      }

    ).then(
      function sanitize() { //
        // Format for arguments: (part that we care about)
        // arguments[0] = { data: { id: <123id> } };

        var retval = [];

        for(var i = 0; i < arguments.length; i++) {
          // format for message_id response is <12345.12345@blah.com>
          // Need to slice off ends to normalize
          // message_id:  httpRes.data.id.slice(1, -1),

          arguments[i].data.id = arguments[i].data.id.slice(1, -1);
          retval.push( { id: arguments[i].data.id } );
        }

        res.success(retval); // Send all data returned from promises
      },
      function error(err) {
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
    // POST https://api:{mgKey}@api.mailgun.net/v3/domains/{domainName}/webhooks
    var mg_url = "https://api:" + mg_keys.secretKey + "@" + mg_keys.baseURL +
                 "/domains/"    + mg_keys.domainURL + "/webhooks";
    var wb_url = "https://" + ps_keys.baseURL + "/webhooks/" + req.params.hook_url;

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
          res.error(JSON.parse(httpRes.text).message);
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
  //    @direction: inbound or outbound
  function(req, res) {
    var Emails = Parse.Object.extend("Emails");
    var emails = new Emails();

    // Initialize objects
    emails.set(
      {
        "messageId": req.params.message_id,
        "direction": ((req.params.direction === undefined)
                     ? "outbound" : req.params.direction)
      }
    );
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
