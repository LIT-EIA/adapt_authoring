var mongo = require('mongodb');
var MongoClient = mongo.MongoClient;
var url = "mongodb://localhost:27017/";
var config = require('../testConfig.json');
var testData = require('../testData.json');

describe('login process', function () {

  before(function (browser) {
    browser.navigateTo(`http://localhost:${config.serverPort}`);
  });

  MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true }, function (err, db) {
    if (err) {
      browser.assert.fail("Database connection failed: " + err.message);
    }

    var database = db.db(config.dbName);

    it('should return invalid email address or password message on wrong password', function (browser) {
      browser.assert.elementPresent('#login-input-username');
      browser.sendKeys('#login-input-username', testData.testUser.email);
      browser.assert.elementPresent('#login-input-password');
      browser.sendKeys('#login-input-password', ['mywrongpassword', browser.Keys.ENTER]);
      browser.assert.elementPresent('#loginErrorMessage');
      browser.expect.element('#loginErrorMessage').text.to.equal('Invalid email address or password');
    });

    it('should lock account after 3 wrong passwords', function (browser) {
      browser.assert.elementPresent('#login-input-username');

      for (let i = 1; i <= 4; i++) {
        browser.perform(() => {
          browser
            .sendKeys('#login-input-password', ['mywrongpassword', browser.Keys.ENTER])
            .assert.elementPresent('#loginErrorMessage')
            .pause(500);
        });
      }

      browser.assert.elementPresent('#loginErrorMessage');
      browser.expect.element('#loginErrorMessage').text.to.equal('This account has been locked because of too many failed login attempts.');


    });

    it('should fail login when account locked', function (browser) {

      browser.assert.elementPresent('#login-input-password');
      browser.sendKeys('#login-input-password', [testData.testUser.plainPassword, browser.Keys.ENTER]);
      browser.assert.elementPresent('#loginErrorMessage');
      browser.expect.element('#loginErrorMessage').text.to.equal('This account has been locked because of too many failed login attempts.');

      browser.perform(() => {
        database.collection("users").updateOne({ email: testData.testUser.email }, { $set: { failedLoginCount: 0 } }, function (err, commandResult) {
          if (err) {
            browser.assert.fail("Failed to reset count " + err.message);
          }
          browser.assert.equal(commandResult.result.nModified, 1);
        });
      });
      browser.setValue('#login-input-username', '');
    });


    it('should complete successful login', function (browser) {
      browser.assert.elementPresent('#login-input-username');
      browser.sendKeys('#login-input-username', testData.testUser.email);
      browser.assert.elementPresent('#login-input-password');
      browser.sendKeys('#login-input-password', [testData.testUser.plainPassword, browser.Keys.ENTER]);
      browser.assert.urlContains('#user/loginMfa');
      var devEnv = config.devEnv;
      var cookieName = devEnv ? `connect-${devEnv}.sid` : `connect.sid`;
      browser.getCookie(cookieName, function callback(result) {
        this.assert.equal(result.name, cookieName);
        var sessionID = result.value.split('.')[0].substring(4);
        var validationTokenId;
        database.collection("mfatokens").findOne({ sessionId: sessionID, verified: false }, function (err, result) {
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
      browser.assert.urlContains('#dashboard');
    });


    it('should respect 12 character new password policy', function (browser) {
      browser.assert.elementPresent('#passwordResetModal');
      browser.sendKeys('#passwordResetModal', 'tinypass');
      browser.sendKeys('#confirmPasswordResetModal', 'tinypass');
      browser.click('.swal2-confirm');
      browser.keys(browser.Keys.ENTER);
      browser.assert.elementPresent('.errorResetModal');
      browser.expect.element('.errorResetModal').text.to.equal('Make your password stronger with at least 12 characters');
    });

    it('should not accept previous password', function (browser) {
      browser.setValue('#passwordResetModal', '');
      browser.setValue('#confirmPasswordResetModal', '');
      browser.assert.elementPresent('#passwordResetModal');
      browser.sendKeys('#passwordResetModal', testData.testUser.plainPassword);
      browser.sendKeys('#confirmPasswordResetModal', testData.testUser.plainPassword);
      browser.click('.swal2-confirm');
      browser.keys(browser.Keys.ENTER);
      browser.assert.elementPresent('#passwordErrorResetModal');
      browser.expect.element('#passwordErrorResetModal').text.to.equal('Your password cannot be the same as your previous passwords');
      browser.setValue('#passwordResetModal', '');
      browser.setValue('#confirmPasswordResetModal', '');
    });

    it('should accept a new valid password', function (browser) {
      browser.assert.elementPresent('#passwordResetModal');
      browser.sendKeys('#passwordResetModal', testData.testUser.newpassword);
      browser.sendKeys('#confirmPasswordResetModal', testData.testUser.newpassword);
      browser.click('.swal2-confirm');
      browser.assert.elementNotPresent('#passwordResetModal');
    });

    it('should be able to logout and render session invalid', function (browser) {
      browser.click('.profile-dropbtn');
      browser.keys(browser.Keys.ENTER);
      browser.click('.navigation-user-logout');
      browser.keys(browser.Keys.ENTER);
      browser.assert.urlContains('#user/login');
      browser.navigateTo(`http://localhost:${config.serverPort}/#dashboard`);
      browser.expect.element('.swal2-html-container').text.to.equal('Your session has expired, click OK to log on again');
    });

  });
  after(function (browser) {
    browser.end();
  });
});
