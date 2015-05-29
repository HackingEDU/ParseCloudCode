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
      "bounce":       "bounceHookreceive",
      "deliver":      "deliverHookreceive",
      "drop":         "dropHookreceive",
      "spam":         "spamHookreceive",
      "unsubscribe":  "unsubscribeHookreceive",
      "click":        "clickHookreceive",
      "open":         "openHookreceive"
    }
  }
};
