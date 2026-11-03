'use strict';
const { NoSuchTower, NoSuchDoor } = require('../errors');

/** A door's state is derived from what it holds, on every read; nothing stores it. */
function stateOf(door) {
  return door.currentParcelId === null ? 'free' : 'holding';
}

function makeDoorService({ repository, parcels, clock }) {
  async function requireTower(tower) {
    if (!(await repository.towerExists(tower))) throw new NoSuchTower(tower);
  }

  /** Whole seconds a parcel has waited, up to now. */
  function dwellSeconds(parcel) {
    return Math.floor((clock.now().getTime() - parcel.droppedAt.getTime()) / 1000);
  }

  /** A free door is { no, size, state }; a holding door adds its parcel and how long it has waited. */
  function shape(doorDoc, parcel) {
    const shaped = { no: doorDoc.no, size: doorDoc.sizeClass, state: stateOf(doorDoc) };
    return parcel ? { ...shaped, parcelId: parcel.parcelId, dwellSeconds: dwellSeconds(parcel) } : shaped;
  }

  /** The wall, optionally only one size and/or one state; `free` counts the free doors among those shown. */
  async function wall(tower, { size, state } = {}) {
    await requireTower(tower);
    const all = await repository.doorsOf(tower);
    const held = await parcels.byIds(
      all.filter((d) => d.currentParcelId !== null).map((d) => d.currentParcelId),
    );
    const byId = new Map(held.map((p) => [p.parcelId, p]));
    const doors = all.map((d) => shape(d, byId.get(d.currentParcelId)))
      .filter((d) => (!size || d.size === size) && (!state || d.state === state));
    return { tower, free: doors.filter((d) => d.state === 'free').length, doors };
  }

  /** One door; a holding door read alone also names the flat its parcel is for. */
  async function door(tower, no) {
    await requireTower(tower);
    const found = await repository.door(tower, no);
    if (!found) throw new NoSuchDoor(tower, no);
    if (found.currentParcelId === null) return shape(found);
    const parcel = await parcels.byId(found.currentParcelId);
    const { dwellSeconds: dwell, ...rest } = shape(found, parcel);
    return { ...rest, flat: parcel.flat, dwellSeconds: dwell };
  }

  return { wall, door };
}

module.exports = { makeDoorService };