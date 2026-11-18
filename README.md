# call-clock

A call timer that starts when **both** people are ready — and that two phones
with different clocks agree on.

This is the clock from [Chatter3](https://app.chatter3.com), a free 1-on-1
English conversation app, extracted because it is small, self-contained, and
the kind of thing every video-call app gets wrong.

The full engineering write-up of where this came from — six production bugs in
a WebRTC app, with the tests that keep them fixed — is at
<https://chatter3-lab.github.io/>.

## The two problems it solves

**1. The timer started before the call did.**

A countdown that begins at the moment two people are matched charges them for
the pre-call screen and for waiting for a partner who is slow. Neither is
conversation. Here the clock is *standing still* until the server says the
call has started:

```js
const clock = createCallClock(300); // a five-minute call
clock.remainingSeconds(); // 300 -- not 299, not 288: the full length
```

A call that has not started can never run out of time, however long you wait.

**2. Two phones counted down to different seconds.**

Phones do not agree on the time. A phone four seconds ahead and a phone seven
seconds behind will end a call at two different moments unless the difference
is worked out. The server owns the truth: it sends the moment the call started
*and* its own clock at that moment, and the client works out the difference
once and carries it along.

```js
const serverStart = Date.parse('2026-11-16T13:13:08Z');

const ahead = createCallClock(300);
const behind = createCallClock(300);

// The server says the same thing to both phones; only their own clocks differ.
ahead.start('2026-11-16 13:13:08', serverStart, serverStart + 4000);
behind.start('2026-11-16 13:13:08', serverStart, serverStart);

// Both ask at the same moment of the clock of the server.
const nowBehind = serverStart + 10000;
const nowAhead = serverStart + 10000 + 4000;

ahead.remainingSeconds(nowAhead); // 290
behind.remainingSeconds(nowBehind); // 290 -- the same second
```

The sign matters, and it is the sign that is easy to get wrong: `skew =
server - phone`, and the start of the call in the clock of the phone is
`server - skew`. Adding instead of subtracting makes a phone that is ahead
count down four seconds too fast.

## Install

```sh
npm install chatter3-call-clock
```

No dependencies. It is one `.mjs` file and it runs in Node 18+, in a browser,
and in a React Native app.

## Use

```js
import { createCallClock, parseServerTimestamp } from 'chatter3-call-clock';

const clock = createCallClock(300);

// The server answers a readiness poll with the start of the call and its
// own time. Start the clock from that answer, never from a local timer.
const res = await fetch('/api/matching/ready', { method: 'POST' });
const d = await res.json();
clock.start(d.call_started_at, d.server_time_ms);

// Read it from wherever you render.
setInterval(() => {
  render(clock.remainingSeconds(), clock.talkSeconds());
}, 250);
```

### `createCallClock(totalSeconds)`

Returns a plain object. It is deliberately **not** a React hook: the timer has
to be readable from a timer callback and from a socket handler, and a state
update is not guaranteed to have been applied by then.

| Member | What it does |
| --- | --- |
| `start(serverTimestamp, serverTimeMs, clientNow?)` | Starts the clock from the server's answer. Returns `false` if the timestamp is unusable, in which case the clock stays still. |
| `remainingSeconds(clientNow?)` | Seconds left. The full length until the call has started. |
| `elapsedMs(clientNow?)` | Milliseconds since the call started. `0` until it has. |
| `talkSeconds(clientNow?)` | Whole seconds of actual conversation, for the summary shown afterwards. |

Every method takes an optional `clientNow`, so the clock can be driven by an
injected clock in a test.

### `parseServerTimestamp(raw)`

Reads the timestamps a server is likely to send:

- `'2026-11-16 13:13:08'` — UTC **without** a timezone marker. A phone that
  reads this as local time is off by the difference between the two zones.
- `'2026-11-16T13:13:08.000Z'` — ISO 8601 with a zone.
- A number — milliseconds, or seconds if the number is small enough to be
  seconds.

Returns `NaN` for anything it cannot read. `NaN` is a value you can check;
`new Date('nonsense')` gives you an `Invalid Date` that quietly compares false
to everything.

## Test

```sh
npm test
```

The tests are the real ones from the app, including the two-phone case that
caught the sign error.

## Why

The clock came out of a bug report that said the timer was wrong. It was —
in two different ways at once, and the second one only showed up once two
phones were compared against each other rather than against the expected
answer. Both are written up with the rest in
[the engineering notes](https://chatter3-lab.github.io/).

The app itself is free: <https://app.chatter3.com>

## Licence

MIT. See [LICENSE](LICENSE).
