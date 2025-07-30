const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const execAsync = promisify(exec);

router.use(requireAuth);

const sanitizeInput = (input) => {
  return input.replace(/[;&|`$(){}[\]\\]/g, '');
};

router.get('/status', async (req, res) => {
  try {
    const { stdout } = await execAsync('ufw status verbose');
    
    const lines = stdout.split('\n');
    const isActive = lines[0].includes('active');
    
    const rules = [];
    let inRulesSection = false;
    
    for (const line of lines) {
      if (line.includes('-----')) {
        inRulesSection = true;
        continue;
      }
      
      if (inRulesSection && line.trim()) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          rules.push({
            port: parts[0],
            action: parts[1],
            from: parts[2] || 'Anywhere',
            protocol: parts[3] || '',
            comment: parts.slice(4).join(' ') || ''
          });
        }
      }
    }

    res.json({
      active: isActive,
      rules: rules,
      raw: stdout
    });

  } catch (error) {
    console.error('UFW status error:', error);
    res.status(500).json({ error: 'Failed to get firewall status' });
  }
});

router.get('/rules', async (req, res) => {
  try {
    const { stdout } = await execAsync('ufw status numbered');
    
    const lines = stdout.split('\n');
    const rules = [];
    
    for (const line of lines) {
      const match = line.match(/^\[\s*(\d+)\]\s+(.+)/);
      if (match) {
        const ruleNumber = match[1];
        const ruleText = match[2].trim();
        
        rules.push({
          number: parseInt(ruleNumber),
          rule: ruleText,
          raw: line.trim()
        });
      }
    }

    res.json({ rules });

  } catch (error) {
    console.error('UFW rules error:', error);
    res.status(500).json({ error: 'Failed to get firewall rules' });
  }
});

router.post('/enable', requireAdmin, async (req, res) => {
  try {
    const { stdout } = await execAsync('echo "y" | ufw enable');
    res.json({ 
      message: 'Firewall enabled successfully',
      output: stdout
    });

  } catch (error) {
    console.error('UFW enable error:', error);
    res.status(500).json({ error: 'Failed to enable firewall' });
  }
});

router.post('/disable', requireAdmin, async (req, res) => {
  try {
    const { stdout } = await execAsync('ufw disable');
    res.json({ 
      message: 'Firewall disabled successfully',
      output: stdout
    });

  } catch (error) {
    console.error('UFW disable error:', error);
    res.status(500).json({ error: 'Failed to disable firewall' });
  }
});

router.post('/reset', requireAdmin, async (req, res) => {
  try {
    const { stdout } = await execAsync('echo "y" | ufw --force reset');
    res.json({ 
      message: 'Firewall reset successfully',
      output: stdout
    });

  } catch (error) {
    console.error('UFW reset error:', error);
    res.status(500).json({ error: 'Failed to reset firewall' });
  }
});

router.post('/allow', requireAdmin, async (req, res) => {
  try {
    const { port, protocol = '', from = '' } = req.body;
    
    if (!port) {
      return res.status(400).json({ error: 'Port is required' });
    }

    const sanitizedPort = sanitizeInput(port.toString());
    const sanitizedProtocol = protocol ? sanitizeInput(protocol) : '';
    const sanitizedFrom = from ? sanitizeInput(from) : '';
    
    let command = `ufw allow ${sanitizedPort}`;
    if (sanitizedProtocol) {
      command += `/${sanitizedProtocol}`;
    }
    if (sanitizedFrom) {
      command += ` from ${sanitizedFrom}`;
    }

    const { stdout } = await execAsync(command);
    res.json({ 
      message: `Rule added successfully`,
      output: stdout
    });

  } catch (error) {
    console.error('UFW allow error:', error);
    res.status(500).json({ error: 'Failed to add allow rule' });
  }
});

router.post('/deny', requireAdmin, async (req, res) => {
  try {
    const { port, protocol = '', from = '' } = req.body;
    
    if (!port) {
      return res.status(400).json({ error: 'Port is required' });
    }

    const sanitizedPort = sanitizeInput(port.toString());
    const sanitizedProtocol = protocol ? sanitizeInput(protocol) : '';
    const sanitizedFrom = from ? sanitizeInput(from) : '';
    
    let command = `ufw deny ${sanitizedPort}`;
    if (sanitizedProtocol) {
      command += `/${sanitizedProtocol}`;
    }
    if (sanitizedFrom) {
      command += ` from ${sanitizedFrom}`;
    }

    const { stdout } = await execAsync(command);
    res.json({ 
      message: `Deny rule added successfully`,
      output: stdout
    });

  } catch (error) {
    console.error('UFW deny error:', error);
    res.status(500).json({ error: 'Failed to add deny rule' });
  }
});

router.delete('/rule/:number', requireAdmin, async (req, res) => {
  try {
    const ruleNumber = parseInt(req.params.number);
    
    if (isNaN(ruleNumber) || ruleNumber < 1) {
      return res.status(400).json({ error: 'Invalid rule number' });
    }

    const { stdout } = await execAsync(`echo "y" | ufw delete ${ruleNumber}`);
    res.json({ 
      message: `Rule ${ruleNumber} deleted successfully`,
      output: stdout
    });

  } catch (error) {
    console.error('UFW delete error:', error);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const { stdout } = await execAsync('tail -n 100 /var/log/ufw.log');
    
    const lines = stdout.split('\n').filter(line => line.trim());
    const logs = lines.map(line => {
      const parts = line.split(' ');
      if (parts.length >= 3) {
        return {
          timestamp: `${parts[0]} ${parts[1]} ${parts[2]}`,
          message: parts.slice(3).join(' '),
          raw: line
        };
      }
      return { raw: line };
    });

    res.json({ logs });

  } catch (error) {
    console.error('UFW logs error:', error);
    res.status(500).json({ error: 'Failed to get firewall logs' });
  }
});

module.exports = router;