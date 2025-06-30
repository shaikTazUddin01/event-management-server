require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.25fgudl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// middleware
app.use(express.json());
app.use(cors());

// mongoDb connection
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    await client.connect();
    await client.db("event_management").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    const userCollection = client.db("event_management").collection("users");
    const eventCollection = client.db("event_management").collection("events");

    //get event api
    app.get("/event/getAll", async (req, res) => {
      try {
        const { search_title, filter_date } = req.query;

        const pipeline = [];

        if (search_title) {
          pipeline.push({
            $match: { eventTitle: { $regex: search_title, $options: "i" } },
          });
        }

        let startDate, endDate;
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const currentYear = now.getFullYear();
        const currentMonthIndex = now.getMonth();
        const currentDayOfWeek = now.getDay();

        switch (filter_date) {
          case "today":
            startDate = new Date(now);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            break;
          case "currentWeek":
            startDate = new Date(now);
            startDate.setDate(now.getDate() - currentDayOfWeek);
            startDate.setHours(0, 0, 0, 0);

            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
            break;
          case "lastWeek":
            startDate = new Date(now);
            startDate.setDate(now.getDate() - currentDayOfWeek - 7);
            startDate.setHours(0, 0, 0, 0);

            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
            break;
          case "currentMonth":
            startDate = new Date(currentYear, currentMonthIndex, 1);
            startDate.setHours(0, 0, 0, 0);

            endDate = new Date(currentYear, currentMonthIndex + 1, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
          case "lastMonth":
            startDate = new Date(currentYear, currentMonthIndex - 1, 1);
            startDate.setHours(0, 0, 0, 0);

            endDate = new Date(currentYear, currentMonthIndex, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
          default:
            break;
        }

        if (startDate && endDate) {
          pipeline.push({
            $addFields: {
              convertedDateTime: {
                $dateFromString: {
                  dateString: "$dateTime",
                },
              },
            },
          });

          pipeline.push({
            $match: {
              convertedDateTime: { $gte: startDate, $lte: endDate },
            },
          });
        }

        const result = await eventCollection.aggregate(pipeline).toArray();

        res.send({ result, message: "Events retrieved successfully" });
      } catch (error) {
        console.error("Error retrieving events:", error);
        res
          .status(500)
          .send({ message: "Failed to retrieve events", error: error.message });
      }
    });
    //create event api
    app.post("/event/add", async (req, res) => {
      const result = await eventCollection.insertOne(req.body);
      res.send({ result, message: "new event added successfully" });
    });
    //user login api
    app.post("/users/login", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (!existingUser) {
        return res.send({ message: "user not found" });
      }
      const token = jwt.sign(
        {
          email: existingUser.email,
          name: existingUser.name,
          imageUrl: existingUser.imageUrl,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "10d",
        }
      );
      res.send({ token });
    });
    // user registration api
    app.post("/users/registration", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await userCollection.insertOne(user);
      res.send({ result, message: "user added successfully" });
    });
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is connecting");
});

app.listen(port, () => {
  console.log(`server is running`);
});
