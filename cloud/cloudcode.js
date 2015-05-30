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
              message_id: httpRes.data.id,
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
  function(req, res) {
    var all_keys = require("cloud/keys");
    var  ps_keys = all_keys.parse;
    var  mg_keys = all_keys.mailgun;

    for(var hook_key in mg_keys.webhooks) {
      Parse.Cloud.httpRequest(
        {
          method: "POST",
          body:
            {
              id: hook_key,
              url: "https://" + ps_keys.baseURL +
                   "/" + mg_keys.webhooks[hook_key]
            },
          url:
            // POST https://api:{mgKey}@api.mailgun.net/v3/domains/{domainName}/webhooks
            "https://api:" + mg_keys.secretKey + "@" + mg_keys.baseURL +
            "/" + mg_keys.domainURL + "/webhooks",
          success: function(httpRes) {
            res.success(true);
          },
          error: function(httpRes) {
            res.error(true);
          }
        }
      );
    }
  }
);


Parse.Cloud.define("saveEmail",
  // Save email into Emails for tracking
  //    @message_id: returned when sending email from mailgun
  //    @template_id:  Parse object to template
  function(req, res) {
    var Emails = Parse.Object.extend("Emails");
    var emails = new Emails();

    // Strip < and > from message
    var stripped_message_id = req.params.message_id.slice(1, -1);

    // Save email into Emails
    emails.save(
      {
        "messageId": stripped_message_id,
        "templateId":
          {
               "__type": "Pointer",
            "className": "EmailTemplates",
             "objectId": req.params.template_id
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
