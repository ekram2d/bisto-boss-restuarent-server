const express = require('express')
const app = express()
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)


const port = process.env.PORT || 5000;


app.use(cors())
app.use(express.json());

const vertfyJWT = (req, res, next) => {

      const authorization = req.headers.authorization;
      if (!authorization) {
            return res.status(401).send({ error: true, message: 'unauthorized access' });
      }
      const token = authorization.split(' ')[1];
      jwt.verify(token, process.env.ACESS_TOKEN_SECRET, (err, decoded) => {

            if (err) {
                  return res.status(401).send({ error: true, message: 'unathorized access' })
            }
            req.decoded = decoded;
            next();
      })

}





const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wlwsqet.mongodb.net/?retryWrites=true&w=majority`;
//  
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
      serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
      }
});

async function run() {
      try {
            // Connect the client to the server	(optional starting in v4.7)
            //     await client.connect();
            // Send a ping to confirm a successful connection

            const menudatabase = client.db("bistroDb").collection("menu");
            const reviewsdatabase = client.db("bistroDb").collection("reviews");
            const cartdatabase = client.db("bistroDb").collection("carts");
            const usersdatabase = client.db("bistroDb").collection("users");
            const paymentdatabase = client.db("bistroDb").collection("payments");



            app.post('/jwt', (req, res) => {
                  const user = req.body;
                  const token = jwt.sign(user, process.env.ACESS_TOKEN_SECRET, { expiresIn: '1h' })
                  res.send({ token });
            })

            const verfyAdmin = async (req, res, next) => {
                  const email = req.decoded.email;
                  const query = { email: email }
                  const user = await usersdatabase.findOne(query);
                  if (user?.role != 'admin') {
                        return res.status(403).send({ error: true, message: 'forbidden message' });
                  }
                  next();
            }

            // users related apis
            app.get('/users', vertfyJWT, verfyAdmin, async (req, res) => {
                  const result = await usersdatabase.find().toArray();
                  res.send(result);
            })
            app.post('/users', async (req, res) => {


                  const user = req.body;
                  const query = { email: user.email }
                  const existingUser = await usersdatabase.findOne(query);
                  console.log('existing user ', existingUser);
                  if (existingUser) {
                        return res.send({ message: 'user already exists' })
                  }
                  const result = await usersdatabase.insertOne(user);
                  res.send(result);
            })


            // app.get('/users/admin/:email', vertfyJWT, async (req, res) => {
            //       if (req.decoded.email != email) {
            //             res.send({ admin: false })
            //       }
            //       const email = req.params.email;
            //       const query = { email: email }
            //       const user = await usersdatabase.findOne(query);
            //       const result = { admin: user?.role == 'admin' }
            //       res.send(result);
            // })

            app.get('/users/admin/:email', vertfyJWT, async (req, res) => {
                  const email = req.params.email;

                  if (req.decoded.email != email) {
                        res.send({ admin: false })
                  }

                  const query = { email: email };
                  const user = await usersdatabase.findOne(query);
                  const result = { admin: user?.role == 'admin' }
                  res.send(result);
            })

            app.patch('/users/admin/:id', async (req, res) => {

                  const id = req.params.id;
                  const filter = { _id: new ObjectId(id) };
                  const updateDoc = {
                        $set: {
                              role: 'admin'
                        },
                  };
                  const result = await usersdatabase.updateOne(filter, updateDoc);
                  res.send(result);
            })

            app.get('/menu', async (req, res) => {
                  const result = await menudatabase.find().toArray();
                  res.send(result);
            })

            app.post('/menu', vertfyJWT, verfyAdmin, async (req, res) => {
                  const newItem = req.body;

                  const result = await menudatabase.insertOne(newItem);
                  // console.log('ne',result.insertedId)
                  res.send(result);

            })


            app.delete('/menu/:id', vertfyJWT, verfyAdmin, async (req, res) => {

                  const id = req.params.id
                  const query = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
                  // console.log(id)
                  const result = await menudatabase.deleteOne(query);
                  // console.log(result);
                  res.send(result)

            })


            app.get('/reviews', async (req, res) => {
                  const result = await reviewsdatabase.find().toArray();
                  res.send(result);
            })


            // cart operation 
            app.get('/carts', vertfyJWT, async (req, res) => {
                  const email = req.query.email;
                  if (!email) {
                        res.send([])
                  }

                  const decodedemail = req.decoded.email;
                  if (email != decodedemail) {

                        return res.status(403).send({ error: true, message: "providden access" })
                  }
                  const query = { email: email };
                  const result = await cartdatabase.find(query).toArray();
                  res.send(result)


            })
            app.post('/carts', async (req, res) => {
                  const item = req.body;
                  // console.log(item);
                  const result = await cartdatabase.insertOne(item);
                  res.send(result);
            })


            app.delete('/carts/:id', async (req, res) => {


                  const id = req.params.id
                  const query = { _id: new ObjectId(id) };
                  // console.log(query)
                  const result = await cartdatabase.deleteOne(query);
                  res.send(result)

            })

            // create payment intent
            app.post('/create-payment-intent', vertfyJWT, async (req, res) => {

                  const { price } = req.body;
                  const amount = price * 100;
                  // console.log(price,amount);
                  const paymentIntent = await stripe.paymentIntents.create({
                        amount: amount,
                        currency: 'usd',
                        payment_method_types: ['card']
                  });
                  res.send({

                        clientSecret: paymentIntent.client_secret
                  })
            })


            app.post('/payments', async (req, res) => {

                  const payment = req.body;
                  const insertresult = await paymentdatabase.insertOne(payment);
                  const query = { _id: { $in: payment.cartitems.map(id => new ObjectId(id)) } }
                  // console.log(payment);
                  const deleteRessult = await cartdatabase.deleteMany(query);

                  res.send({ insertresult, deleteRessult });
            })

            app.get('/admin-status', vertfyJWT, verfyAdmin, async (req, res) => {
                  const users = await usersdatabase.estimatedDocumentCount();
                  const products = await menudatabase.estimatedDocumentCount();
                  const orders = await paymentdatabase.estimatedDocumentCount();
                  const payments = await paymentdatabase.find().toArray();
                  const revenue = payments.reduce((sum, payment) => sum + payment.price, 0)
                  res.send({
                        revenue,
                        users,
                        products,
                        orders
                  })
            })


            // app.get('/order-stats', async(req, res) =>{
            //       const pipeline = [
            //         {
            //           $lookup: {
            //             from: 'menu',
            //             localField: 'menuItems',
            //             foreignField: '_id',
            //             as: 'menuItemsData'
            //           }
            //         },
            //         {
            //           $unwind: '$menuItemsData'
            //         },
            //         {
            //           $group: {
            //             _id: '$menuItemsData.category',
            //             count: { $sum: 1 },
            //             total: { $sum: '$menuItemsData.price' }
            //           }
            //         },
            //         {
            //           $project: {
            //             category: '$_id',
            //             count: 1,
            //             total: { $round: ['$total', 2] },
            //             _id: 0
            //           }
            //         }
            //       ];
            
            //       const result = await paymentdatabase.aggregate(pipeline).toArray()
            //       res.send(result)
            
            //     })


            await client.db("admin").command({ ping: 1 });
            console.log("Pinged your deployment. You successfully connected to MongoDB!");
      } finally {
            // Ensures that the client will close when you finish/error
            //     await client.close();
      }
}
run().catch(console.dir);

app.get('/', (req, res) => {
      res.send('Boss is siting')
})

app.listen(port, () => {
      console.log(`bistro boss is sitting  on port ${port}`)
})