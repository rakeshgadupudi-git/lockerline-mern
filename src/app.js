'use strict';
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const { document } = require('./openapi');
const { inTransaction } = require('./db');
const doorRepository = require('./doors/repository');
const parcelRepository = require('./parcels/repository');
const eventRepository = require('./events/repository');
const { makeDoorService } = require('./doors/service');
const { makeDoorRouter } = require('./doors/router');
const { makeDropService } = require('./drops/service');
const { makeDropRouter } = require('./drops/router');
const { makeParcelService } = require('./parcels/service');
const { makeParcelRouter } = require('./parcels/router');
const { makePickupService } = require('./pickups/service');
const { makePickupRouter } = require('./pickups/router');
const { makeLastRoute, errorHandler } = require('./errors/middleware');

/** Builds the Express app. It never connects to the database and never listens: server.js and tests do that. */
function createApp({ settings, clock }) {
  const app = express();
  const doors = makeDoorService({ repository: doorRepository, parcels: parcelRepository, clock });
  const drops = makeDropService({
    doors: doorRepository, parcels: parcelRepository, events: eventRepository, settings, clock, inTransaction,
  });
  const parcels = makeParcelService({ repository: parcelRepository, events: eventRepository });
  const pickups = makePickupService({
    parcels: parcelRepository, doors: doorRepository, events: eventRepository, settings, clock, inTransaction,
  });

  app.use(express.json());
  app.get('/openapi.json', (req, res) => res.json(document));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(document));
  app.use(makeDoorRouter(doors));
  app.use(makeDropRouter(drops));
  app.use(makeParcelRouter(parcels));
  app.use(makePickupRouter(pickups));
  app.use(makeLastRoute(document.paths));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };