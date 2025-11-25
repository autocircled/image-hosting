// server.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');
// const path = require('path');

const app = express();

// Enable CORS for all routes
app.use(cors());

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExt = file.originalname.split('.').pop();
        cb(null, file.fieldname + '-' + uniqueSuffix + '.' + fileExt);
    }
});

const upload = multer({ storage: storage });

app.post('/upload', upload.single('image'), (req, res) => {
    console.log("request are coming...", req.file);
    try{
        res.json({
            message: 'Image uploaded successfully',
            filename: req.file.filename,
            originalname: req.file.originalname
        });
    } catch(error){
        console.log("Failed to upload image");
    }
});

app.get('/', (req, res) => {
    res.status(200).send('Server is running');
});

app.listen(3000, () => console.log('Server running on port 3000'));