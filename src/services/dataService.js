import { supabase } from '../lib/supabase';

export const PLANS = {
  PRO:   { id: 'PRO',   price: 97.00,  label: 'Plan PRO' },
  ULTRA: { id: 'ULTRA', price: 179.00, label: 'Plan ULTRA' }
};

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  DISTRIBUTOR: 'DISTRIBUTOR',
  SELLER:      'SELLER'
};

let _currentUser = null;

async function calcMetrics(user) {
  const uid = user.id || user.uid;

  if (!user.is_certified) return { rate: 0, base: 0, level: 'BLOQUEADO' };

  // ─── VENDEDOR ──────────────────────────────────────────────────────────
  // Vendedor BASIC  (0–19 ventas)  : sin sueldo base, sin comisión
  // Vendedor PRO    (20–30 ventas) : 7% comisión + $250 base
  // Vendedor ULTRA  (31+ ventas)   : 9% comisión + $300 base
  if (user.role === ROLES.SELLER) {
    const { count: mySales, error } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', uid);

    if (error) console.error(error);
    const total = mySales || 0;

    if (total >= 31) return { rate: 0.09, base: 300, level: 'VENDEDOR ULTRA' };
    if (total >= 20) return { rate: 0.07, base: 250, level: 'VENDEDOR PRO'   };
    return           { rate: 0,    base: 0,   level: 'VENDEDOR BASIC'        };
  }

  // ─── DISTRIBUIDOR ──────────────────────────────────────────────────────
  // Distribuidor BASIC (0–49 ventas totales)   : sin sueldo base, sin comisión
  // Distribuidor 1     (50–100 ventas totales) : 12% comisión + $500 base
  // Distribuidor 2     (101–200 ventas totales): 15% comisión + $600 base
  // Distribuidor 3     (201+ ventas totales)   : 18% comisión + $600 base
  if (user.role === ROLES.DISTRIBUTOR) {
    const { data: team } = await supabase
      .from('profiles')
      .select('id')
      .eq('parent_id', uid);

    const teamIds = [uid, ...(team?.map(t => t.id) || [])];

    const { count: teamSales, error } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .in('seller_id', teamIds);

    if (error) console.error(error);
    const total = teamSales || 0;

    if (total >= 201) return { rate: 0.18, base: 600, level: 'DISTRIBUIDOR 3'    };
    if (total >= 101) return { rate: 0.15, base: 600, level: 'DISTRIBUIDOR 2'    };
    if (total >= 50)  return { rate: 0.12, base: 500, level: 'DISTRIBUIDOR 1'    };
    return            { rate: 0,    base: 0,   level: 'DISTRIBUIDOR BASIC'       };
  }

  return { rate: 0, base: 0, level: 'SUPER ADMIN' };
}

export const dataService = {
  async login(email, password, selectedRole = null) {
    // 1. Validación de Super Admin Principal
    if (email === 'thony.karter@gmail.com' && password === 'Karter.666') {
      const { data: existingAdmin } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (existingAdmin) {
        if (existingAdmin.password === password) {
          _currentUser = existingAdmin;
          return _currentUser;
        }
        throw new Error('Contraseña incorrecta para el Admin Principal.');
      } else {
        // Crear el Super Admin si no existe en la base de datos
        const newAdmin = {
          full_name: 'Thony Karter (Admin)',
          email: email,
          password: password,
          role: ROLES.SUPER_ADMIN,
          is_certified: true,
          wallet_balance: 0,
          parent_id: null
        };
        const { data: insertedAdmin, error } = await supabase
          .from('profiles')
          .insert([newAdmin])
          .select()
          .single();

        if (error) {
          console.error("Error creando Admin:", error);
          throw new Error('Error de Supabase al crear Admin: ' + error.message);
        }
        _currentUser = insertedAdmin;
        return _currentUser;
      }
    }

    // 2. Login normal para el resto de usuarios
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();
      
    if (error || !data) throw new Error('Credenciales incorrectas. Verifica tu email y contraseña.');

    // Validar que el rol seleccionado en la UI coincida con el rol real
    if (selectedRole) {
      const roleMap = {
        'VENDEDOR':    'SELLER',
        'DISTRIBUIDOR': 'DISTRIBUTOR'
      };
      const expectedRole = roleMap[selectedRole];
      if (expectedRole && data.role !== expectedRole) {
        throw new Error(`Acceso denegado. Tu cuenta está registrada como ${data.role === 'SELLER' ? 'Vendedor' : 'Distribuidor'}.`);
      }
    }

    _currentUser = data;
    return _currentUser;
  },

  async logout() {
    _currentUser = null;
  },

  async getMetrics(user) {
    return await calcMetrics(user);
  },

  async registerSale(userId, planKey, customerData, currentRate, isCertified) {
    const plan = PLANS[planKey];
    const commission = isCertified ? plan.price * (currentRate || 0) : 0;

    const newSale = {
      seller_id: userId,
      plan_type: planKey,
      amount: plan.price,
      commission_earned: commission,
      customer_name: customerData.name,
      customer_phone: customerData.phone,
      status: 'COMPLETED'
    };

    const { data: sale, error } = await supabase
      .from('sales')
      .insert([newSale])
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Actualizar billetera localmente y en db
    if (commission > 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', userId)
        .single();
        
      if (profile) {
        const newBalance = Number(profile.wallet_balance || 0) + commission;
        await supabase
          .from('profiles')
          .update({ wallet_balance: newBalance })
          .eq('id', userId);
        
        if (_currentUser && _currentUser.id === userId) {
            _currentUser.wallet_balance = newBalance;
        }
      }
    }

    return sale;
  },

  async getSales(userId) {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('seller_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) throw new Error(error.message);
    return data;
  },

  async getTeam(parentId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('parent_id', parentId)
      .order('created_at', { ascending: true });
      
    if (error) throw new Error(error.message);
    return data.map(({ password, ...rest }) => rest);
  },

  async addTeamMember(parentId, userData) {
    const newProfile = {
      full_name: userData.name,
      email: userData.email,
      password: userData.password || 'connexo123',
      role: userData.role || ROLES.SELLER,
      is_certified: false,
      wallet_balance: 0,
      parent_id: parentId
    };

    const { data, error } = await supabase
      .from('profiles')
      .insert([newProfile])
      .select()
      .single();

    if (error) throw new Error(error.message);
    const { password, ...safeProfile } = data;
    return safeProfile;
  },

  async certifyUser(userId) {
    const { error } = await supabase
      .from('profiles')
      .update({ is_certified: true })
      .eq('id', userId);
      
    if (error) throw new Error(error.message);
    
    if (_currentUser && (_currentUser.id === userId || _currentUser.uid === userId)) {
      _currentUser.is_certified = true;
    }
    return true;
  }
};
