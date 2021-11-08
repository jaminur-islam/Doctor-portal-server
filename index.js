var admin = require("firebase-admin");
const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
require("dotenv").config();

// middleware
app.use(cors());
app.use(express.json());

var serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyToken = async (req, res, next) => {
  if (req?.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split("Bearer ")[1];
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }

  next();
};

// database connect
const { MongoClient } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2uuip.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const run = async () => {
  try {
    await client.connect();
    const database = client.db("DoctorPortal");
    const appointmentCollection = database.collection("Appointments");
    const usersCollection = database.collection("users");

    // PUT admin
    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;

      if (requester) {
        const requesterUser = await usersCollection.findOne({
          email: requester,
        });
        if (requesterUser.role == "Admin") {
          const filter = { email: user.email };
          const updateDoc = {
            $set: {
              role: "Admin",
            },
          };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.send(result);
        } else {
          res.send(403, "no permission");
        }
      }
    });

    // GET  api [filter email]
    app.get("/appointments", verifyToken, async (req, res) => {
      const requester = req.decodedEmail;
      if (requester == req?.query?.email) {
        const email = req.query.email;
        const date = req.query.date;
        const filter = { email: email, date: date };
        const result = await appointmentCollection.find(filter).toArray();
        res.send(result);
      } else {
        res.status(401).json({ message: "user not aphorize" });
      }
    });

    //POST api [appointment data post to server ]
    app.post("/appointments", async (req, res) => {
      const appointment = req.body;
      const result = await appointmentCollection.insertOne(appointment);
      res.send(result);
    });

    // POST user api
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);

      res.send(result);
    });

    // PUT user api
    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const doc = { $set: user };
      const options = { upsert: true };

      const result = await usersCollection.updateOne(filter, doc, options);
      res.send(result);
    });

    // GET admin [admin or not admin firebase checkup]
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const user = await usersCollection.findOne(filter);

      let isadmin = false;
      if (user?.role) {
        isadmin = true;
      }
      res.json({ admin: isadmin });
    });
  } finally {
    // await client.close();
  }
};
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server running");
});
app.listen(port, (ports) => {
  console.log(port);
});
