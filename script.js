const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();

app.use(bodyParser.json());

// Serve homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check
app.get('/ping', (req, res) => {
  res.send('pong');
});

// In-memory seat store
const seats = {};
const LOCK_DURATION_MS = 60 * 1000; // 1 minute

// Initialize 10 seats: S1 to S10
for (let i = 1; i <= 10; i++) {
  seats[`S${i}`] = {
    status: 'available', // available | locked | booked
    lockedBy: null,
    lockTime: null
  };
}

// Expire stale locks
function expireLocks() {
  const now = Date.now();
  for (const seatId in seats) {
    const seat = seats[seatId];
    if (seat.status === 'locked' && now - seat.lockTime > LOCK_DURATION_MS) {
      seat.status = 'available';
      seat.lockedBy = null;
      seat.lockTime = null;
    }
  }
}

// View all seats
app.get('/api/seats', (req, res) => {
  expireLocks();
  res.json(seats);
});

// Lock a seat
app.post('/api/lock', (req, res) => {
  expireLocks();
  const { seatId, userId } = req.body;
  const seat = seats[seatId];

  if (!seat) return res.status(400).json({ error: 'Invalid seat ID' });
  if (seat.status === 'booked') return res.status(400).json({ error: 'Seat already booked' });
  if (seat.status === 'locked') return res.status(400).json({ error: 'Seat is locked by another user' });

  seat.status = 'locked';
  seat.lockedBy = userId;
  seat.lockTime = Date.now();

  console.log(`[${new Date().toISOString()}] ${userId} locked seat ${seatId}`);
  res.json({
    status: 'success',
    data: {
      seatId,
      action: 'locked',
      userId,
      timestamp: new Date().toISOString()
    }
  });
});

// Confirm booking
app.post('/api/confirm', (req, res) => {
  expireLocks();
  const { seatId, userId } = req.body;
  const seat = seats[seatId];

  if (!seat) return res.status(400).json({ error: 'Invalid seat ID' });
  if (seat.status !== 'locked') return res.status(400).json({ error: 'Seat is not locked' });
  if (seat.lockedBy !== userId) return res.status(400).json({ error: 'Seat is locked by another user' });

  seat.status = 'booked';
  seat.lockedBy = null;
  seat.lockTime = null;

  console.log(`[${new Date().toISOString()}] ${userId} booked seat ${seatId}`);
  res.json({
    status: 'success',
    data: {
      seatId,
      action: 'booked',
      userId,
      timestamp: new Date().toISOString()
    }
  });
});

// Unlock a seat
app.put('/api/unlock/:seatId', (req, res) => {
  expireLocks();
  const seatId = req.params.seatId;
  const { userId } = req.body;
  const seat = seats[seatId];

  if (!seat) return res.status(400).json({ error: 'Invalid seat ID' });
  if (seat.status !== 'locked' || seat.lockedBy !== userId) {
    return res.status(400).json({ error: 'Seat not locked by this user' });
  }

  seat.status = 'available';
  seat.lockedBy = null;
  seat.lockTime = null;

  console.log(`[${new Date().toISOString()}] ${userId} unlocked seat ${seatId}`);
  res.json({
    status: 'success',
    data: {
      seatId,
      action: 'unlocked',
      userId,
      timestamp: new Date().toISOString()
    }
  });
});

// Cancel a booking
app.post('/api/cancel', (req, res) => {
  expireLocks();
  const { seatId, userId } = req.body;
  const seat = seats[seatId];

  if (!seat) return res.status(400).json({ error: 'Invalid seat ID' });
  if (seat.status !== 'booked') return res.status(400).json({ error: 'Seat is not booked' });

  seat.status = 'available';
  seat.lockedBy = null;
  seat.lockTime = null;

  console.log(`[${new Date().toISOString()}] ${userId} cancelled booking for seat ${seatId}`);
  res.json({
    status: 'success',
    data: {
      seatId,
      action: 'cancelled',
      userId,
      timestamp: new Date().toISOString()
    }
  });
});

// Check status of a specific seat
app.get('/api/status/:seatId', (req, res) => {
  expireLocks();
  const seat = seats[req.params.seatId];
  if (!seat) return res.status(404).json({ error: 'Seat not found' });
  res.json(seat);
});

// Start server
const port = 3000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
