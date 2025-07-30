const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');

const USERS_FILE = path.join(__dirname, '../../config/users.json');
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

class User {
  constructor(username, password, role = 'user', isActive = true) {
    this.username = username;
    this.password = password;
    this.role = role;
    this.isActive = isActive;
    this.createdAt = new Date().toISOString();
    this.lastLogin = null;
    this.loginAttempts = 0;
    this.lockedUntil = null;
  }

  static async loadUsers() {
    try {
      const data = await fs.readFile(USERS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  static async saveUsers(users) {
    const configDir = path.dirname(USERS_FILE);
    try {
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (error) {
      throw new Error(`Failed to save users: ${error.message}`);
    }
  }

  static async findByUsername(username) {
    const users = await this.loadUsers();
    const userData = users[username];
    if (!userData) return null;
    
    const user = new User(userData.username, userData.password, userData.role, userData.isActive);
    Object.assign(user, userData);
    return user;
  }

  static async create(username, password, role = 'user') {
    if (!this.validatePassword(password)) {
      throw new Error('Password must be at least 12 characters long and contain uppercase, lowercase, numbers, and symbols');
    }

    const users = await this.loadUsers();
    if (users[username]) {
      throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = new User(username, hashedPassword, role);
    
    users[username] = user;
    await this.saveUsers(users);
    
    return user;
  }

  static async authenticate(username, password) {
    const user = await this.findByUsername(username);
    if (!user) return null;

    if (user.isLocked()) {
      throw new Error('Account is temporarily locked due to too many failed login attempts');
    }

    const isValid = await bcrypt.compare(password, user.password);
    
    if (isValid) {
      await user.resetLoginAttempts();
      await user.updateLastLogin();
      return user;
    } else {
      await user.incrementLoginAttempts();
      return null;
    }
  }

  static validatePassword(password) {
    const minLength = 12;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    return password.length >= minLength && hasUpper && hasLower && hasNumber && hasSymbol;
  }

  isLocked() {
    return this.lockedUntil && new Date() < new Date(this.lockedUntil);
  }

  async incrementLoginAttempts() {
    const users = await User.loadUsers();
    this.loginAttempts += 1;
    
    const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    const lockoutTime = parseInt(process.env.LOCKOUT_TIME) || 900000;
    
    if (this.loginAttempts >= maxAttempts) {
      this.lockedUntil = new Date(Date.now() + lockoutTime).toISOString();
    }
    
    users[this.username] = this;
    await User.saveUsers(users);
  }

  async resetLoginAttempts() {
    const users = await User.loadUsers();
    this.loginAttempts = 0;
    this.lockedUntil = null;
    users[this.username] = this;
    await User.saveUsers(users);
  }

  async updateLastLogin() {
    const users = await User.loadUsers();
    this.lastLogin = new Date().toISOString();
    users[this.username] = this;
    await User.saveUsers(users);
  }

  toJSON() {
    const { password, ...userWithoutPassword } = this;
    return userWithoutPassword;
  }
}

module.exports = User;