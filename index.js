const express = require("express")
const cors = require("cors")
const jwt = require("jsonwebtoken")
require("dotenv").config()
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)

const app = express()
const port = process.env.PORT || 5000

const { query } = require("express")

app.use(cors())
app.use(express.json())

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb")
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

    // usercollection
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
      const alreadyUser = await userCollection.findOne({ email: email })
      if (alreadyUser) return
      await userCollection.insertOne({ email: email, role: "user" })
    })

    // Purchase parts
    app.get("/parts", async (req, res) => {
      const parts = await alyonaDatabase.find({}).toArray()
      res.send(parts)
    })

    // Add new Parts
    app.post("/parts", verifyUser, verifyAdmin, async (req, res) => {
      const part = req.body
      console.log(part)
      const result = await alyonaDatabase.insertOne(part)
      res.send(result)
    })

    // Product Delete
    app.delete("/part/delete", verifyUser, verifyAdmin, async (req, res) => {
      const id = req.query.id
      const query = { _id: ObjectId(id) }
      const result = await alyonaDatabase.deleteOne(query)
      res.send(result)
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
    app.get("/orders/all", verifyUser, verifyAdmin, async (req, res) => {
      const order = await orderCollection.find({}).toArray()
      res.send(order)
    })

    // payment order
    app.get("/order/:id", verifyUser, async (req, res) => {
      const id = req.params.id
      const order = await orderCollection.findOne({ _id: ObjectId(id) })
      res.send(order)
    })

    // My order api
    app.get("/myorder", verifyUser, async (req, res) => {
      const email = req.query
      // console.log(email)
      const result = await orderCollection.find(email).toArray()
      res.send(result)
    })

    // summary
    app.get("/summary", async (req, res) => {
      const summary = await summaryCollection.find({}).toArray()
      res.send(summary)
    })

    // order collection post
    app.post("/order", verifyUser, async (req, res) => {
      const order = req.body
      order["paid"] = false
      order["shipped"] = false
      const result = await orderCollection.insertOne(order)
      res.send(result)
    })

    //Order patch
    app.patch("/order/:id", verifyUser, async (req, res) => {
      const id = req.params.id
      const payment = req.body
      const updatedDoc = {
        $set: payment,
      }
      const result = await orderCollection.updateOne(
        { _id: ObjectId(id) },
        updatedDoc
      )
      res.send(result)
    })

    // order shipment
    app.patch(
      "/order/confirm/:id",
      verifyUser,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id
        const shipmentInfo = req.body
        const part = await alyonaDatabase.findOne({
          _id: ObjectId(shipmentInfo.productid),
        })

        // reduce quantity of parts
        const newQuantity = part.availableQuantity - shipmentInfo.addquantity

        const updatedDoc = {
          $set: {
            availableQuantity: newQuantity,
          },
        }

        // update shipment info of ordwer
        await alyonaDatabase.updateOne(
          {
            _id: ObjectId(shipmentInfo.productid),
          },
          updatedDoc
        )

        const updatedDoc2 = {
          $set: { shipped: true },
        }
        const result = await orderCollection.updateOne(
          { _id: ObjectId(id) },
          updatedDoc2
        )
        res.send(result)
      }
    )

    // add review post
    app.post("/review", verifyUser, async (req, res) => {
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
    app.put("/profile", async (req, res) => {
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
      const result = await orderCollection.deleteOne(query)
      res.send(result)
    })

    // admin panel
    app.patch("/user/:email", verifyUser, verifyAdmin, async (req, res) => {
      const email = req.params
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      }
      const result = await userCollection.updateOne(email, updatedDoc)
      console.log(email)
      res.send(result)
    })

    // admin panel only
    app.get("/user", verifyUser, verifyAdmin, async (req, res) => {
      const result = await userCollection.find({}).toArray()
      res.send(result)
    })

    // get user
    app.get("/user/single", verifyUser, async (req, res) => {
      const email = req.query
      const result = await userCollection.findOne(email)
      res.send(result)
    })

    // verify admin
    async function verifyAdmin(req, res, next) {
      const email = req.decoded.email
      const user = await userCollection.findOne({ email: email })
      if (user?.role === "admin") next()
      else res.status(403).send({ message: "forbidden access" })
    }

    // payment
    app.post("/create-payment-intent", verifyUser, async (req, res) => {
      const part = req.body
      const price = part.totalPrice
      const amount = price * 100

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      })
      res.send({ clientSecret: paymentIntent.client_secret })
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
