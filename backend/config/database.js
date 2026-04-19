const mysql = require('mysql2/promise');

class Database {
    constructor() {
        this.pool = null;
    }

    async connect() {
        try {
            this.pool = await mysql.createPool({
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 3306,
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'viajes',
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });
            
            // Probar conexión
            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();
            
            console.log('✅ MySQL connected successfully');
            return this.pool;
        } catch (error) {
            console.error('❌ MySQL connection failed:', error.message);
            console.error('   Verifica que MySQL esté instalado y corriendo');
            console.error('   y que las credenciales en .env sean correctas');
            throw error;
        }
    }

    async query(sql, params) {
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } catch (error) {
            console.error('Database query error:', error.message);
            console.error('SQL:', sql);
            throw error;
        }
    }

    async transaction(callback) {
        const connection = await this.pool.getConnection();
        await connection.beginTransaction();
        
        try {
            const result = await callback(connection);
            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = new Database();