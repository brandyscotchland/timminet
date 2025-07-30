import React from 'react';

interface User {
  username: string;
  role: string;
  lastLogin?: string;
}

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  user: User;
  onLogout: () => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'monitoring', label: 'System Monitor', icon: '🖥️' },
  { id: 'processes', label: 'Processes', icon: '⚙️' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'firewall', label: 'Firewall', icon: '🔥' },
  { id: 'logs', label: 'System Logs', icon: '📋' },
  { id: 'cronjobs', label: 'Cron Jobs', icon: '⏰' },
  { id: 'packages', label: 'Packages', icon: '📦' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, user, onLogout }) => {
  return (
    <div className="w-64 bg-dark-800 border-r border-dark-700 flex flex-col">
      <div className="p-4 border-b border-dark-700">
        <h1 className="text-xl font-bold text-white">TimmiNet</h1>
        <p className="text-sm text-gray-400 mt-1">Server Administration</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`sidebar-item w-full text-left ${activeTab === item.id ? 'active' : ''}`}
          >
            <span className="mr-3">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-dark-700">
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-300">{user.username}</p>
          <p className="text-xs text-gray-500 capitalize">{user.role}</p>
          {user.lastLogin && (
            <p className="text-xs text-gray-500 mt-1">
              Last login: {new Date(user.lastLogin).toLocaleDateString()}
            </p>
          )}
        </div>
        <button
          onClick={onLogout}
          className="btn-secondary w-full text-sm"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Sidebar;