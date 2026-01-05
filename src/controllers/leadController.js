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
        const settings = await service.getSettings()
        const sessionData = await fetchSession(verificationSessionId, settings)
        const imageUrls = await fileDownloader(sessionData)        
        const rowData = await createLead(sessionData, imageUrls, settings)
        const landingPageUrlRow = settings.rows.find(row => row.key === "landing_page_url_live")
        const landingPageUrl = landingPageUrlRow.value.endsWith('/') ? landingPageUrlRow.value.slice(0, -1) : landingPageUrlRow.value;
        const finalLP = process.env.NODE_ENV === 'production' ? landingPageUrl : process.env.LOCAL_FRONTEND_URL;
        res.redirect(`${finalLP}/verify/next?trackingId=${rowData.$id}`);        
    },
    ssnCallback: async (req, res) => {
        try {
            const { ssn, trackingId } = req.body;
            await service.updateLead({ssn}, trackingId);
            return res.json({ success: true, message: 'Lead updated successfully' });
        } catch (error) {
            console.error("Error updating lead:", error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update lead'
            });
        }
    },
    sessionCreate: async (req, res) => {
        const { userId } = req.params;
        try {
            const settings = await service.getSettings()
            const cdnPathRow = settings.rows.find(row => row.key === "cdn_path")
            const cdnHost = cdnPathRow.value.endsWith('/') ? cdnPathRow.value.slice(0, -1) : cdnPathRow.value;
            const finalCDNHost = process.env.NODE_ENV === 'production' ? cdnHost : process.env.LOCAL_CDN_HOST;
            const diditApiRow = settings.rows.find(row => row.key === "didit_api")
            const DIDIT_API = diditApiRow ? diditApiRow.value : null;
            const diditWorkflowIdRow = settings.rows.find(row => row.key === "didit_workflow_id");
            const didit_workflow_id = diditWorkflowIdRow ? diditWorkflowIdRow.value : null;

            try {
                const options = {
                    method: 'POST',
                    headers: {
                        accept: 'application/json',
                        'content-type': 'application/json',
                        'x-api-key': DIDIT_API
                    },
                    body: JSON.stringify({
                        vendor_data: userId,
                        workflow_id: didit_workflow_id,
                        callback: finalCDNHost + '/verification/callback'
                    })
                };

                fetch('https://verification.didit.me/v2/session/', options)
                .then(response => response.json())
                .then(response => {
                    const withSSNCallback = response
                    withSSNCallback.ssnCallback = finalCDNHost + '/verification/ssn'
                    res.json({session: withSSNCallback})
                })
                .catch((error) => console.error('Error fetching session data:', error));
            } catch (error) {
                console.error('Error in sessionCreate:', error);
            }

        } catch (error) {
            console.error('Error in sessionCreate try block:', error);
        }

        
    },
}

const fetchSession = async (verificationSessionId, settings) => {
    if (!verificationSessionId) return null;
    try {
        const diditApiRow = settings.rows.find(row => row.key === "didit_api")
        const DIDIT_API = diditApiRow ? diditApiRow.value : null;

        if (!DIDIT_API) {
            throw new Error('DIDIT_API key not found in settings');
        }
        const options = {
            method: 'GET',
            headers: {
                accept: 'application/json',
                'x-api-key': DIDIT_API
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
    const { id_verification, liveness, face_match } = sessionData
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

    if(liveness){
        const { video_url } = liveness
        if(video_url){
            imageUrls.push({
                "url": video_url,
                "face": "video"
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

                const slug = data.face === 'video' 
                    ? `${verificationSessionId}.webm` 
                    : `${verificationSessionId}-${index}.jpg`
                const filePath = path.join(uploadDir, slug)
                await fs.promises.writeFile(filePath, Buffer.from(buffer))
                return {
                    "url": slug,
                    "face": data.face
                }
            } catch (error) {
                console.log("Error downloading image", error);
                return null;
            }
            });

        const results = await Promise.all(downloadPromises);
        return results.filter(result => result !== null);
    } catch (error) {
        console.log("Error downloading images", error);
        throw error;
    }
}

const createLead = async (sessionData, imageUrls, settings) => {
    // get appwrite settings
    const cdnPathRow = settings.rows.find(row => row.key === "cdn_path")
    const assetsCDN = cdnPathRow.value.endsWith('/') ? cdnPathRow.value + 'cdn/' : cdnPathRow.value + '/cdn/';
    // update appwrite
    const { 
        session_id,
        status,
        vendor_data = "",
        id_verification = {},
        ip_analysis = {}
    } = sessionData

    
    const {
        document_type = "",
        expiration_date = "",
        full_name = "",
        date_of_birth = "",
        gender = "",
        address = "",
        issuing_state_name = ""
    } = id_verification

    const { ip_address = "" } = ip_analysis;
    try {
        const data = {
            id_type: document_type,
            full_name: full_name,
            address,
            session_id,
            status,
            gender,
            ref_by: vendor_data,
            expiry_date: expiration_date,
            dob: date_of_birth,
            ip_address,
            country: issuing_state_name,
            assets_path: assetsCDN
        }
        imageUrls.forEach((image) => {
            data[`${image.face}_uri`] = image?.url
        })
        const rowData = await service.createLead(data);
        return rowData;
    } catch (error) {
        console.log("Error updating appwrite", error);
        throw error;
    }
}

module.exports = LeadController