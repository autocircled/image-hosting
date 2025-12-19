const router = require("express").Router();
const multer = require('multer');
const LeadController = require("../controllers/leadController");

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

router.post('/upload', upload.single('image'), LeadController.upload);
router.get('/cdn/:filename', LeadController.getFile);
router.post('/lead/create', LeadController.init);

module.exports = router;