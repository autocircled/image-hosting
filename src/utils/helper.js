const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs');

const preprocessImage = async(imagePath) => {
    const outputPath = imagePath.replace(/\.[^/.]+$/, "") + '-processed.jpg';
    
    await sharp(imagePath)
        .grayscale()
        .normalize()
        .median(3) // Noise reduction
        .sharpen({ sigma: 1.2 }) //{ sigma: 2, m1: 1, m2: 2 }
        .threshold(150)
        .toFile(outputPath);
        
    return outputPath;
}

const extractTextFromImage = async(imagePath) => {
    try {
        // Preprocess for better OCR
        const processedPath = await preprocessImage(imagePath);
        
        // Perform OCR
        const { data: { text } } = await Tesseract.recognize(
            processedPath,
            'eng',
            {
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/- ',
                psm: 6, // Assume a single uniform block of text (good for IDs)
            }
        );
        
        // Clean up processed file using promises
        try {
            await fs.promises.unlink(processedPath);
        } catch (unlinkError) {
            console.error('Error deleting processed file:', unlinkError);
            // Continue even if deletion fails
        }
        const cleanText = text.replace(/[^a-zA-Z0-9\s\/:\-,#]/g, ' ').toLowerCase();
        return detectDocumentType(cleanText);
    } catch (error) {
        throw new Error(`OCR failed: ${error.message}`);
    }
}

// Simple single-function version
const detectDocumentType = (text) => {
    const docTypeMatchers = [
        {
            type: 'DRIVERS_LICENSE',
            patterns: [
                /dpryers license/i,
                /driver license/i,
                /drivers? license/i,
                /driver'?s? licence/i,
                /dl[#:]?\s*\d+/i,
                /\b(class|restrictions|endorsements)\s*:/i
            ],
            confidence: 0.8
        },
        {
            type: 'ID_CARD',
            patterns: [
                /id\s*card/i,
                /identification card/i,
                /national id/i,
                /government id/i
            ],
            confidence: 0.7
        },
        {
            type: 'PASSPORT',
            patterns: [
                /passport/i,
                /pass\s*port/i,
                /travel document/i,
                /nationality:/i,
                /passport no/i
            ],
            confidence: 0.9
        },
        {
            type: 'RESIDENCE_CARD',
            patterns: [
                /residence card/i,
                /residency permit/i,
                /green card/i,
                /permanent resident/i,
                /alien registration/i
            ],
            confidence: 0.75
        }
    ];

    const results = [];
    
    for (const matcher of docTypeMatchers) {
        let matchCount = 0;
        for (const pattern of matcher.patterns) {
            if (pattern.test(text)) {
                matchCount++;
            }
        }
        
        if (matchCount > 0) {
            const confidence = Math.min(1, matcher.confidence + (matchCount * 0.1));
            results.push({
                type: matcher.type,
                confidence: Math.round(confidence * 100),
                matches: matchCount
            });
        }
    }
    
    results.sort((a, b) => b.confidence - a.confidence);
    
    return {
        primaryType: results[0]?.type || 'UNKNOWN',
        allTypes: results,
        isDocument: results.length > 0
    };
}

module.exports = {
    extractTextFromImage
}