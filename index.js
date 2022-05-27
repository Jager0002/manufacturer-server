const express = require("express")
const cors = require("cors")
const jwt = require("jsonwebtoken")
require("dotenv").config()

const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb")
const { query } = require("express")
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.xvql8.mongodb.net/?retryWrites=true&w=majority`
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
})

function verifyUser(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader)
    return res.status(401).send({ message: "unauthorized access" })
  const token = authHeader.split(" ")[1]
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) return res.status(403).send({ message: "forbidden access" })
    req.decoded = decoded
    next()
  })
}

async function run() {
  try {
    await client.connect()

    //dataCollection
    const alyonaDatabase = client
      .db("alyona-industries-ltd")
      .collection("alyonaParts")

    // orderCollection
    const orderCollection = client
      .db("alyona-industries-ltd")
      .collection("alyonaPartsOrder")

    // uercollection
    const userCollection = client
      .db("alyona-industries-ltd")
      .collection("alyonaUser")

    //reviewCollection
    const reviewCollection = client
      .db("alyona-industries-ltd")
      .collection("alyonaReview")

    //summaryCollection
    const summaryCollection = client
      .db("alyona-industries-ltd")
      .collection("alyonaSummary")

    // profileCollection
    const profileCollection = client
      .db("alyona-industries-ltd")
      .collection("alyonaProfiles")

    // access token generator
    app.get("/login/:email", async (req, res) => {
      const email = req.params.email
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        {
          expiresIn: "1d",
        }
      )
      res.send({ accessToken: token })
      await userCollection.insertOne({ email: email, role: "user" })
    })

    // Purchase parts
    app.get("/parts", async (req, res) => {
      const parts = await alyonaDatabase.find({}).toArray()
      res.send(parts)
    })

    // Unique part
    app.get("/part/:id", verifyUser, async (req, res) => {
      const id = req.params.id
      const result = await alyonaDatabase.findOne({ _id: ObjectId(id) })
      res.send(result)
    })

    // reviews
    app.get("/review", async (req, res) => {
      const review = await reviewCollection.find({}).toArray()
      res.send(review)
    })
    // orders
    app.get("/orders/all", async (req, res) => {
      const order = await orderCollection.find({}).toArray()
      res.send(order)
    })

    // payment order
    // app.get("/order/:id", async (req, res) => {
    //   const id = req.params.id
    //   const order = await orderCollection.findOne({ _id: ObjectId(id) })
    //   res.send(order)
    // })

    // summary
    app.get("/summary", async (req, res) => {
      const summary = await summaryCollection.find({}).toArray()
      res.send(summary)
    })

    // order collection post
    app.post("/order", async (req, res) => {
      const order = req.body
      order["paid"] = false
      const result = await orderCollection.insertOne(order)
      res.send(result)
    })

    // add review post
    app.post("/review", async (req, res) => {
      const reviewAdd = req.body
      const result = await reviewCollection.insertOne(reviewAdd)
      res.send(result)
    })

    // profile post
    app.post("/profile", async (req, res) => {
      const profile = req.body
      const result = await profileCollection.insertOne(profile)
      res.send(result)
    })

    // user edit
    app.put("/profile", verifyUser, async (req, res) => {
      const email = req.query
      const data = req.body
      const option = { upsert: true }
      const updatedDoc = {
        $set: data,
      }
      const result = await profileCollection.updateOne(
        email,
        updatedDoc,
        option
      )
      res.send(result)
    })

    // get profile info
    app.get("/profile", verifyUser, async (req, res) => {
      const email = req.query
      const result = await profileCollection.findOne(email)
      res.send(result)
    })
    // order delete
    app.delete("/order", verifyUser, async (req, res) => {
      const id = req.query.id
      const query = { _id: ObjectId(id) }

      const result = await reviewCollection.deleteOne(query)
      res.send(result)
    })

    // payment
  } finally {
  }
}

run().catch(console.dir)

app.get("/", (req, res) => {
  res.send("hello world")
})

app.listen(port, () => console.log("listening to port", port))
