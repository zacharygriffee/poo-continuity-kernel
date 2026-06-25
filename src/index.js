const continuity = require("./continuity");
const happenings = require("./happenings");
const referents = require("./referents");
const receipts = require("./receipts");
const rbc = require("./rbc");
const projection = require("./projection");
const seatMapDomain = require("./seat-map-domain");
const checkpoints = require("./checkpoints");
const seeds = require("./seeds");
const joins = require("./joins");
const segments = require("./segments");
const rbcCompatibility = require("./rbc-compatibility");
const topology = require("./topology");
const blends = require("./blends");
const ids = require("./ids");
const storage = require("./storage");
const memoryAdapter = require("../adapters/memory");
let localStorageAdapter;
try {
  localStorageAdapter = require("../adapters/localstorage");
} catch (error) {
  localStorageAdapter = null;
}
let fsAdapter;
try {
  fsAdapter = require("../adapters/fs");
} catch (error) {
  fsAdapter = null;
}

module.exports = {
  core: {
    ...continuity,
    ...happenings,
    ...referents,
    ...ids,
  },
  receipts,
  rbc,
  projection,
  checkpoints,
  seeds,
  joins,
  segments,
  rbcCompatibility,
  topology,
  experimental: {
    blends,
  },
  storage,
  domains: {
    seatMap: seatMapDomain,
  },
  adapters: {
    memory: memoryAdapter,
    localstorage: localStorageAdapter,
    fs: fsAdapter,
  },
};

module.exports.createObserver = referents.createObserver;
module.exports.createContinuity = continuity.createContinuity;
module.exports.createHappening = happenings.createHappening;
module.exports.appendAdmittedHappening = continuity.appendAdmittedHappening;
module.exports.evaluateAdmittance = continuity.evaluateAdmittance;
module.exports.deriveState = continuity.deriveState;
module.exports.admittedReceipt = receipts.admittedReceipt;
module.exports.rejectedReceipt = receipts.rejectedReceipt;
module.exports.deferredReceipt = receipts.deferredReceipt;
