const conf = require("../conf/conf");
const { Client, ID, TablesDB, Query, Permission, Role } = require("appwrite");

class APIService {
    client = new Client();
    tablesDB;
    constructor() {
        this.client
            .setEndpoint(conf.appwriteUrl)
            .setProject(conf.appwriteProjectId);

        this.tablesDB = new TablesDB(this.client);
    }

    async createLead(data) {
        try {
            return await this.tablesDB.createRow({
                databaseId: conf.appwriteDatabaseId,
                tableId: "leads",
                rowId: ID.unique(),
                data,
                permissions: [
                    // Permission.read(Role.team("admin")),
                    // Permission.read(Role.team("manager")),
                    // Permission.update(Role.team("admin")),
                    // Permission.delete(Role.team("admin")),
                    // Permission.write("role:all")
                ],
            })
        } catch (error) {
            throw error;
        }
    }

    async updateLead(data, rowId) {
        try {
            if(rowId) {
                return await this.tablesDB.updateRow({
                    databaseId: conf.appwriteDatabaseId,
                    tableId: "leads",
                    rowId: rowId,
                    data,
                    permissions: [
                        // Permission.read(Role.team("admin")),
                        // Permission.read(Role.team("manager")),
                        // Permission.update(Role.team("admin")),
                        // Permission.delete(Role.team("admin")),
                        // Permission.write("role:all")
                    ],
                })
            } else {
                return "rowId is required to update row";
            }
        } catch (error) {
            throw error;
        }
    }

    async getSettings() {
        try {
            return await this.tablesDB.listRows({
                databaseId: conf.appwriteDatabaseId,
                tableId: "settings",
            })
        } catch (error) {
            throw error;
        }
    }
}

// const service = new Service();
module.exports = APIService;