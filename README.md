# TimmiNet

A highly secure and user-friendly web administration interface for Debian and Ubuntu servers, built with Node.js and React.

## Features

### Core Features
- 🖥️ **Live System Monitoring** - Real-time CPU, GPU, RAM, disk usage, network traffic, and uptime monitoring
- 📊 **Historical Charts** - Time-series data visualization for all key metrics
- 💻 **System Information** - OS details, hardware specs, kernel version, and architecture
- ⚙️ **Process Management** - View, search, filter, and manage running processes
- 👥 **User Management** - Create, modify, disable users with role-based access control
- 🔥 **Firewall Management** - UFW integration for managing firewall rules and monitoring
- 📋 **System Logs** - View and filter system logs (auth.log, syslog, dmesg)
- ⏰ **Cron Job Manager** - Schedule and manage automated tasks
- 📦 **Package Management** - Update, install, and remove system packages
- 🔒 **Security Monitoring** - Intrusion detection and automated security alerts

### Security Features
- 🔐 **Secure Authentication** - bcrypt password hashing with strong password policies
- 🛡️ **Rate Limiting** - Login attempt throttling and account lockout protection
- ⏱️ **Session Management** - Automatic logout after configurable inactivity periods
- 🔒 **HTTPS/TLS Support** - Built-in SSL certificate support with Let's Encrypt option
- 📝 **Audit Logging** - Complete audit trail of all administrative actions
- 🚫 **Input Sanitization** - Comprehensive input validation and XSS protection
- 🔐 **Fail2Ban Integration** - Optional integration with Fail2Ban for enhanced security

### Technical Features
- ⚡ **Real-time Updates** - WebSocket-based live dashboard updates
- 📱 **Responsive Design** - Mobile-optimized dark theme interface
- 🎯 **Role-based Access** - Granular permissions for different user types
- 🔧 **RESTful API** - Complete API for automation and integration
- 🐳 **Easy Installation** - One-command installation script
- 🔄 **Auto-restart** - Systemd integration with automatic crash recovery

## Quick Start

### Prerequisites
- Ubuntu 18.04+ or Debian 10+
- Root or sudo access
- Internet connection for downloading dependencies

### Installation

1. **Download and run the installation script:**
   ```bash
   curl -fsSL https://raw.githubusercontent.com/your-repo/timminet/main/install.sh | sudo bash
   ```

2. **Or clone and install manually:**
   ```bash
   git clone https://github.com/your-repo/timminet.git
   cd timminet
   sudo ./install.sh
   ```

3. **Access the web interface:**
   - Open your browser and navigate to `http://your-server-ip:2851`
   - Log in with the admin credentials you created during installation

### Default Configuration
- **Port:** 2851
- **Installation Directory:** `/opt/timminet`
- **Service Name:** `timminet`
- **Configuration:** `/opt/timminet/.env`

## Usage

### Service Management
```bash
# Start TimmiNet
sudo systemctl start timminet
# or
timminet-start

# Stop TimmiNet
sudo systemctl stop timminet
# or
timminet-stop

# Restart TimmiNet
sudo systemctl restart timminet
# or
timminet-restart

# Check status
sudo systemctl status timminet
# or
timminet-status

# View logs
sudo journalctl -u timminet -f
# or
timminet-logs
```

### Creating Users
```bash
# Create additional admin users via CLI
cd /opt/timminet
sudo -u timminet npm run create-admin
```

### Configuration

The main configuration file is located at `/opt/timminet/.env`:

```bash
# Server Configuration
PORT=2851
NODE_ENV=production

# Security Settings
SESSION_SECRET=your-secure-session-secret
BCRYPT_ROUNDS=12
LOGIN_TIMEOUT=1800000          # 30 minutes in milliseconds
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_TIME=900000           # 15 minutes in milliseconds

# SSL/TLS (Optional)
SSL_CERT_PATH=/path/to/certificate.crt
SSL_KEY_PATH=/path/to/private.key
```

## API Documentation

TimmiNet provides a comprehensive REST API for automation and integration:

### Authentication
```bash
# Login
POST /api/auth/login
{
  "username": "admin",
  "password": "your-password"
}

# Logout
POST /api/auth/logout

# Get current user info
GET /api/auth/me
```

### System Information
```bash
# Get system information
GET /api/system/info

# Get real-time system stats
GET /api/system/stats

# Get process list
GET /api/system/processes
```

### Process Management
```bash
# Get processes
GET /api/processes

# Kill a process (admin only)
POST /api/processes/{pid}/kill
{
  "signal": "TERM"
}
```

### User Management
```bash
# List users (admin only)
GET /api/users

# Create user (admin only)
POST /api/users
{
  "username": "newuser",
  "password": "secure-password",
  "role": "user"
}
```

### Firewall Management
```bash
# Get firewall status
GET /api/firewall/status

# Add firewall rule (admin only)
POST /api/firewall/allow
{
  "port": "80",
  "protocol": "tcp"
}
```

## Security Best Practices

1. **Strong Passwords:** Use the built-in password policy (12+ chars, mixed case, numbers, symbols)
2. **Regular Updates:** Keep TimmiNet and your system updated
3. **Network Access:** Restrict access to port 2851 to trusted networks only
4. **HTTPS:** Configure SSL/TLS certificates for production use
5. **Monitoring:** Regularly check audit logs and system alerts
6. **Backups:** Backup configuration files and user data regularly

## Troubleshooting

### Common Issues

**Service won't start:**
```bash
# Check service status
sudo systemctl status timminet

# Check logs
sudo journalctl -u timminet -n 50

# Verify configuration
sudo -u timminet node /opt/timminet/backend/server.js
```

**Port already in use:**
```bash
# Find what's using port 2851
sudo lsof -i :2851

# Change port in configuration
sudo nano /opt/timminet/.env
# Update PORT=2851 to a different port
sudo systemctl restart timminet
```

**Permission errors:**
```bash
# Fix ownership
sudo chown -R timminet:timminet /opt/timminet

# Fix permissions
sudo chmod +x /opt/timminet/scripts/*.sh
```

**Firewall issues:**
```bash
# Check UFW status
sudo ufw status

# Allow TimmiNet port
sudo ufw allow 2851/tcp
```

### Getting Help

- **GitHub Issues:** Report bugs and feature requests
- **Logs:** Always check `/var/log/syslog` and `journalctl -u timminet`
- **Configuration:** Review `/opt/timminet/.env` for settings

## Development

### Local Development Setup
```bash
# Clone repository
git clone https://github.com/your-repo/timminet.git
cd timminet

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..

# Create environment file
cp .env.example .env

# Create admin user
npm run create-admin

# Start development server
npm run dev
```

### Project Structure
```
timminet/
├── backend/
│   ├── routes/          # API endpoints
│   ├── middleware/      # Authentication & security
│   ├── models/          # Data models
│   ├── utils/           # Helper utilities
│   └── server.js        # Main server file
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   └── App.tsx      # Main application
│   └── public/          # Static assets
├── config/              # Configuration files
├── scripts/             # Helper scripts
├── install.sh           # Installation script
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Node.js](https://nodejs.org/) and [React](https://reactjs.org/)
- System information powered by [systeminformation](https://github.com/sebhildebrandt/systeminformation)
- UI components styled with [Tailwind CSS](https://tailwindcss.com/)
- Real-time updates via [Socket.io](https://socket.io/)

---

**TimmiNet** - Secure, Modern, User-Friendly Server Administration