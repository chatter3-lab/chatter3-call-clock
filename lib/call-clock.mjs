/**
 * The clock of a call.
 *
 * A call starts when both people have said they are ready. Until then the
 * timer stands still at the full length: the time spent on the pre-call
 * screen and the time spent waiting for a partner who is slow are not
 * conversation, and they must not be taken out of the call.
 *
 * The clock of the server is the truth. Two phones do not have the same
 * time, and a countdown that is three seconds off ends at a different
 * moment on each side -- so the difference between the two clocks is
 * worked out once and then carried along.
 */

// A moment of the server, as the number of milliseconds since the epoch.
//
// The server writes its timestamps as 'YYYY-MM-DD HH:MM:SS' in UTC, without
// a timezone marker. A phone that reads that as its own local time is off
// by the difference between the two zones.
export const parseServerTimestamp = (raw) => {
  if (raw === null || raw === undefined || raw === '') return NaN;
  if (typeof raw === 'number') return raw > 1e12 ? raw : raw * 1000;
  const s = String(raw).trim();
  if (!s) return NaN;
  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  const zoned = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z';
  const ms = Date.parse(zoned);
  return isNaN(ms) ? NaN : ms;
};

// The clock of one side of a call.
//
// It is a plain object and not a React hook on purpose: the timer has to
// be read from a callback and from a timer, and a state update is not
// guaranteed to have been applied by then.
export function createCallClock(total) {
  return {
    total,
    // The moment the call started, in the clock of this phone.
    startMs: null,
    // The difference between the clock of this phone and the clock of the
    // server.
    skewMs: 0,

    // The answer of the server: the moment the call started and the time
    // of the server at that moment.
    start(serverTimestamp, serverTimeMs, clientNow) {
      const now = typeof clientNow === 'number' ? clientNow : Date.now();
      if (typeof serverTimeMs === 'number') this.skewMs = serverTimeMs - now;
      const ms = parseServerTimestamp(serverTimestamp);
      if (isNaN(ms)) return false;
      // The start of the call is written in the clock of the server, so
      // it has to be carried over into the clock of this phone. The
      // difference between the two clocks is the opposite way round: the
      // answer of the server is the time of the server, and this phone
      // reads its own clock, so skew = server - phone, and the start of
      // the call is phone = server - skew.
      this.startMs = ms - this.skewMs;
      return true;
    },

    // How long the call has been going on. Zero while it has not started.
    //
    // Both numbers are in the clock of this phone: the start of the call
    // was carried over into it, and "now" is the clock of this phone.
    elapsedMs(clientNow) {
      if (this.startMs === null) return 0;
      const now = typeof clientNow === 'number' ? clientNow : Date.now();
      return Math.max(0, now - this.startMs);
    },

    // How much of the call is left. The full length while it has not
    // started -- the timer stands still.
    remainingSeconds(clientNow) {
      if (this.startMs === null) return this.total;
      const el = Math.floor(this.elapsedMs(clientNow) / 1000);
      return Math.max(0, this.total - el);
    },

    // The length of the conversation, for the card that is shared
    // afterwards.
    talkSeconds(clientNow) {
      return Math.floor(this.elapsedMs(clientNow) / 1000);
    },
  };
}
