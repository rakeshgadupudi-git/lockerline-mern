'use strict';
const { NoSuchFlat, NoDoorFree } = require('../errors');
const { wholeSecond, iso } = require('../time');
const { newCode, hashCode } = require('../parcels/codes');

const TOWER = 'A';
const HOUR = 60 * 60 * 1000;

function makeDropService({ doors, parcels, settings, clock, inTransaction }) {
  async function freshCode(session) {
    let code = newCode();
    while (await parcels.codeHashWaiting(hashCode(code, settings.codeHashKey), session)) code = newCode();
    return code;
  }

  async function drop({ sizeClass, flat }) {
    return inTransaction(async (session) => {
      if (!(await doors.residentExists(TOWER, flat, session))) throw new NoSuchFlat(flat);
      const door = await doors.lowestFree(TOWER, sizeClass, session);
      if (!door) throw new NoDoorFree(sizeClass, await doors.freeSizes(TOWER, session));
      const droppedAt = wholeSecond(clock.now());
      const expiresAt = new Date(droppedAt.getTime() + settings.freeWindowHours * HOUR);
      const parcelId = await parcels.nextId(session);
      const code = await freshCode(session);
      await parcels.insert({
        parcelId, towerId: TOWER, flat, sizeClass, doorId: door.no, droppedAt,
        codeHash: hashCode(code, settings.codeHashKey), codeExpiresAt: expiresAt,
      }, session);
      await doors.hold(TOWER, door.no, parcelId, session);
      // The only answer that ever shows the code: the courier hands it to the resident.
      return { parcelId, door: door.no, sizeClass, flat, droppedAt: iso(droppedAt), code, expiresAt: iso(expiresAt) };
    });
  }
  return { drop };
}
module.exports = { makeDropService };