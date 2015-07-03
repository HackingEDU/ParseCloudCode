module.exports = {} // Parse cloud definitions do not need to be exported

var  Mailgun = require("mailgun");
var all_keys = require("cloud/keys");
var  ps_keys = all_keys.parse;
var  mg_keys = all_keys.mailgun;
Mailgun.initialize(mg_keys.domainURL, mg_keys.secretKey);

function templateReplace(html,data) {
  // @html: string for variables to replace
  // @data: object containing { word: "replaceWith", ... }
  return html.replace(/%[a-zA-Z]+%/g,
   function(key) {
     key = key.slice(1, -1);
     return data.hasOwnProperty(key) ? data[key] : "";
   }
  );
}

/*                   *\
 * ***************** *
 * ***************** *
 * *****Webhooks**** *
 * ***************** *
 * ***************** *
\*                   */
Parse.Cloud.afterSave(Parse.User, function(req) {
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
    //    res.success()
    //    res.error()
    //  }
    // console.log(req, res); Probably not a good idea
    Parse.Cloud.useMasterKey();
    //var acl = new Parse.ACL();
    //acl.setPublicReadAccess(true);
    //acl.setPublicWriteAccess(true);
    //req.object.setACL(acl);

    var user = req.object;
    var template_id = undefined;
    var emails_received = user.get("emailsReceived");

    // If no emails has ever been sent to this user...
    if(emails_received === undefined) {
      // Set up template query
      var Templates = Parse.Object.extend("EmailTemplates");
      var tquery = new Parse.Query(Templates);
      // Search for first template email marked type: "onboard"
      tquery.equalTo("type", "onboard");

      tquery.first().then( // Retrieve template email
        function sendEmail(retval) {
          template_id = retval.id;

          if(user.get("username") === undefined) {
            return Parse.Promise.error("Could not find username");
          } else {
            return Parse.Cloud.run("emailUsers",
              {
                "user_emails": user.get("username"),
                "template_id": template_id
              }
            );
          }

        }
      ).then( // Save email
        function saveEmails(retval) {
          // Email(s) sent successfully
          // Immediately update user fields in case of save failure
          //    @retval: list of message ids that were sent
          var promises = [];

          var emails_received = [];
          for(var i = 0; i < retval.length; i++) {
            emails_received.push(retval[i].id);

            promises.push(
              Parse.Cloud.run("saveEmail",
                {
                  message_id:  retval[i].id,
                  template_id: template_id
                }
              )
            );
          }

          if(emails_received.length > 0) {
            user.set("emailsReceived", emails_received);
            user.set("verifiedEmail",  true);
          } else {
            user.set("emailsReceived", undefined);
            user.set("verifiedEmail", false);
          }

          promises.push(user.save(null)); // TODO: Potentially recursive
          return Parse.Promise.when(promises);
        }
      ).then(
        function successes() { /* Successful, do nothing */ },
        function errors() { // Problems sending email(s)
          console.log("Error sending/saving email...", arguments);
        }
      );

    }

  }
);



Parse.Cloud.define("editUser",
  function(req, res) {
  // Dumbass workaround because of permissions
  //    @id:
  //    @hash:
  //    @fields: value
    Parse.Cloud.useMasterKey();

    var id   = req.params.id;
    var hash = req.params.hash;

    var user_query = new Parse.Query(Parse.User);
    if(id)        { user_query.equalTo("objectId", id); }
    else if(hash) { user_query.equalTo("hash",   hash); }
    else          { res.error("User not found."); }

    user_query.first().then(
      function saveUser(retval) {
        for(var key in req.params.fields) {
          retval.set(key, req.params.fields[key]);
        }

        return retval.save({});
      }
    ).then(
      function success(retval) {
        res.success(retval);
      },
      function error(err) {
        res.error(err);
      }
    );
  }
);




Parse.Cloud.define("validateFields",
  // Checks if body is valid
  //    @object: { username: "user", ... }
  function(req, res) {
    try {
      var body = req.params.body;

      // This function can only return when all fields have been validated
      // Due to some of them requiring AJAX, we should handle with counters
      var ajax_counter = 1; // Number of fields to validate
      var rejections   = {};

      function checkEnd() {
        if(--ajax_counter <= 0) {
          if(Object.keys(rejections).length > 0) {
            res.error({
              code: 406,
              message: "Invalid fields",
              fields: rejections
            });
          } else {
            res.success({
              code: 200,
              message: "All fields are valid",
            });
          }
        }
      }

      // Synchronous checks //
      // Validate first/last name
      // Just check for existence...
      // TODO: finish when we use camelCase for validation

      // Validate password
      if(body.password.length < 6) {
        rejections["password"] = "Password too short";
      }


      //// Validate phone (existence)
      //if(req.params.phone === undefined || req.params.phone == "") {
      if(body.phone === undefined || body.phone == "") {
        rejections["phone"] = "Invalid phone number";
      }

      //// Validate school (existence)
      if(body.school === undefined || body.school == "") {
        rejections["school"] = "Invalid schools";
      }

      //// Validate date of birth (existence)
      //// TODO: currently, field names use client side...

      //// Validate other site usernames
      //// Check for slashes, we only want the username

      //// Validate if interested in job (existence)
      if(body.job === undefined || body.job == "") {
        rejections["job"] = "Interested in Job not populated";
      }

      //// Validate if interested in Terms of Service accepted (existence)
      if(body.tos === undefined || body.tos == "") {
        rejections["tos"] = "User did not agree to terms of service";
      }

      // Validate school
      // TODO: school validation...
      // possibly another HTTP request? or an internal list of schools
      // yeah let's do that


      // AJAX REQUESTS
      // Validate email
      var user_query = new Parse.Query(Parse.User);
      user_query.equalTo("username", body.email);

      Parse.Promise.when(
        user_query.first(),
        Parse.Cloud.httpRequest(
          {
            method: "GET",
               url: "https://api:" + mg_keys.publicKey + "@" + mg_keys.baseURL +
                     "/address/validate",
            params: { address: body.email },
          }
        )
      ).then(
        function(user_retval, email_retval) {
          if(user_retval !== undefined) {
            rejections["email"] = "Email already exists";
          } else if(!email_retval.data.is_valid) {
            rejections["email"] = "Email is invalid";
          }

          checkEnd();
        },
        function(err) {
          console.log("Error making query or HTTP request");
          console.log(arguments);
          checkEnd();
        }
      );

    } catch(e) {
      res.error("Unknown exception occured.");
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
    if(req.params.user_emails === undefined) {
      res.error({ code: 109, message: "Emails not specified" });
    }

    // Set up EmailTemplates queries
    var EmailTemplates = Parse.Object.extend("EmailTemplates");
    var email_query = new Parse.Query(EmailTemplates);
    var user_query  = new Parse.Query(Parse.User);
    var emails      = req.params.user_emails.split(",");

    Parse.Promise.when(
      email_query.get(req.params.template_id),       // Look for email template
      user_query.containedIn("username", emails).find() // Filter only to users in emails[]
    ).then(
      function sendEmails(template, user_list) {
        // @template:  template object
        // @user: TODO: hack
        // @user_list: list of parse objects
        var promises = [];

        if(user_list.length == 0) {
          return Parse.Promise.error("Could not find emails");
        }

        for(var i = 0; i < user_list.length; i++) {
          var user = user_list[i];
          // If user is unsubscribed...
          if(user.get("unsubscribed")) {
            return Parse.Promise.error("User has been unsubscribed.");
          } else {
            var email =
            {
              to:      user.get("username"),
              from:    template.get("sender"),
              subject: template.get("subject"),
              text:    template.get("strippedText"),
              html:    template.get("bodyHTML")
            };

            // Retrieve all template variables specified in email
            // Create template matching object
            var keys = email.html.match(/%[a-zA-Z]+%/g);
            if(keys === undefined || keys === null) keys = [];
            var data = {};

            for(var i = 0; i < keys.length; i++) {
              // Slice off % at ends
              var key = keys[i].slice(1, -1);
              var val = user.get(key);

              // TODO: check what gets returned if user[key] doesn't exist
              if(val === undefined || val == "") {
                data[key] = "<b>" + keys[i] + "</b>";
              } else {
                data[key] = val;
              }
            }

            data["unsubscribe"] = mg_keys.unsubscribeURL + "?q=" + user.get("hash");
            // Replace template variables
            email.html = templateReplace(email.html, data);

            // Send email object
            promises.push(Mailgun.sendEmail(email));
          }
        }

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
        req.params.sender = "team@hackingedu.co";
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
        if(event_query == null || event_query === undefined) return Parse.Promise.error();
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
