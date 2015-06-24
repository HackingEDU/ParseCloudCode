// Routing module
var api_keys = require("cloud/keys");
var  ps_keys = api_keys.parse;
var  mg_keys = api_keys.mailgun;

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
    case "/newUser": {
      try {
        Parse.Cloud.run("validateFields").then(
          function saveUser(retval) {
            // retval should be always be true if cloud code returned success
            if(!retval) throw { code: 109, message: "Validation error!" };

            var user = new Parse.User();
            delete req.body.confirm_password;
            user.set(req.body);
            user.set("username", req.body.email); // Mandatory field... set same as email
            return user.signUp(null);
          },
          function rejectUser(err) {
            // 400: Bad request, malformed syntax
            res.status(400).send(err);
          }
        ).then(
          function success(user) {
            // TODO: return undefined
            res.end("Account created");
          },
          function error(err) {
            res.end(JSON.stringify(err));
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
      Parse.Cloud.run("emailUsers",
        {
          user_emails: req.body.emails,
          template_id: req.body.template_id
        }
      ).then(
        function saveEmail(retval) {
          return Parse.Cloud.run("saveEmail",
              {
                message_id:  retval.message_id,
                template_id: retval.template_id
              }
              );
        }
      ).then(
        function success(retval) {
          res.status(200).send(retval);
        },
        function error(err) {
          res.status(406).send(retval);
        }
      );
      break;
    }

    case "/getTemplates": {
      getSubClass("EmailTemplates", req.query.limit, req.query.offset).then(
        function success(retval) {
          res.status(200).send(retval);
        },
        function error(err) {
          res.status(406).send(err);
        }
      );
      break;
    }

    case "/getUsers": {
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
      break;
    }

    // TODO: get emails
    case "/getEmails": {
      res.status(200).send();
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
          sender: req.body["from"]
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

    case "/" + mg_keys.webhooks["onboard"]: {
      // Parse beforeSave webhook when object is created or modified
      // Sends email template with the type "onboard"
      var Templates = Parse.Object.extend("EmailTemplates");
      var tquery = new Parse.Query(Templates);
      var template_id = undefined;
      tquery.equalTo("type", "onboard");

      if(req.body.object.sentRegEmail == undefined ||
         req.body.object.sentRegEmail == false) { // Object is newly created
        // Search for template email marked type: "onboard"
        tquery.first().then(
          function sendEmail(retval) { // email was validated
            return Parse.Cloud.run("emailUsers",
              {
                "user_emails":  req.body.object.emailAddress,
                "template_id": template_id
              }
            );
          }
        ).then(
          function saveEmail(retval) {
            return Parse.Cloud.run("saveEmail",
              {
                message_id:  retval.message_id,
                template_id: retval.template_id
              }
            );
          }
        ).then(
          function setApplicant(retval) {
            // email object saved, sent reg email saved
            // Respond success object with updated keys
            res.send(
              {
                "success":
                {
                  "verifiedEmail": true,
                  "sentRegEmail": true,
                  "emailAddress": req.body.object.emailAddress,
                  "regEmail":
                    {
                         "__type": "Pointer",
                      "className": "Emails",
                       "objectId": retval.id
                    }
                }
              }
            );
          },
          function errorApplicant(error) {
            // Error (most likely validating email), but handle gracefully
            console.log(error);
            res.send(
              {
                "success":
                {
                  "verifiedEmail": false,
                  "sentRegEmail": false,
                  "emailAddress": req.body.object.emailAddress,
                }
              }
            );
          }
        );
      } else {
        // Let any changes be made
        res.status(200).send({"success": req.body.object });
      }
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
