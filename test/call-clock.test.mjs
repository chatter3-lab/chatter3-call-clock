import test from 'node:test';
import assert from 'node:assert/strict';
import { createCallClock, parseServerTimestamp } from '../lib/call-clock.mjs';

test('a timestamp of the server is UTC without a zone', () => {
  // The server writes its timestamps as 'YYYY-MM-DD HH:MM:SS' in UTC,
  // without a timezone marker. A phone that reads that as its own local
  // time is off by the difference between the two zones.
  assert.equal(
    parseServerTimestamp('2026-11-16 13:13:08'),
    Date.parse('2026-11-16T13:13:08Z'),
    'a timestamp of SQLite is not read as UTC'
  );
  assert.equal(
    parseServerTimestamp('2026-11-16T13:13:08.000Z'),
    Date.parse('2026-11-16T13:13:08.000Z'),
    'a timestamp of the browser is not read'
  );
  assert.equal(parseServerTimestamp(1763295188000), 1763295188000,
    'a number is not read as a moment');
  assert.ok(isNaN(parseServerTimestamp('')), 'an empty timestamp is a moment');
  assert.ok(isNaN(parseServerTimestamp(null)), 'a missing timestamp is a moment');
  assert.ok(isNaN(parseServerTimestamp('not a date')), 'a broken timestamp is a moment');
});

test('the timer does not run before the call has started', () => {
  const clock = createCallClock(300);
  assert.equal(clock.remainingSeconds(), 300,
    'the timer does not stand still at the full length');
  assert.equal(clock.remainingSeconds(Date.now() + 60000), 300,
    'the timer runs while the call has not started');
  assert.equal(clock.elapsedMs(), 0,
    'a call that has not started has no length');
});

test('the timer counts from the start of the call', () => {
  const clock = createCallClock(300);
  const start = Date.parse('2026-11-16T13:13:08Z');
  // The server answers with the start of the call and its own time.
  assert.equal(clock.start('2026-11-16 13:13:08', start + 1234, start + 1234), true,
    'the start of the call is not read');
  // The timestamp of the server has no milliseconds, so the start of the
  // call is the beginning of that second: a second and a bit after it,
  // one second has already gone.
  assert.equal(clock.remainingSeconds(start + 1234), 299,
    'the timer does not start at the full length');
  assert.equal(clock.remainingSeconds(start + 1234 + 65000), 234,
    'the timer is not counted from the start of the call');
  assert.equal(clock.talkSeconds(start + 1234 + 65000), 66,
    'the length of the conversation is not measured from the start of the call');
});

test('the two clocks of the two phones are put right', () => {
  // The phone of one side is four seconds ahead of the phone of the
  // other side. Both have to count down to the same moment.
  const serverStart = Date.parse('2026-11-16T13:13:08Z');
  const ahead = createCallClock(300);
  const behind = createCallClock(300);
  // The server says the same thing to both phones; the phone that is
  // ahead has its own clock four seconds further on.
  ahead.start('2026-11-16 13:13:08', serverStart, serverStart + 4000);
  behind.start('2026-11-16 13:13:08', serverStart, serverStart);
  // Both ask at the same moment of the clock of the server.
  const nowBehind = serverStart + 10000;
  const nowAhead = serverStart + 10000 + 4000;
  assert.equal(ahead.remainingSeconds(nowAhead), behind.remainingSeconds(nowBehind),
    'the two sides do not count down to the same second');
  assert.equal(ahead.remainingSeconds(nowAhead), 290,
    'the countdown of the phone that is ahead is wrong');
  assert.equal(behind.remainingSeconds(nowBehind), 290,
    'the countdown of the phone that is behind is wrong');
  // And the same holds the other way round: a phone that is behind.
  const late = createCallClock(300);
  late.start('2026-11-16 13:13:08', serverStart, serverStart - 7000);
  assert.equal(late.remainingSeconds(nowBehind - 7000), 290,
    'the countdown of the phone that is behind is wrong');
});

test('a call that has not started never ends by itself', () => {
  const clock = createCallClock(300);
  // The timer of a call that has not started stands still, so it can
  // never reach zero -- not after an hour, not after a day.
  assert.equal(clock.remainingSeconds(Date.now() + 86400000), 300,
    'a call that has not started runs out of time');
});

test('a broken answer does not start the clock', () => {
  const clock = createCallClock(300);
  assert.equal(clock.start('not a date', Date.now(), Date.now()), false,
    'a broken timestamp starts the call');
  assert.equal(clock.remainingSeconds(), 300,
    'the timer runs after a broken answer');
});
