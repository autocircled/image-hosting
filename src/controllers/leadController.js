const fs = require('fs')
const path = require('path')
const APIService = require('../appwrite/config')
const service = new APIService()

const LeadController = {
    getFile: async (req, res) => {
        const filename = req.params.filename
        const filePath = path.join(__dirname, '../../uploads', filename)

        // Add CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET')

        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                // File doesn't exist
                res.status(404).json({
                    success: false,
                    message: 'File not found'
                })
                return
            }
            // Set proper Content-Type based on file extension
            const ext = path.extname(filename).toLowerCase()
            const mimeTypes = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml'
            }
            
            const contentType = mimeTypes[ext] || 'application/octet-stream'
            res.setHeader('Content-Type', contentType)
            
            res.sendFile(filePath)
        })
    },

    handleCallback: async (req, res) => {
        const { verificationSessionId } = req.query;
        const sessionData = await fetchSession(verificationSessionId)
        const imageUrls = await fileDownloader(sessionData)
            
        await createLead(sessionData, imageUrls)

        res.redirect(`${process.env.FRONTEND_URL}/thank-you`);

        // res.json({
        //     imageUrls,
        //     sessionData
        // })
    },
    sessionCreate: (req, res) => {
        const { userId } = req.params;
        try {
            const options = {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    'content-type': 'application/json',
                    'x-api-key': process.env.DIDIT_API_KEY
                },
                body: JSON.stringify({
                    vendor_data: userId,
                    workflow_id: process.env.DIDIT_WORKFLOW_ID,
                    callback: process.env.DIDIT_CALLBACK_URL
                })
            };

            fetch('https://verification.didit.me/v2/session/', options)
            .then(response => response.json())
            .then(response => res.json({session: response}))
            .catch((error) => console.error('Error fetching session data:', error));
        } catch (error) {
            console.error('Error in sessionCreate:', error);
        }
    },
}

const fetchSession = async (verificationSessionId) => {
    if (!verificationSessionId) return null;
    try {
        const options = {
            method: 'GET',
            headers: {
                accept: 'application/json',
                'x-api-key': process.env.DIDIT_API_KEY
            }
        };

        return fetch(`https://verification.didit.me/v2/session/${verificationSessionId}/decision/`, options)
            .then(response => response.json())
            .then(response => response)
            .catch(err => console.error(err));

    } catch (error) {
        console.error('Error in sessionCreate:', error);
        return null;
    }
}

const fileDownloader = async (sessionData) => {
    const verificationSessionId = sessionData.session_id
    const imageUrls = []
    const { id_verification, face_match } = sessionData
    if(id_verification){
        const { full_front_image, full_back_image } = id_verification
        if(full_front_image){
            imageUrls.push({
                "url": full_front_image,
                "face": "front"
            })
        }
        if(full_back_image){
            imageUrls.push({
                "url": full_back_image,
                "face": "back"
            })
        }
    }

    if(face_match){
        const { target_image } = face_match
        if(target_image){
            imageUrls.push({
                "url": target_image,
                "face": "selfie"
            })
        }
    }
    try {
        const uploadDir = 'uploads';
        await fs.promises.mkdir(uploadDir, { recursive: true });

            const downloadPromises = imageUrls.map(async (data, index) => {
            try {
                const response = await fetch(data.url)
                // console.log("response", response)
                const buffer = await response.arrayBuffer()
                const slug = `${verificationSessionId}-${index}.jpg`
                const filePath = path.join(uploadDir, slug)
                await fs.promises.writeFile(filePath, Buffer.from(buffer))
                return {
                    "url": slug,
                    "face": data.face
                }
            } catch (error) {
                console.log("Error downloading image", error)
            }
            });

        const rerults = await Promise.all(downloadPromises);
        return rerults
    } catch (error) {
        console.log("Error downloading images", error)
    }
}

const createLead = async (sessionData, imageUrls) => {
    // get appwrite settings
    const settings = await service.getSettings()
    const cdnPathRow = settings.rows.find(row => row.key === "cdn_path")
    const assetsCDN = cdnPathRow.value.endsWith('/') ? cdnPathRow.value : cdnPathRow.value + '/';

    // update appwrite
    const { session_id, status, vendor_data = "", id_verification = {}} = sessionData
    const {document_type = "", expiration_date = "", full_name = "", gender = "", address = ""} = id_verification
    try {
        const data = {
            session_id,
            status,
            gender,
            address,
            ref_by: vendor_data,
            id_type: document_type,
            expiry_date: expiration_date,
            full_name: full_name,
            assets_path: assetsCDN
        }
        imageUrls.forEach((image) => {
            data[`${image.face}_uri`] = image?.url
        })
        const response = await service.createLead(data)
    } catch (error) {
        console.log("Error updating appwrite", error)
    }
}

module.exports = LeadController

module.exports = LeadController