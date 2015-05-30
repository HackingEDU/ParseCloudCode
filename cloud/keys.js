module.exports = {
  "parse": {
    "baseURL": "app.parseapp.com",
    "applicationId": "appID",
    "jsKey": "jsKey",
    "masterKey": "masterKey"
  },
  "mailgun": {
    "baseURL": "api.mailgun.net/v3/domains",
    "domainURL": "mailgunDomainName",
    "secretKey": "secretKey",
    "webhooks": {
      "onboard":      "o29d7e29bb8e3b23cc2691f541291d75a",
      "bounced":      "b8749c86de3f73c94befcb82cb0245410",
      "delivered":    "d788aa8742da6cd466eeb292503ce9f19",
      "dropped":      "d51604f82abcd8d1c1d177d78e83e4b27",
      "spam":         "sfe6a180564317d36c31e02782379c183",
      "unsubscribed": "u63e1c9c825c067ac7475a85f606f6c72",
      "clicked":      "cec0046a0a275b106ba68c1dbf19b14c7",
      "opened":       "ob1ede78de6b0a24d78bd3d75b4664257"
    }
  }
};
