// /utils/captureScheduler.js
const { capturarYEvaluar } = require('./monitor');

const state = {
  enabled: false,
  intervalSec: Number(process.env.CAPTURE_EVERY_SEC || 60),
  timer: null,
  running: false,
  runs: 0,
  lastRunAt: null,
  lastOkAt: null,
  lastErrorAt: null,
  lastError: null,
};

function getStatus() {
  return {
    enabled: state.enabled,
    intervalSec: state.intervalSec,
    running: state.running,
    runs: state.runs,
    lastRunAt: state.lastRunAt,
    lastOkAt: state.lastOkAt,
    lastErrorAt: state.lastErrorAt,
    lastError: state.lastError ? String(state.lastError) : null,
  };
}

async function tick(pool) {
  if (state.running) return; // evita solapamiento
  state.running = true;
  state.lastRunAt = new Date().toISOString();
  try {
    await capturarYEvaluar(pool);
    state.runs += 1;
    state.lastOkAt = new Date().toISOString();
    state.lastError = null;
  } catch (err) {
    state.lastError = err.message || String(err);
    state.lastErrorAt = new Date().toISOString();
    console.error('[scheduler] tick error:', err);
  } finally {
    state.running = false;
  }
}

function start(pool) {
  if (state.enabled) return getStatus();
  const ms = Math.max(5, Number(state.intervalSec)) * 1000;
  state.timer = setInterval(() => tick(pool), ms);
  state.enabled = true;
  tick(pool); // corrida inmediata
  return getStatus();
}

function stop() {
  if (!state.enabled) return getStatus();
  clearInterval(state.timer);
  state.timer = null;
  state.enabled = false;
  return getStatus();
}

function setIntervalSec(sec, pool) {
  const n = Math.max(5, Number(sec || 60));
  state.intervalSec = n;
  if (state.enabled) { stop(); start(pool); }
  return getStatus();
}

module.exports = { start, stop, setIntervalSec, getStatus };
