const express = require(`express`);
const app = express();
const cors = require(`cors`);
const port = process.env.PORT || 5000;
var jwt = require('jsonwebtoken');
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(cors());
app.use(express.json());

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


    // jwt related api
    app.post("/jwt", async(req, res)=>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
      res.send({token})
    })

     // middlewares
     const verifyToken = (req, res, next) =>{
      console.log("inside verify token",req.headers.authorization);
      if(!req.headers.authorization){
        return res.status(401).send({message: "unauthorized access"})
      }
      const token = req.headers.authorization.split(" ")[1]; 
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
        if(err){
          return res.status(401).send({message: "unauthorized access"})
        }
        req.decoded = decoded;
        next();
      })
    }

    // verify admin after verifyToken

    const verifyAdmin = async(req, res, next) =>{
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "Admin";
      if(!isAdmin){
        return res.status(403).send({message: "forbidden access"})
      }
      next();
    }

    // menu collection's operations
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    // favorites collection's operations
    app.post("/favorites", async (req, res) => {
      const favItem = req.body;
      const result = await favItemsCollection.insertOne(favItem);
      res.send(result);
    });

    app.get("/favorites", async (req, res) => { 
      const email = req.query.email;
      const query = {email: email}
      const result = await favItemsCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/favorites/:id", async (req, res) => { 
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await favItemsCollection.deleteOne(query);
      res.send(result);
    });

    // users collection's operations
    app.post("/users", async(req, res) =>{
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    app.get("/users", verifyToken, verifyAdmin, async(req, res) =>{
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    app.get("/users/admin/:email", verifyToken, async(req, res)=>{
      const email = req.params.email;
      if(!email === req.decoded.email){
        return res.status(403).send({message: "forbidden access"})
      }
      const query = {email: email};
      const user = await userCollection.findOne(query);
      let admin = false;
      if(user){
        admin = user?.role === "Admin"? true: false;
      }
      res.send({admin});
    })

    app.delete("/users/admin/:id", async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    app.patch("/users/admin/:id", async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: "Admin"
        }
      }
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    })

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
