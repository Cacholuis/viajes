const db = require('../../config/database');

class TripsService {
    async requestTrip(userId, originCoords, destinationAddress) {
        // Calcular distancia simulada (5-50 km para zona rural)
        const distance = Math.floor(Math.random() * 45) + 5;
        const cost = this.calculateCost(distance);
        
        const query = `
            INSERT INTO trips (
                user_id, origin_lat, origin_lng, 
                destination_address, distance_km, cost, status
            ) VALUES (?, ?, ?, ?, ?, ?, 'requesting')
        `;
        
        const result = await db.query(query, [
            userId,
            originCoords.lat, 
            originCoords.lng,
            destinationAddress,
            distance,
            cost
        ]);
        
        const tripId = result.insertId;
        
        // Buscar conductores disponibles en segundo plano
        this.findAndAssignDriver(tripId, originCoords);
        
        return {
            success: true,
            tripId,
            cost,
            distance: `${distance} km`,
            status: 'searching',
            message: 'Buscando conductor disponible en tu zona...'
        };
    }
    
    calculateCost(distanceKm) {
        const baseRate = 35.00;  // Tarifa base
        const perKmRate = 7.50;  // Por kilómetro
        const total = baseRate + (distanceKm * perKmRate);
        return Math.round(total * 100) / 100;
    }
    
    async findAndAssignDriver(tripId, originCoords) {
        // Simular tiempo de búsqueda
        setTimeout(async () => {
            // Buscar conductores disponibles
            const drivers = await db.query(`
                SELECT d.*, u.full_name as driver_name, u.phone, 
                       v.model, v.plate, v.traction
                FROM drivers d
                JOIN users u ON d.user_id = u.id
                JOIN vehicles v ON d.vehicle_id = v.id
                WHERE d.available = 1 AND d.active = 1 AND v.admin_approved = 1
                LIMIT 3
            `);
            
            if (drivers.length === 0) {
                await this.updateTripStatus(tripId, 'no_drivers');
                console.log(`Trip ${tripId}: No drivers available`);
                return;
            }
            
            // Simular que el primer conductor acepta (80% de probabilidad)
            const accepts = Math.random() < 0.8;
            
            if (accepts) {
                const driver = drivers[0];
                await this.assignDriver(tripId, driver.id);
                console.log(`Trip ${tripId}: Assigned to driver ${driver.driver_name}`);
            } else {
                await this.updateTripStatus(tripId, 'no_drivers');
                console.log(`Trip ${tripId}: Driver rejected`);
            }
            
        }, 5000); // Esperar 5 segundos simulando búsqueda
    }
    
    async assignDriver(tripId, driverId) {
        const query = `
            UPDATE trips 
            SET driver_id = ?, status = 'accepted', assigned_at = NOW()
            WHERE id = ? AND status = 'requesting'
        `;
        
        await db.query(query, [driverId, tripId]);
        await db.query(`UPDATE drivers SET available = 0 WHERE id = ?`, [driverId]);
        
        console.log(`Trip ${tripId}: Driver ${driverId} assigned`);
    }
    
    async getTripDetails(tripId) {
        const query = `
            SELECT 
                t.*,
                u.full_name as user_name,
                u.phone as user_phone,
                d.id as driver_id,
                d.rating as driver_rating,
                du.full_name as driver_name,
                du.phone as driver_phone,
                v.model as vehicle_model,
                v.plate as vehicle_plate,
                v.traction as vehicle_traction
            FROM trips t
            JOIN users u ON t.user_id = u.id
            LEFT JOIN drivers d ON t.driver_id = d.id
            LEFT JOIN users du ON d.user_id = du.id
            LEFT JOIN vehicles v ON d.vehicle_id = v.id
            WHERE t.id = ?
        `;
        const trips = await db.query(query, [tripId]);
        return trips[0] || null;
    }
    
    async getTripById(tripId) {
        const query = `SELECT * FROM trips WHERE id = ?`;
        const trips = await db.query(query, [tripId]);
        return trips[0] || null;
    }
    
    async updateTripStatus(tripId, status) {
        const query = `UPDATE trips SET status = ? WHERE id = ?`;
        await db.query(query, [status, tripId]);
        console.log(`Trip ${tripId}: Status updated to ${status}`);
    }
    
    async getUserTrips(userId) {
        const query = `
            SELECT t.*, 
                   d.id as driver_id,
                   du.full_name as driver_name,
                   v.model as vehicle_model
            FROM trips t
            LEFT JOIN drivers d ON t.driver_id = d.id
            LEFT JOIN users du ON d.user_id = du.id
            LEFT JOIN vehicles v ON d.vehicle_id = v.id
            WHERE t.user_id = ?
            ORDER BY t.created_at DESC
            LIMIT 20
        `;
        return await db.query(query, [userId]);
    }
    
    async acceptTripByDriver(tripId, driverId) {
        const trip = await this.getTripById(tripId);
        
        if (!trip) {
            return { success: false, message: 'Viaje no encontrado' };
        }
        
        if (trip.status !== 'requesting') {
            return { success: false, message: 'El viaje ya no está disponible' };
        }
        
        await this.assignDriver(tripId, driverId);
        
        return { success: true, message: 'Viaje aceptado correctamente' };
    }
    
    async completeTrip(tripId, driverId, rating, review) {
        const query = `
            UPDATE trips 
            SET status = 'completed', 
                completed_at = NOW(),
                rating = ?,
                review = ?
            WHERE id = ? AND driver_id = ? AND status = 'accepted'
        `;
        
        const result = await db.query(query, [rating, review, tripId, driverId]);
        
        if (result.affectedRows > 0) {
            // Liberar al conductor
            await db.query(`UPDATE drivers SET available = 1 WHERE id = ?`, [driverId]);
            
            // Actualizar rating del conductor si hay calificación
            if (rating) {
                await db.query(`
                    UPDATE drivers 
                    SET rating = (rating * total_trips + ?) / (total_trips + 1),
                        total_trips = total_trips + 1
                    WHERE id = ?
                `, [rating, driverId]);
            } else {
                await db.query(`UPDATE drivers SET total_trips = total_trips + 1 WHERE id = ?`, [driverId]);
            }
            
            return { success: true, message: 'Viaje completado' };
        }
        
        return { success: false, message: 'No se pudo completar el viaje' };
    }
    
    async cancelTrip(tripId, userId, reason) {
        const trip = await this.getTripById(tripId);
        
        if (!trip || trip.user_id !== userId) {
            return { success: false, message: 'Viaje no encontrado' };
        }
        
        if (trip.status !== 'requesting' && trip.status !== 'searching') {
            return { success: false, message: 'No se puede cancelar el viaje en este estado' };
        }
        
        const query = `UPDATE trips SET status = 'cancelled', cancelled_at = NOW() WHERE id = ?`;
        await db.query(query, [tripId]);
        
        // Liberar conductor si estaba asignado
        if (trip.driver_id) {
            await db.query(`UPDATE drivers SET available = 1 WHERE id = ?`, [trip.driver_id]);
        }
        
        return { success: true, message: 'Viaje cancelado' };
    }
}

module.exports = new TripsService();