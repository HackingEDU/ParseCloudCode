// Routing module
var api_keys = require("cloud/keys");
var  ps_keys = api_keys.parse;
var  mg_keys = api_keys.mailgun;
var      md5 = require("cloud/md5").hex_md5;

/**** ******** ****\
 **** ******** ****
 **** Mailgun  ****
 **** ******** ****
\**** ******** ****/
module.exports.mailgun = function(req, res) {
  switch(req.path) {
    case "/":
      res.status(200).render("index");
      break;
    case "/templates":
      res.status(200).render("templates");
      break;
    case "/sending":
      res.status(200).render("sending");
      break;
    case "/tracking":
      res.status(200).send();
      break;
    case "/routing":
      res.status(200).send();
      break;
    default:
      res.status(404).send();
  }
}



/**** ******** ****\
 **** ******** ****
 ****   AJAX   ****
 **** ******** ****
\**** ******** ****/
var getSubClass = function(name, limit, offset) {
  // Retrieve a promise for a list of objects from Parse class
  //  @name: name of Parse class
  //  @limit: Limit how many templates to retrieve
  //  @offset: record number to start retrieving from
  var promise = Parse.Promise();

  var Class = Parse.Object.extend(name);
  var query = new Parse.Query(Class);

  if(limit > 0 && limit !== undefined)
    query.limit(limit);
  if(offset > 0 && offset !== undefined)
    query.skip(offset);
  return query.find();
}

module.exports.actions = function(req, res) {
  switch(req.path) {
    case "/" + mg_keys.webhooks["validate"]: {
      // Validate field
      //  @: { username: "user", ... }
      // req.body MUST have an email and a password field
      Parse.Cloud.run("validateFields", { body: req.body }).then(
        function success(retval) {
          res.status(200).send(retval);
        },
        function failed(err) {
          // err.message contains actual return data... <_<
          err = err.message;
          res.status(200).send(err);
        }
      );
      break;
    }

    case "/" + mg_keys.webhooks["newuser"]: {
      // Creates a new user based on req.body POST
      // req.body MUST have an email and a password field
      try {
        //if(!req.xhr) throw { code: 407, message: "Internal server error" };
        // TODO: verify post request is coming from hackingedu.co...

        var user = new Parse.User();
        delete req.body.confirm_password;

        for(var key in req.body) {
          user.set(key, req.body[key]);
        }

        // TODO: generate registration url hash
        user.set("username", req.body.email); // Mandatory field... set same as email
        user.set("hash", md5(req.body.email));
        user.signUp(null).then(
          function success(user) {
            res.status(200).send({
              code: 200,
              message: "User saved"
            });
          },
          function rejectUser(err) {
            res.status(406).send(err);
          }

        );

      } catch(e) {
        console.log(e);
        res.status(400).send(e);
      }
      break;
    }

    case "/sendEmail": {
      // Retrieve a promise for a list of objects from Parse class
      //  @emails: comma separated email addresses to send
      //  @template_id: template to send
      try {
        if(!req.xhr) throw { code: 407, message: "Internal server error" };
        // TODO: see if we can post req.body.emails as array instead...

        Parse.Cloud.run("emailUsers",
          {
            user_emails: req.body.emails,
            template_id: req.body.template_id
          }
        ).then(
          function saveEmails(retval) {
            var promises = [];

            // Save each email sent
            for(var i = 0; i < retval.length; i++) {
              promises.push(
                Parse.Cloud.run("saveEmail",
                  {
                    message_id:  retval[i].id,
                    template_id: req.body.template_id
                  }
                )
              );
            }
            return Parse.Promise.when(promises);
          }

        ).then(
          function success(retval) {
            res.status(200).send(retval);
          },
          function error(err) {
            res.status(406).send(err);
          }
        );
      } catch(e) {
        res.status(406).send();
      }
      break;
    }

    case "/getTemplates": {
      try {
        if(!req.xhr) throw { code: 407, message: "Internal server error" };
        getSubClass("EmailTemplates", req.query.limit, req.query.offset).then(
          function success(retval) {
            res.status(200).send(retval);
          },
          function error(err) {
            res.status(406).send(err);
          }
        );
      } catch(e) {
        res.status(500).send(e);
      }
      break;
    }

    case "/getUsers": {
      try {
        if(!req.xhr) throw { code: 407, message: "Internal server error" };
        var query = new Parse.Query(Parse.User);

        if(req.query.limit > 0 && req.query.limit !== undefined)
          query.limit(req.query.limit);
        if(req.query.offset > 0 && req.query.offset !== undefined)
          query.skip(req.query.offset);

        // TODO: finalize column names
        query.select(["firstname", "lastname", "email", "hacker", "veteran"]);

        query.find().then(
          function success(retval) {
            res.status(200).send(retval);
          },
          function error(err) {
            res.status(406).send(err);
          }
        );
      } catch(e) {
        res.status(500).send(e);
      }
      break;
    }

    // TODO: get emails
    case "/getEmails": {
      try {
        if(!req.xhr) throw { code: 407, message: "Internal server error" };
        res.status(200).send();
      } catch(e) {
        res.status(500).send(e);
      }
      break;
    }

    case "/initializeHooks": {
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
                res.status(200).send();
              }
            },
            error: function(err) {
              --ajaxCalls;
              if(ajaxCalls <= 0) {
                res.status(406).send();
              }
            }
          }
        );
      }
      break;
    }
    default:
      res.status(404).send();
  }
}




/**** ******** ****\
 **** ******** ****
 **** Webhooks ****
 **** ******** ****
\**** ******** ****/
module.exports.webhooks = function(req, res) {
  switch(req.path) {
    case "/" + mg_keys.webhooks["template"]: {
      // Mailgun webhook creates a new template email
      Parse.Cloud.run("emailCreateTemplate",
        {
          body: req.body,
        }
      ).then(
        function(retval) {
          res.status(200).send();
        },
        function(error) {
          console.log(error);
          res.status(406).send();
        }
      );
      break;
    }

    case "/" + mg_keys.webhooks["delivered"]: {
      // Mailgun email webhook when email is delivered
      Parse.Cloud.run("updateEmailEvent", { body: req.body }).then(
        function(retval) {
          res.status(200).send();
        },
        function(err) {
          res.status(406).send();
        }
      );
      break;
    }

    case "/" + mg_keys.webhooks["bounced"]: {
      // Mailgun email webhook when email is delivered
      Parse.Cloud.run("updateEmailEvent", { body: req.body }).then(
        function(retval) {
          res.status(200).send();
        },
        function(err) {
          res.status(406).send();
        }
      );
      break;
    }

    case "/" + mg_keys.webhooks["dropped"]: {
      Parse.Cloud.run("updateEmailEvent", { body: req.body }).then(
        function(retval) {
          res.status(200).send();
        },
        function(err) {
          res.status(406).send();
        }
      );
      break;
    }

    case "/" + mg_keys.webhooks["spam"]: {
      Parse.Cloud.run("updateEmailEvent", { body: req.body }).then(
        function(retval) {
          res.status(200).send();
        },
        function(err) {
          res.status(406).send();
        }
      );
      break;
    }

    case "/" + mg_keys.webhooks["unsubscribed"]: {
      // Update unsubscribed....
      //    @req.body.q: user's registration hash
      //Parse.Cloud.run("updateEmailEvent", { body: req.body }).then(
        //function(retval) {
          //res.status(200).send();
        //},
        //function(err) {
          //res.status(406).send();
        //}
      //);
      var user_query = new Parse.Query(Parse.User);
      user_query.equalTo("hash", req.body.q);

      // TODO: Add to mailgun unsubscribed list
      Parse.Cloud.run("editUser",
        { hash: req.body.q,
          fields: { "unsubscribed": true }
        }
      ).then(
        function success(retval) {
          var email = retval.get("username");
          res.status(200).send(email + " has been unsubscribed.");
        },
        function(err) {
          // Error finding user
          console.log(err);
          res.status(406).send("Could not find user or set as unsubscribed.");
        }
      );

      break;
    }

    case "/" + mg_keys.webhooks["clicked"]: {
      Parse.Cloud.run("updateEmailEvent", { body: req.body }).then(
        function(retval) {
          res.status(200).send();
        },
        function(err) {
          res.status(406).send();
        }
      );
      break;
    }

    case "/" + mg_keys.webhooks["opened"]: {
      Parse.Cloud.run("updateEmailEvent", { body: req.body }).then(
        function(retval) {
          res.status(200).send();
        },
        function(err) {
          res.status(406).send();
        }
      );
      break;
    }

    default:
      res.status(404).send();
      break;
  }
};
