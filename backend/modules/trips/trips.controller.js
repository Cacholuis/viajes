const tripsService = require('./trips.service');

class TripsController {
    async requestTrip(req, res) {
        try {
            const { originCoords, destinationAddress } = req.body;
            const userId = req.user.id;
            
            const trip = await tripsService.requestTrip(userId, originCoords, destinationAddress);
            res.status(201).json({ success: true, data: trip });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    
    async getTripStatus(req, res) {
        try {
            const { id } = req.params;
            const trip = await tripsService.getTripDetails(id);
            res.json({ success: true, data: trip });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    
    async getUserTrips(req, res) {
        try {
            const userId = req.user.id;
            const trips = await tripsService.getUserTrips(userId);
            res.json({ success: true, data: trips });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    
    async acceptTrip(req, res) {
        try {
            const { id } = req.params;
            const driverId = req.user.driverId;
            
            // Lógica para aceptar viaje
            res.json({ success: true, message: 'Viaje aceptado' });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    
    async completeTrip(req, res) {
        try {
            const { id } = req.params;
            const { rating, review } = req.body;
            
            // Lógica para completar viaje
            res.json({ success: true, message: 'Viaje completado' });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
}

module.exports = new TripsController();