var mongo = require('mongodb');
var MongoClient = mongo.MongoClient;

var url = "mongodb://localhost:27017/";

MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 5000 }, function (err, db) {
    if (err) {
        console.error("Connection error:", err);
        return;
    }
    console.log('Connected to MongoDB');

    var dbo = db.db("adapt-tenant-master");
    var analytics_db = dbo.collection("analyticsactivities");

    var startDate = new Date('2023-01-01T00:00:00Z');

    // Get current time and round down to the nearest hour
    var now = new Date();
    var endDate = new Date(now);
    endDate.setMinutes(0, 0, 0); // Round down to the hour

    var hourlyRecords = [];
    var dailyRecords = [];

    var currentHour = new Date(startDate);

    // Map to track max hourly count per day
    var dailyMaxMap = new Map();

    // Generate hourly records and track max per day
    while (currentHour < endDate) {
        let count = Math.floor(Math.random() * 100) + 1;

        hourlyRecords.push({
            type: 'hourly',
            timestamp: new Date(currentHour),
            activeUsers: count
        });

        // Create a key for the day (YYYY-MM-DD)
        let dayKey = currentHour.toISOString().split('T')[0];

        // Update max count for the day
        if (!dailyMaxMap.has(dayKey) || dailyMaxMap.get(dayKey) < count) {
            dailyMaxMap.set(dayKey, count);
        }

        currentHour.setHours(currentHour.getHours() + 1);
    }

    // Generate daily records from the map
    for (let [dayKey, maxCount] of dailyMaxMap.entries()) {
        let [year, month, day] = dayKey.split('-');
        let dailyTimestamp = new Date(Date.UTC(year, month - 1, day));

        dailyRecords.push({
            type: 'daily',
            timestamp: dailyTimestamp,
            activeUsers: maxCount
        });
    }

    const allRecords = hourlyRecords.concat(dailyRecords);
    console.log(`Generated ${hourlyRecords.length} hourly and ${dailyRecords.length} daily records`);

    analytics_db.insertMany(allRecords, function (err, res) {
        if (err) {
            console.error("Insert error:", err);
        } else {
            console.log(`Inserted ${res.insertedCount} analytics records`);
        }
        db.close();
    });
});
