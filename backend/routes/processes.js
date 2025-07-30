const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const si = require('systeminformation');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const execAsync = promisify(exec);

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { sort = 'cpu', limit = 50 } = req.query;
    const processes = await si.processes();
    
    let sortedProcesses = processes.list;
    
    switch (sort) {
      case 'memory':
        sortedProcesses = processes.list.sort((a, b) => b.mem - a.mem);
        break;
      case 'name':
        sortedProcesses = processes.list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'pid':
        sortedProcesses = processes.list.sort((a, b) => a.pid - b.pid);
        break;
      case 'cpu':
      default:
        sortedProcesses = processes.list.sort((a, b) => b.cpu - a.cpu);
        break;
    }

    const processData = sortedProcesses
      .slice(0, parseInt(limit))
      .map(proc => ({
        pid: proc.pid,
        ppid: proc.ppid,
        name: proc.name,
        command: proc.command || proc.name,
        cpu: parseFloat(proc.cpu.toFixed(2)),
        mem: parseFloat(proc.mem.toFixed(2)),
        memVsz: proc.memVsz,
        memRss: proc.memRss,
        nice: proc.nice,
        started: proc.started,
        state: proc.state,
        tty: proc.tty,
        user: proc.user,
        priority: proc.priority
      }));

    res.json({
      total: processes.all,
      running: processes.running,
      blocked: processes.blocked,
      sleeping: processes.sleeping,
      processes: processData,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Get processes error:', error);
    res.status(500).json({ error: 'Failed to get process list' });
  }
});

router.get('/:pid', async (req, res) => {
  try {
    const pid = parseInt(req.params.pid);
    
    if (isNaN(pid)) {
      return res.status(400).json({ error: 'Invalid PID' });
    }

    const [processInfo, processLoad] = await Promise.all([
      si.processLoad(pid),
      si.processes()
    ]);

    const process = processLoad.proc || processInfo;
    const processList = processLoad.processes || [];
    
    const detailedProcess = processList.find(p => p.pid === pid);

    if (!detailedProcess && !process) {
      return res.status(404).json({ error: 'Process not found' });
    }

    const result = detailedProcess || process;

    res.json({
      pid: result.pid,
      ppid: result.ppid,
      name: result.name,
      command: result.command,
      cpu: result.cpu,
      mem: result.mem,
      memVsz: result.memVsz,
      memRss: result.memRss,
      nice: result.nice,
      started: result.started,
      state: result.state,
      tty: result.tty,
      user: result.user,
      priority: result.priority,
      threads: result.threads
    });

  } catch (error) {
    console.error('Get process error:', error);
    res.status(500).json({ error: 'Failed to get process details' });
  }
});

router.post('/:pid/kill', requireAdmin, async (req, res) => {
  try {
    const pid = parseInt(req.params.pid);
    const { signal = 'TERM' } = req.body;
    
    if (isNaN(pid) || pid <= 0) {
      return res.status(400).json({ error: 'Invalid PID' });
    }

    if (pid === 1) {
      return res.status(403).json({ error: 'Cannot kill init process' });
    }

    const validSignals = ['TERM', 'KILL', 'HUP', 'INT', 'QUIT', 'USR1', 'USR2'];
    if (!validSignals.includes(signal)) {
      return res.status(400).json({ error: 'Invalid signal' });
    }

    try {
      const { stdout } = await execAsync(`ps -p ${pid} -o pid,comm --no-headers`);
      if (!stdout.trim()) {
        return res.status(404).json({ error: 'Process not found' });
      }
    } catch (error) {
      return res.status(404).json({ error: 'Process not found' });
    }

    await execAsync(`kill -${signal} ${pid}`);
    
    res.json({ 
      message: `Signal ${signal} sent to process ${pid}`,
      pid,
      signal
    });

  } catch (error) {
    console.error('Kill process error:', error);
    if (error.message.includes('No such process')) {
      return res.status(404).json({ error: 'Process not found' });
    }
    if (error.message.includes('Operation not permitted')) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    res.status(500).json({ error: 'Failed to kill process' });
  }
});

router.get('/user/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const processes = await si.processes();
    const userProcesses = processes.list
      .filter(proc => proc.user === username)
      .sort((a, b) => b.cpu - a.cpu)
      .map(proc => ({
        pid: proc.pid,
        ppid: proc.ppid,
        name: proc.name,
        command: proc.command,
        cpu: parseFloat(proc.cpu.toFixed(2)),
        mem: parseFloat(proc.mem.toFixed(2)),
        started: proc.started,
        state: proc.state,
        nice: proc.nice
      }));

    res.json({
      username,
      processCount: userProcesses.length,
      processes: userProcesses,
      totalCpu: userProcesses.reduce((sum, proc) => sum + proc.cpu, 0).toFixed(2),
      totalMem: userProcesses.reduce((sum, proc) => sum + proc.mem, 0).toFixed(2)
    });

  } catch (error) {
    console.error('Get user processes error:', error);
    res.status(500).json({ error: 'Failed to get user processes' });
  }
});

router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 20 } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const processes = await si.processes();
    const searchResults = processes.list
      .filter(proc => 
        proc.name.toLowerCase().includes(query.toLowerCase()) ||
        proc.command.toLowerCase().includes(query.toLowerCase()) ||
        proc.user.toLowerCase().includes(query.toLowerCase())
      )
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, parseInt(limit))
      .map(proc => ({
        pid: proc.pid,
        ppid: proc.ppid,
        name: proc.name,
        command: proc.command,
        cpu: parseFloat(proc.cpu.toFixed(2)),
        mem: parseFloat(proc.mem.toFixed(2)),
        started: proc.started,
        state: proc.state,
        user: proc.user
      }));

    res.json({
      query,
      resultCount: searchResults.length,
      processes: searchResults
    });

  } catch (error) {
    console.error('Search processes error:', error);
    res.status(500).json({ error: 'Failed to search processes' });
  }
});

router.get('/stats/summary', async (req, res) => {
  try {
    const [processes, services] = await Promise.all([
      si.processes(),
      execAsync('systemctl list-units --type=service --state=running --no-pager').catch(() => ({ stdout: '' }))
    ]);

    const serviceLines = services.stdout.split('\n').filter(line => 
      line.includes('.service') && line.includes('loaded') && line.includes('active')
    );

    const topProcesses = processes.list
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 5)
      .map(proc => ({
        name: proc.name,
        cpu: parseFloat(proc.cpu.toFixed(2)),
        mem: parseFloat(proc.mem.toFixed(2)),
        pid: proc.pid
      }));

    const memoryTopProcesses = processes.list
      .sort((a, b) => b.mem - a.mem)
      .slice(0, 5)
      .map(proc => ({
        name: proc.name,
        cpu: parseFloat(proc.cpu.toFixed(2)),
        mem: parseFloat(proc.mem.toFixed(2)),
        pid: proc.pid
      }));

    res.json({
      processStats: {
        total: processes.all,
        running: processes.running,
        sleeping: processes.sleeping,
        blocked: processes.blocked
      },
      serviceStats: {
        running: serviceLines.length
      },
      topByCpu: topProcesses,
      topByMemory: memoryTopProcesses,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Get process stats error:', error);
    res.status(500).json({ error: 'Failed to get process statistics' });
  }
});

module.exports = router;