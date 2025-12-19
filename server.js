// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
// Enable CORS for all routes
app.use(cors());


app.get('/', (req, res) => {
    res.status(200).send('Server is running');
});
const router = require('./src/routes/api');
app.use("/", router);

app.listen(3000, () => console.log('Server running on port 3000'));