const db = require('../../config/database');
const logger = require('../../utils/logger');

class VehiclesService {
    async createVehicle(vehicleData) {
        const query = `
            INSERT INTO vehicles (
                plate, model, year, capacity, precio,
                conditions_ok, admin_approved, created_by, encargado_id,
                conductor_nombre, conductor_telefono, conductor_email
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const result = await db.query(query, [
            vehicleData.plate.toUpperCase(),
            vehicleData.model,
            vehicleData.year,
            vehicleData.capacity,
            vehicleData.precio || 0,
            vehicleData.conditions_ok || 0,
            0,
            vehicleData.created_by,
            vehicleData.created_by,
            vehicleData.conductor_nombre || null,
            vehicleData.conductor_telefono || null,
            vehicleData.conductor_email || null
        ]);
        
        logger.info(`Vehicle created: ${vehicleData.plate}`, { vehicleId: result.insertId });
        return { success: true, id: result.insertId, message: 'Vehículo registrado, pendiente de aprobación' };
    }

    async approveVehicle(vehicleId, adminId) {
        const query = `
            UPDATE vehicles 
            SET admin_approved = 1, 
                admin_approved_by = ?, 
                admin_approved_at = NOW()
            WHERE id = ? AND admin_approved = 0
        `;
        
        const result = await db.query(query, [adminId, vehicleId]);
        
        if (result.affectedRows > 0) {
            logger.info(`Vehicle approved: ${vehicleId} by admin ${adminId}`);
            return { success: true, message: 'Vehículo aprobado correctamente' };
        }
        
        return { success: false, message: 'Vehículo no encontrado o ya aprobado' };
    }

    async getVehicleById(vehicleId) {
        const query = `
            SELECT v.*, u.full_name as created_by_name
            FROM vehicles v
            LEFT JOIN users u ON v.created_by = u.id
            WHERE v.id = ?
        `;
        const vehicles = await db.query(query, [vehicleId]);
        return vehicles[0] || null;
    }

    async getPendingVehicles() {
        const query = `
            SELECT v.*, u.full_name as created_by_name
            FROM vehicles v
            LEFT JOIN users u ON v.created_by = u.id
            WHERE v.admin_approved = 0 AND v.active = 1
            ORDER BY v.created_at DESC
        `;
        return await db.query(query);
    }

    async getAllVehicles() {
        const query = `
            SELECT v.*, u.full_name as created_by_name
            FROM vehicles v
            LEFT JOIN users u ON v.created_by = u.id
            WHERE v.active = 1 
            ORDER BY v.created_at DESC
        `;
        return await db.query(query);
    }

    async updateVehicle(vehicleId, updateData) {
        const query = `
            UPDATE vehicles 
            SET plate = ?, model = ?, year = ?, capacity = ?, precio = ?,
                conductor_nombre = ?, conductor_telefono = ?, conductor_email = ?
            WHERE id = ?
        `;
        
        const result = await db.query(query, [
            updateData.plate.toUpperCase(),
            updateData.model,
            updateData.year,
            updateData.capacity,
            updateData.precio || 0,
            updateData.conductor_nombre || null,
            updateData.conductor_telefono || null,
            updateData.conductor_email || null,
            vehicleId
        ]);
        
        logger.info(`Vehicle updated: ${vehicleId}`, updateData);
        
        return { 
            success: result.affectedRows > 0,
            message: result.affectedRows > 0 ? 'Vehículo actualizado' : 'Vehículo no encontrado'
        };
    }

    async deleteVehicle(vehicleId) {
        const query = `UPDATE vehicles SET active = 0 WHERE id = ?`;
        const result = await db.query(query, [vehicleId]);
        
        if (result.affectedRows > 0) {
            logger.info(`Vehicle deleted (soft): ${vehicleId}`);
            return { success: true, message: 'Vehículo eliminado' };
        }
        
        return { success: false, message: 'Vehículo no encontrado' };
    }

    async getVehiclesByStatus(approved = null, active = null) {
        let query = `SELECT * FROM vehicles WHERE 1=1`;
        const params = [];
        
        if (approved !== null) {
            query += ` AND admin_approved = ?`;
            params.push(approved ? 1 : 0);
        }
        
        if (active !== null) {
            query += ` AND active = ?`;
            params.push(active ? 1 : 0);
        }
        
        query += ` ORDER BY created_at DESC`;
        
        return await db.query(query, params);
    }

    async validateVehicleConditions(vehicleId) {
        const vehicle = await this.getVehicleById(vehicleId);
        if (!vehicle) return { valid: false, reason: 'Vehicle not found' };
        
        const conditions = [];
        
        if (vehicle.year < 2015) {
            conditions.push('Vehículo muy antiguo (más de 8 años)');
        }
        
        if (vehicle.capacity < 4) {
            conditions.push('Capacidad insuficiente (mínimo 4 asientos)');
        }
        
        return {
            valid: conditions.length === 0,
            conditions: conditions,
            requires_approval: conditions.length === 0
        };
    }
}

module.exports = new VehiclesService();