const User = require('../models/User');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createAdminUser() {
  try {
    console.log('=== TimmiNet Admin User Setup ===\n');
    
    const username = await question('Admin username: ');
    
    if (!username || username.length < 3) {
      console.error('Username must be at least 3 characters long');
      process.exit(1);
    }

    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      console.error('User already exists');
      process.exit(1);
    }

    let password;
    do {
      password = await question('Admin password: ');
      if (!User.validatePassword(password)) {
        console.error('\nPassword must be at least 12 characters long and contain:');
        console.error('- Uppercase letters (A-Z)');
        console.error('- Lowercase letters (a-z)');
        console.error('- Numbers (0-9)');
        console.error('- Symbols (!@#$%^&* etc.)\n');
      }
    } while (!User.validatePassword(password));

    const user = await User.create(username, password, 'admin');
    console.log('\n✓ Admin user created successfully!');
    console.log(`Username: ${user.username}`);
    console.log(`Role: ${user.role}`);
    console.log(`Created: ${user.createdAt}`);

  } catch (error) {
    console.error('Error creating admin user:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  createAdminUser();
}

module.exports = createAdminUser;