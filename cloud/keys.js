module.exports = {
  "parse": {
    "baseURL": "app.parseapp.com",
    "applicationId": "appID",
    "jsKey": "jsKey",
    "masterKey": "masterKey"
    "classes": {
      "emails": "Emails",
      "templates": "EmailTemplates",
      "events": "EmailEvents",
      "metadata": "EmailMetadata"
    }
  },
  "mailgun": {
    "domainURL": "mailgunDomainName",
    "secretKey": "secretKey",
    "baseURL": "api.mailgun.net/v3",
    "publicKey": "publicKey",
    "webhooks": {
      "newuser":      "n0354d89c28ec399c00d3cb2d094cf093",
      "template":     "tbf40b0ccd79f4096a23835ef0fb167ef",
      "onboard":      "o29d7e29bb8e3b23cc2691f541291d75a",
      "bounced":      "b8749c86de3f73c94befcb82cb0245410",
      "delivered":    "d788aa8742da6cd466eeb292503ce9f19",
      "dropped":      "d51604f82abcd8d1c1d177d78e83e4b27",
      "spam":         "sfe6a180564317d36c31e02782379c183",
      "unsubscribed": "u63e1c9c825c067ac7475a85f606f6c72",
      "clicked":      "cec0046a0a275b106ba68c1dbf19b14c7",
      "opened":       "ob1ede78de6b0a24d78bd3d75b4664257"
    },
    "webhooksInit": {
      "bounce":       "b8749c86de3f73c94befcb82cb0245410",
      "deliver":      "d788aa8742da6cd466eeb292503ce9f19",
      "drop":         "d51604f82abcd8d1c1d177d78e83e4b27",
      "spam":         "sfe6a180564317d36c31e02782379c183",
      "unsubscribe":  "u63e1c9c825c067ac7475a85f606f6c72",
      "click":        "cec0046a0a275b106ba68c1dbf19b14c7",
      "open":         "ob1ede78de6b0a24d78bd3d75b4664257"
    }
  }
};
