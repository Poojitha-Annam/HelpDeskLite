const mysql = require("mysql2/promise");
require("dotenv").config();

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    // Aiven MySQL requires SSL – rejectUnauthorized:false accepts Aiven's CA chain
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

module.exports = db;
