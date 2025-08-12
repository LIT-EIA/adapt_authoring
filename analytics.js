var mongo = require('mongodb');
var MongoClient = mongo.MongoClient;

var url = "mongodb://localhost:27017/";

MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 5000 }, function (err, db) {
    if (err) {
        console.error("Connection error:", err);
        return;
    }
    console.log('connected');

    var dbo = db.db("adapt-tenant-master");
    var users_db = dbo.collection("users");
    var analytics_db = dbo.collection("analyticsactivities");

    // Get current time and round down to the nearest hour
    var now = new Date();
    var endOfWindow = new Date(now);
    endOfWindow.setMinutes(0, 0, 0);
    var startOfWindow = new Date(endOfWindow.getTime() - 60 * 60 * 1000);

    console.log(`Querying users between ${startOfWindow.toISOString()} and ${endOfWindow.toISOString()}`);

    users_db.countDocuments({
        lastAccess: {
            $gte: startOfWindow,
            $lt: endOfWindow
        }
    }, function (err, count) {
        if (err) {
            console.error("Count error:", err);
            db.close();
            return;
        }

        console.log(`Found ${count} active users`);

        var analyticsRecord = {
            timestamp: startOfWindow,
            activeUsers: count
        };

        console.log(analyticsRecord);

        analytics_db.insertOne(analyticsRecord, function (err, res) {
            if (err) {
                console.error("Insert error:", err);
            } else {
                console.log(`Analytics saved: ${count} active users at ${endOfWindow}`);
            }
            db.close(); // Always close the DB
        });
    });
});
