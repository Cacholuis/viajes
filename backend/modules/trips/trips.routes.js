const express = require('express');
const router = express.Router();
const tripsController = require('./trips.controller');
const auth = require('../../middleware/auth');

router.post('/request', auth, tripsController.requestTrip);
router.get('/:id/status', auth, tripsController.getTripStatus);
router.get('/my-trips', auth, tripsController.getUserTrips);
router.put('/:id/accept', auth, tripsController.acceptTrip);
router.put('/:id/complete', auth, tripsController.completeTrip);

module.exports = router;