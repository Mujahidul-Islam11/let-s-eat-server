const express = require(`express`);
const app = express();
const cors = require(`cors`);
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


app.get('/', (req, res)=>{
res.send("Are hungry? let's eat.....")
})

app.listen(port, ()=>{
    console.log(`Let's eat boss is running on ${port}`)
})