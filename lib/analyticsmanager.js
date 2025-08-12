// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
var _ = require('underscore');
var async = require('async');
var util = require('util');
var configuration = require('./configuration');
var database = require('./database');
const DateTime = require('luxon').DateTime;

/*
 * CONSTANTS
 */
function DuplicateMessageError(message) {
  this.name = 'DuplicateMessageError';
  this.message = message || 'A message already exists for this name';
}

exports = module.exports = {
  retrieveActivity: function (search, options, callback) {
    if ('function' === typeof options) {
      callback = options;
      options = {};
    }

    database.getDatabase(function (err, db) {
      if (err) {
        console.log(err);
        return callback(err);
      }

      db.retrieve('analyticsactivity', search, options, function (error, results) {
        if (error) {
          console.log(error);
          return callback(error);
        }
        return callback(null, results);
      });
    }, configuration.getConfig('dbName'));
  },

  init: function (app) {
    var self = this;
    var rest = require('./rest');

    rest.post('/analytics/activeusers', function (req, res, next) {
      const { startDate, endDate, interval, timezone } = req.body;

      if (!startDate || !endDate || !timezone) {
        res.statusCode = 400;
        return res.json({ error: 'Missing startDate, endDate, or timezone' });
      }

      // Convert local dates to UTC range
      const startUtc = DateTime.fromISO(startDate, { zone: timezone }).startOf('day').toUTC();
      const endUtc = DateTime.fromISO(endDate, { zone: timezone }).endOf('day').toUTC();

      // Choose data type based on interval
      const type = interval === 'hourly' ? 'hourly' : 'daily';

      const search = {
        type,
        timestamp: {
          $gte: new Date(startUtc.toISO()),
          $lte: new Date(endUtc.toISO())
        }
      };

      self.retrieveActivity(search, function (err, results) {
        if (err) {
          res.statusCode = 500;
          return res.json(err);
        }

        const grouped = groupByInterval(results, interval || 'hourly');
        return res.json(grouped);
      });
    });
  }
};

/*
 * Helper function to group data by interval (UTC-based)
 */
function groupByInterval(data, interval) {
  const grouped = {};

  data.forEach(entry => {
    const date = new Date(entry.timestamp);
    let key;

    switch (interval) {
      case 'daily':
        key = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
        break;
      case 'monthly':
        key = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
        break;
      case 'yearly':
        key = `${date.getUTCFullYear()}`;
        break;
      case 'weekly':
        key = getWeekKey(date); // Uses UTC
        break;
      case 'hourly':
      default:
        key = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}`;
        break;
    }

    if (!grouped[key]) {
      grouped[key] = { timestamp: key, activeUsers: 0, count: 0 };
    }

    grouped[key].activeUsers += entry.activeUsers;
    grouped[key].count += 1;
  });

  return Object.values(grouped).map(group => ({
    timestamp: group.timestamp,
    activeUsers: group.count > 0 ? Math.round(group.activeUsers / group.count) : 0
  }));
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/*
 * Helper to get ISO week key (UTC-based)
 */
function getWeekKey(date) {
  const dt = DateTime.fromJSDate(date, { zone: 'utc' });
  return `${dt.weekYear}-W${pad(dt.weekNumber)}`;
}
