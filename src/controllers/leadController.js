const fs = require('fs')
const path = require('path')
const { extractTextFromImage } = require("../utils/helper")
const conf = require('../conf/conf')
const APIService = require('../appwrite/config')
const service = new APIService()

const LeadController = {
    init: async(req, res) => {
        try {
            const ref_by = req.body.ref_by
            const id_type = req.body.id_type
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
            console.log("Failed to init", error)
            return res.json({
                status: 'failed',
                message: 'Failed to init',
            })
        }
        
    },
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
    upload: async (req, res) => {
        console.log("Request received...", req.file)
        console.log("Lead ID in request:", req.body.leadId)

        try{
            const leadId = req.body.leadId || 'default-user'
            const timestamp = Date.now()
            const imageType = req.body.imageType
            const face = imageType.includes('front') ? 'front' : imageType.includes('back') ? 'back' : imageType
            const oldPath = req.file.path
            const fileExt = req.file.originalname.split('.').pop().toLowerCase()
            const newFilename = `${leadId}-${timestamp}-${imageType}.${fileExt}`
            const newPath = `uploads/${newFilename}`
            await fs.promises.rename(oldPath, newPath)
            
            if (face === 'selfie'){
                try {
                    await service.updateLead({
                        [face + '_uri']: newFilename
                    }, leadId)
                    return res.json({
                        status: 'success',
                        message: 'Image uploaded successfully',
                        leadId: leadId,
                        filename: newFilename,
                        face: face
                    })
                } catch (error) {
                    console.log("Error updating lead", error)
                }
            }else{ // face is fron and back
                try {
                    const result = await extractTextFromImage(newPath)
    
                    if(result.primaryType !== 'UNKNOWN'){
    
                        // update appwrite
                        try {
                            const updateRes = await service.updateLead({
                                [face + '_uri']: newFilename
                            }, leadId)
                            console.log("updateRes", updateRes)
                        } catch (error) {
                            console.log("Error updating lead", error)
                        }
    
                        return res.json({
                            status: 'success',
                            message: 'Image uploaded successfully',
                            leadId: leadId,
                            filename: newFilename,
                            face: face,
                            doc_type: result
                        })
                    }else{
                        // Clean up processed file using promises
                        try {
                            await fs.promises.unlink(newPath)
                        } catch (unlinkError) {
                            console.error('Error deleting processed file:', unlinkError)
                            // Continue even if deletion fails
                        }
    
                        return res.json({
                            status: 'failed',
                            error: 'Image seems not valid',
                            leadId: leadId,
                            filename: newFilename,
                            face: face,
                            doc_type: result
                        })
                    }
                    
                } catch (err) {
                    console.log("Failed to validate", err)
                    return res.json({
                        status: 'failed',
                        message: 'Image couldn\'t uploaded successfully',
                    })
                }
            }
        } catch(error){
            console.log("Failed to upload image", error)
            return res.json({
                status: 'failed',
                message: 'Failed to upload image',
            })
        }
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
    handleCallback1: (req, res) => {
        // Handle verification callback here
        console.log('Verification callback received:', req.query);
        return res.json({
            "session_id": "20557068-58c5-4a8f-8522-b9454dc9fa10",
            "session_number": 332,
            "session_url": "https://verify.didit.me/session/tm_QCBhLG6zo",
            "status": "Approved",
            "workflow_id": "d3f8c9b8-f85b-4d86-9aea-6e2588bb6fc1",
            "features": [
                "ID_VERIFICATION",
                "LIVENESS",
                "FACE_MATCH",
                "IP_ANALYSIS"
            ],
            "vendor_data": "692e6287001b6ed36c8b",
            "metadata": null,
            "callback": "https://image.dertypu.shop/verification/callback",
            "id_verification": {
                "status": "Approved",
                "document_type": "Identity Card",
                "document_number": "3254542032",
                "personal_number": null,
                "portrait_image": "https://service-didit-verification-production-a1c5f9b8.s3.amazonaws.com/ocr/20557068-58c5-4a8f-8522-b9454dc9fa10-portrait_image-f3fbe766-4bba-467b-906b-26c163519dab.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIAUH6QTJHN3TZ2X3Q4%2F20251230%2Feu-west-1%2Fs3%2Faws4_request&X-Amz-Date=20251230T181717Z&X-Amz-Expires=14400&X-Amz-SignedHeaders=host&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEPL%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCWV1LXdlc3QtMSJIMEYCIQC1R1e2udTxp4yX2NHzvvmiKvars1ipCmI3Ym2GYgJccgIhAOTyUM5qqjE5gJMzSwaq1ly3fIc30Le3FXnAIGpMvK6zKuoDCLv%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQABoMMjkxOTU4Mzc2OTIzIgz1wmArwAothiMW454qvgOOcuxv3%2FW0od5Dq7yRM%2BloeB%2FcA1ZxX5Bs7oWCYXlSmKC6DamepOsJJnOi7cIRuK0LUwTVLJd5eLTe%2BK41uRNPLz9mgNjkRF6alSUAAB4%2BsUtHdKsFkh5M9npFdiJHqcEjtBgesO081pOZcxPj8dv2iUY%2BVefgD4oRPfpICck8sqbbw9DPJZJrqW%2B10pQ9M9iK6vFYFF1QZc0htv3Tw%2BSCl2AJDU%2BuuAQjZnHmcjUAGaFWGBo6zuR4TBjDresn59AlXN7XpHMp1CSLSoPTvXj%2FrqvTXSrWE0MMf3zEDzlhRYPSrMbE2YS4%2F%2B6LSacvlaSgx%2BHwZZ%2FU8btRiGNvBU%2Bt3Ii2tkbO6daE%2BU8hai5abKxUUXxRxI6N3cRoEBOaA%2FLt2QKTvWCPKLQyePBAEsLvuyQXXjxyPgnWWg1S21rIu5skJmUP8PuUk%2BOzTk%2FvlqOHRC8yHosDDlUL8zVIttvYjRk7Vo%2B6%2FXuZAeH%2FTGilWHnZEK7SfzwQMDDgTh1acVZZcA5joXSe4GjsmvXIoAnJj3XwvmY2Z3CGKPZ1TjlkByaTxy0lMYZ7ToSCPKxYCu0E9rXUQk5ohLsRl8ToazDopNDKBjqkAXRbeOEYxHX3ONcsPgjAatcY%2BvoPgHYX0TFwI44O6M5Fp7qPvTyVtFK6fnYAJr0OYjt7d%2BhdMNnm4A4xqmcAjzkIVOWhdGgr2GeoI6LFqvjdCG8b8LkdPhKyTzTLLsZoKVV6SXpxlL2EMFl20YePXmG3iUY3aJMBF1cGJJNoVdqHCEREWxlrTGbJGC%2BRS6lm7S%2FmQrXBSOywmZOL4PCoSvyXau7b&X-Amz-Signature=b25faca3bfce0ee470ada16d24fc1cecf99838d76ec257f5d84db72b3ec2f0d7",
                "front_image": "https://service-didit-verification-production-a1c5f9b8.s3.amazonaws.com/ocr/20557068-58c5-4a8f-8522-b9454dc9fa10-front_image-c88d55b8-4dc2-48ca-82ff-3963f793e50a.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIAUH6QTJHN3TZ2X3Q4%2F20251230%2Feu-west-1%2Fs3%2Faws4_request&X-Amz-Date=20251230T181717Z&X-Amz-Expires=14400&X-Amz-SignedHeaders=host&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEPL%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCWV1LXdlc3QtMSJIMEYCIQC1R1e2udTxp4yX2NHzvvmiKvars1ipCmI3Ym2GYgJccgIhAOTyUM5qqjE5gJMzSwaq1ly3fIc30Le3FXnAIGpMvK6zKuoDCLv%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQABoMMjkxOTU4Mzc2OTIzIgz1wmArwAothiMW454qvgOOcuxv3%2FW0od5Dq7yRM%2BloeB%2FcA1ZxX5Bs7oWCYXlSmKC6DamepOsJJnOi7cIRuK0LUwTVLJd5eLTe%2BK41uRNPLz9mgNjkRF6alSUAAB4%2BsUtHdKsFkh5M9npFdiJHqcEjtBgesO081pOZcxPj8dv2iUY%2BVefgD4oRPfpICck8sqbbw9DPJZJrqW%2B10pQ9M9iK6vFYFF1QZc0htv3Tw%2BSCl2AJDU%2BuuAQjZnHmcjUAGaFWGBo6zuR4TBjDresn59AlXN7XpHMp1CSLSoPTvXj%2FrqvTXSrWE0MMf3zEDzlhRYPSrMbE2YS4%2F%2B6LSacvlaSgx%2BHwZZ%2FU8btRiGNvBU%2Bt3Ii2tkbO6daE%2BU8hai5abKxUUXxRxI6N3cRoEBOaA%2FLt2QKTvWCPKLQyePBAEsLvuyQXXjxyPgnWWg1S21rIu5skJmUP8PuUk%2BOzTk%2FvlqOHRC8yHosDDlUL8zVIttvYjRk7Vo%2B6%2FXuZAeH%2FTGilWHnZEK7SfzwQMDDgTh1acVZZcA5joXSe4GjsmvXIoAnJj3XwvmY2Z3CGKPZ1TjlkByaTxy0lMYZ7ToSCPKxYCu0E9rXUQk5ohLsRl8ToazDopNDKBjqkAXRbeOEYxHX3ONcsPgjAatcY%2BvoPgHYX0TFwI44O6M5Fp7qPvTyVtFK6fnYAJr0OYjt7d%2BhdMNnm4A4xqmcAjzkIVOWhdGgr2GeoI6LFqvjdCG8b8LkdPhKyTzTLLsZoKVV6SXpxlL2EMFl20YePXmG3iUY3aJMBF1cGJJNoVdqHCEREWxlrTGbJGC%2BRS6lm7S%2FmQrXBSOywmZOL4PCoSvyXau7b&X-Amz-Signature=66eb798c76c7a2ea6608669af961781572f8c07ca8d17346d1a7ebab4f189b70",
                "front_video": null,
                "back_image": "https://service-didit-verification-production-a1c5f9b8.s3.amazonaws.com/ocr/20557068-58c5-4a8f-8522-b9454dc9fa10-back_image-3ba83ad9-a54e-4ffd-9244-784a1379c06e.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIAUH6QTJHN3TZ2X3Q4%2F20251230%2Feu-west-1%2Fs3%2Faws4_request&X-Amz-Date=20251230T181717Z&X-Amz-Expires=14400&X-Amz-SignedHeaders=host&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEPL%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCWV1LXdlc3QtMSJIMEYCIQC1R1e2udTxp4yX2NHzvvmiKvars1ipCmI3Ym2GYgJccgIhAOTyUM5qqjE5gJMzSwaq1ly3fIc30Le3FXnAIGpMvK6zKuoDCLv%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQABoMMjkxOTU4Mzc2OTIzIgz1wmArwAothiMW454qvgOOcuxv3%2FW0od5Dq7yRM%2BloeB%2FcA1ZxX5Bs7oWCYXlSmKC6DamepOsJJnOi7cIRuK0LUwTVLJd5eLTe%2BK41uRNPLz9mgNjkRF6alSUAAB4%2BsUtHdKsFkh5M9npFdiJHqcEjtBgesO081pOZcxPj8dv2iUY%2BVefgD4oRPfpICck8sqbbw9DPJZJrqW%2B10pQ9M9iK6vFYFF1QZc0htv3Tw%2BSCl2AJDU%2BuuAQjZnHmcjUAGaFWGBo6zuR4TBjDresn59AlXN7XpHMp1CSLSoPTvXj%2FrqvTXSrWE0MMf3zEDzlhRYPSrMbE2YS4%2F%2B6LSacvlaSgx%2BHwZZ%2FU8btRiGNvBU%2Bt3Ii2tkbO6daE%2BU8hai5abKxUUXxRxI6N3cRoEBOaA%2FLt2QKTvWCPKLQyePBAEsLvuyQXXjxyPgnWWg1S21rIu5skJmUP8PuUk%2BOzTk%2FvlqOHRC8yHosDDlUL8zVIttvYjRk7Vo%2B6%2FXuZAeH%2FTGilWHnZEK7SfzwQMDDgTh1acVZZcA5joXSe4GjsmvXIoAnJj3XwvmY2Z3CGKPZ1TjlkByaTxy0lMYZ7ToSCPKxYCu0E9rXUQk5ohLsRl8ToazDopNDKBjqkAXRbeOEYxHX3ONcsPgjAatcY%2BvoPgHYX0TFwI44O6M5Fp7qPvTyVtFK6fnYAJr0OYjt7d%2BhdMNnm4A4xqmcAjzkIVOWhdGgr2GeoI6LFqvjdCG8b8LkdPhKyTzTLLsZoKVV6SXpxlL2EMFl20YePXmG3iUY3aJMBF1cGJJNoVdqHCEREWxlrTGbJGC%2BRS6lm7S%2FmQrXBSOywmZOL4PCoSvyXau7b&X-Amz-Signature=36f1c45dd1c6500f3f87d9982c147eee7342cd58d69301ce501beeac34bea555",
                "back_video": null,
                "full_front_image": "https://service-didit-verification-production-a1c5f9b8.s3.amazonaws.com/ocr/20557068-58c5-4a8f-8522-b9454dc9fa10-full_front_image-cfcad1f3-2733-42fb-87f2-0f05dc0e2e1c.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIAUH6QTJHN3TZ2X3Q4%2F20251230%2Feu-west-1%2Fs3%2Faws4_request&X-Amz-Date=20251230T181717Z&X-Amz-Expires=14400&X-Amz-SignedHeaders=host&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEPL%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCWV1LXdlc3QtMSJIMEYCIQC1R1e2udTxp4yX2NHzvvmiKvars1ipCmI3Ym2GYgJccgIhAOTyUM5qqjE5gJMzSwaq1ly3fIc30Le3FXnAIGpMvK6zKuoDCLv%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQABoMMjkxOTU4Mzc2OTIzIgz1wmArwAothiMW454qvgOOcuxv3%2FW0od5Dq7yRM%2BloeB%2FcA1ZxX5Bs7oWCYXlSmKC6DamepOsJJnOi7cIRuK0LUwTVLJd5eLTe%2BK41uRNPLz9mgNjkRF6alSUAAB4%2BsUtHdKsFkh5M9npFdiJHqcEjtBgesO081pOZcxPj8dv2iUY%2BVefgD4oRPfpICck8sqbbw9DPJZJrqW%2B10pQ9M9iK6vFYFF1QZc0htv3Tw%2BSCl2AJDU%2BuuAQjZnHmcjUAGaFWGBo6zuR4TBjDresn59AlXN7XpHMp1CSLSoPTvXj%2FrqvTXSrWE0MMf3zEDzlhRYPSrMbE2YS4%2F%2B6LSacvlaSgx%2BHwZZ%2FU8btRiGNvBU%2Bt3Ii2tkbO6daE%2BU8hai5abKxUUXxRxI6N3cRoEBOaA%2FLt2QKTvWCPKLQyePBAEsLvuyQXXjxyPgnWWg1S21rIu5skJmUP8PuUk%2BOzTk%2FvlqOHRC8yHosDDlUL8zVIttvYjRk7Vo%2B6%2FXuZAeH%2FTGilWHnZEK7SfzwQMDDgTh1acVZZcA5joXSe4GjsmvXIoAnJj3XwvmY2Z3CGKPZ1TjlkByaTxy0lMYZ7ToSCPKxYCu0E9rXUQk5ohLsRl8ToazDopNDKBjqkAXRbeOEYxHX3ONcsPgjAatcY%2BvoPgHYX0TFwI44O6M5Fp7qPvTyVtFK6fnYAJr0OYjt7d%2BhdMNnm4A4xqmcAjzkIVOWhdGgr2GeoI6LFqvjdCG8b8LkdPhKyTzTLLsZoKVV6SXpxlL2EMFl20YePXmG3iUY3aJMBF1cGJJNoVdqHCEREWxlrTGbJGC%2BRS6lm7S%2FmQrXBSOywmZOL4PCoSvyXau7b&X-Amz-Signature=1a2894cb5701cecdef5e996715fed17611d795b32109aa7787adec3ad07aec17",
                "full_back_image": "https://service-didit-verification-production-a1c5f9b8.s3.amazonaws.com/ocr/20557068-58c5-4a8f-8522-b9454dc9fa10-full_back_image-b6d6c385-2fef-4acf-9b9a-b79a612266b2.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIAUH6QTJHN3TZ2X3Q4%2F20251230%2Feu-west-1%2Fs3%2Faws4_request&X-Amz-Date=20251230T181717Z&X-Amz-Expires=14400&X-Amz-SignedHeaders=host&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEPL%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCWV1LXdlc3QtMSJIMEYCIQC1R1e2udTxp4yX2NHzvvmiKvars1ipCmI3Ym2GYgJccgIhAOTyUM5qqjE5gJMzSwaq1ly3fIc30Le3FXnAIGpMvK6zKuoDCLv%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQABoMMjkxOTU4Mzc2OTIzIgz1wmArwAothiMW454qvgOOcuxv3%2FW0od5Dq7yRM%2BloeB%2FcA1ZxX5Bs7oWCYXlSmKC6DamepOsJJnOi7cIRuK0LUwTVLJd5eLTe%2BK41uRNPLz9mgNjkRF6alSUAAB4%2BsUtHdKsFkh5M9npFdiJHqcEjtBgesO081pOZcxPj8dv2iUY%2BVefgD4oRPfpICck8sqbbw9DPJZJrqW%2B10pQ9M9iK6vFYFF1QZc0htv3Tw%2BSCl2AJDU%2BuuAQjZnHmcjUAGaFWGBo6zuR4TBjDresn59AlXN7XpHMp1CSLSoPTvXj%2FrqvTXSrWE0MMf3zEDzlhRYPSrMbE2YS4%2F%2B6LSacvlaSgx%2BHwZZ%2FU8btRiGNvBU%2Bt3Ii2tkbO6daE%2BU8hai5abKxUUXxRxI6N3cRoEBOaA%2FLt2QKTvWCPKLQyePBAEsLvuyQXXjxyPgnWWg1S21rIu5skJmUP8PuUk%2BOzTk%2FvlqOHRC8yHosDDlUL8zVIttvYjRk7Vo%2B6%2FXuZAeH%2FTGilWHnZEK7SfzwQMDDgTh1acVZZcA5joXSe4GjsmvXIoAnJj3XwvmY2Z3CGKPZ1TjlkByaTxy0lMYZ7ToSCPKxYCu0E9rXUQk5ohLsRl8ToazDopNDKBjqkAXRbeOEYxHX3ONcsPgjAatcY%2BvoPgHYX0TFwI44O6M5Fp7qPvTyVtFK6fnYAJr0OYjt7d%2BhdMNnm4A4xqmcAjzkIVOWhdGgr2GeoI6LFqvjdCG8b8LkdPhKyTzTLLsZoKVV6SXpxlL2EMFl20YePXmG3iUY3aJMBF1cGJJNoVdqHCEREWxlrTGbJGC%2BRS6lm7S%2FmQrXBSOywmZOL4PCoSvyXau7b&X-Amz-Signature=1d2ffb50f50657ec0657db07e4bb98d5e6159a07eac63216e105dbd765789702",
                "front_image_camera_front": null,
                "back_image_camera_front": null,
                "front_image_camera_front_face_match_score": null,
                "back_image_camera_front_face_match_score": null,
                "date_of_birth": "1987-10-01",
                "age": 38,
                "expiration_date": "2031-06-15",
                "date_of_issue": "2016-06-16",
                "issuing_state": "BGD",
                "issuing_state_name": "Bangladesh",
                "first_name": "Md Moktadir",
                "last_name": "Rahman",
                "full_name": "Md Moktadir Rahman",
                "gender": "M",
                "address": "বাসা/হোল্ডিং: ২/৭/কে ২, গ্রাম/রাস্তা:,টোলারুবাগ, ডাকঘর: মিরপুর - ১২১৬, মিরপুর, ঢাকা,উত্র সিটি কর্গোরেশন, ঢাকা",
                "formatted_address": "R936+9GV, Mirpur Rd, Dhaka 1216, Bangladesh",
                "place_of_birth": "Naogaon",
                "marital_status": "UNKNOWN",
                "nationality": "BGD",
                "extra_fields": {
                "blood_group": "O+",
                "first_surname": "Rahman"
                },
                "parsed_address": {
                "city": "Dhaka",
                "label": "Bangladesh Identity Card Address",
                "region": "Dhaka Division",
                "country": "BD",
                "category": "Residential",
                "street_1": "Mirpur Road",
                "street_2": null,
                "is_verified": true,
                "postal_code": "1216",
                "raw_results": {
                    "types": [
                    "establishment",
                    "finance",
                    "point_of_interest",
                    "post_office"
                    ],
                    "geometry": {
                    "location": {
                        "lat": 23.8034818,
                        "lng": 90.3612959
                    },
                    "viewport": {
                        "northeast": {
                        "lat": 23.80487963029151,
                        "lng": 90.3626064802915
                        },
                        "southwest": {
                        "lat": 23.8021816697085,
                        "lng": 90.3599085197085
                        }
                    },
                    "location_type": "GEOMETRIC_CENTER"
                    },
                    "place_id": "ChIJKzqP7dvAVTcRHWjJjEJyreI",
                    "partial_match": true,
                    "formatted_address": "R936+9GV, Mirpur Rd, Dhaka 1216, Bangladesh",
                    "navigation_points": [
                    {
                        "location": {
                        "latitude": 23.8035284,
                        "longitude": 90.3612593
                        }
                    }
                    ],
                    "address_components": [
                    {
                        "types": [
                        "plus_code"
                        ],
                        "long_name": "R936+9GV",
                        "short_name": "R936+9GV"
                    },
                    {
                        "types": [
                        "route"
                        ],
                        "long_name": "Mirpur Road",
                        "short_name": "Mirpur Rd"
                    },
                    {
                        "types": [
                        "political",
                        "sublocality",
                        "sublocality_level_1"
                        ],
                        "long_name": "Mirpur",
                        "short_name": "Mirpur"
                    },
                    {
                        "types": [
                        "locality",
                        "political"
                        ],
                        "long_name": "Dhaka",
                        "short_name": "Dhaka"
                    },
                    {
                        "types": [
                        "administrative_area_level_2",
                        "political"
                        ],
                        "long_name": "Dhaka District",
                        "short_name": "Dhaka District"
                    },
                    {
                        "types": [
                        "administrative_area_level_1",
                        "political"
                        ],
                        "long_name": "Dhaka Division",
                        "short_name": "Dhaka Division"
                    },
                    {
                        "types": [
                        "country",
                        "political"
                        ],
                        "long_name": "Bangladesh",
                        "short_name": "BD"
                    },
                    {
                        "types": [
                        "postal_code"
                        ],
                        "long_name": "1216",
                        "short_name": "1216"
                    }
                    ]
                },
                "address_type": null,
                "document_location": {
                    "latitude": 23.8034818,
                    "longitude": 90.3612959
                },
                "formatted_address": "R936+9GV, Mirpur Rd, Dhaka 1216, Bangladesh"
                },
                "extra_files": [],
                "warnings": [
                {
                    "feature": "ID_VERIFICATION",
                    "risk": "POSSIBLE_DUPLICATED_USER",
                    "additional_data": {
                    "api_service": null,
                    "duplicated_session_id": "d455a0bb-2c76-4272-85e4-eabed171aa34",
                    "duplicated_session_number": 298
                    },
                    "log_type": "information",
                    "short_description": "Possible duplicated approved user from other session",
                    "long_description": "The system identified a potential duplicate user with previously approved documents from another session, requiring further investigation."
                }
                ]
            },
            "nfc": null,
            "liveness": {
                "status": "Approved",
                "method": "PASSIVE",
                "score": 100,
                "reference_image": "https://service-didit-verification-production-a1c5f9b8.s3.amazonaws.com/face/20557068-58c5-4a8f-8522-b9454dc9fa10/reference_image.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIAUH6QTJHN3TZ2X3Q4%2F20251230%2Feu-west-1%2Fs3%2Faws4_request&X-Amz-Date=20251230T181717Z&X-Amz-Expires=14400&X-Amz-SignedHeaders=host&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEPL%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCWV1LXdlc3QtMSJIMEYCIQC1R1e2udTxp4yX2NHzvvmiKvars1ipCmI3Ym2GYgJccgIhAOTyUM5qqjE5gJMzSwaq1ly3fIc30Le3FXnAIGpMvK6zKuoDCLv%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQABoMMjkxOTU4Mzc2OTIzIgz1wmArwAothiMW454qvgOOcuxv3%2FW0od5Dq7yRM%2BloeB%2FcA1ZxX5Bs7oWCYXlSmKC6DamepOsJJnOi7cIRuK0LUwTVLJd5eLTe%2BK41uRNPLz9mgNjkRF6alSUAAB4%2BsUtHdKsFkh5M9npFdiJHqcEjtBgesO081pOZcxPj8dv2iUY%2BVefgD4oRPfpICck8sqbbw9DPJZJrqW%2B10pQ9M9iK6vFYFF1QZc0htv3Tw%2BSCl2AJDU%2BuuAQjZnHmcjUAGaFWGBo6zuR4TBjDresn59AlXN7XpHMp1CSLSoPTvXj%2FrqvTXSrWE0MMf3zEDzlhRYPSrMbE2YS4%2F%2B6LSacvlaSgx%2BHwZZ%2FU8btRiGNvBU%2Bt3Ii2tkbO6daE%2BU8hai5abKxUUXxRxI6N3cRoEBOaA%2FLt2QKTvWCPKLQyePBAEsLvuyQXXjxyPgnWWg1S21rIu5skJmUP8PuUk%2BOzTk%2FvlqOHRC8yHosDDlUL8zVIttvYjRk7Vo%2B6%2FXuZAeH%2FTGilWHnZEK7SfzwQMDDgTh1acVZZcA5joXSe4GjsmvXIoAnJj3XwvmY2Z3CGKPZ1TjlkByaTxy0lMYZ7ToSCPKxYCu0E9rXUQk5ohLsRl8ToazDopNDKBjqkAXRbeOEYxHX3ONcsPgjAatcY%2BvoPgHYX0TFwI44O6M5Fp7qPvTyVtFK6fnYAJr0OYjt7d%2BhdMNnm4A4xqmcAjzkIVOWhdGgr2GeoI6LFqvjdCG8b8LkdPhKyTzTLLsZoKVV6SXpxlL2EMFl20YePXmG3iUY3aJMBF1cGJJNoVdqHCEREWxlrTGbJGC%2BRS6lm7S%2FmQrXBSOywmZOL4PCoSvyXau7b&X-Amz-Signature=a6eb7b734684029ea6b90c57b1dd0961cc9225931fde0bcb8fc42fdfd3c34cba",
                "video_url": "https://service-didit-verification-production-a1c5f9b8.s3.amazonaws.com/face-videos/20557068-58c5-4a8f-8522-b9454dc9fa10-video-610949d1-f270-4791-9018-cb2c54adda8f.webm?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIAUH6QTJHN3TZ2X3Q4%2F20251230%2Feu-west-1%2Fs3%2Faws4_request&X-Amz-Date=20251230T181717Z&X-Amz-Expires=14400&X-Amz-SignedHeaders=host&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEPL%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCWV1LXdlc3QtMSJIMEYCIQC1R1e2udTxp4yX2NHzvvmiKvars1ipCmI3Ym2GYgJccgIhAOTyUM5qqjE5gJMzSwaq1ly3fIc30Le3FXnAIGpMvK6zKuoDCLv%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQABoMMjkxOTU4Mzc2OTIzIgz1wmArwAothiMW454qvgOOcuxv3%2FW0od5Dq7yRM%2BloeB%2FcA1ZxX5Bs7oWCYXlSmKC6DamepOsJJnOi7cIRuK0LUwTVLJd5eLTe%2BK41uRNPLz9mgNjkRF6alSUAAB4%2BsUtHdKsFkh5M9npFdiJHqcEjtBgesO081pOZcxPj8dv2iUY%2BVefgD4oRPfpICck8sqbbw9DPJZJrqW%2B10pQ9M9iK6vFYFF1QZc0htv3Tw%2BSCl2AJDU%2BuuAQjZnHmcjUAGaFWGBo6zuR4TBjDresn59AlXN7XpHMp1CSLSoPTvXj%2FrqvTXSrWE0MMf3zEDzlhRYPSrMbE2YS4%2F%2B6LSacvlaSgx%2BHwZZ%2FU8btRiGNvBU%2Bt3Ii2tkbO6daE%2BU8hai5abKxUUXxRxI6N3cRoEBOaA%2FLt2QKTvWCPKLQyePBAEsLvuyQXXjxyPgnWWg1S21rIu5skJmUP8PuUk%2BOzTk%2FvlqOHRC8yHosDDlUL8zVIttvYjRk7Vo%2B6%2FXuZAeH%2FTGilWHnZEK7SfzwQMDDgTh1acVZZcA5joXSe4GjsmvXIoAnJj3XwvmY2Z3CGKPZ1TjlkByaTxy0lMYZ7ToSCPKxYCu0E9rXUQk5ohLsRl8ToazDopNDKBjqkAXRbeOEYxHX3ONcsPgjAatcY%2BvoPgHYX0TFwI44O6M5Fp7qPvTyVtFK6fnYAJr0OYjt7d%2BhdMNnm4A4xqmcAjzkIVOWhdGgr2GeoI6LFqvjdCG8b8LkdPhKyTzTLLsZoKVV6SXpxlL2EMFl20YePXmG3iUY3aJMBF1cGJJNoVdqHCEREWxlrTGbJGC%2BRS6lm7S%2FmQrXBSOywmZOL4PCoSvyXau7b&X-Amz-Signature=99bb36bc8fbe466127dc0f59735c12a7162ffe96a230ac81a2f92ee341e5b5bf",
                "age_estimation": 36.74,
                "matches": [
                {
                    "status": "Approved",
                    "session_id": "d455a0bb-2c76-4272-85e4-eabed171aa34",
                    "api_service": null,
                    "vendor_data": null,
                    "user_details": {
                    "full_name": "Md Moktadir Rahman",
                    "document_type": "ID",
                    "document_number": "3254542032"
                    },
                    "is_blocklisted": false,
                    "session_number": 298,
                    "match_image_url": "https://service-didit-verification-production-a1c5f9b8.s3.amazonaws.com/face/d455a0bb-2c76-4272-85e4-eabed171aa34/reference_image.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIAUH6QTJHN3TZ2X3Q4%2F20251230%2Feu-west-1%2Fs3%2Faws4_request&X-Amz-Date=20251230T181717Z&X-Amz-Expires=14400&X-Amz-SignedHeaders=host&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEPL%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCWV1LXdlc3QtMSJIMEYCIQC1R1e2udTxp4yX2NHzvvmiKvars1ipCmI3Ym2GYgJccgIhAOTyUM5qqjE5gJMzSwaq1ly3fIc30Le3FXnAIGpMvK6zKuoDCLv%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQABoMMjkxOTU4Mzc2OTIzIgz1wmArwAothiMW454qvgOOcuxv3%2FW0od5Dq7yRM%2BloeB%2FcA1ZxX5Bs7oWCYXlSmKC6DamepOsJJnOi7cIRuK0LUwTVLJd5eLTe%2BK41uRNPLz9mgNjkRF6alSUAAB4%2BsUtHdKsFkh5M9npFdiJHqcEjtBgesO081pOZcxPj8dv2iUY%2BVefgD4oRPfpICck8sqbbw9DPJZJrqW%2B10pQ9M9iK6vFYFF1QZc0htv3Tw%2BSCl2AJDU%2BuuAQjZnHmcjUAGaFWGBo6zuR4TBjDresn59AlXN7XpHMp1CSLSoPTvXj%2FrqvTXSrWE0MMf3zEDzlhRYPSrMbE2YS4%2F%2B6LSacvlaSgx%2BHwZZ%2FU8btRiGNvBU%2Bt3Ii2tkbO6daE%2BU8hai5abKxUUXxRxI6N3cRoEBOaA%2FLt2QKTvWCPKLQyePBAEsLvuyQXXjxyPgnWWg1S21rIu5skJmUP8PuUk%2BOzTk%2FvlqOHRC8yHosDDlUL8zVIttvYjRk7Vo%2B6%2FXuZAeH%2FTGilWHnZEK7SfzwQMDDgTh1acVZZcA5joXSe4GjsmvXIoAnJj3XwvmY2Z3CGKPZ1TjlkByaTxy0lMYZ7ToSCPKxYCu0E9rXUQk5ohLsRl8ToazDopNDKBjqkAXRbeOEYxHX3ONcsPgjAatcY%2BvoPgHYX0TFwI44O6M5Fp7qPvTyVtFK6fnYAJr0OYjt7d%2BhdMNnm4A4xqmcAjzkIVOWhdGgr2GeoI6LFqvjdCG8b8LkdPhKyTzTLLsZoKVV6SXpxlL2EMFl20YePXmG3iUY3aJMBF1cGJJNoVdqHCEREWxlrTGbJGC%2BRS6lm7S%2FmQrXBSOywmZOL4PCoSvyXau7b&X-Amz-Signature=91b02cf466fdccbbb0df4d9599abfbf1c4d0da4bb25156445aece9ce32c86990",
                    "verification_date": "2025-12-30T06:22:08Z",
                    "similarity_percentage": 62.86150813102722
                }
                ],
                "warnings": [
                {
                    "feature": "LIVENESS",
                    "risk": "POSSIBLE_DUPLICATED_FACE",
                    "additional_data": {
                    "api_service": null,
                    "duplicated_session_id": "d455a0bb-2c76-4272-85e4-eabed171aa34",
                    "duplicated_session_number": 298
                    },
                    "log_type": "information",
                    "short_description": "Possible duplicated face from other approved session",
                    "long_description": "The system identified a possible duplicate face from another approved session, requiring further investigation."
                }
                ]
            },
            "face_match": {
                "status": "Approved",
                "score": 73.81,
                "source_image_session_id": null,
                "source_image": "https://service-didit-verification-production-a1c5f9b8.s3.amazonaws.com/face-match/20557068-58c5-4a8f-8522-b9454dc9fa10/source.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIAUH6QTJHN3TZ2X3Q4%2F20251230%2Feu-west-1%2Fs3%2Faws4_request&X-Amz-Date=20251230T181717Z&X-Amz-Expires=14400&X-Amz-SignedHeaders=host&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEPL%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCWV1LXdlc3QtMSJIMEYCIQC1R1e2udTxp4yX2NHzvvmiKvars1ipCmI3Ym2GYgJccgIhAOTyUM5qqjE5gJMzSwaq1ly3fIc30Le3FXnAIGpMvK6zKuoDCLv%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQABoMMjkxOTU4Mzc2OTIzIgz1wmArwAothiMW454qvgOOcuxv3%2FW0od5Dq7yRM%2BloeB%2FcA1ZxX5Bs7oWCYXlSmKC6DamepOsJJnOi7cIRuK0LUwTVLJd5eLTe%2BK41uRNPLz9mgNjkRF6alSUAAB4%2BsUtHdKsFkh5M9npFdiJHqcEjtBgesO081pOZcxPj8dv2iUY%2BVefgD4oRPfpICck8sqbbw9DPJZJrqW%2B10pQ9M9iK6vFYFF1QZc0htv3Tw%2BSCl2AJDU%2BuuAQjZnHmcjUAGaFWGBo6zuR4TBjDresn59AlXN7XpHMp1CSLSoPTvXj%2FrqvTXSrWE0MMf3zEDzlhRYPSrMbE2YS4%2F%2B6LSacvlaSgx%2BHwZZ%2FU8btRiGNvBU%2Bt3Ii2tkbO6daE%2BU8hai5abKxUUXxRxI6N3cRoEBOaA%2FLt2QKTvWCPKLQyePBAEsLvuyQXXjxyPgnWWg1S21rIu5skJmUP8PuUk%2BOzTk%2FvlqOHRC8yHosDDlUL8zVIttvYjRk7Vo%2B6%2FXuZAeH%2FTGilWHnZEK7SfzwQMDDgTh1acVZZcA5joXSe4GjsmvXIoAnJj3XwvmY2Z3CGKPZ1TjlkByaTxy0lMYZ7ToSCPKxYCu0E9rXUQk5ohLsRl8ToazDopNDKBjqkAXRbeOEYxHX3ONcsPgjAatcY%2BvoPgHYX0TFwI44O6M5Fp7qPvTyVtFK6fnYAJr0OYjt7d%2BhdMNnm4A4xqmcAjzkIVOWhdGgr2GeoI6LFqvjdCG8b8LkdPhKyTzTLLsZoKVV6SXpxlL2EMFl20YePXmG3iUY3aJMBF1cGJJNoVdqHCEREWxlrTGbJGC%2BRS6lm7S%2FmQrXBSOywmZOL4PCoSvyXau7b&X-Amz-Signature=9d5ff9a3612ae30eb360988633b6f81a4852d9296e6184441828b01057eb7dcd",
                "target_image": "https://service-didit-verification-production-a1c5f9b8.s3.amazonaws.com/face-match/20557068-58c5-4a8f-8522-b9454dc9fa10/target.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIAUH6QTJHN3TZ2X3Q4%2F20251230%2Feu-west-1%2Fs3%2Faws4_request&X-Amz-Date=20251230T181717Z&X-Amz-Expires=14400&X-Amz-SignedHeaders=host&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEPL%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCWV1LXdlc3QtMSJIMEYCIQC1R1e2udTxp4yX2NHzvvmiKvars1ipCmI3Ym2GYgJccgIhAOTyUM5qqjE5gJMzSwaq1ly3fIc30Le3FXnAIGpMvK6zKuoDCLv%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQABoMMjkxOTU4Mzc2OTIzIgz1wmArwAothiMW454qvgOOcuxv3%2FW0od5Dq7yRM%2BloeB%2FcA1ZxX5Bs7oWCYXlSmKC6DamepOsJJnOi7cIRuK0LUwTVLJd5eLTe%2BK41uRNPLz9mgNjkRF6alSUAAB4%2BsUtHdKsFkh5M9npFdiJHqcEjtBgesO081pOZcxPj8dv2iUY%2BVefgD4oRPfpICck8sqbbw9DPJZJrqW%2B10pQ9M9iK6vFYFF1QZc0htv3Tw%2BSCl2AJDU%2BuuAQjZnHmcjUAGaFWGBo6zuR4TBjDresn59AlXN7XpHMp1CSLSoPTvXj%2FrqvTXSrWE0MMf3zEDzlhRYPSrMbE2YS4%2F%2B6LSacvlaSgx%2BHwZZ%2FU8btRiGNvBU%2Bt3Ii2tkbO6daE%2BU8hai5abKxUUXxRxI6N3cRoEBOaA%2FLt2QKTvWCPKLQyePBAEsLvuyQXXjxyPgnWWg1S21rIu5skJmUP8PuUk%2BOzTk%2FvlqOHRC8yHosDDlUL8zVIttvYjRk7Vo%2B6%2FXuZAeH%2FTGilWHnZEK7SfzwQMDDgTh1acVZZcA5joXSe4GjsmvXIoAnJj3XwvmY2Z3CGKPZ1TjlkByaTxy0lMYZ7ToSCPKxYCu0E9rXUQk5ohLsRl8ToazDopNDKBjqkAXRbeOEYxHX3ONcsPgjAatcY%2BvoPgHYX0TFwI44O6M5Fp7qPvTyVtFK6fnYAJr0OYjt7d%2BhdMNnm4A4xqmcAjzkIVOWhdGgr2GeoI6LFqvjdCG8b8LkdPhKyTzTLLsZoKVV6SXpxlL2EMFl20YePXmG3iUY3aJMBF1cGJJNoVdqHCEREWxlrTGbJGC%2BRS6lm7S%2FmQrXBSOywmZOL4PCoSvyXau7b&X-Amz-Signature=611b852ac1c0f409d72a032248bbe7af1822178e1e99f962240fbe8649f864a1",
                "warnings": []
            },
            "poa": null,
            "phone": null,
            "email": null,
            "aml": null,
            "ip_analysis": {
                "status": "Approved",
                "device_brand": null,
                "device_model": null,
                "browser_family": "Chrome",
                "os_family": "Windows",
                "platform": "desktop",
                "ip_country": "Bangladesh",
                "ip_country_code": "BD",
                "ip_state": null,
                "ip_city": null,
                "latitude": 23.701799392700195,
                "longitude": 90.37419891357422,
                "ip_address": "103.148.74.209",
                "isp": "Sinthia Telecom",
                "organization": "Sinthia Telecom",
                "is_vpn_or_tor": false,
                "is_data_center": false,
                "time_zone": "Asia/Dhaka",
                "time_zone_offset": "+0600",
                "locations_info": {
                "ip": {
                    "location": {
                    "longitude": 90.37419891357422,
                    "latitude": 23.701799392700195
                    },
                    "distance_from_id_document": {
                    "distance": 11.38,
                    "direction": "S"
                    },
                    "distance_from_poa_document": null
                },
                "id_document": {
                    "location": {
                    "latitude": 23.8034818,
                    "longitude": 90.3612959
                    },
                    "distance_from_ip": {
                    "distance": 11.38,
                    "direction": "S"
                    },
                    "distance_from_poa_document": null
                },
                "poa_document": {
                    "location": null,
                    "distance_from_ip": null,
                    "distance_from_id_document": null
                }
                },
                "warnings": []
            },
            "database_validation": null,
            "reviews": [],
            "contact_details": null,
            "expected_details": null,
            "questionnaire": null,
            "created_at": "2025-12-30T06:42:57.086123Z"
            });
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
            assets_path: assetsCDN + 'cdn/'
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