// Routing module
var cloud_code = require("cloud/cloudcode");
var api_keys = require("cloud/keys");
var  ps_keys = api_keys.parse;
var  mg_keys = api_keys.mailgun;

/**** ******** ****\
 **** ******** ****
 ****   HTTP   ****
 **** ******** ****
\**** ******** ****/
module.exports.index = function(req, res)    {
  res.status(200).render("index");
};

module.exports.template = function(req, res) {
  res.status(200).render("templates");
};
module.exports.sending  = function(req, res) {
  res.status(200).render("sending");
};
module.exports.tracking = function(req, res) { res.status(200).send(); };
module.exports.routing = function(req, res) { res.status(200).send(); };



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

module.exports.sendEmail = function(req, res) {
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
};

module.exports.getTemplates = function(req, res) {
  getSubClass("EmailTemplates", req.query.limit, req.query.offset).then(
    function success(retval) {
      res.status(200).send(retval);
    },
    function error(err) {
      res.status(406).send(err);
    }
  );
};

module.exports.getApplicants = function(req, res) {
  getSubClass("applicants", req.query.limit, req.query.offset).then(
    function success(retval) {
      res.status(200).send(retval);
    },
    function error(err) {
      res.status(406).send(err);
    }
  );
};

module.exports.getEmails    = function(req, res) { res.status(200).send(); };




/**** ******** ****\
 **** ******** ****
 **** Webhooks ****
 **** ******** ****
\**** ******** ****/
module.exports[mg_keys.webhooks["template"]] = function(req, res) {
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
}

module.exports[mg_keys.webhooks["onboard"]] = function(req, res) {
  // Parse beforeSave webhook when object is created or modified
  // Sends email template with the type "onboard"
  var Templates = Parse.Object.extend("EmailTemplates");
  var tquery = new Parse.Query(Templates);
  var template_id = undefined;
  tquery.equalTo("type", "onboard");

  if(req.body.object.sentRegEmail == undefined ||
     req.body.object.sentRegEmail == false) { // Object is newly created
    tquery.first().then(
      function(template) {
        template_id = template.id;
        return Parse.Cloud.run("validateEmail",
          { email_address: req.body.object.emailAddress }
        );
      }
    ).then(
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
};

module.exports.initializeHooks = function(req, res) {
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
            res.send(200).send();
          }
        },
        error: function(err) {
          --ajaxCalls;
          if(ajaxCalls <= 0) {
            res.send(406).send();
          }
        }
      }
    );
  }
};

module.exports[mg_keys.webhooks["delivered"]]     = function(req, res) {
  // Mailgun email webhook when email is delivered
  Parse.Cloud.run("updateEmailEvent", { body: req.body }).then(
    function(retval) {
      res.status(200).send();
    },
    function(err) {
      res.status(406).send();
    }
  );
};

module.exports[mg_keys.webhooks["bounced"]]      = function(req, res) {
  // Mailgun email webhook when email is delivered
  Parse.Cloud.run("updateEmailEvent", { body: req.body }).then(
    function(retval) {
      res.status(200).send();
    },
    function(err) {
      res.status(406).send();
    }
  );
};

module.exports[mg_keys.webhooks["dropped"]]        = function(req, res) {
  Parse.Cloud.run("updateEmailEvent", { body: req.body }).then(
    function(retval) {
      res.status(200).send();
    },
    function(err) {
      res.status(406).send();
    }
  );
};

module.exports[mg_keys.webhooks["spam"]]        = function(req, res) {
  Parse.Cloud.run("updateEmailEvent", { body: req.body }).then(
    function(retval) {
      res.status(200).send();
    },
    function(err) {
      res.status(406).send();
    }
  );
};

module.exports[mg_keys.webhooks["unsubscribed"]] = function(req, res) {
  Parse.Cloud.run("updateEmailEvent", { body: req.body }).then(
    function(retval) {
      res.status(200).send();
    },
    function(err) {
      res.status(406).send();
    }
  );
};

module.exports[mg_keys.webhooks["clicked"]]       = function(req, res) {
  Parse.Cloud.run("updateEmailEvent", { body: req.body }).then(
    function(retval) {
      res.status(200).send();
    },
    function(err) {
      res.status(406).send();
    }
  );
};

module.exports[mg_keys.webhooks["opened"]]        = function(req, res) {
  Parse.Cloud.run("updateEmailEvent", { body: req.body }).then(
    function(retval) {
      res.status(200).send();
    },
    function(err) {
      res.status(406).send();
    }
  );
};
