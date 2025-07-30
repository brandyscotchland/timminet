const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const User = require('../models/User');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const execAsync = promisify(exec);

router.use(requireAuth);

const sanitizeInput = (input) => {
  return input.replace(/[;&|`$(){}[\]\\]/g, '');
};

router.get('/', requireAdmin, async (req, res) => {
  try {
    const users = await User.loadUsers();
    const userList = Object.values(users).map(user => ({
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      loginAttempts: user.loginAttempts,
      lockedUntil: user.lockedUntil
    }));

    res.json({ users: userList });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { username, password, role = 'user' } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }

    if (!User.validatePassword(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 12 characters long and contain uppercase, lowercase, numbers, and symbols' 
      });
    }

    const validRoles = ['user', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.create(username, password, role);
    res.status(201).json({ 
      message: 'User created successfully',
      user: user.toJSON()
    });

  } catch (error) {
    console.error('Create user error:', error);
    if (error.message === 'User already exists') {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/:username', requireAdmin, async (req, res) => {
  try {
    const { username } = req.params;
    const { role, isActive } = req.body;

    if (username === req.user.username) {
      return res.status(400).json({ error: 'Cannot modify your own account' });
    }

    const users = await User.loadUsers();
    if (!users[username]) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (role !== undefined) {
      const validRoles = ['user', 'admin'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      users[username].role = role;
    }

    if (isActive !== undefined) {
      users[username].isActive = Boolean(isActive);
    }

    await User.saveUsers(users);

    res.json({ 
      message: 'User updated successfully',
      user: {
        username: users[username].username,
        role: users[username].role,
        isActive: users[username].isActive,
        createdAt: users[username].createdAt,
        lastLogin: users[username].lastLogin
      }
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/:username', requireAdmin, async (req, res) => {
  try {
    const { username } = req.params;

    if (username === req.user.username) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const users = await User.loadUsers();
    if (!users[username]) {
      return res.status(404).json({ error: 'User not found' });
    }

    delete users[username];
    await User.saveUsers(users);

    res.json({ message: 'User deleted successfully' });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.post('/:username/unlock', requireAdmin, async (req, res) => {
  try {
    const { username } = req.params;

    const users = await User.loadUsers();
    if (!users[username]) {
      return res.status(404).json({ error: 'User not found' });
    }

    users[username].loginAttempts = 0;
    users[username].lockedUntil = null;
    await User.saveUsers(users);

    res.json({ message: 'User unlocked successfully' });

  } catch (error) {
    console.error('Unlock user error:', error);
    res.status(500).json({ error: 'Failed to unlock user' });
  }
});

router.get('/system-users', requireAdmin, async (req, res) => {
  try {
    const { stdout: passwdOutput } = await execAsync('cat /etc/passwd');
    const { stdout: shadowOutput } = await execAsync('getent shadow');
    
    const passwdLines = passwdOutput.split('\n').filter(line => line.trim());
    const shadowLines = shadowOutput.split('\n').filter(line => line.trim());
    
    const shadowMap = {};
    shadowLines.forEach(line => {
      const parts = line.split(':');
      if (parts.length >= 9) {
        shadowMap[parts[0]] = {
          lastChanged: parts[2],
          minDays: parts[3],
          maxDays: parts[4],
          warnDays: parts[5],
          inactive: parts[6],
          expire: parts[7]
        };
      }
    });

    const systemUsers = passwdLines.map(line => {
      const parts = line.split(':');
      if (parts.length >= 7) {
        const username = parts[0];
        const uid = parseInt(parts[2]);
        const gid = parseInt(parts[3]);
        const home = parts[5];
        const shell = parts[6];
        
        return {
          username,
          uid,
          gid,
          home,
          shell,
          shadowInfo: shadowMap[username] || null,
          isSystemUser: uid < 1000
        };
      }
      return null;
    }).filter(user => user !== null);

    const regularUsers = systemUsers.filter(user => !user.isSystemUser && user.shell !== '/usr/sbin/nologin' && user.shell !== '/bin/false');

    res.json({ 
      systemUsers: regularUsers,
      total: regularUsers.length 
    });

  } catch (error) {
    console.error('Get system users error:', error);
    res.status(500).json({ error: 'Failed to get system users' });
  }
});

router.get('/sessions', requireAdmin, async (req, res) => {
  try {
    const { stdout: whoOutput } = await execAsync('who -u');
    const { stdout: lastOutput } = await execAsync('last -n 20');
    
    const activeSessionsLines = whoOutput.split('\n').filter(line => line.trim());
    const activeSessions = activeSessionsLines.map(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        return {
          user: parts[0],
          terminal: parts[1],
          date: parts[2],
          time: parts[3],
          pid: parts[4] ? parts[4].replace(/[()]/g, '') : '',
          from: parts[5] || 'local'
        };
      }
      return null;
    }).filter(session => session !== null);

    const lastSessionsLines = lastOutput.split('\n').filter(line => line.trim() && !line.includes('wtmp begins'));
    const lastSessions = lastSessionsLines.map(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 7) {
        return {
          user: parts[0],
          terminal: parts[1],
          from: parts[2],
          startDate: parts[3],
          startTime: parts[4],
          endDate: parts[5] === 'still' ? 'still logged in' : parts[5],
          endTime: parts[6] === 'logged' ? 'logged in' : parts[6],
          duration: parts[7] || ''
        };
      }
      return null;
    }).filter(session => session !== null);

    res.json({ 
      activeSessions,
      lastSessions: lastSessions.slice(0, 20)
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to get user sessions' });
  }
});

module.exports = router;