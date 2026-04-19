const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../config/database');

class AuthService {
    async register(userData) {
        const { email, password, fullName, phone, role } = userData;
        
        // Verificar si el usuario existe
        const existingUser = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            throw new Error('El email ya está registrado');
        }
        
        // Hashear contraseña
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Crear usuario
        const query = `
            INSERT INTO users (email, password_hash, full_name, phone, role)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        const result = await db.query(query, [email, hashedPassword, fullName, phone, role || 'user']);
        
        // Generar token
        const token = jwt.sign(
            { id: result.insertId, email, role: role || 'user' },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );
        
        return {
            token,
            user: {
                id: result.insertId,
                email,
                fullName,
                phone,
                role: role || 'user'
            }
        };
    }
    
    async login(email, password) {
        const users = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            throw new Error('Credenciales inválidas');
        }
        
        const user = users[0];
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!isValidPassword) {
            throw new Error('Credenciales inválidas');
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );
        
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                phone: user.phone,
                role: user.role
            }
        };
    }
    
    async createAdminIfNotExists() {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminExists = await db.query('SELECT * FROM users WHERE email = ?', [adminEmail]);
        
        if (adminExists.length === 0) {
            const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
            await db.query(`
                INSERT INTO users (email, password_hash, full_name, phone, role)
                VALUES (?, ?, 'Administrador', '0000000000', 'admin')
            `, [adminEmail, hashedPassword]);
            console.log('✅ Admin user created');
        }
    }
}

module.exports = new AuthService();