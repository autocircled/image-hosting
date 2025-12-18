const Fuse = require('fuse.js');

// Document type keywords with common OCR errors
const documentKeywords = {
    DRIVERS_LICENSE: [
        'drivers license', 'driver license', 'driving license',
        'drivers licence', 'driver licence', 'driving licence',
        'drivers lic', 'driver lic', 'driving lic',
        'dl number', 'dl#', 'dl no', 'license no',
        'permit', 'operators license', 'operators permit',
        'chauffeur license', 'commercial license',
        // Common OCR errors for "drivers"
        'dpryers', 'dpryers license', 'dr1vers', 'driv3rs',
        'd river s', 'drivers1icense', 'drivers 1icense',
        'dprvers license'
    ],
    ID_CARD: [
        'id card', 'identification card', 'identity card',
        'national id', 'national identification',
        'citizen card', 'citizen id', 'civil id',
        'government id', 'govt id', 'state id',
        'voter id', 'voter card', 'voter identification',
        'id number', 'id#', 'identification number',
        // Common variations
        '1d card', 'idcard', 'id-card', 'id_card'
    ],
    PASSPORT: [
        'passport', 'pass port', 'passport number',
        'passport no', 'passport #', 'passport id',
        'travel document', 'travel passport',
        'diplomatic passport', 'official passport',
        'passport card', 'passport book',
        // OCR errors
        'passport', 'passpert', 'pasp0rt', 'passp0rt'
    ],
    RESIDENCE_CARD: [
        'residence card', 'residence permit', 'residency card',
        'green card', 'permanent resident card',
        'alien registration card', 'arc card',
        'foreigner card', 'foreign resident card',
        'immigration card', 'immigrant card',
        'residence certificate', 'residency permit',
        'work permit', 'work visa', 'employment card',
        // Common terms
        'pr card', 'rp card', 'ic card'
    ],
    SOCIAL_SECURITY: [
        'social security', 'social security card',
        'ssn', 'ss card', 'social insurance',
        'national insurance', 'tin', 'tax id',
        'social security number', 'ss number',
        'ss#', 'ssn number'
    ],
    HEALTH_CARD: [
        'health card', 'health insurance card',
        'medical card', 'medicare card',
        'medicaid card', 'insurance card',
        'health id', 'medical insurance',
        'ehic', 'european health card'
    ],
    STUDENT_ID: [
        'student id', 'student card', 'student identification',
        'university id', 'college id', 'school id',
        'student number', 'matriculation card',
        'library card', 'campus card'
    ]
};

// Country-specific patterns
const countryPatterns = {
    USA: {
        drivers_license: /(?:california|texas|florida|new york|illinois|pennsylvania|ohio|georgia|north carolina|michigan|new jersey|virginia|washington|massachusetts|arizona|tennessee|indiana|missouri|maryland|wisconsin|colorado|minnesota|south carolina|alabama|louisiana|kentucky|oregon|oklahoma|connecticut|utah|iowa|nevada|arkansas|mississippi|kansas|new mexico|nebraska|west virginia|idaho|hawaii|new hampshire|maine|montana|rhode island|delaware|south dakota|north dakota|alaska|vermont|wyoming)\s+(?:drivers?|driver'?s?)\s+(?:license|id|card)/i,
        id_card: /(?:state\s+id|state\s+identification|non.?driver\s+id)/i
    },
    CANADA: {
        drivers_license: /(?:ontario|quebec|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|prince edward island|yukon|northwest territories|nunavut)\s+(?:drivers?|driver'?s?)\s+(?:license|licence)/i
    },
    EU: {
        id_card: /\b(?:personalausweis|carte d'identité|carta d'identità|cédula|pasaporte|dokument tożsamości)\b/i
    }
};

class DocumentClassifier {
    constructor() {
        this.fuseInstances = {};
        
        // Create Fuse instances for each document type
        for (const [docType, keywords] of Object.entries(documentKeywords)) {
            this.fuseInstances[docType] = new Fuse(keywords, {
                includeScore: true,
                threshold: 0.6, // Increased tolerance for OCR errors
                distance: 50,
                minMatchCharLength: 3,
                includeMatches: true,
                ignoreLocation: true
            });
        }
    }

    classifyDocument(text) {
        const lowercaseText = text.toLowerCase().replace(/\s+/g, ' ');
        const results = [];
        
        // Check each document type
        for (const [docType, fuse] of Object.entries(this.fuseInstances)) {
            const searchResults = fuse.search(lowercaseText);
            
            if (searchResults.length > 0) {
                const bestMatch = searchResults[0];
                results.push({
                    type: docType,
                    score: 1 - bestMatch.score, // Convert to confidence (0-1)
                    match: bestMatch.item,
                    matches: bestMatch.matches
                });
            }
        }
        
        // Sort by confidence score
        results.sort((a, b) => b.score - a.score);
        
        // Additional pattern-based detection
        this.applyPatternDetection(lowercaseText, results);
        
        // Apply country-specific checks
        this.applyCountrySpecificDetection(text, results);
        
        return this.formatResults(results, text);
    }

    applyPatternDetection(text, results) {
        // Check for specific patterns that indicate document types
        const patterns = {
            DRIVERS_LICENSE: [
                /\bdl[#:]?\s*[a-z0-9]{6,15}\b/i,
                /\b(?:class|restrictions|endorsements|hgt|height|wgt|weight|eyes|hair|sex)\s*[:=]/i,
                /\b(?:expires|expiration|exp|valid until)\s*[:=]\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/i,
                /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s*(?:dob|birth)/i
            ],
            PASSPORT: [
                /\bpassport\s*(?:no|number|#)\s*[a-z0-9]{6,12}\b/i,
                /\b(?:type|code|nationality|country of birth|place of birth|authority)\s*[:=]/i,
                /\bp[<]?[a-z]{1}[0-9]{7}[0-9a-z]?\b/i, // Common passport number format
                /\bissued by\s*[:=]/i
            ],
            RESIDENCE_CARD: [
                /\b(?:alien|foreign|non.?resident|immigrant|migrant)\s+(?:registration|id|number)\b/i,
                /\b(?:permanent\s+resident|pr\s+card|green\s+card)\b/i,
                /\b(?:residence|residency)\s+(?:permit|card|certificate)\b/i,
                /\b(?:valid\s+until|date\s+of\s+expiry)\s*[:=]\s*\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/i
            ],
            ID_CARD: [
                /\b(?:national\s+id|government\s+id|state\s+id)\s*(?:no|number|#)?\s*[a-z0-9]{8,20}\b/i,
                /\b(?:id\s*[:=]\s*[a-z0-9]{8,20})\b/i,
                /\b(?:issued\s+on|date\s+of\s+issue)\s*[:=]\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/i
            ]
        };

        for (const [docType, docPatterns] of Object.entries(patterns)) {
            let patternScore = 0;
            for (const pattern of docPatterns) {
                if (pattern.test(text)) {
                    patternScore += 0.1; // Add to confidence for each pattern match
                }
            }
            
            if (patternScore > 0) {
                const existingResult = results.find(r => r.type === docType);
                if (existingResult) {
                    existingResult.score = Math.min(1, existingResult.score + patternScore);
                } else {
                    results.push({
                        type: docType,
                        score: patternScore,
                        match: 'pattern_detected',
                        patternMatches: patternScore
                    });
                }
            }
        }
    }

    applyCountrySpecificDetection(text, results) {
        // Detect country and apply specific patterns
        for (const [country, patterns] of Object.entries(countryPatterns)) {
            for (const [docType, pattern] of Object.entries(patterns)) {
                if (pattern.test(text)) {
                    const docTypeKey = docType.toUpperCase().replace(/ /g, '_');
                    const existingResult = results.find(r => r.type === docTypeKey);
                    
                    if (existingResult) {
                        existingResult.score = Math.min(1, existingResult.score + 0.15);
                        existingResult.country = country;
                    } else {
                        results.push({
                            type: docTypeKey,
                            score: 0.3,
                            match: `country_specific_${country.toLowerCase()}`,
                            country: country
                        });
                    }
                }
            }
        }
    }

    formatResults(results, originalText) {
        // Filter out low-confidence results
        const filteredResults = results.filter(r => r.score >= 0.3);
        
        if (filteredResults.length === 0) {
            return {
                detected: false,
                confidence: 0,
                possibleTypes: [],
                rawText: originalText
            };
        }
        
        // Get top result
        const topResult = filteredResults[0];
        
        // Get all possible types with confidence > 0.4
        const possibleTypes = filteredResults
            .filter(r => r.score >= 0.4)
            .map(r => ({
                type: r.type,
                confidence: Math.round(r.score * 100),
                match: r.match,
                country: r.country || 'Unknown'
            }));
        
        return {
            detected: true,
            primaryType: topResult.type,
            confidence: Math.round(topResult.score * 100),
            possibleTypes: possibleTypes,
            rawText: originalText,
            details: {
                country: topResult.country || this.detectCountry(originalText),
                hasExpiration: /\b(?:expires|expiration|valid until)\b/i.test(originalText),
                hasPhoto: /\b(?:photo|photograph|picture|image)\b/i.test(originalText),
                hasSignature: /\b(?:signature|signed|sign)\b/i.test(originalText)
            }
        };
    }

    detectCountry(text) {
        const countryIndicators = {
            'USA': [/united states|usa|u\.s\.a|american|us driv/i, /(?:ca|tx|fl|ny|il|pa|oh|ga|nc|mi|nj|va|wa|ma|az|tn|in|mo|md|wi|co|mn|sc|al|la|ky|or|ok|ct|ut|ia|nv|ar|ms|ks|nm|ne|wv|id|hi|nh|me|mt|ri|de|sd|nd|ak|vt|wy)\b/i],
            'Canada': [/canada|canadian|cdn/i, /(?:on|qc|bc|ab|mb|sk|ns|nb|nl|pe|yt|nt|nu)\b/i],
            'UK': [/united kingdom|uk|u\.k|british|england|scotland|wales|northern ireland/i],
            'Germany': [/germany|deutschland|german/i, /\b(?:de|by|bw|be|bb|hb|hh|he|mv|ni|nw|rp|sl|sn|st|sh|th)\b/i],
            'France': [/france|french|république française/i],
            'Australia': [/australia|australian|aus/i, /(?:nsw|vic|qld|wa|sa|tas|act|nt)\b/i]
        };
        
        for (const [country, patterns] of Object.entries(countryIndicators)) {
            for (const pattern of patterns) {
                if (pattern.test(text)) {
                    return country;
                }
            }
        }
        
        return 'Unknown';
    }

    // Advanced: Extract structured data based on document type
    extractDocumentData(text, documentType) {
        const extractors = {
            DRIVERS_LICENSE: this.extractDriversLicenseData.bind(this),
            ID_CARD: this.extractIdCardData.bind(this),
            PASSPORT: this.extractPassportData.bind(this),
            RESIDENCE_CARD: this.extractResidenceCardData.bind(this),
            SOCIAL_SECURITY: this.extractSocialSecurityData.bind(this),
            HEALTH_CARD: this.extractHealthCardData.bind(this),
            STUDENT_ID: this.extractStudentIdData.bind(this)
        };
        
        const extractor = extractors[documentType] || this.extractGenericIdData;
        return extractor(text);
    }

    extractDriversLicenseData(text) {
        return {
            licenseNumber: this.extractPattern(text, /\b(?:dl|license|licence|permis)[#:]?\s*([a-z0-9]{6,15})\b/i),
            name: this.extractPattern(text, /\b([A-Z][A-Z\s]{2,20})\b(?:\s*\d|\s*DOB)/),
            dateOfBirth: this.extractPattern(text, /\b(?:dob|birth)[:\s]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i),
            expirationDate: this.extractPattern(text, /\b(?:expires|exp|expiration)[:\s]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i),
            address: this.extractAddress(text),
            restrictions: this.extractPattern(text, /\b(?:restrictions|restrict)[:\s]*([A-Z0-9,\s]+)/i),
            endorsements: this.extractPattern(text, /\b(?:endorsements|endorse)[:\s]*([A-Z0-9,\s]+)/i)
        };
    }

    extractPattern(text, pattern) {
        const match = text.match(pattern);
        return match ? match[1] : null;
    }

    extractAddress(text) {
        const addressMatch = text.match(/(\d+\s+[A-Z\s]+(?:ST|STREET|AVE|AVENUE|RD|ROAD|BLVD|LANE|DR|DRIVE))\s+([A-Z]+),\s*([A-Z]{2})\s+(\d{5,10})/i);
        return addressMatch ? {
            street: addressMatch[1],
            city: addressMatch[2],
            state: addressMatch[3],
            postalCode: addressMatch[4]
        } : null;
    }
}

module.exports = {
    DocumentClassifier
}

// Usage Example
// const classifier = new DocumentClassifier();

// // Test with your OCR text
// const ocrText = `SC usa\nSouth Carolina DpRVERS LICENSE 9\n. ~~,\n| «DL#:123456789 Ta\n» 1 SAMPLE RL\n3 2 JANE MARIA\n| 8 5 123 MAIN STREET e Aa\n& ANYTOWN, SC 123451111 JR\n~ " 3 DOB: 07/04/1970 ~\nNS 43 Issued: 10/01/2017\n4 Expires: 07/04/2025\nSA "15 Sex: F 1c Hgt: 5-09" "oo\n17 Wgt: 130 Ib 's Eyes: BRO\n9 Class:D 2End:NONE , oo\nApaedl\n12 Restrictions: p "= Havemor\n_ 50D 0100010602224403054 )`;

// const result = classifier.classifyDocument(ocrText);
// console.log('Classification Result:', JSON.stringify(result, null, 2));

// // Extract detailed data if it's a driver's license
// if (result.detected && result.primaryType === 'DRIVERS_LICENSE') {
//     const detailedData = classifier.extractDocumentData(ocrText, 'DRIVERS_LICENSE');
//     console.log('\nExtracted Driver License Data:', detailedData);
// }