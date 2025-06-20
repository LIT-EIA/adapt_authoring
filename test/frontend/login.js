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
        { field: 'mfaResetCount', value: 3 }
      ];

      const resetAllFields = (done) => {
        database.collection("users").updateOne(
          { email: testData.testUser.email },
          {
            $set: {
              failedLoginCount: 0,
              failedMfaCount: 0,
              mfaResetCount: 0
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

          browser.setValue('#login-input-username', '');
          browser.assert.elementPresent('#login-input-username');
          browser.sendKeys('#login-input-username', testData.testUser.email);
          browser.assert.elementPresent('#login-input-password');
          browser.sendKeys('#login-input-password', [testData.testUser.plainPassword, browser.Keys.ENTER]);
          browser.assert.elementPresent('#loginErrorMessage');
          browser.expect.element('#loginErrorMessage').text.to.equal(
            'This account has been locked because of too many failed login attempts.'
          );

      });

      browser.perform((done) => resetAllFields(done));
      // Final check: all fields should be 0
      browser.perform((done) => {
        database.collection("users").findOne(
          { email: testData.testUser.email },
          {
            projection: {
              failedLoginCount: 1,
              failedMfaCount: 1,
              mfaResetCount: 1,
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

    it('should accept request to reset password with Forgot Password? option', function (browser) {
      browser.navigateTo(`http://localhost:${config.serverPort}`);
      browser.assert.elementPresent('a[href="#user/forgot"]');
      browser.navigateTo(`http://localhost:${config.serverPort}/#user/forgot`);
      browser.assert.urlContains('#user/forgot');
      browser.assert.elementPresent('.input-username-email');
      browser.sendKeys('.input-username-email', [testData.testUser.email, browser.Keys.ENTER]);
      browser.assert.elementPresent('.forgot-password-success');
    });

    it('should reject password reset page with invalid token', function (browser) {
      browser.navigateTo(`http://localhost:${config.serverPort}/#user/reset/2b51063c83eb099c58e6234a`);
      browser.assert.urlContains('#user/reset');
      browser.assert.elementNotPresent('.reset-password');
    });

    it('should accept password reset page with valid token', function (browser) {
      browser.perform((done) => {
        database.collection("users").findOne({ email: testData.testUser.email }, function (err, user) {
          if (err) {
            browser.assert.fail("Failed to get user " + err.message);
          }
          database.collection("userpasswordresets").findOne({ user: user._id }, function (err, result) {
            if (err) {
              browser.assert.fail("Failed to get user " + err.message);
            }
            browser.navigateTo(`http://localhost:${config.serverPort}/#user/reset/${result.token}`);
            browser.assert.urlContains('#user/reset');
            browser.assert.elementPresent('.reset-password');
            browser.assert.elementPresent('#password');
            browser.sendKeys('#password', testData.testUser.newpassword);
            browser.assert.elementPresent('#confirmPassword');
            browser.sendKeys('#confirmPassword', [testData.testUser.newpassword]);
            browser.assert.elementPresent('.submit');
            browser.click('.submit');
            browser.keys(browser.Keys.ENTER);
            browser.assert.elementPresent('.return');
            browser.pause(2000);
            browser.perform((cb) => {
              browser.pause(2000);
              database.collection("users").updateOne({ email: testData.testUser.email }, { $set: { lastPasswordChange: new Date("2020-01-01T00:00:00Z") } }, function (err, commandResult) {
                if (err) {
                  browser.assert.fail("Failed to reset count " + err.message);
                }
                console.log(commandResult)
                cb()
              });
            })
            done();
          });
        });
      });
    });

    it('should reject login when mfa code is over 10 minutes old', function (browser) {
      browser.navigateTo(`http://localhost:${config.serverPort}`);
      browser.setValue('#login-input-username', '');
      browser.assert.elementPresent('#login-input-username');
      browser.sendKeys('#login-input-username', testData.testUser.email);
      browser.assert.elementPresent('#login-input-password');
      browser.sendKeys('#login-input-password', [testData.testUser.newpassword, browser.Keys.ENTER]);
      browser.assert.urlContains('#user/loginMfa');
      var devEnv = config.devEnv;
      var cookieName = devEnv ? `connect-${devEnv}.sid` : `connect.sid`;
      browser.getCookie(cookieName, function callback(result) {
        this.assert.equal(result.name, cookieName);
        var sessionID = result.value.split('.')[0].substring(4);
        var validationTokenId;
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
        browser.pause(2000);
        database.collection("mfatokens").findOneAndUpdate(
          { sessionId: sessionID, verified: false },
          { $set: { validationTokenIssueDate: fifteenMinutesAgo } },
          function (err, result) {
            if (err) {
              browser.assert.fail("Failed to update issue date: " + err.message);
            }

            const updatedDoc = result.value;
            if (updatedDoc && updatedDoc.validationToken) {
              validationTokenId = updatedDoc.validationToken;
            }
            browser.perform(() => {
              browser.assert.elementPresent('#login-mfa-input-verificationcode');
              browser.sendKeys('#login-mfa-input-verificationcode', [validationTokenId, browser.Keys.ENTER]);
              browser.assert.elementPresent('#loginErrorMessage');
              browser.expect.element('#loginErrorMessage').text.to.equal('Invalid one-time password');
                database.collection("users").updateOne({ email: testData.testUser.email }, { $set: { failedMfaCount: 0 } }, function (err, commandResult) {
                  if (err) {
                    browser.assert.fail("Failed to reset count " + err.message);
                  }
                });
            });
          }
        );
      });
    });

    it('should complete successful login', function (browser) {
      browser.navigateTo(`http://localhost:${config.serverPort}`);
      browser.setValue('#login-input-username', '');
      browser.assert.elementPresent('#login-input-username');
      browser.sendKeys('#login-input-username', testData.testUser.email);
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
      browser.sendKeys('#passwordResetModal', testData.testUser.newpassword);
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
      browser.sendKeys('#passwordResetModal', testData.testUser.newpassword);
      browser.sendKeys('#confirmPasswordResetModal', testData.testUser.newpassword);
      browser.click('.swal2-confirm');
      browser.keys(browser.Keys.ENTER);
      browser.assert.elementPresent('#passwordErrorResetModal');
      browser.expect.element('#passwordErrorResetModal').text.to.equal('Your password cannot be the same as your previous passwords');
      browser.setValue('#passwordResetModal', '');
      browser.setValue('#confirmPasswordResetModal', '');
    });

    it('should accept a new valid password', function (browser) {
      browser.assert.elementPresent('#passwordResetModal');
      browser.sendKeys('#passwordResetModal', testData.testUser.thirdpassword);
      browser.sendKeys('#confirmPasswordResetModal', testData.testUser.thirdpassword);
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

    it('should enable new user login to work', function (browser) {
      browser.sendKeys('#passwordUserManagementResetModal', testData.secondUser.newpassword);
      browser.sendKeys('#confirmPasswordUserManagementResetModal', testData.secondUser.newpassword);
      browser.click('.swal2-confirm');
      browser.keys(browser.Keys.ENTER);
      browser.click('.swal2-confirm');
    });

    it('should be able to logout and render session invalid', function (browser) {
      browser.perform(() => {
        browser.click('.profile-dropbtn');
        browser.keys(browser.Keys.ENTER);
        browser.click('.navigation-user-logout');
        browser.keys(browser.Keys.ENTER);
        browser.assert.urlContains('#user/login');
      });
      browser.navigateTo(`http://localhost:${config.serverPort}/#dashboard`);
      browser.expect.element('.swal2-html-container').text.to.equal('Your session has expired, click OK to log on again');
    });

    it('should accept new user password on login', function (browser) {
      browser.navigateTo(`http://localhost:${config.serverPort}`);
      browser.assert.elementPresent('#login-input-username');
      browser.assert.elementPresent('#login-input-password');
      browser.assert.elementPresent('#login-input-username');
      browser.sendKeys('#login-input-username', testData.secondUser.email);
      browser.sendKeys('#login-input-password', [testData.secondUser.newpassword, browser.Keys.ENTER]);
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
      browser.assert.elementPresent('#passwordResetModal');
      browser.sendKeys('#passwordResetModal', testData.secondUser.thirdpassword);
      browser.sendKeys('#confirmPasswordResetModal', testData.secondUser.thirdpassword);
      browser.click('.swal2-confirm');
      browser.assert.elementNotPresent('#passwordResetModal');
      browser.assert.urlContains('#dashboard');
      browser.perform(() => {
        browser.click('.profile-dropbtn');
        browser.keys(browser.Keys.ENTER);
        browser.click('.navigation-user-logout');
        browser.keys(browser.Keys.ENTER);
        browser.assert.urlContains('#user/login');
        browser.navigateTo(`http://localhost:${config.serverPort}/#dashboard`);
        browser.expect.element('.swal2-html-container').text.to.equal('Your session has expired, click OK to log on again');
      })
    });


    it('should reject login from the old password', function (browser) {
      browser.navigateTo(`http://localhost:${config.serverPort}`);
      browser.pause(1000);
      browser.assert.elementPresent('#login-input-username');
      browser.sendKeys('#login-input-username', testData.testUser.email);
      browser.assert.elementPresent('#login-input-password');
      browser.sendKeys('#login-input-password', [testData.testUser.newpassword, browser.Keys.ENTER]);
      browser.assert.elementPresent('#loginErrorMessage');
      browser.setValue('.login-input-password', '');
    });


    it('should complete successful login with the new password', function (browser) {
      browser.assert.elementPresent('#login-input-username');
      browser.assert.elementPresent('#login-input-password');
      browser.sendKeys('#login-input-password', [testData.testUser.thirdpassword, browser.Keys.ENTER]);
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
      browser.sendKeys('#password', [testData.testUser.lastpassword]);
      browser.sendKeys('#confirmPassword', [testData.testUser.lastpassword]);
      browser.click('.user-profile-edit-sidebar-save-inner');
      browser.keys(browser.Keys.ENTER);
      browser.assert.urlContains('#dashboard');
      browser.click('.profile-dropbtn');
      browser.keys(browser.Keys.ENTER);
      browser.click('.navigation-profile');
      browser.keys(browser.Keys.ENTER);
      browser.expect.element('#firstName').to.have.value.equal('John');
      browser.expect.element('#lastName').to.have.value.equal('Doe');
      browser.perform(() => {
        browser.click('.profile-dropbtn');
        browser.keys(browser.Keys.ENTER);
        browser.click('.navigation-user-logout');
        browser.keys(browser.Keys.ENTER);
      });
    });

    it('should accept password change from profile menu', function (browser) {
      browser.assert.elementPresent('#login-input-username');
      browser.sendKeys('#login-input-username', testData.testUser.email);
      browser.assert.elementPresent('#login-input-password');
      browser.sendKeys('#login-input-password', [testData.testUser.lastpassword, browser.Keys.ENTER]);
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
      browser.sendKeys('#login-input-password', [testData.testUser.lastpassword, browser.Keys.ENTER]);
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
      browser.perform(() => {
        browser.click('.profile-dropbtn');
        browser.keys(browser.Keys.ENTER);
        browser.click('.navigation-user-logout');
        browser.keys(browser.Keys.ENTER);
      });
    });

    it('should accept login with stored mfa cookie', function (browser) {
      browser.navigateTo(`http://localhost:${config.serverPort}`);
      browser.pause(500);
      browser.assert.urlContains('#user/login');
      browser.assert.elementPresent('#login-input-username');
      browser.sendKeys('#login-input-username', testData.testUser.email);
      browser.assert.elementPresent('#login-input-password');
      browser.sendKeys('#login-input-password', [testData.testUser.lastpassword, browser.Keys.ENTER]);
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
            browser.sendKeys('#login-input-password', [testData.testUser.lastpassword, browser.Keys.ENTER]);
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
        browser.sendKeys('#login-input-password', [testData.testUser.lastpassword, browser.Keys.ENTER]);
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
      browser.sendKeys('#login-input-password', [testData.testUser.lastpassword, browser.Keys.ENTER]);
      browser.assert.urlContains('#user/loginMfa');
    });

  });

  after(function (browser) {
    browser.end();
  });

});
