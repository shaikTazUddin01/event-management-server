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
        const result = await eventCollection.find().toArray();
        res.send({ result, message: "retrieve successfully" });
      } catch (error) {
        console.error("Error retrieving events:", error);
        res.status(500).send({ message: "Failed to retrieve events" });
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
