const router = require("express").Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

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
        const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

router.post('/upload', upload.single('image'), async (req, res) => {
    console.log("Request received...", req.file);
    console.log("Lead ID in request:", req.body.leadId);

    try{
        const leadId = req.body.leadId || 'default-user';
        const timestamp = Date.now();
        const imageType = req.body.imageType;
        const face = imageType.includes('front') ? 'front' : imageType.includes('back') ? 'back' : imageType;
        const oldPath = req.file.path;
        const fileExt = req.file.originalname.split('.').pop().toLowerCase();
        const newFilename = `${leadId}-${timestamp}-${imageType}.${fileExt}`;
        const newPath = `uploads/${newFilename}`;
        await fs.promises.rename(oldPath, newPath);
        const formData = new FormData();
        formData.append('front_image', fs.createReadStream(newPath));
        const verificationUrl = process.env.DIDIT_API_URL;
        console.log(verificationUrl)
        try {
            
            return res.json({
                status: 'success',
                message: 'Image uploaded successfully',
                leadId: leadId,
                filename: newFilename,
                face: face,
                verification: "coming soon"
            });
        } catch (err) {
            console.log("Failed to validate", err);
            return res.json({
                status: 'failed',
                message: 'Image couldn\'t uploaded successfully',
            })
        }
    } catch(error){
        console.log("Failed to upload image", error);
        return res.json({
            status: 'failed',
            message: 'Failed to upload image',
        })
    }
});


router.get('/cdn/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../../uploads', filename);

    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            // File doesn't exist
            res.status(404).json({
                success: false,
                message: 'File not found'
            });
            return;
        }
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
});

module.exports = router;