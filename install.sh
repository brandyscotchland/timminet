#!/bin/bash

set -e

INSTALL_DIR="/opt/timminet"
SERVICE_NAME="timminet"
USER="timminet"
PORT="2851"

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_header() {
    echo -e "\n${BOLD}${BLUE}$1${NC}\n"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        log_info "Please run: sudo $0"
        exit 1
    fi
}

check_os() {
    if ! command -v lsb_release &> /dev/null; then
        log_error "This script requires lsb_release. Please install it first:"
        log_info "Ubuntu/Debian: apt update && apt install -y lsb-release"
        exit 1
    fi

    OS=$(lsb_release -si)
    VERSION=$(lsb_release -sr)
    
    if [[ "$OS" != "Ubuntu" && "$OS" != "Debian" ]]; then
        log_error "TimmiNet is only supported on Ubuntu and Debian systems"
        log_info "Detected: $OS $VERSION"
        exit 1
    fi
    
    log_success "OS Check passed: $OS $VERSION"
}

install_dependencies() {
    log_header "Installing Dependencies"
    
    apt update
    
    local packages=("curl" "git" "ufw" "software-properties-common" "gnupg" "ca-certificates")
    
    for package in "${packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $package "; then
            log_info "Installing $package..."
            apt install -y "$package"
        else
            log_info "$package is already installed"
        fi
    done
    
    if ! command -v node &> /dev/null; then
        log_info "Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt install -y nodejs
    else
        NODE_VERSION=$(node --version)
        log_info "Node.js is already installed: $NODE_VERSION"
    fi
    
    if ! command -v npm &> /dev/null; then
        log_info "Installing npm..."
        apt install -y npm
    else
        NPM_VERSION=$(npm --version)
        log_info "npm is already installed: $NPM_VERSION"
    fi
    
    log_success "All dependencies installed"
}

create_user() {
    log_header "Creating System User"
    
    if id "$USER" &>/dev/null; then
        log_info "User $USER already exists"
    else
        log_info "Creating user $USER..."
        useradd --system --home "$INSTALL_DIR" --shell /bin/bash --comment "TimmiNet Service User" "$USER"
        log_success "User $USER created"
    fi
}

setup_firewall() {
    log_header "Configuring Firewall"
    
    if ! ufw status | grep -q "Status: active"; then
        log_info "Enabling UFW firewall..."
        ufw --force enable
    else
        log_info "UFW is already enabled"
    fi
    
    log_info "Opening port $PORT for TimmiNet..."
    ufw allow "$PORT"/tcp comment "TimmiNet Web Interface"
    
    if ! ufw status | grep -q "OpenSSH"; then
        log_warning "SSH access is not explicitly allowed in UFW"
        log_info "Adding SSH rule to prevent lockout..."
        ufw allow OpenSSH
    fi
    
    log_success "Firewall configured"
}

install_application() {
    log_header "Installing TimmiNet Application"
    
    if [[ -d "$INSTALL_DIR" ]]; then
        log_warning "Installation directory already exists"
        read -p "Do you want to remove it and reinstall? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Removing existing installation..."
            rm -rf "$INSTALL_DIR"
        else
            log_error "Installation cancelled"
            exit 1
        fi
    fi
    
    log_info "Creating installation directory..."
    mkdir -p "$INSTALL_DIR"
    
    if [[ -f "package.json" ]]; then
        log_info "Installing from current directory..."
        cp -r . "$INSTALL_DIR"/
    else
        log_info "Cloning from GitHub..."
        git clone https://github.com/brandyscotchland/timminet.git "$INSTALL_DIR"
    fi
    
    cd "$INSTALL_DIR"
    
    log_info "Installing Node.js dependencies..."
    npm install --production
    
    if [[ -d "frontend" ]]; then
        log_info "Building frontend..."
        cd frontend
        npm install
        npm run build
        cd ..
    fi
    
    log_info "Setting up configuration..."
    if [[ ! -f ".env" ]]; then
        cp .env.example .env
        
        SESSION_SECRET=$(openssl rand -base64 32)
        sed -i "s/change_this_to_a_secure_random_string/$SESSION_SECRET/" .env
        sed -i "s/PORT=2851/PORT=$PORT/" .env
        sed -i "s/NODE_ENV=production/NODE_ENV=production/" .env
    fi
    
    chown -R "$USER":"$USER" "$INSTALL_DIR"
    chmod +x "$INSTALL_DIR"/scripts/*.sh 2>/dev/null || true
    
    log_success "Application installed"
}

create_systemd_service() {
    log_header "Creating Systemd Service"
    
    cat > "/etc/systemd/system/$SERVICE_NAME.service" << EOF
[Unit]
Description=TimmiNet - Secure Server Administration Interface
Documentation=https://github.com/brandyscotchland/timminet.git
After=network.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin
ExecStart=/usr/bin/node backend/server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=$SERVICE_NAME

# Security settings
NoNewPrivileges=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=$INSTALL_DIR/config $INSTALL_DIR/logs
PrivateTmp=true
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictRealtime=true

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    
    log_success "Systemd service created and enabled"
}

create_admin_user() {
    log_header "Creating Admin User"
    
    cd "$INSTALL_DIR"
    
    log_info "Please create an admin user for TimmiNet:"
    sudo -u "$USER" npm run create-admin
    
    log_success "Admin user created"
}

start_service() {
    log_header "Starting TimmiNet Service"
    
    systemctl start "$SERVICE_NAME"
    
    sleep 3
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log_success "TimmiNet service started successfully"
    else
        log_error "Failed to start TimmiNet service"
        log_info "Check logs with: journalctl -u $SERVICE_NAME -f"
        exit 1
    fi
}

create_helper_scripts() {
    log_header "Creating Helper Scripts"
    
    mkdir -p "$INSTALL_DIR/scripts"
    
    cat > "$INSTALL_DIR/scripts/start.sh" << 'EOF'
#!/bin/bash
systemctl start timminet
EOF
    
    cat > "$INSTALL_DIR/scripts/stop.sh" << 'EOF'
#!/bin/bash
systemctl stop timminet
EOF
    
    cat > "$INSTALL_DIR/scripts/restart.sh" << 'EOF'
#!/bin/bash
systemctl restart timminet
EOF
    
    cat > "$INSTALL_DIR/scripts/status.sh" << 'EOF'
#!/bin/bash
systemctl status timminet
EOF
    
    cat > "$INSTALL_DIR/scripts/logs.sh" << 'EOF'
#!/bin/bash
journalctl -u timminet -f
EOF
    
    chmod +x "$INSTALL_DIR"/scripts/*.sh
    chown -R "$USER":"$USER" "$INSTALL_DIR/scripts"
    
    ln -sf "$INSTALL_DIR/scripts/start.sh" /usr/local/bin/timminet-start
    ln -sf "$INSTALL_DIR/scripts/stop.sh" /usr/local/bin/timminet-stop
    ln -sf "$INSTALL_DIR/scripts/restart.sh" /usr/local/bin/timminet-restart
    ln -sf "$INSTALL_DIR/scripts/status.sh" /usr/local/bin/timminet-status
    ln -sf "$INSTALL_DIR/scripts/logs.sh" /usr/local/bin/timminet-logs
    
    log_success "Helper scripts created"
}

print_summary() {
    log_header "Installation Complete!"
    
    echo -e "${GREEN}TimmiNet has been successfully installed!${NC}\n"
    
    echo -e "${BOLD}Service Information:${NC}"
    echo -e "  • Service: $SERVICE_NAME"
    echo -e "  • User: $USER"
    echo -e "  • Installation: $INSTALL_DIR"
    echo -e "  • Port: $PORT\n"
    
    echo -e "${BOLD}Access Information:${NC}"
    echo -e "  • Web Interface: http://$(hostname -I | awk '{print $1}'):$PORT"
    echo -e "  • Local Access: http://localhost:$PORT\n"
    
    echo -e "${BOLD}Management Commands:${NC}"
    echo -e "  • Start: ${BLUE}timminet-start${NC} or ${BLUE}systemctl start $SERVICE_NAME${NC}"
    echo -e "  • Stop: ${BLUE}timminet-stop${NC} or ${BLUE}systemctl stop $SERVICE_NAME${NC}"
    echo -e "  • Restart: ${BLUE}timminet-restart${NC} or ${BLUE}systemctl restart $SERVICE_NAME${NC}"
    echo -e "  • Status: ${BLUE}timminet-status${NC} or ${BLUE}systemctl status $SERVICE_NAME${NC}"
    echo -e "  • Logs: ${BLUE}timminet-logs${NC} or ${BLUE}journalctl -u $SERVICE_NAME -f${NC}\n"
    
    echo -e "${BOLD}Configuration:${NC}"
    echo -e "  • Config file: $INSTALL_DIR/.env"
    echo -e "  • User data: $INSTALL_DIR/config/users.json"
    echo -e "  • Logs: $INSTALL_DIR/logs/\n"
    
    echo -e "${YELLOW}Important Notes:${NC}"
    echo -e "  • Make sure port $PORT is accessible from your network"
    echo -e "  • Use strong passwords for all accounts"
    echo -e "  • Regularly backup your configuration files"
    echo -e "  • Monitor logs for any security issues\n"
    
    echo -e "${GREEN}Enjoy using TimmiNet!${NC}"
}

main() {
    log_header "TimmiNet Installation Script"
    echo -e "This script will install TimmiNet on your system.\n"
    
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Installation cancelled"
        exit 0
    fi
    
    check_root
    check_os
    install_dependencies
    create_user
    setup_firewall
    install_application
    create_systemd_service
    create_helper_scripts
    create_admin_user
    start_service
    print_summary
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi