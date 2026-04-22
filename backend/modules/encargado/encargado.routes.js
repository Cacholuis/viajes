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

// ========== NUEVAS RUTAS PARA MOVIMIENTOS Y REPORTES ==========

// GET - Movimientos (viajes completados agrupados por día y vehículo)
router.get('/movimientos/viajes', auth, isEncargado, async (req, res) => {
    try {
        const encargadoId = req.encargadoId;

        const movimientos = await db.query(`
            SELECT 
                DATE(viajes.created_at) AS fecha,
                v.id AS vehiculo_id,
                v.plate AS patente,
                v.conductor_nombre AS conductor,
                COUNT(viajes.id) AS cantidad_viajes,
                SUM(viajes.costo) AS total
            FROM viajes
            JOIN vehicles v ON viajes.vehicle_id = v.id
            WHERE v.encargado_id = ? AND viajes.estado = 'completado'
            GROUP BY DATE(viajes.created_at), v.id
            ORDER BY fecha DESC, patente ASC
        `, [encargadoId]);

        res.json({ success: true, data: movimientos });
    } catch (error) {
        console.error('Error en movimientos/viajes:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET - Detalle de movimientos de un día específico (opcional)
router.get('/movimientos/detalle', auth, isEncargado, async (req, res) => {
    try {
        const { fecha, vehiculo_id } = req.query;
        const encargadoId = req.encargadoId;

        const detalle = await db.query(`
            SELECT 
                viajes.id,
                viajes.usuario_nombre,
                viajes.origen_direccion,
                viajes.destino_direccion,
                viajes.costo,
                viajes.created_at
            FROM viajes
            JOIN vehicles v ON viajes.vehicle_id = v.id
            WHERE v.encargado_id = ? 
              AND DATE(viajes.created_at) = ?
              AND viajes.vehicle_id = ?
              AND viajes.estado = 'completado'
            ORDER BY viajes.created_at ASC
        `, [encargadoId, fecha, vehiculo_id]);

        res.json({ success: true, data: detalle });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET - Reportes (misma consulta que movimientos pero sin límite)
router.get('/reportes', auth, isEncargado, async (req, res) => {
    try {
        const encargadoId = req.encargadoId;

        const reporte = await db.query(`
            SELECT 
                DATE(viajes.created_at) AS fecha,
                v.plate AS patente,
                v.conductor_nombre AS conductor,
                COUNT(viajes.id) AS viajes,
                SUM(viajes.costo) AS total
            FROM viajes
            JOIN vehicles v ON viajes.vehicle_id = v.id
            WHERE v.encargado_id = ? AND viajes.estado = 'completado'
            GROUP BY DATE(viajes.created_at), v.id
            ORDER BY fecha DESC, patente ASC
        `, [encargadoId]);

        res.json({ success: true, data: reporte });
    } catch (error) {
        console.error('Error en reportes:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Mantenemos la ruta original /movimientos por si se usa para auditoría
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
// GET - Detalle de un día específico
router.get('/movimientos/detalle', auth, isEncargado, async (req, res) => {
    try {
        const { fecha, vehiculo_id } = req.query;
        const encargadoId = req.encargadoId;

        const detalle = await db.query(`
            SELECT 
                viajes.id,
                viajes.usuario_nombre,
                viajes.origen_direccion,
                viajes.destino_direccion,
                viajes.costo,
                viajes.created_at
            FROM viajes
            JOIN vehicles v ON viajes.vehicle_id = v.id
            WHERE v.encargado_id = ? 
              AND DATE(viajes.created_at) = ?
              AND viajes.vehicle_id = ?
              AND viajes.estado = 'completado'
            ORDER BY viajes.created_at ASC
        `, [encargadoId, fecha, vehiculo_id]);

        res.json({ success: true, data: detalle });
    } catch (error) {
        console.error('Error en detalle:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
module.exports = router;