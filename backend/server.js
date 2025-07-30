const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 2851;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: parseInt(process.env.LOGIN_TIMEOUT) || 1800000,
    sameSite: 'strict'
  }
}));

app.use(limiter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', loginLimiter);

const authRoutes = require('./routes/auth');
const systemRoutes = require('./routes/system');
const firewallRoutes = require('./routes/firewall');
const usersRoutes = require('./routes/users');
const processesRoutes = require('./routes/processes');

app.use('/api/auth', authRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/firewall', firewallRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/processes', processesRoutes);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

let server;

if (process.env.SSL_CERT_PATH && process.env.SSL_KEY_PATH) {
  try {
    const options = {
      key: fs.readFileSync(process.env.SSL_KEY_PATH),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH)
    };
    server = https.createServer(options, app);
    console.log('HTTPS server configured');
  } catch (error) {
    console.warn('SSL certificates not found, falling back to HTTP');
    server = http.createServer(app);
  }
} else {
  server = http.createServer(app);
}

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000',
    credentials: true,
  },
});

const si = require('systeminformation');

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('subscribe-stats', () => {
    console.log('Client subscribed to stats:', socket.id);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const broadcastSystemStats = async () => {
  try {
    const [currentLoad, memory, fsStats, networkStats] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsStats(),
      si.networkStats()
    ]);

    const stats = {
      timestamp: Date.now(),
      cpu: {
        usage: currentLoad.currentLoad.toFixed(2),
        cores: currentLoad.cpus.map(cpu => ({
          load: cpu.load.toFixed(2)
        }))
      },
      memory: {
        total: memory.total,
        used: memory.used,
        free: memory.free,
        usage: ((memory.used / memory.total) * 100).toFixed(2)
      },
      disk: {
        rx_sec: fsStats.rx_sec || 0,
        wx_sec: fsStats.wx_sec || 0,
        tx_sec: fsStats.tx_sec || 0
      },
      network: networkStats.reduce((acc, iface) => {
        if (iface.iface !== 'lo') {
          acc.rx_sec += iface.rx_sec || 0;
          acc.tx_sec += iface.tx_sec || 0;
          acc.rx_bytes += iface.rx_bytes || 0;
          acc.tx_bytes += iface.tx_bytes || 0;
        }
        return acc;
      }, { rx_sec: 0, tx_sec: 0, rx_bytes: 0, tx_bytes: 0 })
    };

    io.emit('system-stats', stats);
  } catch (error) {
    console.error('Error broadcasting system stats:', error);
  }
};

setInterval(broadcastSystemStats, 2000);

server.listen(PORT, () => {
  console.log(`TimmiNet server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});