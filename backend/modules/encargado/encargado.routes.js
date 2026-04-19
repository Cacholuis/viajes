const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const auth = require('../../middleware/auth');

// Middleware para verificar que es encargado
const isEncargado = async (req, res, next) => {
    try {
        const users = await db.query('SELECT role, id, zona_asignada, full_name FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0 || users[0].role !== 'encargado') {
            return res.status(403).json({ success: false, message: 'Acceso denegado. Se requiere rol de encargado.' });
        }
        req.encargadoId = users[0].id;
        req.zonaAsignada = users[0].zona_asignada;
        req.encargadoNombre = users[0].full_name;
        next();
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET - Dashboard
router.get('/dashboard', auth, isEncargado, async (req, res) => {
    try {
        const vehiculos = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN admin_approved = 1 THEN 1 ELSE 0 END) as aprobados,
                SUM(CASE WHEN admin_approved = 0 THEN 1 ELSE 0 END) as pendientes
            FROM vehicles 
            WHERE encargado_id = ?
        `, [req.encargadoId]);
        
        res.json({ 
            success: true, 
            total: vehiculos[0]?.total || 0,
            aprobados: vehiculos[0]?.aprobados || 0,
            pendientes: vehiculos[0]?.pendientes || 0,
            zona: req.zonaAsignada || 'Sin zona'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET - Vehículos del encargado
router.get('/vehiculos', auth, isEncargado, async (req, res) => {
    try {
        console.log('🔍 Buscando vehículos para encargado ID:', req.encargadoId);
        
        const vehiculos = await db.query(`
            SELECT * FROM vehicles 
            WHERE encargado_id = ?
            ORDER BY created_at DESC
        `, [req.encargadoId]);
        
        console.log('✅ Vehículos encontrados:', vehiculos.length);
        
        res.json({ success: true, data: vehiculos });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET - Movimientos del encargado
router.get('/movimientos', auth, isEncargado, async (req, res) => {
    try {
        const movimientos = await db.query(`
            SELECT * FROM movimientos 
            WHERE usuario_id = ? 
            ORDER BY created_at DESC 
            LIMIT 50
        `, [req.user.id]);
        
        res.json({ success: true, data: movimientos });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;