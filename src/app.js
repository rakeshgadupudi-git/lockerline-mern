'use strict';
const express = require('express');
const { inTransaction } = require('./db');
const doorRepository = require('./doors/repository');
const parcelRepository = require('./parcels/repository');
const { makeDoorService } = require('./doors/service');
const { makeDoorRouter } = require('./doors/router');
const { makeDropService } = require('./drops/service');
const { makeDropRouter } = require('./drops/router');
const { makeParcelService } = require('./parcels/service');
const { makeParcelRouter } = require('./parcels/router');
const { notFound, errorHandler } = require('./errors/middleware');

/** Builds the Express app. It never connects to the database and never listens: server.js and tests do that. */
function createApp({ settings, clock }) {
  const app = express();
  const doors = makeDoorService({ repository: doorRepository, parcels: parcelRepository, clock });
  const drops = makeDropService({ doors: doorRepository, parcels: parcelRepository, clock, inTransaction });
  const parcels = makeParcelService({ repository: parcelRepository });

  app.use(express.json());
  app.use(makeDoorRouter(doors));
  app.use(makeDropRouter(drops));
  app.use(makeParcelRouter(parcels));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };