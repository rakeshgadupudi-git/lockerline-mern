'use strict';
const express = require('express');
const { z } = require('zod');
const { parse } = require('../validate');

const dropBody = z.object({
  sizeClass: z.enum(['S', 'M', 'L']),
  flat: z.string().min(1),
});

function makeDropRouter(service) {
  const router = express.Router();

  router.post('/drops', async (req, res) => {
    const made = await service.drop(parse(dropBody, req.body));
    res.status(201).location(`/parcels/${made.parcelId}`).json(made);
  });

  return router;
}

module.exports = { makeDropRouter };