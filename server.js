// server.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
// const path = require('path');

const app = express();

// Enable CORS for all routes
app.use(cors());

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExt = file.originalname.split('.').pop();
        cb(null, uniqueSuffix + '.' + fileExt);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.includes('image/png')) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

app.post('/upload', upload.single('image'), (req, res) => {
    console.log("request are coming...", req.file);
    console.log("user id is in request", req.body.userId);
    try{
        const userId = req.body.userId || 'default-user';
        const timestamp = req.body.timestamp || Date.now();
        const imageType = req.body.imageType;
        const oldPath = req.file.path;
        const fileExt = req.file.originalname.split('.').pop().toLowerCase();
        const newFilename = `${userId}-${timestamp}-${imageType}.${fileExt}`;
        const newPath = `uploads/${newFilename}`;
        fs.rename(oldPath, newPath, (err) => {
            if (err) {
                console.error("Error renaming file:", err);
                return res.status(500).json({ error: 'File processing failed' });
            }
            
            res.json({
                message: 'Image uploaded successfully',
                filename: newFilename,
                originalname: req.file.originalname,
                timestamp: timestamp
            });
        });
        // res.json({
        //     message: 'Image uploaded successfully',
        //     filename: req.file.filename,
        //     originalname: req.file.originalname
        // });
    } catch(error){
        console.log("Failed to upload image", error);
    }
});

app.get('/', (req, res) => {
    res.status(200).send('Server is running');
});

app.listen(3000, () => console.log('Server running on port 3000'));