import React from 'react';
import { Home, BarChart3, GraduationCap, Users, User, Settings } from 'lucide-react';

const BottomNav = ({ activeTab, setActiveTab, role }) => {
  const navItems = [
    { id: 'dashboard', label: 'Inicio', icon: <Home size={20} /> },
    { id: 'sales', label: 'Ventas', icon: <BarChart3 size={20} /> },
    { id: 'academy', label: 'Academia', icon: <GraduationCap size={20} /> },
    { id: 'network', label: role === 'SUPER_ADMIN' ? 'Admin' : 'Red', icon: role === 'SUPER_ADMIN' ? <Settings size={20} /> : <Users size={20} /> },
    { id: 'profile', label: 'Perfil', icon: <User size={20} /> },
  ];

  return (
    <nav className="bottom-nav glass">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
          onClick={() => setActiveTab(item.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          aria-label={item.label}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default BottomNav;
