const express = require(`express`);
const app = express();
const cors = require(`cors`);
const port = process.env.PORT || 5000;
var jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(cors());
app.use(express.json());

const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.u8ojnwq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

    // database collections
    const database = client.db("LetsEatDB");
    const userCollection = database.collection("users");
    const menuCollection = database.collection("menu");
    const favItemsCollection = database.collection("favItems");
    const paymentCollection = database.collection("payments");
    const bookingsCollection = database.collection("bookings");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // verify admin after verifyToken

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "Admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // menu collection's operations
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      const menuItem = req.body;
      const result = await menuCollection.insertOne(menuItem);
      res.send(result);
    });

    app.delete(
      "/menu/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await menuCollection.deleteOne(query);
        res.send(result);
      }
    );

    app.patch("/menu/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          name: item.name,
          img: item.img,
          category: item.category,
          price: item.price,
          rating: 0,
          desc: item.desc,
          status: item.status,
        },
      };
      const result = await menuCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // favorites collection's operations
    app.post("/favorites", verifyToken, async (req, res) => {
      const favItem = req.body;
      const result = await favItemsCollection.insertOne(favItem);
      res.send(result);
    });

    app.get("/favorites", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await favItemsCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/favorites/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await favItemsCollection.deleteOne(query);
      res.send(result);
    });

    // users collection's operations
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (!email === req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "Admin" ? true : false;
      }
      res.send({ admin });
    });

    app.delete("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "Admin",
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // payment collection's operations
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", verifyToken, async (req, res) => {
      const paymentInfo = req.body;
      const result = await paymentCollection.insertOne(paymentInfo);

      // delete item from favorites
      const query = {
        _id: { $in: paymentInfo?.favIds?.map((id) => new ObjectId(id)) },
      };
      const deletedResult = await favItemsCollection?.deleteMany(query);
      res.send({ result, deletedResult });
    });

    app.patch("/payments/confirm/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set:{
          status: "complete"
        }
      }
      const result = await paymentCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.get("/payments/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      if (!email == req.decoded.email) {
        res.status(403).send({ message: "forbidden access" });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/payments", verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    // admin stats api
    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();
      // const payments = await paymentCollection.find().toArray();
      // const revenue = payments?.reduce((total, item) => total + item.price, 0).toFixed(2);
      const result = await paymentCollection
        ?.aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$price" },
            },
          },
        ])
        .toArray();
      const revenue = result.length > 0 ? result[0].totalRevenue.toFixed(2) : 0;
      res.send({
        users,
        menuItems,
        orders,
        revenue,
      });
    });
    // table collection's apis
    app.post("/bookings", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await bookingsCollection.insertOne(data);
      res.send(result);
    });

    app.get("/bookings", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/bookings/admin",verifyToken, verifyAdmin, async (req, res) => {
      const result = await bookingsCollection.find().toArray();
      res.send(result);
    });

    app.delete("/bookings/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/bookings/confirm/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set:{
          status: "confirmed"
        }
      }
      const result = await bookingsCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.patch("/bookings/cancel/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set:{
          status: "canceled"
        }
      }
      const result = await bookingsCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Are hungry? let's eat.....");
});

app.listen(port, () => {
  console.log(`Let's eat, boss is running on ${port}`);
});
