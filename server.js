// server.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

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
    console.log("lead id is in request", req.body.leadId);
    const api_url = req.body.api_url;
    try{
        const leadId = req.body.leadId || 'default-user';
        const timestamp = Date.now();
        const imageType = req.body.imageType;
        const face = imageType.includes('front') ? 'front' : imageType.includes('back') ? 'back' : imageType;
        const oldPath = req.file.path;
        const fileExt = req.file.originalname.split('.').pop().toLowerCase();
        const newFilename = `${leadId}-${timestamp}-${imageType}.${fileExt}`;
        const newPath = `uploads/${newFilename}`;
        fs.rename(oldPath, newPath, (err) => {
            if (err) {
                console.error("Error renaming file:", err);
                return res.status(500).json({ error: 'File processing failed' });
            }
            
            res.json({
                status: 'success',
                message: 'Image uploaded successfully',
                leadId: leadId,
                filename: newFilename,
                face: face,
                api_url: api_url
            });
        });
    } catch(error){
        console.log("Failed to upload image", error);
    }
});

app.get('/cdn/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'uploads', filename);

    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // Set proper Content-Type based on file extension
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    
    res.sendFile(filePath);
});

app.get('/', (req, res) => {
    res.status(200).send('Server is running');
});

app.listen(3000, () => console.log('Server running on port 3000'));