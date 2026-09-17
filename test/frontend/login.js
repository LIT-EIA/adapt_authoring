var mongo = require('mongodb');
var MongoClient = mongo.MongoClient;
var config = require('../.testcache/testConfig.generated.json');
var testData = require('../testData.json');
var authString = config.dbUser && config.dbPass ?
  encodeURIComponent(config.dbUser) + ':' + encodeURIComponent(config.dbPass) + '@' : '';
var url = 'mongodb://' + authString + config.dbHost + ':' + config.dbPort + '/';
if (config.dbAuthSource) {
  url += '?authSource=' + config.dbAuthSource;
}

describe('login process', function () {

  before(function (browser) {
    browser.navigateTo(`http://localhost:${config.serverPort}`);
  });

  MongoClient.connect(url).then(function (db) {

    var database = db.db(config.dbName);

    it('should return invalid email address or password message on wrong password', function (browser) {
      browser.waitForElementPresent('#login-input-username', 5000);
      browser.sendKeys('#login-input-username', testData.testUser.email);
      browser.waitForElementPresent('#login-input-password', 5000);
      browser.sendKeys('#login-input-password', ['mywrongpassword', browser.Keys.ENTER]);
      browser.assert.elementPresent('#loginErrorMessage');
      browser.expect.element('#loginErrorMessage').text.to.equal('Invalid email address or password');
    });

    it('should lock account after 3 wrong passwords', function (browser) {
      browser.waitForElementPresent('#login-input-username', 5000);

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

      browser.waitForElementPresent('#login-input-password', 5000);
      browser.sendKeys('#login-input-password', [testData.testUser.plainPassword, browser.Keys.ENTER]);
      browser.assert.elementPresent('#loginErrorMessage');
      browser.expect.element('#loginErrorMessage').text.to.equal('This account has been locked because of too many failed login attempts.');

      browser.perform(async () => {
        const commandResult = await database.collection("users").updateOne({ email: testData.testUser.email }, { $set: { failedLoginCount: 0 } });
        browser.assert.equal(commandResult.modifiedCount, 1);
      });
      browser.setValue('#login-input-username', '');
    });

    it('should fail login whenever failedLoginCount, failedMfaCount, mfaResetCount or passwordResetCount reaches 3', function (browser) {
      const updates = [
        { field: 'failedLoginCount', value: 3 },
        { field: 'failedMfaCount', value: 3 },
        { field: 'mfaResetCount', value: 3 }
      ];

      const resetAllFields = async () => {
        const commandResult = await database.collection("users").updateOne(
          { email: testData.testUser.email },
          {
            $set: {
              failedLoginCount: 0,
              failedMfaCount: 0,
              mfaResetCount: 0
            }
          }
        );
        browser.assert.strictEqual(commandResult.matchedCount, 1, "Expected 1 document to match for reset");
      };

      updates.forEach(({ field, value }, index) => {
        // The login form's submit handler is debounced (leading-edge, 300ms) to guard
        // against double-submits, so successive rapid submits in this loop (with no
        // page reload in between) must be spaced out past that window or they get
        // silently dropped, leaving #loginErrorMessage unchanged from its prior state.
        browser.pause(500);

        // Reset all fields before each iteration
        browser.perform(resetAllFields);

        // Set the current field to 3
        browser.perform(async () => {
          const update = {};
          update[field] = value;

          const commandResult = await database.collection("users").updateOne(
            { email: testData.testUser.email },
            { $set: update }
          );
          browser.assert.strictEqual(
            commandResult.matchedCount,
            1,
            `Expected 1 document to match for ${field}`
          );
        });

        // Perform login and assert error message

        browser.setValue('#login-input-username', '');
        browser.waitForElementPresent('#login-input-username', 5000);
        browser.sendKeys('#login-input-username', testData.testUser.email);
        browser.waitForElementPresent('#login-input-password', 5000);
        browser.sendKeys('#login-input-password', [testData.testUser.plainPassword, browser.Keys.ENTER]);
        browser.assert.elementPresent('#loginErrorMessage');
        browser.expect.element('#loginErrorMessage').text.to.equal(
          'This account has been locked because of too many failed login attempts.'
        );

      });

      browser.perform(resetAllFields);
      // Final check: all fields should be 0
      browser.perform(async () => {
        const user = await database.collection("users").findOne(
          { email: testData.testUser.email },
          {
            projection: {
              failedLoginCount: 1,
              failedMfaCount: 1,
              mfaResetCount: 1,
              _id: 0
            }
          }
        );
        browser.assert.strictEqual(user.failedLoginCount, 0, 'failedLoginCount should be 0');
        browser.assert.strictEqual(user.failedMfaCount, 0, 'failedMfaCount should be 0');
        browser.assert.strictEqual(user.mfaResetCount, 0, 'mfaResetCount should be 0');
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
      browser.perform(async () => {
        const user = await database.collection("users").findOne({ email: testData.testUser.email });
        const result = await database.collection("userpasswordresets").findOne({ user: user._id });
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
        browser.perform(async () => {
          browser.pause(2000);
          const commandResult = await database.collection("users").updateOne({ email: testData.testUser.email }, { $set: { lastPasswordChange: new Date("2020-01-01T00:00:00Z") } });
          console.log(commandResult)
        });
      });
    });

    it('should reject login when mfa code is over 10 minutes old', function (browser) {
      browser.navigateTo(`http://localhost:${config.serverPort}`);
      browser.setValue('#login-input-username', '');
      browser.waitForElementPresent('#login-input-username', 5000);
      browser.sendKeys('#login-input-username', testData.testUser.email);
      browser.waitForElementPresent('#login-input-password', 5000);
      browser.sendKeys('#login-input-password', [testData.testUser.newpassword, browser.Keys.ENTER]);
      browser.assert.urlContains('#user/loginMfa');
      var devEnv = config.devEnv;
      var cookieName = devEnv ? `connect-${devEnv}.sid` : `connect.sid`;
      browser.getCookie(cookieName, async function callback(result) {
        this.assert.equal(result.name, cookieName);
        var sessionID = result.value.split('.')[0].substring(4);
        var validationTokenId;
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
        browser.pause(2000);
        const updatedDoc = await database.collection("mfatokens").findOneAndUpdate(
          { sessionId: sessionID, verified: false },
          { $set: { validationTokenIssueDate: fifteenMinutesAgo } }
        );
        if (updatedDoc && updatedDoc.validationToken) {
          validationTokenId = updatedDoc.validationToken;
        }
        browser.perform(async () => {
          browser.assert.elementPresent('#login-mfa-input-verificationcode');
          browser.sendKeys('#login-mfa-input-verificationcode', [validationTokenId, browser.Keys.ENTER]);
          browser.assert.elementPresent('#loginErrorMessage');
          browser.expect.element('#loginErrorMessage').text.to.equal('Invalid one-time password');
          await database.collection("users").updateOne({ email: testData.testUser.email }, { $set: { failedMfaCount: 0 } });
        });
      });
    });

    it('should complete successful login', function (browser) {
      browser.navigateTo(`http://localhost:${config.serverPort}`);
      browser.setValue('#login-input-username', '');
      browser.waitForElementPresent('#login-input-username', 5000);
      browser.sendKeys('#login-input-username', testData.testUser.email);
      browser.waitForElementPresent('#login-input-password', 5000);
      browser.sendKeys('#login-input-password', [testData.testUser.newpassword, browser.Keys.ENTER]);
      browser.assert.urlContains('#user/loginMfa');
      var devEnv = config.devEnv;
      var cookieName = devEnv ? `connect-${devEnv}.sid` : `connect.sid`;
      browser.getCookie(cookieName, async function callback(result) {
        this.assert.equal(result.name, cookieName);
        var sessionID = result.value.split('.')[0].substring(4);
        var validationTokenId;
        const result2 = await database.collection("mfatokens").findOne({ sessionId: sessionID, verified: false });
        if (result2 && result2.validationToken) {
          validationTokenId = result2.validationToken;
        }
        browser.assert.elementPresent('#login-mfa-input-verificationcode');
        browser.sendKeys('#login-mfa-input-verificationcode', [validationTokenId, browser.Keys.ENTER]);
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

    it('locked account should return the right message in usermanager', function (browser) {
      browser.pause(1000);
      browser.perform(async () => {
        // The previous test submits the "create user" form without waiting for the
        // POST to complete, so secondUser may not exist in Mongo yet. Poll for it
        // before locking, otherwise this updateOne silently matches 0 documents.
        let user = null;
        for (let i = 0; i < 20 && !user; i++) {
          user = await database.collection("users").findOne({ email: testData.secondUser.email });
          if (!user) {
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
        }
        const commandResult = await database.collection("users").updateOne({ email: testData.secondUser.email }, { $set: { failedLoginCount: 3, passwordResetCount: 0, failedMfaCount: 0, mfaResetCount: 0 } });
        browser.assert.strictEqual(commandResult.matchedCount, 1, 'Expected secondUser to exist before locking');
      });
      browser.pause(1000);
      browser.navigateTo(`http://localhost:${config.serverPort}/#userManagement`);
      browser.pause(1000);
      // This is the first hard refresh() in the whole suite, so the SPA bundle loads
      // cold here (every prior navigateTo was a same-page hash change); give it a
      // generous timeout to finish loading before checking the locked-user label.
      browser.refresh();
      browser.waitForElementPresent('.users', 15000);
      browser.useXpath().assert.containsText(
        "//div[contains(@class, 'user-item') and contains(@class, 'locked')]//div[contains(@class, 'col-10')][.//text()[contains(., 'Locked')]]",
        'Locked'
      ).useCss();
    });

    it('email password locked account should return the right message in usermanager', function (browser) {
      browser.pause(1000);
      browser.perform(async () => {
        await database.collection("users").updateOne({ email: testData.secondUser.email }, { $set: { failedLoginCount: 0, passwordResetCount: 3, failedMfaCount: 0, mfaResetCount: 0 } });
      });
      browser.pause(1000);
      browser.navigateTo(`http://localhost:${config.serverPort}/#userManagement`);
      browser.pause(1000);
      browser.refresh();
      browser.waitForElementPresent('.users', 15000);
      browser.useXpath().assert.containsText(
        "//div[contains(@class, 'user-item') and contains(@class, 'locked')]//div[contains(@class, 'col-10')][.//text()[contains(., 'Password Mail Locked')]]",
        'Locked'
      ).useCss();
    });

    it('mfa locked account should return the right message in usermanager', function (browser) {
      browser.pause(1000);
      browser.perform(async () => {
        await database.collection("users").updateOne({ email: testData.secondUser.email }, { $set: { failedLoginCount: 0, passwordResetCount: 0, failedMfaCount: 3, mfaResetCount: 0 } });
      });
      browser.pause(1000);
      browser.navigateTo(`http://localhost:${config.serverPort}/#userManagement`);
      browser.pause(1000);
      browser.refresh();
      browser.waitForElementPresent('.users', 15000);
      browser.useXpath().assert.containsText(
        "//div[contains(@class, 'user-item') and contains(@class, 'locked')]//div[contains(@class, 'col-10')][.//text()[contains(., 'Mfa Locked')]]",
        'Locked'
      ).useCss();
    });
    it('mfa email locked account should return the right message in usermanager', function (browser) {
      browser.pause(1000);
      browser.perform(async () => {
        await database.collection("users").updateOne({ email: testData.secondUser.email }, { $set: { failedLoginCount: 0, passwordResetCount: 0, failedMfaCount: 0, mfaResetCount: 3 } });
      });
      browser.pause(1000);
      browser.navigateTo(`http://localhost:${config.serverPort}/#userManagement`);
      browser.pause(1000);
      browser.refresh();
      browser.waitForElementPresent('.users', 15000);
      browser.useXpath().assert.containsText(
        "//div[contains(@class, 'user-item') and contains(@class, 'locked')]//div[contains(@class, 'col-10')][.//text()[contains(., 'Mfa Mail Locked')]]",
        'Locked'
      ).useCss();
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
      browser.waitForElementPresent('#login-input-username', 5000);
      browser.waitForElementPresent('#login-input-password', 5000);
      browser.waitForElementPresent('#login-input-username', 5000);
      browser.sendKeys('#login-input-username', testData.secondUser.email);
      browser.sendKeys('#login-input-password', [testData.secondUser.newpassword, browser.Keys.ENTER]);
      browser.assert.urlContains('#user/loginMfa');
      var devEnv = config.devEnv;
      var cookieName = devEnv ? `connect-${devEnv}.sid` : `connect.sid`;
      browser.getCookie(cookieName, async function callback(result) {
        this.assert.equal(result.name, cookieName);
        var sessionID = result.value.split('.')[0].substring(4);
        var validationTokenId;
        const result2 = await database.collection("mfatokens").findOne({ sessionId: sessionID, verified: false });
        if (result2 && result2.validationToken) {
          validationTokenId = result2.validationToken;
        }
        browser.assert.elementPresent('#login-mfa-input-verificationcode');
        browser.sendKeys('#login-mfa-input-verificationcode', [validationTokenId, browser.Keys.ENTER]);
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
      browser.waitForElementPresent('#login-input-username', 5000);
      browser.sendKeys('#login-input-username', testData.testUser.email);
      browser.waitForElementPresent('#login-input-password', 5000);
      browser.sendKeys('#login-input-password', [testData.testUser.newpassword, browser.Keys.ENTER]);
      browser.assert.elementPresent('#loginErrorMessage');
      browser.setValue('.login-input-password', '');
    });


    it('should complete successful login with the new password', function (browser) {
      browser.waitForElementPresent('#login-input-username', 5000);
      browser.waitForElementPresent('#login-input-password', 5000);
      browser.sendKeys('#login-input-password', [testData.testUser.thirdpassword, browser.Keys.ENTER]);
      browser.assert.urlContains('#user/loginMfa');
      var devEnv = config.devEnv;
      var cookieName = devEnv ? `connect-${devEnv}.sid` : `connect.sid`;
      browser.getCookie(cookieName, async function callback(result) {
        this.assert.equal(result.name, cookieName);
        var sessionID = result.value.split('.')[0].substring(4);
        var validationTokenId;
        const result2 = await database.collection("mfatokens").findOne({ sessionId: sessionID, verified: false });
        if (result2 && result2.validationToken) {
          validationTokenId = result2.validationToken;
        }
        browser.assert.elementPresent('#login-mfa-input-verificationcode');
        browser.sendKeys('#login-mfa-input-verificationcode', [validationTokenId, browser.Keys.ENTER]);
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
      browser.waitForElementPresent('#login-input-username', 5000);
      browser.sendKeys('#login-input-username', testData.testUser.email);
      browser.waitForElementPresent('#login-input-password', 5000);
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
      browser.perform(async () => {
        const commandResult = await database.collection("users").updateOne({ email: testData.testUser.email }, { $set: { failedMfaCount: 0 } });
        browser.assert.equal(commandResult.modifiedCount, 1);
      });
    });

    var storedCookie;

    it('should be able to remember mfa token for 30 days', function (browser) {
      browser.navigateTo(`http://localhost:${config.serverPort}`);
      browser.pause(500);
      browser.assert.urlContains('#user/login');
      browser.waitForElementPresent('#login-input-username', 5000);
      browser.sendKeys('#login-input-username', testData.testUser.email);
      browser.waitForElementPresent('#login-input-password', 5000);
      browser.sendKeys('#login-input-password', [testData.testUser.lastpassword, browser.Keys.ENTER]);
      browser.assert.urlContains('#user/loginMfa');
      var devEnv = config.devEnv;
      var cookieName = devEnv ? `connect-${devEnv}.sid` : `connect.sid`;
      browser.getCookie(cookieName, async function callback(result) {
        this.assert.equal(result.name, cookieName);
        storedCookie = result;
        var sessionID = result.value.split('.')[0].substring(4);
        var validationTokenId;
        const result2 = await database.collection("mfatokens").findOne({ sessionId: sessionID, verified: false });
        if (result2 && result2.validationToken) {
          validationTokenId = result2.validationToken;
        }
        browser.assert.elementPresent('#skip-mfa');
        browser.element('#skip-mfa').check();
        browser.assert.elementPresent('#login-mfa-input-verificationcode');
        browser.sendKeys('#login-mfa-input-verificationcode', [validationTokenId, browser.Keys.ENTER]);
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
      browser.waitForElementPresent('#login-input-username', 5000);
      browser.sendKeys('#login-input-username', testData.testUser.email);
      browser.waitForElementPresent('#login-input-password', 5000);
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
      browser.getCookie(cookieName, async function callback(result) {
        this.assert.equal(result.name, cookieName);
        var tokenID = result.value.split('.')[0].substring(6);
        const fortyFiveDaysAgo = new Date();
        fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
        await database.collection("mfatokens").updateOne(
          { tokenId: tokenID, verified: true }, // filter
          { $set: { validationDate: fortyFiveDaysAgo } } // update
        );
        browser.navigateTo(`http://localhost:${config.serverPort}`);
        browser.pause(500);
        browser.assert.urlContains('#user/login');
        browser.waitForElementPresent('#login-input-username', 5000);
        browser.sendKeys('#login-input-username', testData.testUser.email);
        browser.waitForElementPresent('#login-input-password', 5000);
        browser.sendKeys('#login-input-password', [testData.testUser.lastpassword, browser.Keys.ENTER]);
        browser.pause(2000);
        browser.assert.urlContains('#user/loginMfa');
        await database.collection("mfatokens").updateOne(
          { tokenId: tokenID, verified: true }, // filter
          { $set: { validationDate: new Date() } } // update
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
        browser.waitForElementPresent('#login-input-username', 5000);
        browser.sendKeys('#login-input-username', testData.testUser.email);
        browser.waitForElementPresent('#login-input-password', 5000);
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
      browser.waitForElementPresent('#login-input-username', 5000);
      browser.sendKeys('#login-input-username', testData.testUser.email);
      browser.waitForElementPresent('#login-input-password', 5000);
      browser.sendKeys('#login-input-password', [testData.testUser.lastpassword, browser.Keys.ENTER]);
      browser.assert.urlContains('#user/loginMfa');
    });

  }).catch(function (err) {
    browser.assert.fail("Database connection failed: " + err.message);
  });

  after(function (browser) {
    browser.end();
  });

});
