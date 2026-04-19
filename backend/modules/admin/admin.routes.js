const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../../config/database');
const auth = require('../../middleware/auth');

// Middleware para verificar que es administrador
const isAdmin = async (req, res, next) => {
    try {
        const users = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0 || users[0].role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acceso denegado. Se requiere rol de administrador.' });
        }
        next();
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET - Listar todos los encargados
router.get('/encargados', auth, isAdmin, async (req, res) => {
    try {
        const encargados = await db.query(`
            SELECT u.*, COUNT(v.id) as vehiculos_count
            FROM users u
            LEFT JOIN vehicles v ON v.encargado_id = u.id
            WHERE u.role = 'encargado'
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);
        res.json({ success: true, data: encargados });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET - Obtener un encargado por ID
router.get('/encargados/:id', auth, isAdmin, async (req, res) => {
    try {
        const encargados = await db.query(`
            SELECT id, email, full_name, phone, role, zona_asignada, created_at
            FROM users 
            WHERE id = ? AND role = 'encargado'
        `, [req.params.id]);
        
        if (encargados.length === 0) {
            return res.status(404).json({ success: false, message: 'Encargado no encontrado' });
        }
        res.json({ success: true, data: encargados[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST - Crear nuevo encargado
router.post('/encargados', auth, isAdmin, async (req, res) => {
    try {
        const { full_name, email, phone, password, zona_asignada } = req.body;
        
        // Verificar si ya existe
        const existing = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'El email ya está registrado' });
        }
        
        // Hashear contraseña
        const hashedPassword = await bcrypt.hash(password || '123456', 10);
        
        // Crear encargado
        const result = await db.query(`
            INSERT INTO users (email, password_hash, full_name, phone, role, created_by, zona_asignada)
            VALUES (?, ?, ?, ?, 'encargado', ?, ?)
        `, [email, hashedPassword, full_name, phone, req.user.id, zona_asignada]);
        
        // Registrar movimiento
        await db.query(`
            INSERT INTO movimientos (usuario_id, usuario_nombre, accion, tabla_afectada, registro_id)
            VALUES (?, ?, 'CREAR', 'users', ?)
        `, [req.user.id, 'Administrador', result.insertId]);
        
        res.json({ success: true, message: 'Encargado creado correctamente', id: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT - Actualizar encargado
router.put('/encargados/:id', auth, isAdmin, async (req, res) => {
    try {
        const { full_name, email, phone, password, zona_asignada } = req.body;
        const encargadoId = req.params.id;
        
        let query = 'UPDATE users SET full_name = ?, email = ?, phone = ?, zona_asignada = ?';
        let params = [full_name, email, phone, zona_asignada];
        
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            query += ', password_hash = ?';
            params.push(hashedPassword);
        }
        
        query += ' WHERE id = ? AND role = "encargado"';
        params.push(encargadoId);
        
        await db.query(query, params);
        
        // Registrar movimiento
        await db.query(`
            INSERT INTO movimientos (usuario_id, usuario_nombre, accion, tabla_afectada, registro_id)
            VALUES (?, ?, 'ACTUALIZAR', 'users', ?)
        `, [req.user.id, 'Administrador', encargadoId]);
        
        res.json({ success: true, message: 'Encargado actualizado correctamente' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE - Eliminar encargado
router.delete('/encargados/:id', auth, isAdmin, async (req, res) => {
    try {
        const encargadoId = req.params.id;
        
        // Primero, desasignar vehículos
        await db.query('UPDATE vehicles SET encargado_id = NULL WHERE encargado_id = ?', [encargadoId]);
        
        // Eliminar encargado
        await db.query('DELETE FROM users WHERE id = ? AND role = "encargado"', [encargadoId]);
        
        // Registrar movimiento
        await db.query(`
            INSERT INTO movimientos (usuario_id, usuario_nombre, accion, tabla_afectada, registro_id)
            VALUES (?, ?, 'ELIMINAR', 'users', ?)
        `, [req.user.id, 'Administrador', encargadoId]);
        
        res.json({ success: true, message: 'Encargado eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET - Dashboard admin
router.get('/dashboard', auth, isAdmin, async (req, res) => {
    try {
        const encargados = await db.query('SELECT COUNT(*) as total FROM users WHERE role = "encargado"');
        const vehiculos = await db.query('SELECT COUNT(*) as total FROM vehicles');
        const movimientos = await db.query('SELECT COUNT(*) as total FROM movimientos');
        
        res.json({
            success: true,
            encargados: encargados[0].total,
            vehiculos: vehiculos[0].total,
            movimientos: movimientos[0].total
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET - Movimientos
router.get('/movimientos', auth, isAdmin, async (req, res) => {
    try {
        const movimientos = await db.query(`
            SELECT * FROM movimientos 
            ORDER BY created_at DESC 
            LIMIT 100
        `);
        res.json({ success: true, data: movimientos });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST - Configuración
router.post('/configuracion', auth, isAdmin, async (req, res) => {
    try {
        const { dias_movimientos, dias_viajes } = req.body;
        
        await db.query(`
            INSERT INTO configuracion (clave, valor) VALUES 
            ('dias_guardar_movimientos', ?),
            ('dias_guardar_viajes', ?)
            ON DUPLICATE KEY UPDATE valor = VALUES(valor)
        `, [dias_movimientos, dias_viajes]);
        
        res.json({ success: true, message: 'Configuración guardada' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST - Limpiar movimientos viejos
router.post('/limpiar-movimientos', auth, isAdmin, async (req, res) => {
    try {
        const config = await db.query(`SELECT valor FROM configuracion WHERE clave = 'dias_guardar_movimientos'`);
        const dias = config.length > 0 ? parseInt(config[0].valor) : 90;
        
        const result = await db.query(`
            DELETE FROM movimientos 
            WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [dias]);
        
        res.json({ success: true, message: `Se eliminaron ${result.affectedRows} movimientos antiguos` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST - Limpiar viajes viejos
router.post('/limpiar-viajes', auth, isAdmin, async (req, res) => {
    try {
        const config = await db.query(`SELECT valor FROM configuracion WHERE clave = 'dias_guardar_viajes'`);
        const dias = config.length > 0 ? parseInt(config[0].valor) : 180;
        
        const result = await db.query(`
            UPDATE trips 
            SET eliminado = 1, eliminado_en = NOW()
            WHERE status IN ('completed', 'cancelled') 
            AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
            AND eliminado = 0
        `, [dias]);
        
        res.json({ success: true, message: `Se marcaron ${result.affectedRows} viajes como eliminados` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;