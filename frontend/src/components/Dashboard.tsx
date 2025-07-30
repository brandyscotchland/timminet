import React from 'react';

interface User {
  username: string;
  role: string;
  lastLogin?: string;
}

interface DashboardProps {
  activeTab: string;
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ activeTab, user }) => {
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div>
            <h1 className="text-3xl font-bold text-white mb-6">Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-white mb-2">System Status</h3>
                <p className="text-green-400">✓ All systems operational</p>
              </div>
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-white mb-2">CPU Usage</h3>
                <p className="text-2xl font-bold text-blue-400">25%</p>
              </div>
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-white mb-2">Memory Usage</h3>
                <p className="text-2xl font-bold text-yellow-400">67%</p>
              </div>
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-white mb-2">Disk Usage</h3>
                <p className="text-2xl font-bold text-orange-400">45%</p>
              </div>
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-white mb-2">Network</h3>
                <p className="text-green-400">↑ 1.2 MB/s ↓ 850 KB/s</p>
              </div>
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-white mb-2">Uptime</h3>
                <p className="text-2xl font-bold text-purple-400">15d 4h</p>
              </div>
            </div>
          </div>
        );
      
      case 'monitoring':
        return (
          <div>
            <h1 className="text-3xl font-bold text-white mb-6">System Monitor</h1>
            <div className="card p-6">
              <p className="text-gray-400">Real-time system monitoring will be displayed here.</p>
            </div>
          </div>
        );
      
      case 'processes':
        return (
          <div>
            <h1 className="text-3xl font-bold text-white mb-6">Process Management</h1>
            <div className="card p-6">
              <p className="text-gray-400">Process list and management tools will be displayed here.</p>
            </div>
          </div>
        );
      
      case 'users':
        return (
          <div>
            <h1 className="text-3xl font-bold text-white mb-6">User Management</h1>
            <div className="card p-6">
              <p className="text-gray-400">User management interface will be displayed here.</p>
            </div>
          </div>
        );
      
      case 'firewall':
        return (
          <div>
            <h1 className="text-3xl font-bold text-white mb-6">Firewall Management</h1>
            <div className="card p-6">
              <p className="text-gray-400">Firewall rules and configuration will be displayed here.</p>
            </div>
          </div>
        );
      
      case 'logs':
        return (
          <div>
            <h1 className="text-3xl font-bold text-white mb-6">System Logs</h1>
            <div className="card p-6">
              <p className="text-gray-400">System log viewer will be displayed here.</p>
            </div>
          </div>
        );
      
      case 'cronjobs':
        return (
          <div>
            <h1 className="text-3xl font-bold text-white mb-6">Cron Jobs</h1>
            <div className="card p-6">
              <p className="text-gray-400">Cron job management interface will be displayed here.</p>
            </div>
          </div>
        );
      
      case 'packages':
        return (
          <div>
            <h1 className="text-3xl font-bold text-white mb-6">Package Management</h1>
            <div className="card p-6">
              <p className="text-gray-400">Package management tools will be displayed here.</p>
            </div>
          </div>
        );
      
      case 'settings':
        return (
          <div>
            <h1 className="text-3xl font-bold text-white mb-6">Settings</h1>
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Account Settings</h3>
              <p className="text-gray-400 mb-2">Username: {user.username}</p>
              <p className="text-gray-400 mb-4">Role: {user.role}</p>
              <button className="btn-primary">Change Password</button>
            </div>
          </div>
        );
      
      default:
        return (
          <div>
            <h1 className="text-3xl font-bold text-white mb-6">Page Not Found</h1>
            <div className="card p-6">
              <p className="text-gray-400">The requested page could not be found.</p>
            </div>
          </div>
        );
    }
  };

  return <div className="max-w-7xl mx-auto">{renderContent()}</div>;
};

export default Dashboard;