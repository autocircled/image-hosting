const conf = {
    appwriteUrl: String(process.env.APPWRITE_ENDPOINT),
    appwriteProjectId: String(process.env.APPWRITE_PROJECT_ID),
    appwriteDatabaseId: String(process.env.APPWRITE_DATABASE_ID),
}

module.exports = conf