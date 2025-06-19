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
      browser.perform(() => {
        browser.click('.profile-dropbtn');
        browser.keys(browser.Keys.ENTER);
        browser.click('.navigation-user-logout');
        browser.keys(browser.Keys.ENTER);
        browser.assert.urlContains('#user/login');
        browser.navigateTo(`http://localhost:${config.serverPort}/#dashboard`);
        browser.pause(500);
        browser.expect.element('.swal2-html-container').text.to.equal('Your session has expired, click OK to log on again');
      });
    });

    it('should reject login from the old password', function (browser) {
      browser.navigateTo(`http://localhost:${config.serverPort}`);
      browser.pause(1000);
      browser.assert.elementPresent('#login-input-username');
      browser.sendKeys('#login-input-username', testData.testUser.email);
      browser.assert.elementPresent('#login-input-password');
      browser.sendKeys('#login-input-password', [testData.testUser.plainPassword, browser.Keys.ENTER]);
      browser.assert.elementPresent('#loginErrorMessage');
      browser.setValue('.login-input-password', '');
    });


    it('should complete successful login with the new password', function (browser) {
      browser.assert.elementPresent('#login-input-username');
      browser.assert.elementPresent('#login-input-password');
      browser.sendKeys('#login-input-password', [testData.testUser.newpassword, browser.Keys.ENTER]);
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


    it('should enable user to change password from the profile menu', function (browser) {
      browser.assert.urlContains('#dashboard');
      browser.assert.elementPresent('.profile-dropbtn');
      browser.click('.profile-dropbtn');
      browser.keys(browser.Keys.ENTER);
      browser.click('.navigation-profile');
      browser.keys(browser.Keys.ENTER);
      browser.click('.change-password');
      browser.keys(browser.Keys.ENTER);
      browser.assert.elementPresent('#passwordField');
      browser.sendKeys('#password', [testData.testUser.thirdpassword]);
      browser.sendKeys('#confirmPassword', [testData.testUser.thirdpassword]);
      browser.click('.user-profile-edit-sidebar-save-inner');
      browser.keys(browser.Keys.ENTER);
      browser.assert.urlContains('#dashboard');
      browser.click('.profile-dropbtn');
      browser.keys(browser.Keys.ENTER);
      browser.click('.navigation-user-logout');
      browser.keys(browser.Keys.ENTER);
    });

    it('should accept password change from profile menu', function (browser) {
      browser.assert.elementPresent('#login-input-username');
      browser.sendKeys('#login-input-username', testData.testUser.email);
      browser.assert.elementPresent('#login-input-password');
      browser.sendKeys('#login-input-password', [testData.testUser.thirdpassword, browser.Keys.ENTER]);
      browser.assert.urlContains('#user/loginMfa');
    });

    it('should lock the user after 3 failed MFA key entry attempts', function (browser) {
      var basicKey = '123456'
      for (let i = 1; i <= 4; i++) {
        browser.perform(() => {
          browser
            .assert.elementPresent('#login-mfa-input-verificationcode')
            .sendKeys('#login-mfa-input-verificationcode', [basicKey, browser.Keys.ENTER])
            .setValue('#login-mfa-input-verificationcode', '')
            .pause(500);
        });
      }
      browser.expect.element('#loginErrorMessage').text.to.equal('You have exceeded the maximum number of attempts to enter your one-time password. For your security, please reset your password by selecting the "Forgot Password?" option.');
      browser.perform(() => {
        database.collection("users").updateOne({ email: testData.testUser.email }, { $set: { failedMfaCount: 0 } }, function (err, commandResult) {
          if (err) {
            browser.assert.fail("Failed to reset count " + err.message);
          }
          browser.assert.equal(commandResult.result.nModified, 1);
        });
      });
    });

    var storedCookie;

    it('should be able to remember mfa token for 30 days', function (browser) {
      browser.navigateTo(`http://localhost:${config.serverPort}`);
      browser.pause(500);
      browser.assert.urlContains('#user/login');
      browser.assert.elementPresent('#login-input-username');
      browser.sendKeys('#login-input-username', testData.testUser.email);
      browser.assert.elementPresent('#login-input-password');
      browser.sendKeys('#login-input-password', [testData.testUser.thirdpassword, browser.Keys.ENTER]);
      browser.assert.urlContains('#user/loginMfa');
      var devEnv = config.devEnv;
      var cookieName = devEnv ? `connect-${devEnv}.sid` : `connect.sid`;
      browser.getCookie(cookieName, function callback(result) {
        this.assert.equal(result.name, cookieName);
        storedCookie = result;
        var sessionID = result.value.split('.')[0].substring(4);
        var validationTokenId;
        database.collection("mfatokens").findOne({ sessionId: sessionID, verified: false }, function (err, result) {
          if (err) {
            browser.assert.fail("Failed to query validation token: " + err.message);
          }
          if (result && result.validationToken) {
            validationTokenId = result.validationToken;
          }
          browser.assert.elementPresent('#skip-mfa');
          browser.element('#skip-mfa').check();
          browser.assert.elementPresent('#login-mfa-input-verificationcode');
          browser.sendKeys('#login-mfa-input-verificationcode', [validationTokenId, browser.Keys.ENTER]);
        });
      });
      browser.assert.urlContains('#dashboard');
      var cookieName2 = devEnv ? `connect-${devEnv}.fid` : `connect.fid`;
      browser.getCookie(cookieName2, function callback(result) {
        this.assert.equal(result.name, cookieName2);
      });
      browser.click('.profile-dropbtn');
      browser.keys(browser.Keys.ENTER);
      browser.click('.navigation-user-logout');
      browser.keys(browser.Keys.ENTER);
    });

    it('should accept login with stored mfa cookie', function (browser) {
      browser.navigateTo(`http://localhost:${config.serverPort}`);
      browser.pause(500);
      browser.assert.urlContains('#user/login');
      browser.assert.elementPresent('#login-input-username');
      browser.sendKeys('#login-input-username', testData.testUser.email);
      browser.assert.elementPresent('#login-input-password');
      browser.sendKeys('#login-input-password', [testData.testUser.thirdpassword, browser.Keys.ENTER]);
      browser.pause(2000);
      browser.assert.urlContains('#dashboard');
      browser.perform(() => {
        browser.assert.elementPresent('.profile-dropbtn');
        browser.click('.profile-dropbtn');
        browser.keys(browser.Keys.ENTER);
        browser.click('.navigation-user-logout');
        browser.keys(browser.Keys.ENTER);
      });
    });

    it('should reject login with stored mfa cookie that is expired', function (browser) {
      var devEnv = config.devEnv;
      var cookieName = devEnv ? `connect-${devEnv}.fid` : `connect.fid`;
      browser.getCookie(cookieName, function callback(result) {
        this.assert.equal(result.name, cookieName);
        var tokenID = result.value.split('.')[0].substring(6);
        const fortyFiveDaysAgo = new Date();
        fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
        database.collection("mfatokens").updateOne(
          { tokenId: tokenID, verified: true }, // filter
          { $set: { validationDate: fortyFiveDaysAgo } }, // update
          function (err, result) {
            if (err) {
              browser.assert.fail("Failed to update validation date: " + err.message);
              return;
            }
            browser.navigateTo(`http://localhost:${config.serverPort}`);
            browser.pause(500);
            browser.assert.urlContains('#user/login');
            browser.assert.elementPresent('#login-input-username');
            browser.sendKeys('#login-input-username', testData.testUser.email);
            browser.assert.elementPresent('#login-input-password');
            browser.sendKeys('#login-input-password', [testData.testUser.thirdpassword, browser.Keys.ENTER]);
            browser.pause(2000);
            browser.assert.urlContains('#user/loginMfa');
            database.collection("mfatokens").updateOne(
              { tokenId: tokenID, verified: true }, // filter
              { $set: { validationDate: new Date() } }, // update
              function (err, result) {
                if (err) {
                  browser.assert.fail("Failed to update validation date: " + err.message);
                  return;
                }
              }
            );
          }
        );
      });
    });

    it('should reject login with stored mfa if tokenId is wrong', function (browser) {
      browser.navigateTo(`http://localhost:${config.serverPort}/#user/login`);
      browser.pause(2500);
      browser.assert.urlContains('#user/login');
      var devEnv = config.devEnv;
      var cookieName2 = devEnv ? `connect-${devEnv}.fid` : `connect.fid`;
      browser.getCookie(cookieName2, function callback(result) {
        var cookie = result;
        browser.cookies.set({
          name: cookie.name,
          value: 's%253A5mn7X5wTyDT45hTv8-m3lHFUvvo_dyY4.aIRqsk9F1Hv6dEa061usdSuV9jDVfWFm7AFj4cqygyg',
          path: '/'
        })
        browser.assert.elementPresent('#login-input-username');
        browser.sendKeys('#login-input-username', testData.testUser.email);
        browser.assert.elementPresent('#login-input-password');
        browser.sendKeys('#login-input-password', [testData.testUser.thirdpassword, browser.Keys.ENTER]);
        browser.assert.urlContains('#user/loginMfa');
      });
    });

    it('should reject login with stored mfa if tokenId signature is wrong', function (browser) {
      browser.navigateTo(`http://localhost:${config.serverPort}`);
      browser.pause(500);
      browser.assert.urlContains('#user/login');
      var cookieValue = storedCookie.value.slice(0, -1) + "?";
      browser.cookies.set({
        name: storedCookie.name,
        value: cookieValue,
        path: '/'
      })
      browser.assert.elementPresent('#login-input-username');
      browser.sendKeys('#login-input-username', testData.testUser.email);
      browser.assert.elementPresent('#login-input-password');
      browser.sendKeys('#login-input-password', [testData.testUser.thirdpassword, browser.Keys.ENTER]);
      browser.assert.urlContains('#user/loginMfa');
    });

  });

  after(function (browser) {
    browser.end();
  });

});
