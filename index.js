require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.25fgudl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// middleware
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://event-management-theta-three.vercel.app",
    ],
    credentials: true,
  })
);

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

    const userCollection = client.db("event_management").collection("users");
    const eventCollection = client.db("event_management").collection("events");

    // update attendeeCount
    app.patch("/event/attendeeCount/:id", async (req, res) => {
      try {
        const eventId = req.params.id;
        const newAttendeeList = req.body.attendeeCount;
        const filter = { _id: new ObjectId(eventId) };

        const updateDoc = {
          $set: {
            attendeeCount: newAttendeeList,
          },
        };

        const result = await eventCollection.updateOne(filter, updateDoc, {
          new: true,
        });

        if (result.matchedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Event not found." });
        }
        if (result.modifiedCount === 0) {
          return res.status(200).send({
            success: true,
            message:
              "Event found, but no changes applied (already joined or data is identical).",
          });
        }

        const updatedEvent = await eventCollection.findOne(filter);

        res.status(200).send({
          success: true,
          message: "Event updated successfully.",
          data: updatedEvent,
        });
      } catch (error) {
        console.error("Error updating attendee count:", error);
        res.status(500).send({
          success: false,
          message: "Failed to update attendee count.",
          error: error.message,
        });
      }
    });
    //update event
    app.patch("/event/:id", async (req, res) => {
      try {
        const eventId = req.params.id;
        const updatedData = req.body;
        console.log(req.body);
        const filter = { _id: new ObjectId(eventId) };
        console.log(filter);
        const updateDoc = {
          $set: {
            ...updatedData,
          },
        };
        const result = await eventCollection.updateOne(filter, updateDoc, {
          new: true,
        });

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Event not found." });
        }

        res.send({ result, message: "Event updated successfully." });
      } catch (error) {
        res.status(500).send({
          message: "Failed to update the event.",
          error: error.message,
        });
      }
    });
    //Delete event
    app.delete("/event/:id", async (req, res) => {
      const eventId = req.params.id;
      const result = await eventCollection.deleteOne({
        _id: new ObjectId(eventId),
      });
      if (result.deletedCount === 1) {
        res.send({ message: "Event deleted successfully." });
      } else {
        res.status(404).send({ message: "Event not found." });
      }
    });
    // get my event
    app.get("/event/myEvent", async (req, res) => {
      const userEmail = req.query.email;
      const query = { email: userEmail };
      const result = await eventCollection
        .find(query)
        .sort({ date: 1 })
        .toArray();
      res.send({ result, message: "Events retrieved successfully" });
    });
    //get event api
    app.get("/event/getAll", async (req, res) => {
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

      const result = await eventCollection
        .aggregate(pipeline)
        .sort({ date: 1 })
        .toArray();

      res.send({ result, message: "Events retrieved successfully" });
    });
    //create event api
    app.post("/event/add", async (req, res) => {
      const result = await eventCollection.insertOne(req.body);
      res.send({ result, message: "New event added successfully" });
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
