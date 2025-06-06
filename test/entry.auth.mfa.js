var async = require('async');
var should = require('should');
var request = require('supertest');

var origin = require('../');
var auth = require('../lib/auth');
var usermanager = require('../lib/usermanager');

var app = origin();

var testData = require('./testData.json');
var authUser = testData.auth;
var testUser = testData.testUser;

var helper = {
  passwordCipher: '',
  userAgent: {},
};


before(function (done) {
  // store the agent to use cookies
  app.configuration.setConfig('useMFA', true);
  helper.userAgent = request.agent(app.getServerURL());
  createUser(authUser, done);
});

after(function (done) {
  removeUser(authUser, done);
});

it('should be able to generate a random token', function (done) {
  auth.createToken(function (error, token) {
    should.not.exist(error);
    token.should.have.lengthOf(24);
    done();
  });
});

it('should be able to hash a password', function (done) {
  auth.hashPassword(authUser.plainPassword, function (error, hash) {
    should.not.exist(error);
    helper.passwordCipher = hash;
    done();
  });
});

it('should validate a correct password', function (done) {
  auth.validatePassword(authUser.plainPassword, helper.passwordCipher, function (error, valid) {
    should.not.exist(error);
    valid.should.be.true;
    done();
  });
});

it('should not validate an incorrect password', function (done) {
  auth.validatePassword('this is not my password', helper.passwordCipher, function (error, valid) {
    should.not.exist(error);
    valid.should.not.be.true;
    done();
  });
});

it('should be able to generate an mfa token', function (done) {
  auth.createMfaToken(function (error, token) {
    should.not.exist(error);
    token.should.have.lengthOf(6);
    done();
  });
});

var sharedTokenId;

it('should be able to generate an mfa tokenId', function (done) {
  auth.generateTokenId(function (error, tokenId) {
    sharedTokenId = tokenId;
    should.not.exist(error);
    should.exist(sharedTokenId);
    sharedTokenId.should.have.lengthOf(32);
    done();
  });
});

var sharedSignedToken;

it('should be able to sign tokenId signature', function (done) {
  sharedSignedToken = auth.signTokenId(sharedTokenId);
  should.exist(sharedSignedToken);
  sharedSignedToken.should.have.lengthOf(80);
  done();
});

it('should accept valid tokenId signature', function (done) {
  auth.validateTokenIdSignature(sharedSignedToken, function (error, validatedTokenId) {
    should.not.exist(error);
    should.exist(validatedTokenId);
    validatedTokenId.should.equal(sharedTokenId);
    done();
  });
});

it('should reject invalid tokenId signature', function (done) {
  auth.validateTokenIdSignature('s%3Abz9ewb_AK7Tq_W3rDlJcxUskp4BKPxNw.ozxklshvzpXmA08vLuEGXawARyAZGj_nujyQsOGsDBg', function (error, validatedTokenId) {
    should.exist(error);
    should.not.exist(validatedTokenId);
    done();
  });
});

it('should reject a user with an incorrect login', function (done) {
  helper.userAgent
    .post('/api/login')
    .set('Accept', 'application/json')
    .send({
      'email': 'nobody@nowhere.com',
      'password': '12345'
    })
    .expect(401)
    .expect('Content-Type', /json/)
    .end(function (error, res) {
      should.not.exist(error);
      done();
    });
});

it('should reject a user with an incorrect mfa token', function (done) {
  helper.userAgent
    .post('/api/login')
    .set('Accept', 'application/json')
    .send({
      'email': authUser.email,
      'password': authUser.plainPassword
    })
    .expect(200)
    .end(function (error, res) {
      should.not.exist(error);
      should.exist(res.body.id);
      res.body.email.should.equal(authUser.email);
      res.body.isAuthenticated.should.equal(false);
        helper.userAgent
          .post('/api/loginMfa')
          .send({
            'email': authUser.email,
            'token': 123456,
            'shouldSkipMfa': false
          })
          .expect(403)
          .end(function (error, res) {
            should.not.exist(error);
            res.body.errorCode.should.equal('invalidMfaToken');
            done();
          });

    });
});

it('should accept authenticated requests to create a user session', function (done) {
  helper.userAgent
    .post('/api/login')
    .set('Accept', 'application/json')
    .send({
      'email': authUser.email,
      'password': authUser.plainPassword
    })
    .expect(200)
    .end(function (error, res) {
      should.not.exist(error);
      should.exist(res.body.id);
      res.body.email.should.equal(authUser.email);
      res.body.isAuthenticated.should.equal(false);
      usermanager.retrieveMfaToken({ userId: res.body.id, verified: false }, function (error, tokens) {
        var token = tokens[0];
        helper.userAgent
          .post('/api/loginMfa')
          .send({
            'email': authUser.email,
            'token': token.validationToken,
            'shouldSkipMfa': false
          })
          .expect(200)
          .end(function (error, res) {
            should.not.exist(error);
            res.body.email.should.equal(authUser.email);
            res.body.isAuthenticated.should.equal(true);
            should.exist(res.body.tenantId);
            should.exist(res.body.tenantName);
            should.exist(res.body.permissions);
            done();
          });
      });
    });
});

it('should accept requests to verify if a user is authenticated', function (done) {
  helper.userAgent
    .get('/api/authcheck')
    .send()
    .expect(200)
    .end(function (error, res) {
      should.not.exist(error);
      res.body.id.should.equal(authUser._id);
      done();
    });
});

it('should accept requests to create a password reset token', function (done) {
  helper.userAgent
    .post('/api/createtoken')
    .set('Accept', 'application/json')
    .send({ 'email': authUser.email })
    .expect(200)
    .end(function (error, res) {
      should.not.exist(error);
      done();
    });
});

it('should accept requests to reset a user\'s password', function (done) {
  usermanager.retrieveUser({ email: authUser.email, auth: 'local' }, function (error, userObject) {
    should.not.exist(error);
    should.exist(userObject);
    usermanager.retrieveUserPasswordReset({ user: userObject._id }, function (error, reset) {
      should.not.exist(error);
      should.exist(reset);
      helper.userAgent
        .put('/api/userpasswordreset/' + reset.token)
        .set('Accept', 'application/json')
        .send({
          'user': authUser._id,
          'password': authUser.newPassword,
          'token': reset.token
        })
        .expect(200)
        .end(function (error, res) {
          should.not.exist(error);
          done();
        });
    });
  });
});

it('should reset a users password', function (done) {
  helper.userAgent
    .post('/api/login')
    .set('Accept', 'application/json')
    .send({
      'email': authUser.email,
      'password': authUser.newPassword
    })
    .expect(200)
    .expect('Content-Type', /json/)
    .end(function (error, res) {
      should.not.exist(error);
      done();
    });
});

it('should delete password token after password change', function (done) {
  usermanager.retrieveUser({ email: authUser.email, auth: 'local' }, function (error, userObject) {
    should.not.exist(error);
    should.exist(userObject);
    usermanager.retrieveUserPasswordReset({ user: userObject._id }, function (error, reset) {
      should.not.exist(reset);
      done();
    });
  });
});

it('should accept requests to end a user session', function (done) {
  helper.userAgent
    .post('/api/logout')
    .expect(200)
    .end(function (error, res) {
      should.not.exist(error);
      done();
    });
});

it('should not reset a different users password', function (done) {
  helper.userAgent
    .post('/api/createtoken')
    .set('Accept', 'application/json')
    .send({ 'email': authUser.email })
    .expect(200)
    .end(function (error, res) {
      should.not.exist(error);
      usermanager.retrieveUser({ email: authUser.email, auth: 'local' }, function (error, userObject) {
        should.not.exist(error);
        should.exist(userObject);
        usermanager.retrieveUserPasswordReset({ user: userObject._id }, function (error, reset) {
          should.not.exist(error);
          should.exist(reset);
          helper.userAgent
            .put('/api/userpasswordreset/' + reset.token)
            .set('Accept', 'application/json')
            .send({
              'user': testUser._id,
              'password': authUser.secondNewPassword,
              'token': reset.token
            })
            .expect(200)
            .end(function (error, res) {
              should.not.exist(error);
              helper.userAgent
                .post('/api/login')
                .set('Accept', 'application/json')
                .send({
                  'email': authUser.email,
                  'password': authUser.secondNewPassword
                })
                .expect(200)
                .expect('Content-Type', /json/)
                .end(function (error, res) {
                  should.not.exist(error);
                  // Should not allow user 2 to login with the new password
                  helper.userAgent
                    .post('/api/login')
                    .set('Accept', 'application/json')
                    .send({
                      'email': testUser.email,
                      'password': testUser.secondNewPassword
                    })
                    .expect(401)
                    .expect('Content-Type', /json/)
                    .end(function (error, res) {
                      should.not.exist(error);
                      done();
                    });
                });
            });
        });
      });
    });
});

function createUser(userData, done) {
  auth.hashPassword(userData.plainPassword, function (error, hash) {
    if (error) return done(error);
    userData.password = hash;
    if (!userData._tenantId) {
      userData._tenantId = app.configuration.getConfig('masterTenantID');
    }
    usermanager.createUser(userData, function (error, user) {
      if (error && error instanceof usermanager.errors.DuplicateUserError) {
        return usermanager.retrieveUser({ email: userData.email }, done);
      }
      userData._id = user._id.toString();
      done(error, user);
    });
  });
}

function removeUser(userData, done) {
  if (!userData._id) return done();
  usermanager.deleteUser({ _id: userData._id }, function (error) {
    if (error) return done(error);
    usermanager.retrieveUserPasswordReset({ user: userData._id }, function (error, record) {
      if (error) return done(error);
      if (!record) return done();
      usermanager.deleteUserPasswordReset({ user: record.user }, done);
    });
  });
}

function getUserResetData() {
  return {
    email: authUser.email,
    token: authUser.token,
    issueDate: new Date(),
    ipAddress: '127.0.0.1',
    auth: 'local'
  };
}
