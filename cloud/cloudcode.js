module.exports = {}

// Mailgun functions
Parse.Cloud.define("validateEmail",
  // Checks if email is valid and can be sent to
  //    @email_address: potentially valid email address
  function(req, res) {
    // Do nothing and return true
    res.success(true);
  }
);

Parse.Cloud.define("emailUser",
  // Emails a template to a user based on either user ID or username
  //    @user_id:   array of object IDs
  //    @user_name: array of usernames
  //    @email_id:  ID of template being used
  function(req, res) {
    // Do nothing and return true
    res.success(true);
  }
);
