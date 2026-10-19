import React, { useState, useEffect } from 'react';
import { Store, StoreFeatureFlags, DEFAULT_FEATURE_FLAGS } from '../types';
import { createNewStore, updateStoreMeta, deleteStoreRecord, resetStoreToFactory } from '../services/db';

interface SuperAdminViewProps {
  stores: Store[];
  onSelectStore: (storeId: string, mode?: 'storefront' | 'admin') => void;
  onExitSuperAdmin: () => void;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({
  stores,
  onSelectStore,
  onExitSuperAdmin
}) => {
  const [localStores, setLocalStores] = useState<Store[]>(stores);

  useEffect(() => {
    setLocalStores(stores);
  }, [stores]);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('atelier_superadmin_auth') === 'true';
    } catch {
      return false;
    }
  });

  const [passwordInput, setPasswordInput] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [authError, setAuthError] = useState(false);

  // New Store Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreSlug, setNewStoreSlug] = useState('');
  const [newStoreWhatsApp, setNewStoreWhatsApp] = useState('');
  const [newStorePassword, setNewStorePassword] = useState('AdminApolo2026!');
  const [showNewStorePassword, setShowNewStorePassword] = useState(false);
  const [newStoreIsSandbox, setNewStoreIsSandbox] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Store Deletion Modal (avoids window.confirm blocking in iframe)
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);

  // Edit Store Modal
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [editName, setEditName] = useState('');
  const [editWhatsApp, setEditWhatsApp] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editIsSandbox, setEditIsSandbox] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Feature Flags Modal State
  const [featureFlagsStore, setFeatureFlagsStore] = useState<Store | null>(null);

  // Sandbox Reset Confirmation Modal
  const [sandboxResetStore, setSandboxResetStore] = useState<Store | null>(null);
  const [isResettingSandbox, setIsResettingSandbox] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Platform Mercado Pago Master Settings Modal
  const [isPlatformMpModalOpen, setIsPlatformMpModalOpen] = useState(false);
  const [platformPublicKey, setPlatformPublicKey] = useState('APP_USR-5bed7b67-e57e-4f32-92fa-d6555c149928');
  const [platformAccessToken, setPlatformAccessToken] = useState('APP_USR-1254765898303511-101901-bf79a18105c13f25b1a0bfb65082e01c-3776798082');
  const [showPlatformToken, setShowPlatformToken] = useState(false);
  const [platformSandboxMode, setPlatformSandboxMode] = useState(true);
  const [isVerifyingMp, setIsVerifyingMp] = useState(false);
  const [isSavingPlatformMp, setIsSavingPlatformMp] = useState(false);
  const [activeMpModalTab, setActiveMpModalTab] = useState<'credentials' | 'guide' | 'cards'>('credentials');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [mpVerifyResult, setMpVerifyResult] = useState<{
    valid?: boolean;
    nickname?: string;
    email?: string;
    siteId?: string;
    error?: string;
  } | null>({
    valid: true,
    nickname: 'Cuenta de Desarrollo (Sandbox)',
    email: 'yunior@gmail.com',
    siteId: 'MLA'
  });

  useEffect(() => {
    fetch('/api/platform/mercadopago')
      .then((r) => r.json())
      .then((d) => {
        if (d.publicKey) setPlatformPublicKey(d.publicKey);
        if (d.accessToken) setPlatformAccessToken(d.accessToken);
        if (typeof d.sandboxMode === 'boolean') setPlatformSandboxMode(d.sandboxMode);
        if (d.accountNickname) {
          setMpVerifyResult({
            valid: true,
            nickname: d.accountNickname,
            email: d.accountEmail || '',
            siteId: 'MLA'
          });
        }
      })
      .catch((err) => console.warn('Could not load MP platform config:', err));
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleVerifyPlatformMp = async () => {
    if (!platformAccessToken.trim()) {
      showToast('Debes ingresar un Access Token para verificar.');
      return;
    }
    setIsVerifyingMp(true);
    setMpVerifyResult(null);
    try {
      const res = await fetch('/api/mercadopago/verify-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: platformAccessToken.trim() })
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setMpVerifyResult({
          valid: true,
          nickname: data.nickname,
          email: data.email,
          siteId: data.siteId
        });
        showToast('¡Credenciales validadas con éxito con Mercado Pago!');
      } else {
        setMpVerifyResult({
          valid: false,
          error: data.error || 'Credenciales no válidas.'
        });
        showToast('Error de validación con Mercado Pago.');
      }
    } catch (err: any) {
      setMpVerifyResult({
        valid: false,
        error: err.message || 'Error de red.'
      });
    } finally {
      setIsVerifyingMp(false);
    }
  };

  const handleSavePlatformMp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPlatformMp(true);
    try {
      const res = await fetch('/api/platform/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: platformPublicKey.trim(),
          accessToken: platformAccessToken.trim(),
          sandboxMode: platformSandboxMode
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('¡Configuración global de Mercado Pago guardada!');
        if (data.config?.accountNickname) {
          setMpVerifyResult({
            valid: true,
            nickname: data.config.accountNickname,
            email: data.config.accountEmail || '',
            siteId: 'MLA'
          });
        }
      } else {
        showToast(data.error || 'Error al guardar la configuración');
      }
    } catch (err: any) {
      showToast(err.message || 'Error de conexión');
    } finally {
      setIsSavingPlatformMp(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'GenericaApolo2026!') {
      try {
        sessionStorage.setItem('atelier_superadmin_auth', 'true');
      } catch (err) {
        console.warn(err);
      }
      setIsAuthenticated(true);
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem('atelier_superadmin_auth');
    } catch (err) {
      console.warn(err);
    }
    setIsAuthenticated(false);
    onExitSuperAdmin();
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) return;

    setIsSubmitting(true);
    try {
      const generatedSlug = (newStoreSlug.trim() || newStoreName.toLowerCase().replace(/[^a-z0-9]/g, '-')).replace(/^-+|-+$/g, '');
      const created = await createNewStore({
        name: newStoreName.trim(),
        slug: generatedSlug,
        whatsappNumber: newStoreWhatsApp.trim(),
        adminPassword: newStorePassword.trim() || 'AdminApolo2026!',
        isSandbox: newStoreIsSandbox
      });

      setLocalStores((prev) => [...prev, created]);
      showToast(`¡Tienda "${created.name}" creada con éxito!`);
      setIsCreateModalOpen(false);
      setNewStoreName('');
      setNewStoreSlug('');
      setNewStoreWhatsApp('');
      setNewStorePassword('AdminApolo2026!');
      setNewStoreIsSandbox(false);
    } catch (err) {
      console.error(err);
      showToast('Error al crear la tienda. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (store: Store) => {
    const nextActive = store.active === false ? true : false;
    setLocalStores((prev) =>
      prev.map((s) => (s.id === store.id ? { ...s, active: nextActive } : s))
    );
    try {
      await updateStoreMeta(store.id, { active: nextActive });
      showToast(`Comercio "${store.name}" ${nextActive ? 'habilitado' : 'deshabilitado'} con éxito.`);
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar el estado del comercio.');
    }
  };

  const handleToggleFeatureFlag = async (
    store: Store,
    flagKey: Exclude<keyof StoreFeatureFlags, 'maxProducts'>
  ) => {
    const currentFlags = store.featureFlags || { ...DEFAULT_FEATURE_FLAGS };
    const nextValue = !currentFlags[flagKey];
    const updatedFlags: StoreFeatureFlags = {
      ...currentFlags,
      [flagKey]: nextValue
    };

    setLocalStores((prev) =>
      prev.map((s) => (s.id === store.id ? { ...s, featureFlags: updatedFlags } : s))
    );

    if (featureFlagsStore && featureFlagsStore.id === store.id) {
      setFeatureFlagsStore({ ...featureFlagsStore, featureFlags: updatedFlags });
    }

    try {
      await updateStoreMeta(store.id, { featureFlags: updatedFlags });
      const flagLabels: Record<keyof StoreFeatureFlags, string> = {
        publicCatalog: 'Catálogo Público',
        aiAssistant: 'Asistente IA',
        salesModule: 'Módulo de Ventas',
        brandCustomizer: 'Personalización de Marca',
        maxProducts: 'Límite de Prendas',
        whatsappCheckout: 'Checkout por WhatsApp',
        mercadoPagoCheckout: 'Cobro Online con Mercado Pago',
        exportProducts: 'Exportar Productos',
        exportSales: 'Exportar Ventas',
        uploadDevicePhotos: 'Fotos desde el Dispositivo'
      };

      showToast(`${flagLabels[flagKey]}: ${nextValue ? 'Activado' : 'Desactivado'}`);
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar feature flag.');
    }
  };

  const handleUpdateMaxProducts = async (store: Store, maxProducts: number) => {
    const currentFlags = store.featureFlags || { ...DEFAULT_FEATURE_FLAGS };
    const parsedVal = Math.max(0, Math.floor(maxProducts));
    const updatedFlags: StoreFeatureFlags = {
      ...currentFlags,
      maxProducts: parsedVal
    };

    setLocalStores((prev) =>
      prev.map((s) => (s.id === store.id ? { ...s, featureFlags: updatedFlags } : s))
    );

    if (featureFlagsStore && featureFlagsStore.id === store.id) {
      setFeatureFlagsStore({ ...featureFlagsStore, featureFlags: updatedFlags });
    }

    try {
      await updateStoreMeta(store.id, { featureFlags: updatedFlags });
      showToast(`Límite de prendas: ${parsedVal > 0 ? `${parsedVal} prendas` : 'Ilimitado'}`);
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar límite de prendas.');
    }
  };

  const handleExecuteResetSandbox = async () => {
    if (!sandboxResetStore) return;
    setIsResettingSandbox(true);
    try {
      await resetStoreToFactory(sandboxResetStore.id);
      showToast(`¡Tienda "${sandboxResetStore.name}" restaurada con datos limpios de fábrica!`);
      setSandboxResetStore(null);
    } catch (err) {
      console.error(err);
      showToast('Error al restablecer la tienda de pruebas.');
    } finally {
      setIsResettingSandbox(false);
    }
  };

  const executeDeleteStore = async (store: Store) => {
    setLocalStores((prev) => prev.filter((s) => s.id !== store.id));
    await deleteStoreRecord(store.id);
    showToast(`Tienda "${store.name}" eliminada.`);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore) return;
    setLocalStores((prev) =>
      prev.map((s) =>
        s.id === editingStore.id
          ? {
              ...s,
              name: editName.trim(),
              whatsappNumber: editWhatsApp.trim(),
              adminPassword: editPassword.trim() || 'AdminApolo2026!',
              isSandbox: editIsSandbox
            }
          : s
      )
    );
    await updateStoreMeta(editingStore.id, {
      name: editName.trim(),
      whatsappNumber: editWhatsApp.trim(),
      adminPassword: editPassword.trim() || 'AdminApolo2026!',
      isSandbox: editIsSandbox
    });
    showToast('Datos de la tienda actualizados.');
    setEditingStore(null);
  };

  const copyStoreLink = (slug: string, type: 'catalog' | 'admin') => {
    const origin = window.location.origin;
    const url = type === 'catalog' 
      ? `${origin}/${slug}`
      : `${origin}/${slug}/admin`;

    navigator.clipboard.writeText(url).then(() => {
      showToast(`Enlace de ${type === 'catalog' ? 'catálogo' : 'admin'} copiado al portapapeles`);
    }).catch(() => {
      showToast(url);
    });
  };

  // Login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#111827] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-neutral-200">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-[#1A1A1A] text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
              <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Super Admin Platform</h1>
            <p className="text-sm text-neutral-500 mt-1">Gestión Centralizada de Tiendas & Catálogos</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                Clave Maestra
              </label>
              <div className="relative">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setAuthError(false);
                  }}
                  placeholder="Ingresa la clave maestra de superadmin"
                  className="w-full pl-4 pr-10 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all text-sm font-mono"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black transition-colors cursor-pointer"
                  title={showLoginPassword ? 'Ocultar clave' : 'Mostrar clave'}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showLoginPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {authError && (
                <p className="text-xs text-rose-600 mt-1.5 font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  Clave de superadministrador incorrecta.
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-neutral-900 hover:bg-black text-white font-medium rounded-xl transition-all shadow-md active:scale-[0.99] cursor-pointer text-sm"
            >
              Acceder al Panel Multi-Tienda
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span>Acceso confidencial</span>
            <button
              onClick={onExitSuperAdmin}
              className="text-neutral-700 hover:text-black font-medium underline cursor-pointer"
            >
              Volver a la tienda
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeCount = localStores.filter((s) => s.active !== false).length;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-neutral-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-neutral-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-900 text-white rounded-xl flex items-center justify-center font-bold shadow-xs">
              <span className="material-symbols-outlined text-xl">hub</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-neutral-900">Plataforma Multi-Tienda</h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded-full">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-neutral-500">Administrador y creador de comercios</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-rose-200"
              title="Cerrar sesión de Super Admin"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span>Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">store</span>
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-neutral-900">{localStores.length}</div>
              <div className="text-xs text-neutral-500 font-medium">Tiendas Registradas</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">check_circle</span>
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-neutral-900">{activeCount}</div>
              <div className="text-xs text-neutral-500 font-medium">Tiendas Habilitadas Online</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">pause_circle</span>
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-neutral-900">{localStores.length - activeCount}</div>
              <div className="text-xs text-neutral-500 font-medium">Tiendas Deshabilitadas</div>
            </div>
          </div>
        </div>

        {/* Section Header with Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-900">Listado de Tiendas</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Administra cada comercio, accede a su panel de gestión o genera nuevas tiendas independientes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlatformMpModalOpen(true)}
              className="px-4 py-2.5 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 border border-neutral-300 shadow-2xs transition-all cursor-pointer"
            >
              <div className="w-5 h-5 rounded-md bg-[#009EE3] text-white flex items-center justify-center text-[10px] font-black">
                MP
              </div>
              <span>Pasarela Mercado Pago (Global)</span>
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Nueva Tienda</span>
            </button>
          </div>
        </div>

        {/* Stores Grid / Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {localStores.map((store) => {
            const isActive = store.active !== false;

            return (
              <div
                key={store.id}
                className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Card Top */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {store.logoUrl ? (
                        <div className="w-12 h-12 rounded-xl bg-neutral-50 border border-neutral-100 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                          <img
                            src={store.logoUrl}
                            alt={store.name}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div
                          className="w-12 h-12 rounded-xl text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-xs uppercase"
                          style={{ backgroundColor: store.primaryColor || '#1A1A1A' }}
                        >
                          {store.name.substring(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-neutral-900 text-base truncate tracking-tight">
                            {store.name}
                          </h3>
                          {store.isSandbox && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                              🧪 Sandbox
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-mono mt-0.5 truncate">
                          <span>url:</span>
                          <span className="bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700 font-semibold">
                            /{store.slug}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status badge toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(store)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer border shadow-2xs ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100'
                          : 'bg-rose-50 text-rose-800 border-rose-200/80 hover:bg-rose-100'
                      }`}
                      title={isActive ? 'Click para deshabilitar este comercio' : 'Click para habilitar este comercio'}
                    >
                      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span>{isActive ? 'Habilitado' : 'Deshabilitado'}</span>
                    </button>
                  </div>

                  {/* Store Details */}
                  <div className="space-y-1.5 text-xs text-neutral-600 mt-3 pt-2.5 border-t border-neutral-100">
                    {store.whatsappNumber && (
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[15px] text-emerald-600">chat</span>
                        <span className="truncate">{store.whatsappNumber}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-neutral-400">
                      <span className="material-symbols-outlined text-[15px]">schedule</span>
                      <span>Creada: {new Date(store.createdAt || Date.now()).toLocaleDateString()}</span>
                    </div>

                    {!isActive && (
                      <div className="mt-2.5 py-1.5 px-2.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-900 text-xs font-medium flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-amber-600">pause_circle</span>
                        <span>Comercio pausado para los clientes</span>
                      </div>
                    )}
                  </div>

                  {/* Feature Flags Quick Bar */}
                  <div className="mt-3 pt-2.5 border-t border-neutral-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] uppercase tracking-wider font-bold text-neutral-500 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">tune</span>
                        Feature Flags
                      </span>
                      <button
                        type="button"
                        onClick={() => setFeatureFlagsStore(store)}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer flex items-center gap-0.5"
                        title="Abrir panel completo de feature flags y límites"
                      >
                        <span>Configurar</span>
                        <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                      </button>
                    </div>

                    {/* Capacidad Numérica de Prendas */}
                    <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-neutral-50 border border-neutral-200/70 flex items-center justify-between text-[11px]">
                      <span className="text-neutral-600 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-neutral-500">inventory_2</span>
                        <span>Cupo de Prendas:</span>
                      </span>
                      <span className="font-bold font-mono text-neutral-900">
                        {store.featureFlags?.maxProducts && store.featureFlags.maxProducts > 0
                          ? `${store.productCount || 0} / ${store.featureFlags.maxProducts}`
                          : 'Ilimitado'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      {/* Catálogo */}
                      <button
                        type="button"
                        onClick={() => handleToggleFeatureFlag(store, 'publicCatalog')}
                        className={`px-1.5 py-1 rounded-md border flex items-center justify-between text-left transition-colors cursor-pointer ${
                          store.featureFlags?.publicCatalog !== false
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                            : 'bg-neutral-100 border-neutral-200 text-neutral-400'
                        }`}
                        title="Catálogo público visible a clientes"
                      >
                        <span className="truncate">🌐 Catálogo</span>
                        <span className="font-bold text-[9px] ml-0.5">{store.featureFlags?.publicCatalog !== false ? 'ON' : 'OFF'}</span>
                      </button>

                      {/* Asistente IA */}
                      <button
                        type="button"
                        onClick={() => handleToggleFeatureFlag(store, 'aiAssistant')}
                        className={`px-1.5 py-1 rounded-md border flex items-center justify-between text-left transition-colors cursor-pointer ${
                          store.featureFlags?.aiAssistant !== false
                            ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                            : 'bg-neutral-100 border-neutral-200 text-neutral-400'
                        }`}
                        title="Carga de productos con IA desde fotos"
                      >
                        <span className="truncate">⚡ IA</span>
                        <span className="font-bold text-[9px] ml-0.5">{store.featureFlags?.aiAssistant !== false ? 'ON' : 'OFF'}</span>
                      </button>

                      {/* Módulo Ventas */}
                      <button
                        type="button"
                        onClick={() => handleToggleFeatureFlag(store, 'salesModule')}
                        className={`px-1.5 py-1 rounded-md border flex items-center justify-between text-left transition-colors cursor-pointer ${
                          store.featureFlags?.salesModule !== false
                            ? 'bg-purple-50/70 border-purple-200 text-purple-800'
                            : 'bg-neutral-100 border-neutral-200 text-neutral-400'
                        }`}
                        title="Módulo de Ventas y Cobros"
                      >
                        <span className="truncate">💰 Ventas</span>
                        <span className="font-bold text-[9px] ml-0.5">{store.featureFlags?.salesModule !== false ? 'ON' : 'OFF'}</span>
                      </button>

                      {/* Diseño & Marca */}
                      <button
                        type="button"
                        onClick={() => handleToggleFeatureFlag(store, 'brandCustomizer')}
                        className={`px-1.5 py-1 rounded-md border flex items-center justify-between text-left transition-colors cursor-pointer ${
                          store.featureFlags?.brandCustomizer !== false
                            ? 'bg-pink-50/70 border-pink-200 text-pink-800'
                            : 'bg-neutral-100 border-neutral-200 text-neutral-400'
                        }`}
                        title="Personalizador de Marca y colores"
                      >
                        <span className="truncate">🎨 Marca</span>
                        <span className="font-bold text-[9px] ml-0.5">{store.featureFlags?.brandCustomizer !== false ? 'ON' : 'OFF'}</span>
                      </button>

                      {/* WhatsApp Checkout */}
                      <button
                        type="button"
                        onClick={() => handleToggleFeatureFlag(store, 'whatsappCheckout')}
                        className={`px-1.5 py-1 rounded-md border flex items-center justify-between text-left transition-colors cursor-pointer ${
                          store.featureFlags?.whatsappCheckout !== false
                            ? 'bg-green-50/70 border-green-200 text-green-800'
                            : 'bg-neutral-100 border-neutral-200 text-neutral-400'
                        }`}
                        title="Checkout directo por WhatsApp"
                      >
                        <span className="truncate">🛒 WApp</span>
                        <span className="font-bold text-[9px] ml-0.5">{store.featureFlags?.whatsappCheckout !== false ? 'ON' : 'OFF'}</span>
                      </button>

                      {/* Mercado Pago Checkout */}
                      <button
                        type="button"
                        onClick={() => handleToggleFeatureFlag(store, 'mercadoPagoCheckout')}
                        className={`px-1.5 py-1 rounded-md border flex items-center justify-between text-left transition-colors cursor-pointer ${
                          store.featureFlags?.mercadoPagoCheckout !== false
                            ? 'bg-[#009ee3]/10 border-[#009ee3]/30 text-[#009ee3] font-semibold'
                            : 'bg-neutral-100 border-neutral-200 text-neutral-400'
                        }`}
                        title="Cobro online con Mercado Pago"
                      >
                        <span className="truncate">💳 MP</span>
                        <span className="font-bold text-[9px] ml-0.5">{store.featureFlags?.mercadoPagoCheckout !== false ? 'ON' : 'OFF'}</span>
                      </button>

                      {/* Fotos Dispositivo */}
                      <button
                        type="button"
                        onClick={() => handleToggleFeatureFlag(store, 'uploadDevicePhotos')}
                        className={`px-1.5 py-1 rounded-md border flex items-center justify-between text-left transition-colors cursor-pointer ${
                          store.featureFlags?.uploadDevicePhotos !== false
                            ? 'bg-teal-50/70 border-teal-200 text-teal-800'
                            : 'bg-neutral-100 border-neutral-200 text-neutral-400'
                        }`}
                        title="Subir fotos desde archivos del dispositivo"
                      >
                        <span className="truncate">📱 Fotos</span>
                        <span className="font-bold text-[9px] ml-0.5">{store.featureFlags?.uploadDevicePhotos !== false ? 'ON' : 'OFF'}</span>
                      </button>
                    </div>

                  </div>
                </div>

                {/* Card Actions Bottom */}
                <div className="bg-neutral-50/80 px-5 py-3.5 border-t border-neutral-100 flex flex-col gap-2.5">
                  {/* Botón Principal para Habilitar / Deshabilitar Comercio */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(store)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border shadow-2xs active:scale-[0.99] ${
                      isActive
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200/90 hover:border-amber-300'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent shadow-xs hover:shadow'
                    }`}
                    title={isActive ? 'Deshabilitar comercio' : 'Habilitar comercio'}
                  >
                    <span className="material-symbols-outlined text-[17px]">
                      {isActive ? 'pause_circle' : 'check_circle'}
                    </span>
                    <span>{isActive ? 'Deshabilitar comercio' : 'Habilitar comercio'}</span>
                  </button>

                  {/* Botón de Reset Sandbox exclusivo para tiendas de prueba */}
                  {store.isSandbox && (
                    <button
                      type="button"
                      onClick={() => setSandboxResetStore(store)}
                      className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200/90 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      title="Restaurar productos, ventas y configuraciones de muestra a valores limpios de fábrica"
                    >
                      <span className="material-symbols-outlined text-[16px] text-indigo-600">restart_alt</span>
                      <span>Resetear datos de fábrica (Sandbox)</span>
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onSelectStore(store.slug, 'storefront')}
                      className="py-2 px-3 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[16px] text-neutral-500">storefront</span>
                      <span>Catálogo</span>
                    </button>
                    <button
                      onClick={() => onSelectStore(store.slug, 'admin')}
                      className="py-2 px-3 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[16px] text-neutral-300">settings</span>
                      <span>Admin</span>
                    </button>
                  </div>

                  {/* Secondary actions: copy link, edit, delete */}
                  <div className="flex items-center justify-between pt-1 text-xs text-neutral-500">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyStoreLink(store.slug, 'catalog')}
                        className="hover:text-neutral-900 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Copiar enlace directo al catálogo"
                      >
                        <span className="material-symbols-outlined text-[14px]">link</span>
                        <span>Link Catálogo</span>
                      </button>
                      <span className="text-neutral-300">|</span>
                      <button
                        onClick={() => copyStoreLink(store.slug, 'admin')}
                        className="hover:text-neutral-900 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Copiar enlace directo al panel admin"
                      >
                        <span className="material-symbols-outlined text-[14px]">key</span>
                        <span>Link Admin</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingStore(store);
                          setEditName(store.name);
                          setEditWhatsApp(store.whatsappNumber || '');
                          setEditPassword(store.adminPassword || 'admin');
                          setEditIsSandbox(!!store.isSandbox);
                        }}
                        className="p-1 hover:text-neutral-900 rounded transition-colors cursor-pointer"
                        title="Editar datos de la tienda"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button
                        onClick={() => setStoreToDelete(store)}
                        className="p-1 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        title="Eliminar tienda"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CREATE NEW STORE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">add_business</span>
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 text-base">Crear Nueva Tienda</h3>
                  <p className="text-xs text-neutral-500">Configura los datos del nuevo comercio independiente</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-neutral-400 hover:text-black rounded-lg p-1 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateStore} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                  Nombre del Comercio *
                </label>
                <input
                  type="text"
                  required
                  value={newStoreName}
                  onChange={(e) => {
                    setNewStoreName(e.target.value);
                    if (!newStoreSlug || newStoreSlug === newStoreName.toLowerCase().replace(/[^a-z0-9]/g, '-')) {
                      setNewStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                    }
                  }}
                  placeholder="Ej: Calipso Indumentaria"
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                  Identificador / Slug URL
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-2.5 bg-neutral-100 border border-r-0 border-neutral-200 rounded-l-xl text-xs text-neutral-600 font-mono font-bold select-none">
                    /
                  </span>
                  <input
                    type="text"
                    value={newStoreSlug}
                    onChange={(e) => setNewStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="calipso"
                    className="flex-1 px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-r-xl text-neutral-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white"
                  />
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Dirección directa para abrir el catálogo: <code className="text-neutral-700 font-bold">/{newStoreSlug || 'nombre-tienda'}</code>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                    WhatsApp para Pedidos
                  </label>
                  <input
                    type="text"
                    value={newStoreWhatsApp}
                    onChange={(e) => setNewStoreWhatsApp(e.target.value)}
                    placeholder="+5491130000000"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                    Clave Admin del Comercio
                  </label>
                  <div className="relative">
                    <input
                      type={showNewStorePassword ? 'text' : 'password'}
                      value={newStorePassword}
                      onChange={(e) => setNewStorePassword(e.target.value)}
                      placeholder="AdminApolo2026!"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewStorePassword(!showNewStorePassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black transition-colors cursor-pointer"
                      title={showNewStorePassword ? 'Ocultar clave' : 'Mostrar clave'}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showNewStorePassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 transition-colors">
                  <input
                    type="checkbox"
                    checked={newStoreIsSandbox}
                    onChange={(e) => setNewStoreIsSandbox(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                      <span>🧪 Marcar como Tienda Sandbox (Modo Pruebas)</span>
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      Incluirá badge distintivo y botón para restablecer datos de fábrica fácilmente.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-medium text-neutral-600 hover:text-black rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newStoreName.trim()}
                  className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                      <span>Creando...</span>
                    </>
                  ) : (
                    <span>Crear Tienda</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STORE MODAL */}
      {editingStore && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-neutral-900 text-base">Editar Tienda: {editingStore.name}</h3>
              <button
                onClick={() => setEditingStore(null)}
                className="text-neutral-400 hover:text-black rounded-lg p-1 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                  Nombre del Comercio
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                  WhatsApp para Pedidos
                </label>
                <input
                  type="text"
                  value={editWhatsApp}
                  onChange={(e) => setEditWhatsApp(e.target.value)}
                  placeholder="+54911..."
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                  Contraseña de Admin de la Tienda
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="AdminApolo2026!"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black transition-colors cursor-pointer"
                    title={showEditPassword ? 'Ocultar clave' : 'Mostrar clave'}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showEditPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 transition-colors">
                  <input
                    type="checkbox"
                    checked={editIsSandbox}
                    onChange={(e) => setEditIsSandbox(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                      <span>🧪 Tienda Sandbox (Modo Pruebas)</span>
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      Habilita el botón de reset a fábrica y el distintivo visual de pruebas.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingStore(null)}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-black rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FEATURE FLAGS MODAL */}
      {featureFlagsStore && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-2xs">
                  <span className="material-symbols-outlined text-2xl">tune</span>
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 text-base">
                    Feature Flags: {featureFlagsStore.name}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Control dinámico de funcionalidades por comercio
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFeatureFlagsStore(null)}
                className="text-neutral-400 hover:text-black rounded-lg p-1 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="py-4 space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {/* Flag 1: Catalogo Publico */}
              <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100/70 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[20px]">storefront</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-900">1) Catálogo Público</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        featureFlagsStore.featureFlags?.publicCatalog !== false
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-neutral-200 text-neutral-600'
                      }`}>
                        {featureFlagsStore.featureFlags?.publicCatalog !== false ? 'Habilitado' : 'Deshabilitado'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                      Habilita o deshabilita el acceso público al catálogo para compradores. Si está apagado, los clientes verán aviso de catálogo no disponible y el comercio podrá seguir operando en su panel.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeatureFlag(featureFlagsStore, 'publicCatalog')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    featureFlagsStore.featureFlags?.publicCatalog !== false ? 'bg-emerald-600' : 'bg-neutral-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      featureFlagsStore.featureFlags?.publicCatalog !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Flag 2: Asistente IA */}
              <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100/70 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-900">2) Carga con IA (Asistente Gemini)</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        featureFlagsStore.featureFlags?.aiAssistant !== false
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-neutral-200 text-neutral-600'
                      }`}>
                        {featureFlagsStore.featureFlags?.aiAssistant !== false ? 'Habilitado' : 'Deshabilitado'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                      Muestra u oculta el botón "Nuevo producto con IA", que detecta automáticamente colores, nombre, categoría y tags a partir de fotos con Gemini 2.5 Flash.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeatureFlag(featureFlagsStore, 'aiAssistant')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    featureFlagsStore.featureFlags?.aiAssistant !== false ? 'bg-amber-600' : 'bg-neutral-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      featureFlagsStore.featureFlags?.aiAssistant !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Flag 3: Modulo Ventas */}
              <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-100/70 text-purple-800 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[20px]">point_of_sale</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-900">3) Módulo de Ventas & Cobros</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        featureFlagsStore.featureFlags?.salesModule !== false
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-neutral-200 text-neutral-600'
                      }`}>
                        {featureFlagsStore.featureFlags?.salesModule !== false ? 'Habilitado' : 'Deshabilitado'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                      Muestra u oculta la pestaña "Registro de Ventas" en la barra de navegación del administrador de la tienda.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeatureFlag(featureFlagsStore, 'salesModule')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    featureFlagsStore.featureFlags?.salesModule !== false ? 'bg-purple-600' : 'bg-neutral-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      featureFlagsStore.featureFlags?.salesModule !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Flag 4: Personalizador de Marca */}
              <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-pink-100/70 text-pink-800 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[20px]">palette</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-900">4) Personalizador de Marca</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        featureFlagsStore.featureFlags?.brandCustomizer !== false
                          ? 'bg-pink-100 text-pink-800'
                          : 'bg-neutral-200 text-neutral-600'
                      }`}>
                        {featureFlagsStore.featureFlags?.brandCustomizer !== false ? 'Habilitado' : 'Deshabilitado'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                      Muestra u oculta la pestaña "Diseño & Marca" para que el comercio ajuste logos, paleta de colores oficial y tipografías.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeatureFlag(featureFlagsStore, 'brandCustomizer')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    featureFlagsStore.featureFlags?.brandCustomizer !== false ? 'bg-pink-600' : 'bg-neutral-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      featureFlagsStore.featureFlags?.brandCustomizer !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Flag 5: Límite Numérico de Prendas (maxProducts) */}
              <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-100/70 text-indigo-800 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-900">5) Límite de Prendas en Catálogo</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          featureFlagsStore.featureFlags?.maxProducts && featureFlagsStore.featureFlags.maxProducts > 0
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {featureFlagsStore.featureFlags?.maxProducts && featureFlagsStore.featureFlags.maxProducts > 0
                            ? `${featureFlagsStore.featureFlags.maxProducts} prendas`
                            : 'Ilimitado'}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                        Tope máximo de prendas activas permitidas. Si se supera, el sistema bloquea crear nuevos artículos hasta liberar espacio o ampliar el cupo. (Actual: {featureFlagsStore.productCount || 0} prendas cargadas).
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pl-12">
                  {[0, 10, 25, 50, 100, 250].map((preset) => {
                    const currentVal = featureFlagsStore.featureFlags?.maxProducts || 0;
                    const isSelected = currentVal === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleUpdateMaxProducts(featureFlagsStore, preset)}
                        className={`px-2.5 py-1 text-xs rounded-lg font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                            : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                        }`}
                      >
                        {preset === 0 ? '♾️ Ilimitado' : `${preset} prendas`}
                      </button>
                    );
                  })}
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-[11px] text-neutral-500 font-medium">Personalizado:</span>
                    <input
                      type="number"
                      min="0"
                      max="10000"
                      value={featureFlagsStore.featureFlags?.maxProducts || 0}
                      onChange={(e) => handleUpdateMaxProducts(featureFlagsStore, Number(e.target.value) || 0)}
                      className="w-16 px-2 py-1 text-xs font-mono font-bold border border-neutral-300 rounded-lg bg-white text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Flag 6: WhatsApp Checkout */}
              <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-100/70 text-green-800 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[20px]">shopping_cart_checkout</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-900">6) Checkout Directo por WhatsApp</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        featureFlagsStore.featureFlags?.whatsappCheckout !== false
                          ? 'bg-green-100 text-green-800'
                          : 'bg-neutral-200 text-neutral-600'
                      }`}>
                        {featureFlagsStore.featureFlags?.whatsappCheckout !== false ? 'Habilitado' : 'Deshabilitado'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                      Permite a los clientes finalizar pedidos desde el carrito con armado del mensaje automático hacia WhatsApp. Si se apaga, la tienda funciona como vitrina/catálogo para consultar.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeatureFlag(featureFlagsStore, 'whatsappCheckout')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    featureFlagsStore.featureFlags?.whatsappCheckout !== false ? 'bg-green-600' : 'bg-neutral-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      featureFlagsStore.featureFlags?.whatsappCheckout !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Flag 7: Exportar Productos */}
              <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-100/70 text-blue-800 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[20px]">file_download</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-900">7) Exportar Productos (CSV)</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        featureFlagsStore.featureFlags?.exportProducts !== false
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-neutral-200 text-neutral-600'
                      }`}>
                        {featureFlagsStore.featureFlags?.exportProducts !== false ? 'Habilitado' : 'Deshabilitado'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                      Habilita el botón "Exportar Planilla" (CSV) en el panel de inventario de productos.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeatureFlag(featureFlagsStore, 'exportProducts')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    featureFlagsStore.featureFlags?.exportProducts !== false ? 'bg-blue-600' : 'bg-neutral-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      featureFlagsStore.featureFlags?.exportProducts !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Flag 8: Exportar Ventas */}
              <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-100/70 text-purple-800 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-900">8) Exportar Ventas (CSV)</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        featureFlagsStore.featureFlags?.exportSales !== false
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-neutral-200 text-neutral-600'
                      }`}>
                        {featureFlagsStore.featureFlags?.exportSales !== false ? 'Habilitado' : 'Deshabilitado'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                      Habilita el botón "Exportar Planilla" (CSV) en el libro comercial de ventas y cobros.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeatureFlag(featureFlagsStore, 'exportSales')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    featureFlagsStore.featureFlags?.exportSales !== false ? 'bg-purple-600' : 'bg-neutral-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      featureFlagsStore.featureFlags?.exportSales !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Flag 9: Fotos del Dispositivo */}
              <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-teal-100/70 text-teal-800 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[20px]">upload_file</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-900">9) Fotos desde el Dispositivo</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        featureFlagsStore.featureFlags?.uploadDevicePhotos !== false
                          ? 'bg-teal-100 text-teal-800'
                          : 'bg-neutral-200 text-neutral-600'
                      }`}>
                        {featureFlagsStore.featureFlags?.uploadDevicePhotos !== false ? 'Habilitado' : 'Deshabilitado'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                      Permite al usuario subir fotos directamente desde archivos locales (PC/Celular), además de enlaces públicos o Google Drive (en logo, ficha de producto y creación por IA).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeatureFlag(featureFlagsStore, 'uploadDevicePhotos')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    featureFlagsStore.featureFlags?.uploadDevicePhotos !== false ? 'bg-teal-600' : 'bg-neutral-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      featureFlagsStore.featureFlags?.uploadDevicePhotos !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Flag 10: Mercado Pago Checkout */}
              <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#009ee3]/10 text-[#009ee3] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[20px]">credit_card</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-900">10) Cobro Online con Mercado Pago</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        featureFlagsStore.featureFlags?.mercadoPagoCheckout !== false
                          ? 'bg-[#009ee3]/20 text-[#009ee3]'
                          : 'bg-neutral-200 text-neutral-600'
                      }`}>
                        {featureFlagsStore.featureFlags?.mercadoPagoCheckout !== false ? 'Habilitado' : 'Deshabilitado'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                      Habilita la pasarela oficial de Checkout Pro con tarjetas de crédito, débito y dinero en cuenta en el carrito. Los cobros impactan directamente en la cuenta de Mercado Pago del comercio.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFeatureFlag(featureFlagsStore, 'mercadoPagoCheckout')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    featureFlagsStore.featureFlags?.mercadoPagoCheckout !== false ? 'bg-[#009ee3]' : 'bg-neutral-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      featureFlagsStore.featureFlags?.mercadoPagoCheckout !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>


            <div className="pt-4 flex items-center justify-end border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setFeatureFlagsStore(null)}
                className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Cerrar y Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SANDBOX RESET CONFIRMATION MODAL */}
      {sandboxResetStore && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-2xl">restart_alt</span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              ¿Restablecer Tienda Sandbox "{sandboxResetStore.name}"?
            </h3>
            <div className="text-xs text-neutral-600 mb-5 space-y-2 leading-relaxed">
              <p>
                Esta acción restaurará la tienda de pruebas a sus <strong>valores originales de fábrica</strong>:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-neutral-500">
                <li>Catálogo de demostración con prendas, talles y variantes limpias.</li>
                <li>Libro comercial de ventas y cobros iniciales.</li>
                <li>Colores y configuraciones de marca predeterminados.</li>
                <li>Todos los Feature Flags activados.</li>
              </ul>
              <p className="text-indigo-700 font-semibold pt-1">
                Ideal para reiniciar pruebas o preparar una demo limpia para nuevos clientes.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isResettingSandbox}
                onClick={() => setSandboxResetStore(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isResettingSandbox}
                onClick={handleExecuteResetSandbox}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isResettingSandbox ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    <span>Restableciendo...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                    <span>Restablecer Datos de Fábrica</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLATFORM MERCADO PAGO MASTER MODAL */}
      {isPlatformMpModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-neutral-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#009EE3] text-white flex items-center justify-center font-black text-sm shadow-xs">
                  MP
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold tracking-tight text-white">
                      Pasarela Global Mercado Pago
                    </h3>
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md tracking-wider ${
                      platformSandboxMode
                        ? 'bg-amber-400 text-neutral-900'
                        : 'bg-emerald-400 text-neutral-900'
                    }`}>
                      {platformSandboxMode ? 'Sandbox (Prueba)' : 'Producción (Real)'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Infraestructura centralizada de la plataforma • Exclusivo Super Administrador
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPlatformMpModalOpen(false)}
                className="w-8 h-8 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Modal Subnav Tabs */}
            <div className="flex border-b border-neutral-200 bg-neutral-50 px-6 pt-3 gap-2">
              <button
                type="button"
                onClick={() => setActiveMpModalTab('credentials')}
                className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeMpModalTab === 'credentials'
                    ? 'border-[#009EE3] text-[#009EE3]'
                    : 'border-transparent text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">key</span>
                <span>Credenciales Maestras</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMpModalTab('guide')}
                className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeMpModalTab === 'guide'
                    ? 'border-[#009EE3] text-[#009EE3]'
                    : 'border-transparent text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
                <span>Paso a Producción & Resguardo</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMpModalTab('cards')}
                className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeMpModalTab === 'cards'
                    ? 'border-[#009EE3] text-[#009EE3]'
                    : 'border-transparent text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">credit_card</span>
                <span>Tarjetas de Prueba (Sandbox)</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[75vh] overflow-y-auto">
              {/* TAB 1: CREDENTIALS */}
              {activeMpModalTab === 'credentials' && (
                <form onSubmit={handleSavePlatformMp} className="space-y-5">
                  {/* Status Banner */}
                  {mpVerifyResult?.valid ? (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-emerald-600 text-xl">check_circle</span>
                        <div>
                          <div className="text-xs font-bold text-emerald-900">
                            Conexión verificada con la API de Mercado Pago
                          </div>
                          <div className="text-[11px] text-emerald-700">
                            Cuenta: {mpVerifyResult.nickname} {mpVerifyResult.email ? `(${mpVerifyResult.email})` : ''} • Región: {mpVerifyResult.siteId || 'MLA'}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleVerifyPlatformMp}
                        disabled={isVerifyingMp}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-white text-emerald-800 hover:bg-emerald-100 rounded-lg border border-emerald-300 transition-colors cursor-pointer shrink-0"
                      >
                        {isVerifyingMp ? 'Probando...' : 'Re-verificar'}
                      </button>
                    </div>
                  ) : mpVerifyResult?.valid === false ? (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-rose-600 text-xl">error</span>
                      <div>
                        <div className="text-xs font-bold text-rose-900">Error en credenciales de Mercado Pago</div>
                        <div className="text-[11px] text-rose-700">{mpVerifyResult.error}</div>
                      </div>
                    </div>
                  ) : null}

                  {/* Mode Selector */}
                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-neutral-900">Entorno de Operación</div>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Define si las ventas se procesan en modo de prueba o con cobros bancarios reales.
                      </p>
                    </div>

                    <div className="inline-flex p-1 bg-white border border-neutral-200 rounded-xl shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setPlatformSandboxMode(true)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          platformSandboxMode
                            ? 'bg-amber-100 text-amber-900 shadow-2xs'
                            : 'text-neutral-600 hover:text-black'
                        }`}
                      >
                        Sandbox (Prueba)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlatformSandboxMode(false)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          !platformSandboxMode
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-neutral-600 hover:text-black'
                        }`}
                      >
                        Producción (Real)
                      </button>
                    </div>
                  </div>

                  {/* Public Key */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-neutral-800">
                        Public Key (Clave Pública)
                      </label>
                      <button
                        type="button"
                        onClick={() => handleCopy(platformPublicKey, 'public')}
                        className="text-[11px] text-[#009EE3] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[13px]">content_copy</span>
                        <span>{copiedKey === 'public' ? '¡Copiada!' : 'Copiar'}</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={platformPublicKey}
                      onChange={(e) => setPlatformPublicKey(e.target.value)}
                      placeholder="APP_USR-xxxx-xxxx..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-mono bg-neutral-50/50 focus:bg-white focus:ring-2 focus:ring-[#009EE3] focus:border-[#009EE3] outline-none"
                    />
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Identificador público de la aplicación de Mercado Pago.
                    </p>
                  </div>

                  {/* Access Token */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-neutral-800">
                        Access Token (Clave Secreta de Plataforma)
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowPlatformToken(!showPlatformToken)}
                          className="text-[11px] text-neutral-600 hover:text-black flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {showPlatformToken ? 'visibility_off' : 'visibility'}
                          </span>
                          <span>{showPlatformToken ? 'Ocultar' : 'Revelar'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(platformAccessToken, 'token')}
                          className="text-[11px] text-[#009EE3] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[13px]">content_copy</span>
                          <span>{copiedKey === 'token' ? '¡Copiado!' : 'Copiar'}</span>
                        </button>
                      </div>
                    </div>
                    <input
                      type={showPlatformToken ? 'text' : 'password'}
                      required
                      value={platformAccessToken}
                      onChange={(e) => setPlatformAccessToken(e.target.value)}
                      placeholder="APP_USR-xxxx-xxxx..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-mono bg-neutral-50/50 focus:bg-white focus:ring-2 focus:ring-[#009EE3] focus:border-[#009EE3] outline-none"
                    />
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Clave de autorización con permisos para generar preferencias de Checkout Pro.
                    </p>
                  </div>

                  {/* Save and Verify Buttons */}
                  <div className="pt-4 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={isVerifyingMp}
                      onClick={handleVerifyPlatformMp}
                      className="px-4 py-2 text-xs font-medium text-neutral-700 hover:text-black bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[15px]">sync</span>
                      <span>{isVerifyingMp ? 'Verificando con MP...' : 'Testear Conexión'}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsPlatformMpModalOpen(false)}
                        className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-800 rounded-xl cursor-pointer"
                      >
                        Cerrar
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingPlatformMp}
                        className="px-5 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {isSavingPlatformMp ? (
                          <>
                            <span className="material-symbols-outlined text-[14px] animate-spin">refresh</span>
                            <span>Guardando...</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[16px]">save</span>
                            <span>Guardar Credenciales</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* TAB 2: PRODUCTION GUIDE & SECURITY */}
              {activeMpModalTab === 'guide' && (
                <div className="space-y-4 text-xs text-neutral-700">
                  <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 text-blue-900">
                    <h4 className="text-sm font-bold flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined text-blue-600 text-[18px]">verified_user</span>
                      ¿Cómo resguardar tus credenciales en Producción sin escribirlas en el chat?
                    </h4>
                    <p className="text-xs leading-relaxed text-blue-800">
                      Tenés dos métodos 100% seguros y privados para configurar tus credenciales de producción sin exponerlas jamás públicamente:
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-neutral-200 space-y-2">
                    <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-neutral-900 text-white text-[11px] flex items-center justify-center">1</span>
                      Opción A: Cargar directamente en este panel de Super Admin
                    </div>
                    <p className="text-xs text-neutral-600 pl-6 leading-relaxed">
                      Este modal está protegido bajo tu clave maestra de Super Administrador. Podés pegar aquí tu Public Key y Access Token de producción, seleccionar el modo <strong>Producción (Real)</strong> y presionar Guardar. Los datos se envían cifrados directamente al backend.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-neutral-200 space-y-2">
                    <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-neutral-900 text-white text-[11px] flex items-center justify-center">2</span>
                      Opción B: Variables de entorno del servidor (.env)
                    </div>
                    <p className="text-xs text-neutral-600 pl-6 leading-relaxed">
                      Al desplegar en Cloud Run / servidor, definís las variables de entorno <code className="bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-800 font-mono">MERCADOPAGO_PUBLIC_KEY</code> y <code className="bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-800 font-mono">MERCADOPAGO_ACCESS_TOKEN</code>. El servidor las detecta automáticamente como prioritarias sin necesidad de guardarlas en base de datos.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200">
                    <h5 className="font-bold text-neutral-900 mb-2">Pasos para homologar en Mercado Pago:</h5>
                    <ol className="list-decimal pl-5 space-y-1.5 text-xs text-neutral-600">
                      <li>Ingresá a <a href="https://www.mercadopago.com.ar/developers" target="_blank" rel="noreferrer" className="text-[#009EE3] underline font-medium">mercadopago.com.ar/developers</a> con tu cuenta.</li>
                      <li>Abrí la aplicación que creaste y navegá a <strong>Credenciales de producción</strong>.</li>
                      <li>Completá el formulario de homologación (nombre del negocio, sitio web de la tienda, rubro indumentaria).</li>
                      <li>Mercado Pago te habilitará de inmediato el par de credenciales de Producción.</li>
                      <li>Copiá esas credenciales y pegalas en este panel o en tus variables de entorno.</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* TAB 3: TEST CARDS */}
              {activeMpModalTab === 'cards' && (
                <div className="space-y-4 text-xs text-neutral-700">
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-amber-600 text-lg shrink-0 mt-0.5">info</span>
                    <div>
                      <strong className="font-bold">Modo Sandbox Activo:</strong> Podés usar estas tarjetas oficiales de prueba de Mercado Pago para simular compras en el catálogo sin transferir dinero real.
                    </div>
                  </div>

                  <div className="border border-neutral-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-100 text-neutral-700 border-b border-neutral-200 font-semibold">
                        <tr>
                          <th className="p-3">Resultado</th>
                          <th className="p-3">Tarjeta</th>
                          <th className="p-3">Número de Tarjeta</th>
                          <th className="p-3">Vencimiento</th>
                          <th className="p-3">CVV</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        <tr className="bg-emerald-50/40">
                          <td className="p-3 font-bold text-emerald-800 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                            Pago Aprobado
                          </td>
                          <td className="p-3 font-medium">Visa Crédito</td>
                          <td className="p-3 font-mono font-semibold">4010 0000 0000 0001</td>
                          <td className="p-3 font-mono">11/28</td>
                          <td className="p-3 font-mono">123</td>
                        </tr>
                        <tr className="bg-emerald-50/40">
                          <td className="p-3 font-bold text-emerald-800 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                            Pago Aprobado
                          </td>
                          <td className="p-3 font-medium">Mastercard</td>
                          <td className="p-3 font-mono font-semibold">5031 7557 3453 0001</td>
                          <td className="p-3 font-mono">11/28</td>
                          <td className="p-3 font-mono">123</td>
                        </tr>
                        <tr className="bg-rose-50/40">
                          <td className="p-3 font-bold text-rose-800 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-rose-600">cancel</span>
                            Fondos Insuficientes
                          </td>
                          <td className="p-3 font-medium">Visa Débito</td>
                          <td className="p-3 font-mono font-semibold">4010 0000 0000 0003</td>
                          <td className="p-3 font-mono">11/28</td>
                          <td className="p-3 font-mono">123</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1.5">
                    <div className="font-bold text-neutral-900">Datos del comprador de prueba:</div>
                    <p className="text-neutral-600">
                      • Nombre: <span className="font-mono text-neutral-800">Juan Pérez</span>
                    </p>
                    <p className="text-neutral-600">
                      • Email: <span className="font-mono text-neutral-800">comprador.prueba@testuser.com</span>
                    </p>
                    <p className="text-neutral-600">
                      • DNI / CUIT: <span className="font-mono text-neutral-800">33444555</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE STORE CONFIRMATION MODAL */}
      {storeToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-2xl">delete_forever</span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              ¿Eliminar la tienda "{storeToDelete.name}"?
            </h3>
            <p className="text-xs text-neutral-500 mb-5 leading-relaxed">
              Esta acción eliminará permanentemente la tienda con identificador <code className="bg-neutral-100 px-1 py-0.5 rounded font-mono text-neutral-800">/{storeToDelete.slug}</code>, junto con sus productos y configuraciones.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setStoreToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const s = storeToDelete;
                  setStoreToDelete(null);
                  await executeDeleteStore(s);
                }}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Eliminar Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white px-4 py-3 rounded-xl shadow-xl text-xs font-medium flex items-center gap-2 border border-neutral-800 animate-in fade-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
