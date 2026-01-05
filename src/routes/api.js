const router = require("express").Router();
const LeadController = require("../controllers/leadController");


router.get('/cdn/:filename', LeadController.getFile);

router.get('/verification/callback', LeadController.handleCallback);
router.post('/verification/ssn', LeadController.ssnCallback);
router.get('/session/create/:userId', LeadController.sessionCreate);

module.exports = router;