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
    // Set up EmailTemplates queries
    var EmailTemplates = Parse.Object.extend("EmailTemplates");
    var query = new Parse.Query(EmailTemplates);

    // Look for requested email template
    query.get(req.params.template_id,
      {
        success: function(retval) {
          // Create local mailgun cloud instance due to callback scope
          // we gon in deep
          var Mailgun = require("mailgun");
          var mg_keys = require("cloud/keys");
          Mailgun.initialize(mg_keys.mailgunDomain, mg_keys.mailgunKey);

          // Create email object for sending
          var email = {
            to:      req.params.user_email,
            from:    "domain@example.com",
            subject: retval.get("subject"),
            html:    retval.get("html")
          };

          // Send email object
          Mailgun.sendEmail(email,
            {
              success: function(httpRes) {
                // TODO: Add email to Emails for tracking
                res.success("Email sent.");
              },
              error: function(httpRes) {
                res.error("Email not sent.");
              }
            }
          );
        },
        error: function(object, error) {
          res.error("Could not find requested email template");
        }
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
            console.log(httpRes.message, httpRes.url);
            res.success(true);
          },
          error: function(httpRes) {
            console.error(httpRes.message);
            res.error(true);
          }
        }
      );
    }
  }
);
