const mysql = require('mysql2/promise');

const dbConfig = {
    host: '3.14.252.156',
    user: 'root',
    password: '',
    database: 'DB_GENERAL'
};

const pool = mysql.createPool(dbConfig);

async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Conexión a MySQL establecida correctamente');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Error al conectar a MySQL:', error);
        return false;
    }
}

async function query(sql, params) {
    try {
        const [results] = await pool.execute(sql, params);
        return results;
    } catch (error) {
        console.error('Error en la consulta SQL:', error);
        throw error;
    }
}

module.exports = {
    query,
    testConnection,
    pool
};