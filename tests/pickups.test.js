'use strict';
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../src/app');
const doorRepository = require('../src/doors/repository');
const { testDatabase } = require('./helpers');

const db = testDatabase('pickups');
beforeAll(() => db.start());
afterAll(() => db.stop());

test('a code that never existed is a 404 no-such-code', async () => {
  await db.api().post('/drops').send({ sizeClass: 'M', flat: '302' });

  const res = await db.api().post('/pickups').send({ code: '000000' });

  expect(res.status).toBe(404);
  expect(res.body.type).toBe('/errors/no-such-code');
});

test('a code whose 48-hour window has passed is a 404 code-expired', async () => {
  const drop = await db.api().post('/drops').send({ sizeClass: 'S', flat: '101' });
  const threeDaysLater = { now: () => new Date('2026-09-28T13:10:00Z') };

  const res = await request(createApp({ settings: db.settings, clock: threeDaysLater }))
    .post('/pickups').send({ code: drop.body.code });

  expect(res.status).toBe(404);
  expect(res.body.type).toBe('/errors/code-expired');
});

test('with every large door taken, a large drop is a 409 naming the free sizes', async () => {
  for (let i = 0; i < 8; i++) await db.api().post('/drops').send({ sizeClass: 'L', flat: '302' });

  const res = await db.api().post('/drops').send({ sizeClass: 'L', flat: '302' });

  expect(res.status).toBe(409);
  expect(res.body.type).toBe('/errors/no-door-free');
  expect(res.body.freeSizes).toEqual(['S', 'M']);
});

test('a valid code opens the door once, and the same code again is a 409 code-used', async () => {
  const drop = await db.api().post('/drops').send({ sizeClass: 'M', flat: '303' });
  const twoHoursLater = request(createApp({ settings: db.settings, clock: { now: () => new Date('2026-09-25T15:10:00Z') } }));

  const opened = await twoHoursLater.post('/pickups').send({ code: drop.body.code });
  const again = await db.api().post('/pickups').send({ code: drop.body.code });

  expect(opened.status).toBe(200);
  expect(opened.body.door).toBe(drop.body.door);
  expect(opened.body.dwellSeconds).toBe(2 * 60 * 60);
  expect(again.status).toBe(409);
  expect(again.body.type).toBe('/errors/code-used');
});

test('when freeing the door fails, the pickup is a 500 and the parcel is still waiting', async () => {
  const drop = await db.api().post('/drops').send({ sizeClass: 'S', flat: '102' });
  jest.spyOn(doorRepository, 'release').mockRejectedValueOnce(new Error('the door write failed'));

  const res = await db.api().post('/pickups').send({ code: drop.body.code });

  expect(res.status).toBe(500);
  const parcel = await mongoose.connection.collection('parcels').findOne({ parcelId: drop.body.parcelId });
  expect(parcel.state).toBe('holding');
  expect(parcel.codeUsedAt).toBeNull();
});