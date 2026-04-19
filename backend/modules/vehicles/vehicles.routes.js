const express = require('express');
const router = express.Router();
const vehiclesController = require('./vehicles.controller');
const auth = require('../../middleware/auth');

router.post('/', auth, vehiclesController.createVehicle);
router.put('/:id/approve', auth, vehiclesController.approveVehicle);
router.get('/pending', auth, vehiclesController.getPendingVehicles);
router.get('/', auth, vehiclesController.getAllVehicles);
router.put('/:id', auth, vehiclesController.updateVehicle);
router.delete('/:id', auth, vehiclesController.deleteVehicle);

module.exports = router;