'use strict';
const mongoose = require('mongoose');
const doorRepository = require('../src/doors/repository');
const { testDatabase } = require('./helpers');

const db = testDatabase('drops');
beforeAll(() => db.start());
afterAll(() => db.stop());

test('a medium drop for flat 302 takes the lowest free medium door', async () => {
  const res = await db.api().post('/drops').send({ sizeClass: 'M', flat: '302' });

  expect(res.status).toBe(201);
  expect(res.body.door).toBe('D21');
  expect(res.headers.location).toBe(`/parcels/${res.body.parcelId}`);
});

test('a size class outside S, M, L is a 400 naming sizeClass', async () => {
  const res = await db.api().post('/drops').send({ sizeClass: 'XL', flat: '302' });

  expect(res.status).toBe(400);
  expect(res.body.type).toBe('/errors/validation');
  expect(res.body.errors.map((e) => e.field)).toContain('sizeClass');
});

test('a flat that does not exist is a 400 no-such-flat', async () => {
  const res = await db.api().post('/drops').send({ sizeClass: 'M', flat: '999' });

  expect(res.status).toBe(400);
  expect(res.body.type).toBe('/errors/no-such-flat');
});

test('when holding the door fails, the drop is a 500 and leaves no parcel behind', async () => {
  const parcelsBefore = await mongoose.connection.collection('parcels').countDocuments();
  jest.spyOn(doorRepository, 'hold').mockRejectedValueOnce(new Error('the door write failed'));

  const res = await db.api().post('/drops').send({ sizeClass: 'S', flat: '101' });

  expect(res.status).toBe(500);
  expect(await mongoose.connection.collection('parcels').countDocuments()).toBe(parcelsBefore);
  const wall = await db.api().get('/towers/A/doors?size=S');
  expect(wall.body.free).toBe(20);
});

test('a body that is not JSON at all is a 400 validation problem', async () => {
  const res = await db.api().post('/drops')
    .set('content-type', 'application/json')
    .send('{not json');

  expect(res.status).toBe(400);
  expect(res.body.type).toBe('/errors/validation');
});