const conf = {
    appwriteUrl: String(process.env.APPWRITE_ENDPOINT),
    appwriteProjectId: String(process.env.APPWRITE_PROJECT_ID),
    appwriteDatabaseId: String(process.env.APPWRITE_DATABASE_ID),
    appwriteDevKey: String(process.env.APPWRITE_DEV_KEY),
    assetsCDN: String(process.env.ASSETS_CDN),
}

module.exports = conf