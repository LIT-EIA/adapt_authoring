var mongo = require('mongodb');
var MongoClient = mongo.MongoClient;
var url = "mongodb://localhost:27017/";
var config = require('../../conf/config.json');

describe('login process', function () {

  before(function (browser) {
    browser.navigateTo('http://localhost:5000');
  });

  it('should complete successful login', function (browser) {
    browser.assert.elementPresent('#login-input-username');
    browser.sendKeys('#login-input-username', process.env.TEST_USER_NAME);
    browser.assert.elementPresent('#login-input-password');
    browser.sendKeys('#login-input-password', [process.env.TEST_USER_PASSWORD, browser.Keys.ENTER]);
    browser.assert.urlContains('#user/loginMfa');
    var devEnv = config.devEnv;
    var cookieName = devEnv ? `connect-${devEnv}.sid` : `connect.sid`;
    browser.getCookie(cookieName, function callback(result) {
      this.assert.equal(result.name, cookieName);
      var sessionID = result.value.split('.')[0].substring(4);
      var validationTokenId;
      MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true }, function(err, db) {
        if (err) {
          browser.assert.fail("Database connection failed: " + err.message);
        }
        var dbo = db.db("adapt-tenant-master");
        var mfa_db = dbo.collection("mfatokens");

        mfa_db.findOne({ sessionId: sessionID, verified: false }, function(err, result) {
          if (err) {
            browser.assert.fail("Failed to query validation token: " + err.message);
          }
          if (result && result.validationToken) {
            validationTokenId = result.validationToken;
          }
          browser.assert.elementPresent('#login-mfa-input-verificationcode');
          browser.sendKeys('#login-mfa-input-verificationcode', [validationTokenId, browser.Keys.ENTER]);
        });
      });
    });
    browser.assert.urlContains('#dashboard');
  });

  after(function (browser) {
    browser.end();
  });
});
