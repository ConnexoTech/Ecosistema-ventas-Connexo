import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav    from './components/layout/BottomNav';
import Header       from './components/layout/Header';
import Login        from './components/auth/Login';
import TeamManager  from './components/team/TeamManager';
import Onboarding   from './components/onboarding/Onboarding';
import SaleForm     from './components/sales/SaleForm';
import Academy      from './components/academy/Academy';
import { dataService, PLANS } from './services/dataService';

const SESSION_KEY = 'connexo_session';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading,       setIsLoading]       = useState(true);   // true al inicio para restaurar sesión
  const [activeTab,       setActiveTab]       = useState('dashboard');
  const [user,            setUser]            = useState(null);
  const [team,            setTeam]            = useState([]);
  const [sales,           setSales]           = useState([]);
  const [showOnboarding,  setShowOnboarding]  = useState(false);
  const [selectedPlan,    setSelectedPlan]    = useState(null);
  const [metrics,         setMetrics]         = useState({ rate: 0, base: 0, level: 'CARGANDO...' });
  const [notifications,   setNotifications]   = useState([
    { id: 1, message: 'Ecosistema Connexo v2.2 iniciado', type: 'INFO', read: false }
  ]);
  const [highContrast,    setHighContrast]    = useState(false);

  // ── Restaurar sesión al recargar ──────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const savedUser = JSON.parse(saved);
        setUser(savedUser);
        setIsAuthenticated(true);
        // No mostramos onboarding al recargar, ya pasó antes
        setShowOnboarding(false);
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  // ── Refrescar métricas y equipo cuando cambia el usuario ──────────────
  useEffect(() => {
    if (isAuthenticated && user) refreshData();
  }, [isAuthenticated, user?.id]);

  const refreshData = async () => {
    try {
      const [newMetrics, teamData, salesData] = await Promise.all([
        dataService.getMetrics(user),
        user.role !== 'SELLER' ? dataService.getTeam(user.uid || user.id) : Promise.resolve([]),
        dataService.getSales(user.uid || user.id)
      ]);
      setMetrics(newMetrics);
      setTeam(teamData);
      setSales(salesData);
    } catch (err) {
      console.error('Error al refrescar datos:', err);
    }
  };

  // --- Handlers ---
  const handleLogin = async (email, password, selectedRole) => {
    setIsLoading(true);
    try {
      const userData = await dataService.login(email, password, selectedRole);
      localStorage.setItem(SESSION_KEY, JSON.stringify(userData)); // 💾 Guardar sesión
      setUser(userData);
      setIsAuthenticated(true);
      setShowOnboarding(true);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminBypass = (adminUser) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(adminUser)); // 💾 Guardar sesión admin
    setUser(adminUser);
    setIsAuthenticated(true);
    setShowOnboarding(true);
  };

  const handleLogout = async () => {
    await dataService.logout();
    localStorage.removeItem(SESSION_KEY); // 🗑️ Limpiar sesión guardada
    setIsAuthenticated(false);
    setUser(null);
    setSales([]);
    setTeam([]);
    setMetrics({ rate: 0, base: 0, level: 'CARGANDO...' });
    setActiveTab('dashboard');
    setShowOnboarding(false);
  };

  const handleRegisterSale = async (planKey, customerData) => {
    setIsLoading(true);
    try {
      const newSale = await dataService.registerSale(
        user.uid || user.id,
        planKey,
        customerData,
        metrics.rate,
        user.is_certified
      );
      setSales(prev => [newSale, ...prev]);
      setSelectedPlan(null);
      addNotification(`Venta de ${customerData.name} registrada — +$${newSale.commission_earned.toFixed(2)}`);
      refreshData();
    } catch (err) {
      alert('Error al registrar venta: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const addNotification = (message, type = 'SUCCESS') => {
    setNotifications(prev => [{ id: Date.now(), message, type, read: false }, ...prev]);
  };

  // --- Loading Screen ---
  if (isLoading && !isAuthenticated) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--accent)', fontFamily: 'Verdana', padding: '2rem', textAlign: 'center', gap: '1.5rem' }}>
        <div style={{ width: 40, height: 40, border: '4px solid rgba(255,102,0,0.2)', borderTop: '4px solid var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p>Iniciando Ecosistema...</p>
      </div>
    );
  }

  // --- Tab Content ---
  const renderContent = () => {
    switch (activeTab) {

      case 'dashboard': return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '0 1.5rem 100px', fontFamily: 'Verdana, sans-serif' }}>

          {/* Status Card */}
          <div className="card glass" style={{ marginBottom: '1.5rem', border: '1px solid var(--accent)' }}>
            <p style={{ fontSize: '0.65rem', opacity: 0.6, textTransform: 'uppercase' }}>Nivel Actual</p>
            <h2 style={{ color: 'var(--accent)', margin: '4px 0', fontSize: '1.2rem' }}>{metrics.level}</h2>
            
            <div style={{ margin: '16px 0' }}>
              <p style={{ fontSize: '0.7rem', marginBottom: '4px', opacity: 0.8 }}>Progreso a Nivel ULTRA</p>
              <progress 
                aria-label="Progreso para nivel Ultra" 
                aria-valuenow={Math.min(sales.length, 100)} 
                aria-valuemax="100"
                value={Math.min(sales.length, 100)}
                max="100"
                style={{ width: '100%', height: '10px', accentColor: 'var(--accent)' }}
              ></progress>
              <p style={{ fontSize: '0.65rem', textAlign: 'right', marginTop: '4px', opacity: 0.6 }}>{Math.min(sales.length, 100)} / 100 ventas</p>
            </div>

            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: user?.is_certified ? 'var(--success)' : 'var(--danger)' }}>
              {user?.is_certified ? '✓ CERTIFICADO CONNEXO' : '⚠ CERTIFICACIÓN PENDIENTE'}
            </p>
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '2rem' }}>
            <div className="card glass">
              <p style={{ fontSize: '0.6rem', opacity: 0.5 }}>BILLETERA</p>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>${(user?.wallet_balance || 0).toFixed(2)}</h3>
            </div>
            <div className="card glass">
              <p style={{ fontSize: '0.6rem', opacity: 0.5 }}>SUELDO BASE</p>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>${metrics.base.toFixed(2)}</h3>
            </div>
            <div className="card glass">
              <p style={{ fontSize: '0.6rem', opacity: 0.5 }}>COMISIÓN</p>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{(metrics.rate * 100).toFixed(0)}%</h3>
            </div>
            <div className="card glass">
              <p style={{ fontSize: '0.6rem', opacity: 0.5 }}>VENTAS</p>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{sales.length}</h3>
            </div>
          </div>

          {/* Sales History */}
          <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', marginBottom: '1rem' }}>Historial de Ventas</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sales.length === 0 ? (
              <p style={{ textAlign: 'center', opacity: 0.4, fontSize: '0.8rem', padding: '2rem' }}>
                Aún no hay ventas registradas.<br/>¡Registra tu primera venta!
              </p>
            ) : (
              sales.map(s => (
                <div key={s.id} className="card glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem' }}>{s.customer_name}</p>
                    <p style={{ margin: 0, fontSize: '0.7rem', opacity: 0.5 }}>{s.plan_type} · {new Date(s.created_at).toLocaleDateString()}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, color: 'var(--accent)', fontWeight: 700 }}>+${s.commission_earned.toFixed(2)}</p>
                    <p style={{ margin: 0, fontSize: '0.65rem', opacity: 0.5 }}>${s.amount.toFixed(2)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      );

      case 'sales': return (
        <div style={{ padding: '0 1.5rem 100px', fontFamily: 'Verdana, sans-serif' }}>
          <h2 style={{ fontSize: '1.3rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Terminal de Ventas</h2>
          <p style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '2rem' }}>Comisión activa: {(metrics.rate * 100).toFixed(0)}%</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button disabled={isLoading} className="btn btn-primary" style={{ padding: '1.2rem', fontSize: '1rem', textTransform: 'uppercase' }} onClick={() => setSelectedPlan('PRO')}>
              Plan PRO — $97.00
            </button>
            <button disabled={isLoading} className="btn btn-primary" style={{ padding: '1.2rem', fontSize: '1rem', background: 'var(--accent-dark)', textTransform: 'uppercase' }} onClick={() => setSelectedPlan('ULTRA')}>
              Plan ULTRA — $179.00
            </button>
          </div>
          {selectedPlan && (
            <SaleForm
              plan={PLANS[selectedPlan]}
              onConfirm={(data) => handleRegisterSale(selectedPlan, data)}
              onCancel={() => setSelectedPlan(null)}
            />
          )}
        </div>
      );

      case 'network': return (
        <TeamManager
          users={team}
          currentUser={user}
          sales={sales}
          onAddUser={async (userData) => {
            const newUser = await dataService.addTeamMember(user.uid || user.id, userData);
            setTeam(prev => [...prev, newUser]);
            addNotification(`${newUser.full_name} agregado al equipo`, 'SUCCESS');
          }}
        />
      );

      case 'academy': return (
        <Academy
          user={user}
          onCertify={async () => {
            try {
              await dataService.certifyUser(user.uid || user.id);
              setUser(prev => ({ ...prev, is_certified: true }));
              addNotification('¡Certificación completada! Comisiones desbloqueadas.', 'SUCCESS');
              refreshData();
            } catch (err) {
              alert('Error: ' + err.message);
            }
          }}
        />
      );

      case 'profile': return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '2rem 1.5rem 100px', fontFamily: 'Verdana, sans-serif', textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 1.5rem' }}>
            {(user?.full_name || 'U').charAt(0).toUpperCase()}
          </div>
          <h2 style={{ textTransform: 'uppercase', fontSize: '1.2rem' }}>{user?.full_name}</h2>
          <p style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.3rem', fontSize: '1rem' }}>{metrics.level}</p>
          <p style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '0.2rem' }}>{user?.email}</p>
          <p style={{ fontSize: '0.7rem', opacity: 0.4 }}>{user?.role?.replace('_', ' ')}</p>

          {/* Commission Breakdown */}
          <div style={{ background: 'rgba(255,102,0,0.08)', border: '1px solid rgba(255,102,0,0.25)', borderRadius: '12px', padding: '1.2rem', margin: '1.5rem 0', textAlign: 'left' }}>
            <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', opacity: 0.6, marginBottom: '1rem' }}>Estructura de Comisiones</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="card glass" style={{ textAlign: 'center', padding: '0.8rem' }}>
                <p style={{ fontSize: '0.55rem', opacity: 0.5, textTransform: 'uppercase' }}>Comisión Activa</p>
                <h3 style={{ margin: '4px 0', color: 'var(--accent)', fontSize: '1.4rem' }}>{(metrics.rate * 100).toFixed(0)}%</h3>
              </div>
              <div className="card glass" style={{ textAlign: 'center', padding: '0.8rem' }}>
                <p style={{ fontSize: '0.55rem', opacity: 0.5, textTransform: 'uppercase' }}>Sueldo Base</p>
                <h3 style={{ margin: '4px 0', color: metrics.base > 0 ? 'var(--success)' : 'inherit', fontSize: '1.4rem' }}>${metrics.base.toFixed(0)}</h3>
              </div>
              <div className="card glass" style={{ textAlign: 'center', padding: '0.8rem' }}>
                <p style={{ fontSize: '0.55rem', opacity: 0.5, textTransform: 'uppercase' }}>Billetera</p>
                <h3 style={{ margin: '4px 0', fontSize: '1.4rem' }}>${(user?.wallet_balance || 0).toFixed(2)}</h3>
              </div>
              <div className="card glass" style={{ textAlign: 'center', padding: '0.8rem' }}>
                <p style={{ fontSize: '0.55rem', opacity: 0.5, textTransform: 'uppercase' }}>Ventas</p>
                <h3 style={{ margin: '4px 0', fontSize: '1.4rem' }}>{sales.length}</h3>
              </div>
            </div>

            {/* Next tier hint */}
            {user?.role === 'SELLER' && (
              <div style={{ marginTop: '1rem', padding: '0.8rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                <p style={{ fontSize: '0.65rem', opacity: 0.7, marginBottom: '4px' }}>Próximo nivel:</p>
                {sales.length < 20 && <p style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>Vendedor PRO → {20 - sales.length} ventas más (7% + $250 base)</p>}
                {sales.length >= 20 && sales.length < 31 && <p style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>Vendedor ULTRA → {31 - sales.length} ventas más (9% + $300 base)</p>}
                {sales.length >= 31 && <p style={{ fontSize: '0.7rem', color: 'var(--success)' }}>🏆 Nivel máximo alcanzado</p>}
              </div>
            )}
            {user?.role === 'DISTRIBUTOR' && (
              <div style={{ marginTop: '1rem', padding: '0.8rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                <p style={{ fontSize: '0.65rem', opacity: 0.7, marginBottom: '4px' }}>Progreso del equipo:</p>
                {metrics.level === 'DISTRIBUIDOR BASIC' && <p style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>Distribuidor 1 → {50 - sales.length} ventas más (12% + $500 base)</p>}
                {metrics.level === 'DISTRIBUIDOR 1' && <p style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>Distribuidor 2 → alcanza 101 ventas (15% + $600 base)</p>}
                {metrics.level === 'DISTRIBUIDOR 2' && <p style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>Distribuidor 3 → alcanza 201 ventas (18% + $600 base)</p>}
                {metrics.level === 'DISTRIBUIDOR 3' && <p style={{ fontSize: '0.7rem', color: 'var(--success)' }}>🏆 Nivel máximo alcanzado</p>}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.5rem' }}>
            <div className="card glass">
              <p style={{ fontSize: '0.6rem', opacity: 0.5 }}>ROL</p>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem' }}>{user?.role?.replace('_', ' ')}</p>
            </div>
            <div className="card glass">
              <p style={{ fontSize: '0.6rem', opacity: 0.5 }}>ESTADO</p>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', color: user?.is_certified ? 'var(--success)' : 'var(--danger)' }}>
                {user?.is_certified ? 'CERTIFICADO' : 'PENDIENTE'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              setHighContrast(!highContrast);
              document.documentElement.style.setProperty('--bg-primary', !highContrast ? '#000000' : '#210900');
              document.documentElement.style.setProperty('--accent', !highContrast ? '#ffff00' : '#ff6600');
            }} 
            className="btn" 
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', width: '100%', padding: '1rem', textTransform: 'uppercase', marginBottom: '1rem', border: '1px solid var(--accent)' }}
          >
            [Configuración de Accesibilidad]
          </button>
          <button onClick={handleLogout} className="btn" style={{ background: 'var(--danger)', color: 'white', width: '100%', padding: '1rem', textTransform: 'uppercase' }}>
            Cerrar Sesión
          </button>
        </motion.div>
      );

      default: return null;
    }
  };

  // --- Main Render ---
  return (
    <AnimatePresence mode="wait">
      {!isAuthenticated ? (
        <Login
          key="login"
          onLogin={handleLogin}
          onAdminBypass={handleAdminBypass}
          isLoading={isLoading}
        />
      ) : showOnboarding ? (
        <Onboarding key="onboarding" user={user} onComplete={() => setShowOnboarding(false)} />
      ) : (
        <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Header
            user={{ name: user?.full_name, ...user }}
            notificationCount={notifications.filter(n => !n.read).length}
            onShowNotifications={() => {
              alert(notifications.map(n => n.message).join('\n'));
              setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            }}
            activeTab={activeTab}
            onBack={() => setActiveTab('dashboard')}
          />
          <main role="main" style={{ flex: 1 }}>{renderContent()}</main>
          <nav role="navigation">
            <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} role={user?.role} />
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default App;
