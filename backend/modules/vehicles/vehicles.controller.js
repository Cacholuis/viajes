const vehiclesService = require('./vehicles.service');

class VehiclesController {
async createVehicle(req, res) {
    try {
        console.log('📥 Datos recibidos:', JSON.stringify(req.body, null, 2));
        console.log('👤 Usuario:', req.user);
        
        const vehicleData = { ...req.body, created_by: req.user.id };
        const result = await vehiclesService.createVehicle(vehicleData);
        res.status(201).json(result);
    } catch (error) {
        console.error('❌ Error detallado:', error);
        console.error('❌ Stack:', error.stack);
        res.status(400).json({ success: false, message: error.message });
    }
}

    async approveVehicle(req, res) {
        try {
            const { id } = req.params;
            const result = await vehiclesService.approveVehicle(id, req.user.id);
            res.json(result);
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async getPendingVehicles(req, res) {
        try {
            const vehicles = await vehiclesService.getPendingVehicles();
            res.json({ success: true, data: vehicles });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async getAllVehicles(req, res) {
        try {
            const vehicles = await vehiclesService.getAllVehicles();
            res.json({ success: true, data: vehicles });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async updateVehicle(req, res) {
        try {
            const { id } = req.params;
            const result = await vehiclesService.updateVehicle(id, req.body);
            res.json(result);
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async deleteVehicle(req, res) {
        try {
            const { id } = req.params;
            const result = await vehiclesService.deleteVehicle(id);
            res.json(result);
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
}

module.exports = new VehiclesController();