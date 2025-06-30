require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT


app.get("/", (req, res) => {
  res.send("Hello from your Express app!");
});

app.listen(port, () => {
  console.log(`server is running`);
});
