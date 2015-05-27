module.exports = {} // Parse cloud definitions do not need to be exported


// Mailgun functions
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
