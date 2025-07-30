const express = require('express');
const si = require('systeminformation');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

router.get('/info', async (req, res) => {
  try {
    const [osInfo, system, cpu, mem, disk, networkStats] = await Promise.all([
      si.osInfo(),
      si.system(),
      si.cpu(),
      si.mem(),
      si.fsSize(),
      si.networkStats()
    ]);

    res.json({
      os: {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        kernel: osInfo.kernel,
        arch: osInfo.arch,
        hostname: osInfo.hostname,
        uptime: osInfo.uptime
      },
      system: {
        manufacturer: system.manufacturer,
        model: system.model,
        version: system.version
      },
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        speed: cpu.speed
      },
      memory: {
        total: mem.total,
        free: mem.free,
        used: mem.used,
        available: mem.available,
        usage: ((mem.used / mem.total) * 100).toFixed(2)
      },
      storage: disk.map(d => ({
        fs: d.fs,
        type: d.type,
        size: d.size,
        used: d.used,
        available: d.available,
        usage: d.use,
        mount: d.mount
      })),
      network: networkStats.map(n => ({
        iface: n.iface,
        rx_bytes: n.rx_bytes,
        tx_bytes: n.tx_bytes,
        rx_sec: n.rx_sec,
        tx_sec: n.tx_sec
      }))
    });
  } catch (error) {
    console.error('System info error:', error);
    res.status(500).json({ error: 'Failed to get system information' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const [currentLoad, memory, fsStats, networkStats] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsStats(),
      si.networkStats()
    ]);

    res.json({
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
        tx_sec: fsStats.tx_sec || 0,
        rx: fsStats.rx || 0,
        wx: fsStats.wx || 0,
        tx: fsStats.tx || 0
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
    });
  } catch (error) {
    console.error('System stats error:', error);
    res.status(500).json({ error: 'Failed to get system stats' });
  }
});

router.get('/processes', async (req, res) => {
  try {
    const processes = await si.processes();
    
    const processData = processes.list
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 50)
      .map(proc => ({
        pid: proc.pid,
        ppid: proc.ppid,
        name: proc.name,
        command: proc.command,
        cpu: proc.cpu,
        mem: proc.mem,
        state: proc.state,
        started: proc.started,
        user: proc.user
      }));

    res.json({
      total: processes.all,
      running: processes.running,
      blocked: processes.blocked,
      sleeping: processes.sleeping,
      processes: processData
    });
  } catch (error) {
    console.error('Processes error:', error);
    res.status(500).json({ error: 'Failed to get process information' });
  }
});

module.exports = router;