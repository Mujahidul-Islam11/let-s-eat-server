const express = require(`express`);
const app = express();
const cors = require(`cors`);
const port = process.env.PORT || 5000;
require("dotenv").config()
const { MongoClient, ServerApiVersion } = require('mongodb');


// middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.u8ojnwq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();

    // database collections
    const database = client.db("LetsEatDB");
    const menuCollection = database.collection("menu");

    // crud operations
    app.get("/menu", async(req, res)=> {
        const result = await menuCollection.find().toArray();
        res.send(result)
    })

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res)=>{
res.send("Are hungry? let's eat.....")
})

app.listen(port, ()=>{
    console.log(`Let's eat boss is running on ${port}`)
})