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

    it('should fail login whenever failedLoginCount, failedMfaCount, mfaResetCount or passwordResetCount reaches 3', function (browser) {
      const updates = [
        { field: 'failedLoginCount', value: 3 },
        { field: 'failedMfaCount', value: 3 },
        { field: 'mfaResetCount', value: 3 },
        { field: 'passwordResetCount', value: 3 }
      ];

      const resetAllFields = (done) => {
        database.collection("users").updateOne(
          { email: testData.testUser.email },
          {
            $set: {
              failedLoginCount: 0,
              failedMfaCount: 0,
              mfaResetCount: 0,
              passwordResetCount: 0
            }
          },
          function (err, commandResult) {
            if (err) {
              browser.assert.fail("Failed to reset all fields: " + err.message);
            } else {
              browser.assert.strictEqual(commandResult.matchedCount, 1, "Expected 1 document to match for reset");
            }
            done();
          }
        );
      };

      updates.forEach(({ field, value }, index) => {
        // Reset all fields before each iteration
        browser.perform((done) => resetAllFields(done));

        // Set the current field to 3
        browser.perform((done) => {
          const update = {};
          update[field] = value;

          database.collection("users").updateOne(
            { email: testData.testUser.email },
            { $set: update },
            function (err, commandResult) {
              if (err) {
                browser.assert.fail(`Failed to update ${field}: ${err.message}`);
              } else {
                browser.assert.strictEqual(
                  commandResult.matchedCount,
                  1,
                  `Expected 1 document to match for ${field}`
                );
              }
              done();
            }
          );
        });

        // Perform login and assert error message
        if (field === 'passwordResetCount') {

        } else {
          browser.setValue('#login-input-username', '');
          browser.assert.elementPresent('#login-input-username');
          browser.sendKeys('#login-input-username', testData.testUser.email);
          browser.assert.elementPresent('#login-input-password');
          browser.sendKeys('#login-input-password', [testData.testUser.plainPassword, browser.Keys.ENTER]);
          browser.assert.elementPresent('#loginErrorMessage');
          browser.expect.element('#loginErrorMessage').text.to.equal(
            'This account has been locked because of too many failed login attempts.'
          );
        }
      });

      // Final check: all fields should be 0
      browser.perform((done) => {
        database.collection("users").findOne(
          { email: testData.testUser.email },
          {
            projection: {
              failedLoginCount: 1,
              failedMfaCount: 1,
              mfaResetCount: 1,
              passwordResetCount: 1,
              _id: 0
            }
          },
          function (err, user) {
            if (err) {
              browser.assert.fail("Failed to fetch user data: " + err.message);
            } else {
              browser.assert.strictEqual(user.failedLoginCount, 0, 'failedLoginCount should be 0');
              browser.assert.strictEqual(user.failedMfaCount, 0, 'failedMfaCount should be 0');
              browser.assert.strictEqual(user.mfaResetCount, 0, 'mfaResetCount should be 0');
            }
            done();
          }
        );
      });
    });


    it('should complete successful login', function (browser) {
      browser.setValue('#login-input-username', '');
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

    it('should not accept mismatched password in password confirmation field', function (browser) {
      browser.setValue('#passwordResetModal', '');
      browser.setValue('#confirmPasswordResetModal', '');
      browser.assert.elementPresent('#passwordResetModal');
      browser.sendKeys('#passwordResetModal', testData.testUser.plainPassword);
      browser.sendKeys('#confirmPasswordResetModal', 'mismatchedpassword');
      browser.click('.swal2-confirm');
      browser.keys(browser.Keys.ENTER);
      browser.assert.elementPresent('#confirmPasswordErrorResetModal');
      browser.expect.element('#confirmPasswordErrorResetModal').text.to.equal('Confirmation password does not match the new password.');
      browser.setValue('#passwordResetModal', '');
      browser.setValue('#confirmPasswordResetModal', '');
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

    it('should enable super admin to access user management', function (browser) {
      browser.assert.elementPresent('.navigation-global-menu');
      browser.click('.navigation-global-menu');
      browser.keys(browser.Keys.ENTER);
      browser.click('.fa-users');
      browser.keys(browser.Keys.ENTER);
      browser.assert.elementPresent('.users');
    });

    it('should enable super admin to create a new user', function (browser) {
      browser.assert.elementPresent('.add');
      browser.click('.add');
      browser.keys(browser.Keys.ENTER);
      browser.assert.urlContains('#userManagement/addUser');
      browser.sendKeys('input[name="firstName"]', [testData.secondUser.firstName, browser.Keys.ENTER]);
      browser.sendKeys('input[name="lastName"]', [testData.secondUser.lastName, browser.Keys.ENTER]);
      browser.sendKeys('input[name="email"]', [testData.secondUser.email, browser.Keys.ENTER]);
      browser.click('.save');
      browser.keys(browser.Keys.ENTER);
      browser.assert.urlContains('#userManagement/addUser');
    });

    it('should enable super admin to be subjected to 12 character password policy change on user password change', function (browser) {
      browser.click('ul.users .user-item:nth-of-type(2)');
      browser.click('.changePassword');
      browser.keys(browser.Keys.ENTER);
      browser.assert.elementPresent('#passwordUserManagementResetModal');
      browser.sendKeys('#passwordUserManagementResetModal', 'tinypass');
      browser.sendKeys('#confirmPasswordUserManagementResetModal', 'tinypass');
      browser.click('.swal2-confirm');
      browser.keys(browser.Keys.ENTER);
      browser.assert.elementPresent('.errorUserManagementResetModal');
      browser.expect.element('.errorUserManagementResetModal').text.to.equal('Make your password stronger with at least 12 characters');
      browser.setValue('#passwordUserManagementResetModal', '');
      browser.setValue('#confirmPasswordUserManagementResetModal', '');
    });

    it('should not permit blocklist passwords from usermanager', function (browser) {
      browser.sendKeys('#passwordUserManagementResetModal', 'yankeesRomeo-NK1992');
      browser.sendKeys('#confirmPasswordUserManagementResetModal', 'yankeesRomeo-NK1992');
      browser.click('.swal2-confirm');
      browser.keys(browser.Keys.ENTER);
      browser.assert.elementPresent('.errorUserManagementResetModal');
      browser.expect.element('.errorUserManagementResetModal').text.to.equal('This password is too common, please use a more unique password.');
      browser.setValue('#passwordUserManagementResetModal', '');
      browser.setValue('#confirmPasswordUserManagementResetModal', '');
    });


    it('should not accept mismatched password in usermanager', function (browser) {
      browser.setValue('#passwordUserManagementResetModal', '');
      browser.setValue('#confirmPasswordUserManagementResetModal', '');
      browser.sendKeys('#passwordUserManagementResetModal', 'hugepasswordinputhere');
      browser.sendKeys('#confirmPasswordUserManagementResetModal', 'mismatchedpassword');
      browser.click('.swal2-confirm');
      browser.keys(browser.Keys.ENTER);
      browser.assert.elementPresent('#confirmPasswordErrorUserManagementResetModal');
      browser.expect.element('#confirmPasswordErrorUserManagementResetModal').text.to.equal('Confirmation password does not match the new password.');
      browser.setValue('#passwordUserManagementResetModal', '');
      browser.setValue('#confirmPasswordUserManagementResetModal', '');
    });

    it('should enable password change from usermanager', function (browser) {
      browser.sendKeys('#passwordUserManagementResetModal', testData.secondUser.newpassword);
      browser.sendKeys('#confirmPasswordUserManagementResetModal', testData.secondUser.newpassword);
      browser.click('.swal2-confirm');
      browser.keys(browser.Keys.ENTER);
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


    it('should reject login from the old password', function (browser) {
      browser.navigateTo(`http://localhost:${config.serverPort}`);
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


    it('should enable user to change password & personal information from the profile menu', function (browser) {
      browser.assert.urlContains('#dashboard');
      browser.assert.elementPresent('.profile-dropbtn');
      browser.click('.profile-dropbtn');
      browser.keys(browser.Keys.ENTER);
      browser.click('.navigation-profile');
      browser.keys(browser.Keys.ENTER);
      browser.setValue('#firstName', '');
      browser.setValue('#lastName', '');
      browser.sendKeys('#firstName', ['John', browser.Keys.ENTER]);
      browser.sendKeys('#lastName', ['Doe', browser.Keys.ENTER]);
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
      browser.click('.navigation-profile');
      browser.keys(browser.Keys.ENTER);
      browser.expect.element('#firstName').to.have.value.equal('John');
      browser.expect.element('#lastName').to.have.value.equal('Doe');
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
    });

  });
  after(function (browser) {
    browser.end();
  });
});