'use strict';
const { NoSuchFlat, NoDoorFree } = require('../errors');
const { wholeSecond, iso } = require('../time');

const TOWER = 'A';

function makeDropService({ doors, parcels, clock, inTransaction }) {
  /**
   * A courier's drop: the free door of exactly this size with the lowest number. Recording the parcel and holding
   * the door happen in one transaction, so a failure part-way leaves neither.
   */
  async function drop({ sizeClass, flat }) {
    return inTransaction(async (session) => {
      if (!(await doors.residentExists(TOWER, flat, session))) throw new NoSuchFlat(flat);
      const door = await doors.lowestFree(TOWER, sizeClass, session);
      if (!door) throw new NoDoorFree(sizeClass, await doors.freeSizes(TOWER, session));
      const droppedAt = wholeSecond(clock.now());
      const parcelId = await parcels.nextId(session);
      await parcels.insert({ parcelId, towerId: TOWER, flat, sizeClass, doorId: door.no, droppedAt }, session);
      await doors.hold(TOWER, door.no, parcelId, session);
      return { parcelId, door: door.no, sizeClass, flat, droppedAt: iso(droppedAt) };
    });
  }

  return { drop };
}

module.exports = { makeDropService };