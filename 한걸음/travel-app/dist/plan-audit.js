(() => {
  'use strict';

  const WALK_LEG_METERS = 1600;
  const WALK_LEG_MINUTES = 30;
  const WALK_DAY_METERS = 8000;

  function assessLeg({walk, bus, availableMinutes}) {
    const walking = walk && Number.isFinite(walk.minutes) && Number.isFinite(walk.meters) ? walk : null;
    const transit = bus && Number.isFinite(bus.minutes) && bus.minutes > 0 && !bus.busAccessUnknown ? bus : null;
    const walkWithinLimit = walking && walking.meters <= WALK_LEG_METERS && walking.minutes <= WALK_LEG_MINUTES;
    if (walkWithinLimit) {
      if (walking.minutes > availableMinutes && transit && transit.minutes <= availableMinutes)
        return {mode:'bus',minutes:transit.minutes,meters:Number.isFinite(transit.walkMeters) ? transit.walkMeters : null,status:'check-bus'};
      return {mode:'walk',minutes:walking.minutes,meters:walking.meters,status:walking.minutes > availableMinutes ? 'short' : 'ok'};
    }
    if (transit) {
      return {mode:'bus',minutes:transit.minutes,meters:Number.isFinite(transit.walkMeters) ? transit.walkMeters : null,
        status:transit.minutes > availableMinutes ? 'short' : 'check-bus'};
    }
    if (walking) {
      return {mode:'walk',minutes:walking.minutes,meters:walking.meters,
        status:'over-walk-limit'};
    }
    return {mode:null,minutes:null,meters:null,status:'unknown'};
  }

  const api = {assessLeg,WALK_LEG_METERS,WALK_LEG_MINUTES,WALK_DAY_METERS};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.HangeoreumPlanAudit = api;
})();
