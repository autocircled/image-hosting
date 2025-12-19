const fs = require('fs');
const path = require('path');
const { extractTextFromImage } = require("../utils/helper");
const conf = require('../conf/conf');
const Service = require('../appwrite/config');
const service = new Service();

const LeadController = {
    init: async(req, res) => {
        try {
            const ref_by = req.body.ref_by;
            const id_type = req.body.id_type;
            const result = await service.createLead({
                ref_by: ref_by,
                id_type: id_type,
                assets_path: conf.assetsCDN
            })

            return res.json({
                status: 'success',
                message: 'Lead created successfully',
                data: result,
            })
            
        } catch (error) {
            console.log("Failed to init", error);
            return res.json({
                status: 'failed',
                message: 'Failed to init',
            })
        }
        
    },
    getFile: async (req, res) => {
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
    },
    upload: async (req, res) => {
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
            
            try {
                const result = await extractTextFromImage(newPath);

                if(result.primaryType !== 'UNKNOWN'){
                    return res.json({
                        status: 'success',
                        message: 'Image uploaded successfully',
                        leadId: leadId,
                        filename: newFilename,
                        face: face,
                        doc_type: result
                    });
                }else{
                    return res.json({
                        status: 'failed',
                        error: 'Image seems not valid',
                        leadId: leadId,
                        filename: newFilename,
                        face: face,
                        doc_type: result
                    });
                }
                
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
    },
}

module.exports = LeadController;