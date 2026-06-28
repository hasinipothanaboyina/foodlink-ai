/**
 * MySQL Database Connection
 * Uses a connection pool for efficient query handling.
 */

const mysql = require('mysql2/promise');
require('dotenv').config();
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: false,
});

// Test connection on startup
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL Database connected successfully!');
    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
  }
}

testConnection();

module.exports = pool;
