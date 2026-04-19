require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');

const database = require('./config/database');
const authService = require('./modules/auth/auth.service');

// Importar rutas
const authRoutes = require('./modules/auth/auth.routes');
const vehiclesRoutes = require('./modules/vehicles/vehicles.routes');
const tripsRoutes = require('./modules/trips/trips.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const encargadoRoutes = require('./modules/encargado/encargado.routes');

const app = express();
const server = http.createServer(app);

// ============ 1. CORS PRIMERO ============
// CORS - Permitir todo para desarrollo
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Conductor-Email']
}));

// Para preflight requests
app.options('*', cors());

// ============ 2. MIDDLEWARE ============
app.use(express.json());

// Logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// ============ 3. RUTAS ============
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/encargado', encargadoRoutes);

// ============ 4. RUTAS PÚBLICAS ============
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'Viajes API',
        version: '1.0.0',
        timestamp: new Date()
    });
});

// ============ 5. RUTAS DE USUARIO Y CONDUCTOR ============
const db = require('./config/database');

// Buscar vehículos disponibles
app.post('/api/buscar-vehiculos', async (req, res) => {
    try {
        const vehiculos = await db.query(`
            SELECT v.*, u.full_name as encargado_nombre
            FROM vehicles v
            JOIN users u ON v.encargado_id = u.id
            WHERE v.active = 1 AND v.admin_approved = 1
            ORDER BY v.created_at DESC
        `);
        
        const resultados = vehiculos.map(v => {
            const distancia = Math.floor(Math.random() * 50) + 5;
            let costo = 35 + (distancia * 8);
            
            return {
                id: v.id,
                patente: v.plate,
                modelo: v.model,
                year: v.year,
                capacidad: v.capacity,
                conductor_nombre: v.conductor_nombre,
                conductor_telefono: v.conductor_telefono,
                distancia_km: distancia,
                costo: Math.round(costo)
            };
        });
        
        res.json({ success: true, data: resultados });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Crear solicitud de viaje
app.post('/api/solicitar-viaje', async (req, res) => {
    try {
        const { usuario_nombre, usuario_telefono, origen, destino, vehicle_id, costo, distancia } = req.body;
        const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const result = await db.query(`
            INSERT INTO viajes (usuario_nombre, usuario_telefono, origen_direccion, destino_direccion, 
                                vehicle_id, costo, distancia_km, codigo_seguimiento, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')
        `, [usuario_nombre, usuario_telefono, origen, destino, vehicle_id, costo, distancia, codigo]);
        
        res.json({ success: true, viaje_id: result.insertId, codigo: codigo });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Login de conductor
app.post('/api/conductor/login', async (req, res) => {
    try {
        const { email } = req.body;
        
        const conductor = await db.query(`
            SELECT v.id, v.conductor_nombre, v.conductor_telefono, v.conductor_email,
                   v.plate, v.model
            FROM vehicles v
            WHERE v.conductor_email = ? AND v.active = 1
        `, [email]);
        
        if (conductor.length === 0) {
            return res.status(401).json({ success: false, message: 'Email no registrado como conductor' });
        }
        
        const token = Buffer.from(email).toString('base64');
        
        res.json({ 
            success: true, 
            token: token,
            conductor: conductor[0]
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Ver solicitudes pendientes
app.get('/api/conductor/solicitudes', async (req, res) => {
    try {
        const email = req.headers['x-conductor-email'];
        
        const solicitudes = await db.query(`
            SELECT vj.*, v.plate, v.model
            FROM viajes vj
            JOIN vehicles v ON vj.vehicle_id = v.id
            WHERE v.conductor_email = ? AND vj.estado = 'pendiente'
            ORDER BY vj.created_at DESC
        `, [email]);
        
        res.json({ success: true, data: solicitudes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Aceptar viaje
app.put('/api/conductor/aceptar/:id', async (req, res) => {
    try {
        await db.query(`UPDATE viajes SET estado = 'aceptado', aceptado_en = NOW() WHERE id = ?`, [req.params.id]);
        res.json({ success: true, message: 'Viaje aceptado' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Rechazar viaje
app.put('/api/conductor/rechazar/:id', async (req, res) => {
    try {
        await db.query(`UPDATE viajes SET estado = 'cancelado' WHERE id = ?`, [req.params.id]);
        res.json({ success: true, message: 'Viaje rechazado' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Historial del conductor
app.get('/api/conductor/historial', async (req, res) => {
    try {
        const email = req.headers['x-conductor-email'];
        
        const historial = await db.query(`
            SELECT vj.*, v.plate, v.model
            FROM viajes vj
            JOIN vehicles v ON vj.vehicle_id = v.id
            WHERE v.conductor_email = ? AND vj.estado IN ('completado', 'cancelado')
            ORDER BY vj.created_at DESC
        `, [email]);
        
        res.json({ success: true, data: historial });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Completar viaje
app.put('/api/conductor/completar/:id', async (req, res) => {
    try {
        await db.query(`UPDATE viajes SET estado = 'completado', completado_en = NOW() WHERE id = ?`, [req.params.id]);
        res.json({ success: true, message: 'Viaje completado' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============ 6. INICIAR SERVIDOR ============
async function startServer() {
    try {
        await database.connect();
        await authService.createAdminIfNotExists();
        
        const PORT = process.env.PORT || 3000;
        server.listen(PORT, () => {
            console.log('\n=================================');
            console.log('🚀 VIAJES - Transporte Rural');
            console.log('=================================');
            console.log(`📡 Servidor: http://localhost:${PORT}`);
            console.log(`❤️  Health: http://localhost:${PORT}/health`);
            console.log('=================================\n');
        });
    } catch (error) {
        console.error('❌ Error starting server:', error);
        process.exit(1);
    }
}
// Consultar estado de un viaje
app.get('/api/viaje/estado/:id', async (req, res) => {
    try {
        const viajeId = req.params.id;
        
        const viaje = await db.query(`
            SELECT vj.*, v.plate, v.model, v.conductor_nombre, v.conductor_telefono
            FROM viajes vj
            JOIN vehicles v ON vj.vehicle_id = v.id
            WHERE vj.id = ?
        `, [viajeId]);
        
        if (viaje.length === 0) {
            return res.status(404).json({ success: false, message: 'Viaje no encontrado' });
        }
        
        res.json({ success: true, data: viaje[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Calificar viaje
app.post('/api/viaje/calificar/:id', async (req, res) => {
    try {
        const viajeId = req.params.id;
        const { calificacion, comentario } = req.body;
        
        await db.query(`
            UPDATE viajes 
            SET calificacion = ?, comentario = ?
            WHERE id = ?
        `, [calificacion, comentario, viajeId]);
        
        res.json({ success: true, message: 'Calificación enviada' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// Obtener viajes activos del conductor (aceptados y en curso)
app.get('/api/conductor/activos', async (req, res) => {
    try {
        const email = req.headers['x-conductor-email'];
        
        const activos = await db.query(`
            SELECT vj.*, v.plate, v.model
            FROM viajes vj
            JOIN vehicles v ON vj.vehicle_id = v.id
            WHERE v.conductor_email = ? AND vj.estado IN ('aceptado', 'en_curso')
            ORDER BY vj.created_at DESC
        `, [email]);
        
        res.json({ success: true, data: activos });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Iniciar viaje
app.put('/api/conductor/iniciar/:id', async (req, res) => {
    try {
        const viajeId = req.params.id;
        
        await db.query(`
            UPDATE viajes 
            SET estado = 'en_curso', iniciado_en = NOW()
            WHERE id = ?
        `, [viajeId]);
        
        res.json({ success: true, message: 'Viaje iniciado' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Obtener perfil del conductor
app.get('/api/conductor/perfil', async (req, res) => {
    try {
        const email = req.headers['x-conductor-email'];
        
        const conductor = await db.query(`
            SELECT v.id, v.conductor_nombre, v.conductor_telefono, v.conductor_email,
                   v.plate, v.model, 
                   COUNT(vj.id) as viajes_completados,
                   SUM(CASE WHEN vj.estado = 'completado' THEN vj.costo ELSE 0 END) as ganancias_total
            FROM vehicles v
            LEFT JOIN viajes vj ON vj.vehicle_id = v.id AND vj.estado = 'completado'
            WHERE v.conductor_email = ?
            GROUP BY v.id
        `, [email]);
        
        if (conductor.length === 0) {
            return res.status(404).json({ success: false, message: 'Conductor no encontrado' });
        }
        
        res.json({ success: true, data: conductor[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============ VIAJES ============

// Guardar viaje completado
app.post('/api/guardar-viaje', async (req, res) => {
    try {
        const { usuario_nombre, usuario_telefono, origen, destino, conductor_nombre, patente, precio, hora_salida, hora_fin, conforme } = req.body;
        
        // Buscar vehicle_id por patente
        const vehicle = await db.query('SELECT id FROM vehicles WHERE plate = ?', [patente]);
        const vehicle_id = vehicle.length > 0 ? vehicle[0].id : null;
        
        const result = await db.query(`
            INSERT INTO viajes (usuario_nombre, usuario_telefono, origen_direccion, destino_direccion, 
                                conductor_nombre, patente, vehicle_id, costo, hora_salida, hora_fin, conforme, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completado')
        `, [usuario_nombre, usuario_telefono, origen, destino, conductor_nombre, patente, vehicle_id, precio, hora_salida, hora_fin, conforme || 'pendiente']);
        
        res.json({ success: true, message: 'Viaje guardado', id: result.insertId });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Obtener viajes (para encargado)
app.get('/api/encargado/viajes', async (req, res) => {
    try {
        const viajes = await db.query(`
            SELECT * FROM viajes 
            ORDER BY created_at DESC 
            LIMIT 100
        `);
        res.json({ success: true, data: viajes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Obtener resumen de ganancias por día
app.get('/api/encargado/resumen', async (req, res) => {
    try {
        const resumen = await db.query(`
            SELECT 
                DATE(created_at) as fecha,
                COUNT(*) as total_viajes,
                SUM(costo) as total_ganado
            FROM viajes 
            WHERE estado = 'completado'
            GROUP BY DATE(created_at)
            ORDER BY fecha DESC
            LIMIT 30
        `);
        res.json({ success: true, data: resumen });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Actualizar conforme del viaje
app.put('/api/actualizar-conforme', async (req, res) => {
    try {
        const { patente, conforme } = req.body;
        
        await db.query(`
            UPDATE viajes 
            SET conforme = ? 
            WHERE patente = ? AND estado = 'completado'
            ORDER BY created_at DESC 
            LIMIT 1
        `, [conforme, patente]);
        
        res.json({ success: true, message: 'Conforme actualizado' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Guardar viaje completado
app.post('/api/guardar-viaje', async (req, res) => {
    try {
        const { usuario_nombre, usuario_telefono, origen, destino, conductor_nombre, patente, precio, hora_salida, hora_fin, conforme } = req.body;
        
        const vehicle = await db.query('SELECT id FROM vehicles WHERE plate = ?', [patente]);
        const vehicle_id = vehicle.length > 0 ? vehicle[0].id : null;
        
        // Generar código de seguimiento
        const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const result = await db.query(`
            INSERT INTO viajes (usuario_nombre, usuario_telefono, origen_direccion, destino_direccion, 
                                conductor_nombre, patente, vehicle_id, costo, distancia_km, 
                                codigo_seguimiento, hora_salida, hora_fin, conforme, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completado')
        `, [usuario_nombre, usuario_telefono, origen, destino, conductor_nombre, patente, vehicle_id, precio, null, codigo, hora_salida, hora_fin, conforme || 'pendiente']);
        
        res.json({ success: true, message: 'Viaje guardado', id: result.insertId });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Reporte por conductor
app.get('/api/encargado/reporte-conductores', async (req, res) => {
    try {
        const reporte = await db.query(`
            SELECT 
                conductor_nombre,
                patente,
                COUNT(*) as total_viajes,
                SUM(costo) as total_ganado,
                SUM(CASE WHEN conforme = 'si' THEN 1 ELSE 0 END) as conformes_si,
                SUM(CASE WHEN conforme = 'no' THEN 1 ELSE 0 END) as conformes_no,
                AVG(costo) as promedio_precio
            FROM viajes 
            WHERE estado = 'completado' AND conductor_nombre IS NOT NULL
            GROUP BY conductor_nombre, patente
            ORDER BY total_ganado DESC
        `);
        
        res.json({ success: true, data: reporte });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
startServer();