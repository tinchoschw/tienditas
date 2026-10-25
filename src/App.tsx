import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { StorefrontView } from './components/StorefrontView';
import { InventoryView } from './components/InventoryView';
import { SalesView } from './components/SalesView';
import { BrandCustomizerView } from './components/BrandCustomizerView';
import { PaymentsConfigView } from './components/PaymentsConfigView';
import { AdminLoginView } from './components/AdminLoginView';
import { CartDrawer } from './components/CartDrawer';
import { SuperAdminView } from './components/SuperAdminView';
import { PlatformLandingView } from './components/PlatformLandingView';
import { DisabledStoreNotice } from './components/DisabledStoreNotice';
import { AdminHelpAssistant } from './components/AdminHelpAssistant';
import { useModalHistory } from './hooks/useModalHistory';
import { Product, Sale, StoreSettings, CartItem, Store } from './types';
import { INITIAL_PRODUCTS, INITIAL_SALES, INITIAL_SETTINGS, INITIAL_STORES } from './initialData';
import {
  subscribeStores,
  updateStoreMeta,
  subscribeStoreSettings,
  updateStoreSettings,
  subscribeProducts,
  saveProduct,
  deleteProduct,
  subscribeSales,
  createSale,
  cancelSale,
  deleteSale,
  addPaymentToSale,
  updateSaleItems,
  confirmPreventaSale,
  confirmMercadoPagoOrder,
  getStoreSettingsFromDb,
  getSettingsKey,
  getProductsKey,
  getSalesKey
} from './services/db';

const INITIAL_CART: CartItem[] = [];

export interface ParsedRoute {
  route: 'landing' | 'storefront' | 'admin' | 'superadmin';
  storeSlug: string;
  productId?: string;
}

export function parseCurrentRoute(): ParsedRoute {
  // Support both hash-based (#/calipso) and pathname-based (/calipso) routing
  let rawPath = '';
  let queryString = '';

  if (window.location.hash && window.location.hash.length > 1) {
    const hashContent = window.location.hash.replace(/^#\/?/, '').trim();
    const hashParts = hashContent.split('?');
    rawPath = hashParts[0] || '';
    queryString = hashParts[1] || '';
  } else {
    rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '').trim();
    queryString = window.location.search.replace(/^\?/, '');
  }

  // Also check window.location.search if hash didn't carry query params
  if (!queryString && window.location.search) {
    queryString = window.location.search.replace(/^\?/, '');
  }

  const searchParams = new URLSearchParams(queryString);
  let productId = searchParams.get('p') || searchParams.get('producto') || searchParams.get('item') || undefined;

  // Root or index.html -> Platform Landing Page (No default store)
  if (!rawPath || rawPath === 'index.html') {
    return { route: 'landing', storeSlug: '', productId };
  }

  const parts = rawPath.split('/').filter(Boolean);
  const first = parts[0]?.toLowerCase() || '';
  const second = parts[1]?.toLowerCase() || '';

  if (first === 'superadmin') {
    return { route: 'superadmin', storeSlug: '', productId };
  }

  // Legacy format support: admin/calipso or store/calipso
  if (first === 'admin' && second) {
    return { route: 'admin', storeSlug: second, productId };
  }
  if ((first === 'store' || first === 'tienda') && second) {
    const isSubAdmin = parts[2]?.toLowerCase() === 'admin';
    if (isSubAdmin) {
      return { route: 'admin', storeSlug: second, productId };
    }
    // Deep link sub-path: /store/calipso/p/prod-xxx
    if ((parts[2]?.toLowerCase() === 'p' || parts[2]?.toLowerCase() === 'producto') && parts[3]) {
      productId = parts[3];
    }
    return { route: 'storefront', storeSlug: second, productId };
  }

  // Simple clean URLs:
  // /calipso -> Storefront
  // /calipso/admin -> Admin panel
  if (second === 'admin') {
    return { route: 'admin', storeSlug: first, productId };
  }

  // Deep link sub-path: /calipso/p/prod-xxx
  if ((second === 'p' || second === 'producto') && parts[2]) {
    productId = parts[2];
  }

  return { route: 'storefront', storeSlug: first, productId };
}

function MainContent() {
  // Stores directory
  const [stores, setStores] = useState<Store[]>(INITIAL_STORES);
  const [storesLoaded, setStoresLoaded] = useState<boolean>(false);

  // Route parsing
  const [routeInfo, setRouteInfo] = useState<ParsedRoute>(() => parseCurrentRoute());

  // Current store slug
  const currentStoreSlug = routeInfo.storeSlug;

  // Navigation helper that updates history and triggers route update
  const navigateTo = (newPath: string) => {
    // If the browser current URL uses hash, keep hash in sync; otherwise use clean pathname
    if (window.location.hash && window.location.hash.length > 1) {
      window.location.hash = newPath.startsWith('/') ? `#${newPath}` : `#/${newPath}`;
    } else {
      window.history.pushState(null, '', newPath);
      setRouteInfo(parseCurrentRoute());
    }
  };

  // Synchronize route on browser back/forward or hash change
  useEffect(() => {
    const handleLocationChange = () => {
      setRouteInfo(parseCurrentRoute());
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Subscribe to Stores list
  useEffect(() => {
    const unsub = subscribeStores((stList) => {
      setStores(stList);
      setStoresLoaded(true);
    });
    return () => unsub();
  }, []);

  // Admin Authenticated Session per store
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    if (!currentStoreSlug) return false;
    try {
      const key = `atelier_admin_auth_${currentStoreSlug}`;
      return sessionStorage.getItem(key) === 'true' || sessionStorage.getItem('atelier_superadmin_auth') === 'true';
    } catch {
      return false;
    }
  });

  // Re-check authentication when store slug changes
  useEffect(() => {
    if (!currentStoreSlug) {
      setIsAdminAuthenticated(false);
      return;
    }
    try {
      const key = `atelier_admin_auth_${currentStoreSlug}`;
      const isAuth = sessionStorage.getItem(key) === 'true' || sessionStorage.getItem('atelier_superadmin_auth') === 'true';
      setIsAdminAuthenticated(isAuth);
    } catch {
      setIsAdminAuthenticated(false);
    }
  }, [currentStoreSlug]);

  // Admin Sub-Tab
  const [adminTab, setAdminTab] = useState<'inventory' | 'sales' | 'brand' | 'payments'>('inventory');

  // Customer Slide-Over Cart
  const [isSlideOverCartOpen, setIsSlideOverCartOpen] = useState(false);

  // Payment Feedback Modal when returning from Mercado Pago
  const [paymentModalInfo, setPaymentModalInfo] = useState<{
    status: 'approved' | 'failure' | 'pending';
    extRef?: string;
  } | null>(null);

  // Shop Owner AI Help Assistant
  const [isHelpAssistantOpen, setIsHelpAssistantOpen] = useState(false);

  // Mobile Back Button / Gesture Handlers for App-level modals
  useModalHistory({
    isOpen: isSlideOverCartOpen,
    onClose: () => setIsSlideOverCartOpen(false),
    modalKey: 'cart-drawer'
  });

  useModalHistory({
    isOpen: isHelpAssistantOpen,
    onClose: () => setIsHelpAssistantOpen(false),
    modalKey: 'help-assistant'
  });

  useModalHistory({
    isOpen: Boolean(paymentModalInfo),
    onClose: () => setPaymentModalInfo(null),
    modalKey: 'payment-modal'
  });



  // Loading states
  const [isSettingsLoaded, setIsSettingsLoaded] = useState<boolean>(false);
  const [isProductsLoaded, setIsProductsLoaded] = useState<boolean>(false);

  // Firestore Subscribed Data for the active store
  const [settings, setSettings] = useState<StoreSettings>(() => {
    if (!currentStoreSlug) return INITIAL_SETTINGS;
    try {
      const key = getSettingsKey(currentStoreSlug);
      const raw = localStorage.getItem(key) || localStorage.getItem(`atelier_local_settings_${currentStoreSlug}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return INITIAL_SETTINGS;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    if (!currentStoreSlug) return [];
    try {
      const key = getProductsKey(currentStoreSlug);
      const raw = localStorage.getItem(key) || localStorage.getItem(`atelier_local_products_${currentStoreSlug}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return currentStoreSlug === 'apolo' ? INITIAL_PRODUCTS : [];
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    if (!currentStoreSlug) return [];
    try {
      const key = getSalesKey(currentStoreSlug);
      const raw = localStorage.getItem(key) || localStorage.getItem(`atelier_local_sales_${currentStoreSlug}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return currentStoreSlug === 'apolo' ? INITIAL_SALES : [];
  });

  // Customer Cart State (Persisted locally for client and isolated by store)
  const cartStorageKey = currentStoreSlug ? `atelier_cart_${currentStoreSlug}` : 'atelier_cart';
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (!currentStoreSlug) return INITIAL_CART;
    try {
      const raw = localStorage.getItem(cartStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn(e);
    }
    return INITIAL_CART;
  });

  // Reset cart when store changes
  useEffect(() => {
    if (!currentStoreSlug) return;
    try {
      const raw = localStorage.getItem(cartStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setCart(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn(e);
    }
    setCart(INITIAL_CART);
  }, [cartStorageKey, currentStoreSlug]);

  useEffect(() => {
    if (!currentStoreSlug) return;
    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    } catch (e) {
      console.warn(e);
    }
  }, [cart, cartStorageKey, currentStoreSlug]);

  // Check URL params for Mercado Pago redirect returns
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);

      // Check for Mercado Pago OAuth merchant authorization return (non-popup fallback)
      const mpAuth = searchParams.get('mp_auth');
      if (mpAuth === 'success' && currentStoreSlug) {
        // Regla 1: Al volver de la vinculación, solo debe volver a LEER la configuración de la tienda desde Firestore
        // y actualizar el estado local, SIN escribir ni sobrescribir el objeto en Firestore.
        getStoreSettingsFromDb(currentStoreSlug).then((fresh) => {
          if (fresh) {
            setSettings(fresh);
          }
        }).catch(console.warn);

        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } else if (mpAuth === 'error') {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }

      const pStatus = searchParams.get('payment_status') || searchParams.get('status') || searchParams.get('collection_status');
      const extRef = searchParams.get('ext_ref') || searchParams.get('external_reference') || undefined;
      const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id') || undefined;

      if (pStatus === 'approved') {
        setPaymentModalInfo({ status: 'approved', extRef });

        // CLEAR THE CART ONLY UPON SUCCESSFUL APPROVED PAYMENT!
        setCart([]);
        if (currentStoreSlug) {
          try {
            localStorage.removeItem(`atelier_cart_${currentStoreSlug}`);
          } catch (e) {
            console.warn(e);
          }
        }

        // Confirm the sale in local database and Firestore (moves status to cobrada_total and discounts stock if pending)
        if (currentStoreSlug && extRef) {
          confirmMercadoPagoOrder(currentStoreSlug, extRef, { paymentId })
            .then((res) => {
              if (res?.sales) setSales(res.sales);
              if (res?.products) setProducts(res.products);
            })
            .catch(console.warn);
        }

        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } else if (pStatus === 'failure' || pStatus === 'rejected') {
        // DO NOT CLEAR CART: Keep items intact so customer can retry from cart or switch to WhatsApp
        setPaymentModalInfo({ status: 'failure', extRef });
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } else if (pStatus === 'pending') {
        setPaymentModalInfo({ status: 'pending', extRef });
        setCart([]);
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    } catch (e) {
      console.warn('URL payment check error:', e);
    }
  }, [currentStoreSlug]);

  // Update page title and OpenGraph / Social Share tags dynamically for WhatsApp & chat previews
  useEffect(() => {
    let title = 'Catálogo Online - Tienda Oficial';
    let description = 'Explorá nuestro catálogo de productos en línea y realizá tus pedidos directamente por WhatsApp.';
    let siteName = 'Catálogo Online';

    if (routeInfo.route === 'landing') {
      title = 'Plataforma de Comercios Online | Catálogos & Ventas por WhatsApp';
      description = 'Creá tu catálogo digital en minutos con matriz de talles x color y recibí pedidos directos a WhatsApp.';
      siteName = 'Plataforma Multi-Comercio';
    } else if (routeInfo.route === 'superadmin') {
      title = 'Super Admin | Gestión Centralizada Multi-Tienda';
      description = 'Panel de control centralizado de comercios, configuración y catálogos en línea.';
      siteName = 'Super Admin Platform';
    } else if (routeInfo.route === 'admin') {
      title = settings.storeName 
        ? `${settings.storeName} | Panel de Administración` 
        : 'Administración de Tienda';
      description = `Gestión de catálogo, inventario, precios y ventas de ${settings.storeName || 'la tienda'}.`;
      siteName = settings.storeName || 'Administración';
    } else if (settings.storeName) {
      title = `${settings.storeName} | Catálogo Online Oficial`;
      description = `Mirá todas las novedades y productos disponibles en ${settings.storeName} y realizá tu pedido directo por WhatsApp.`;
      siteName = settings.storeName;
    }

    document.title = title;

    const setMeta = (nameOrProperty: string, content: string, isProperty = false) => {
      const selector = isProperty ? `meta[property="${nameOrProperty}"]` : `meta[name="${nameOrProperty}"]`;
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(isProperty ? 'property' : 'name', nameOrProperty);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('description', description);
    setMeta('og:title', title, true);
    setMeta('og:description', description, true);
    setMeta('og:site_name', siteName, true);
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
  }, [settings.storeName, routeInfo.route]);

  // Firestore subscriptions for the active store
  useEffect(() => {
    if (!currentStoreSlug || routeInfo.route === 'landing' || routeInfo.route === 'superadmin') {
      return;
    }

    setIsSettingsLoaded(false);
    setIsProductsLoaded(false);

    const unsubSettings = subscribeStoreSettings(currentStoreSlug, (s) => {
      setSettings(s);
      setIsSettingsLoaded(true);
    });

    const unsubProducts = subscribeProducts(currentStoreSlug, (p) => {
      setProducts(p);
      setIsProductsLoaded(true);
    });

    const unsubSales = subscribeSales(currentStoreSlug, (sl) => {
      setSales(sl);
    });

    return () => {
      unsubSettings();
      unsubProducts();
      unsubSales();
    };
  }, [currentStoreSlug, routeInfo.route]);

  // Customer Cart actions
  const handleAddToCart = (item: CartItem) => {
    setCart((prev) => {
      const prod = products.find((p) => p.id === item.productId);
      const variant = prod?.variants.find(
        (v) =>
          (v.id && v.id === item.variantId) ||
          (v.color.toLowerCase() === item.color.toLowerCase() &&
            v.size.toLowerCase() === item.size.toLowerCase())
      );
      const maxStock = variant ? Math.max(0, Number(variant.stock || 0)) : 999;
      if (maxStock <= 0) return prev;

      const existingIdx = prev.findIndex(
        (ci) => ci.productId === item.productId && ci.size === item.size && ci.color === item.color
      );
      if (existingIdx >= 0) {
        const copy = [...prev];
        const newQty = Math.min(maxStock, copy[existingIdx].quantity + item.quantity);
        copy[existingIdx].quantity = newQty;
        return copy;
      }
      return [...prev, { ...item, quantity: Math.min(maxStock, item.quantity) }];
    });
  };

  const handleUpdateCartQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const item = prev[index];
      if (!item) return prev;
      const prod = products.find((p) => p.id === item.productId);
      const variant = prod?.variants.find(
        (v) =>
          (v.id && v.id === item.variantId) ||
          (v.color.toLowerCase() === item.color.toLowerCase() &&
            v.size.toLowerCase() === item.size.toLowerCase())
      );
      const maxStock = variant ? Math.max(0, Number(variant.stock || 0)) : 999;

      const requestedQty = item.quantity + delta;
      if (requestedQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      const cappedQty = Math.min(maxStock, requestedQty);
      const copy = [...prev];
      copy[index] = { ...item, quantity: cappedQty };
      return copy;
    });
  };

  const handleRemoveCartItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // Route & Auth Navigation Handlers
  const handleOpenAdmin = () => {
    if (currentStoreSlug) {
      navigateTo(`/${currentStoreSlug}/admin`);
    } else {
      navigateTo('/superadmin');
    }
  };

  const handleExitAdmin = () => {
    if (currentStoreSlug) {
      navigateTo(`/${currentStoreSlug}`);
    } else {
      navigateTo('/');
    }
  };

  const handleOpenSuperAdmin = () => {
    navigateTo('/superadmin');
  };

  const handleLogoutAdmin = () => {
    if (currentStoreSlug) {
      try {
        const key = `atelier_admin_auth_${currentStoreSlug}`;
        sessionStorage.removeItem(key);
      } catch (e) {
        console.warn(e);
      }
    }
    setIsAdminAuthenticated(false);
    handleExitAdmin();
  };

  const handleSelectStoreFromSuperAdmin = (slug: string, mode: 'storefront' | 'admin' = 'storefront') => {
    if (mode === 'admin') {
      navigateTo(`/${slug}/admin`);
    } else {
      navigateTo(`/${slug}`);
    }
  };

  const totalCartUnits = cart.reduce((acc, it) => acc + it.quantity, 0);
  const totalCartPrice = cart.reduce((acc, it) => acc + (it.price * it.quantity), 0);

  // 1. LANDING ROUTE (Default without specified store)
  if (routeInfo.route === 'landing') {
    return (
      <PlatformLandingView
        stores={stores}
        onSelectStore={(slug, mode) => {
          if (mode === 'admin') {
            navigateTo(`/${slug}/admin`);
          } else {
            navigateTo(`/${slug}`);
          }
        }}
        onOpenSuperAdmin={handleOpenSuperAdmin}
      />
    );
  }

  // 2. SUPER ADMIN ROUTE
  if (routeInfo.route === 'superadmin') {
    return (
      <SuperAdminView
        stores={stores}
        onSelectStore={handleSelectStoreFromSuperAdmin}
        onExitSuperAdmin={() => navigateTo('/')}
      />
    );
  }

  // 3. STORE NOT FOUND OR DISABLED CHECKS
  const activeStore = stores.find((s) => s.slug === currentStoreSlug || s.id === currentStoreSlug);
  const isStoreDisabled = activeStore ? activeStore.active === false : false;

  // Initial loading state while store registry is resolving
  if (!storesLoaded && currentStoreSlug) {
    return (
      <div className="min-h-screen bg-[#FBF9F8] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mb-3" />
        <p className="text-xs text-neutral-500 font-medium">Cargando...</p>
      </div>
    );
  }

  // 3A. PUBLIC CATALOG FOR A DISABLED STORE (or non-existent store):
  // "Si un comercio esta deshabilitado, el catalogo publico es como si no existiera."
  if (storesLoaded && currentStoreSlug && (!activeStore || (routeInfo.route === 'storefront' && isStoreDisabled))) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 bg-neutral-200 text-neutral-600 rounded-2xl flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-3xl">storefront</span>
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Comercio no encontrado</h1>
        <p className="text-sm text-neutral-600 max-w-md mb-6 leading-relaxed">
          No encontramos ninguna tienda activa con la dirección web <code className="bg-neutral-200 px-2 py-0.5 rounded font-mono text-neutral-900">/{currentStoreSlug}</code>.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => navigateTo('/')}
            className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
          >
            Ver Listado de Tiendas
          </button>
          <button
            onClick={handleOpenSuperAdmin}
            className="px-5 py-2.5 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-semibold rounded-xl border border-neutral-300 transition-all cursor-pointer"
          >
            Acceso Super Admin
          </button>
        </div>
      </div>
    );
  }

  // 3B. ADMIN PANEL FOR A DISABLED STORE:
  // "Si un comercio esta deshabilitado, el panel de administracion del comercio debe mostrar un aviso que esta deshabilitado y que se pongan en contacto con el administrador de la plataforma y mostrar informacion de contacto(ugmartin@hotmail.com), similar al contacto de la landing pero con un mensaje claro que el sitio se encuentra deshabilitado."
  if (storesLoaded && activeStore && isStoreDisabled && routeInfo.route === 'admin') {
    return (
      <DisabledStoreNotice
        store={activeStore}
        settings={settings}
        onExitToLanding={() => navigateTo('/')}
        onOpenSuperAdmin={handleOpenSuperAdmin}
        onReenableStore={async () => {
          await updateStoreMeta(activeStore.id, { active: true });
        }}
      />
    );
  }

  // 3C. PUBLIC CATALOG DISABLED BY FEATURE FLAG:
  // "1) Catalogo publico: Habilita o deshabilita el catalogo publico."
  if (
    storesLoaded &&
    activeStore &&
    !isStoreDisabled &&
    activeStore.featureFlags?.publicCatalog === false &&
    routeInfo.route === 'storefront'
  ) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mb-4 shadow-xs">
          <span className="material-symbols-outlined text-3xl">storefront</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold mb-2">
          <span className="material-symbols-outlined text-[15px]">toggle_off</span>
          <span>Catálogo Público Desactivado</span>
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Catálogo Temporalmente No Disponible</h1>
        <p className="text-sm text-neutral-600 max-w-md mb-6 leading-relaxed">
          El catálogo público del comercio <strong className="text-neutral-900">{activeStore.name}</strong> se encuentra temporalmente deshabilitado por el administrador.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => navigateTo('/')}
            className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
          >
            Ver Tiendas Activas
          </button>
          <button
            onClick={() => navigateTo(`/${currentStoreSlug}/admin`)}
            className="px-5 py-2.5 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-semibold rounded-xl border border-neutral-300 transition-all cursor-pointer"
          >
            Acceso Admin del Comercio
          </button>
          <button
            onClick={handleOpenSuperAdmin}
            className="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
          >
            Super Admin
          </button>
        </div>
      </div>
    );
  }

  const effectiveAdminTab =
    adminTab === 'sales' && activeStore?.featureFlags?.salesModule === false
      ? 'inventory'
      : adminTab === 'brand' && activeStore?.featureFlags?.brandCustomizer === false
      ? 'inventory'
      : adminTab;

  // 4. STOREFRONT & STORE ADMIN ROUTE
  return (
    <div
      className="min-h-screen flex flex-col transition-colors duration-300"
      style={{
        backgroundColor: routeInfo.route === 'storefront' 
          ? (isSettingsLoaded ? settings.backgroundColor || '#ffffff' : '#ffffff') 
          : '#fbf9f8',
        ['--brand-primary' as any]: settings.primaryColor || '#1A1A1A',
        ['--brand-secondary' as any]: settings.secondaryColor || '#1A1A1A',
        ['--brand-bg' as any]: settings.backgroundColor || '#ffffff'
      }}
    >
      {/* Global Header */}
      <Header
        isAdminView={routeInfo.route === 'admin' && isAdminAuthenticated}
        currentTab={routeInfo.route === 'admin' ? effectiveAdminTab : 'storefront'}
        setCurrentTab={(tab) => {
          if (tab !== 'storefront') {
            setAdminTab(tab as 'inventory' | 'sales' | 'brand' | 'payments');
          }
        }}
        cartCount={totalCartUnits}
        cartTotal={totalCartPrice}
        onOpenCart={() => setIsSlideOverCartOpen(true)}
        settings={settings}
        isSettingsLoaded={isSettingsLoaded}
        isSandbox={activeStore?.isSandbox}
        featureFlags={activeStore?.featureFlags}
        onExitAdmin={handleExitAdmin}
        onLogoutAdmin={handleLogoutAdmin}
        onOpenHelpAssistant={() => setIsHelpAssistantOpen(true)}
      />

      {/* Main View Router */}
      <main className="w-full flex-1">
        {/* PUBLIC STOREFRONT (Customer facing) */}
        {routeInfo.route === 'storefront' && (
          <StorefrontView
            products={products}
            settings={settings}
            cart={cart}
            isLoading={!isProductsLoaded}
            isSettingsLoaded={isSettingsLoaded}
            onAddToCart={handleAddToCart}
            onOpenCart={() => setIsSlideOverCartOpen(true)}
            storeSlug={currentStoreSlug}
            initialProductId={routeInfo.productId}
            featureFlags={activeStore?.featureFlags}
          />
        )}

        {/* ADMIN PORTAL: Authentication Screen if unauthenticated */}
        {routeInfo.route === 'admin' && !isAdminAuthenticated && (
          <AdminLoginView
            settings={settings}
            onSuccess={() => {
              if (currentStoreSlug) {
                try {
                  const key = `atelier_admin_auth_${currentStoreSlug}`;
                  sessionStorage.setItem(key, 'true');
                } catch (e) {
                  console.warn(e);
                }
              }
              setIsAdminAuthenticated(true);
            }}
            onBackToStore={handleExitAdmin}
          />
        )}

        {/* ADMIN PORTAL: Protected Operational Dashboards */}
        {routeInfo.route === 'admin' && isAdminAuthenticated && (
          <>
            {effectiveAdminTab === 'inventory' && (
              <InventoryView
                products={products}
                settings={settings}
                featureFlags={activeStore?.featureFlags}
                onSaveProduct={(p) => saveProduct(currentStoreSlug, p)}
                onDeleteProduct={(id) => deleteProduct(currentStoreSlug, id)}
                onUpdateSettings={async (newSettings) => {
                  const updated = await updateStoreSettings(currentStoreSlug, newSettings, 'Administrador');
                  setSettings(updated);
                  return updated;
                }}
              />
            )}

            {effectiveAdminTab === 'sales' && (
              <SalesView
                sales={sales}
                products={products}
                featureFlags={activeStore?.featureFlags}
                onCreateSale={async (newSale) => {
                  const res = await createSale(currentStoreSlug, newSale);
                  if (res?.products) setProducts(res.products);
                  if (res?.sales) setSales(res.sales);
                  return res.sale;
                }}
                onCancelSale={async (saleId) => {
                  const res = await cancelSale(currentStoreSlug, saleId);
                  if (res?.products) setProducts(res.products);
                  if (res?.sales) setSales(res.sales);
                }}
                onDeleteSale={async (saleId) => {
                  await deleteSale(currentStoreSlug, saleId);
                  try {
                    const key = `atelier_local_sales_${currentStoreSlug}`;
                    const rawS = localStorage.getItem(key);
                    if (rawS) setSales(JSON.parse(rawS));
                  } catch (e) {
                    console.warn(e);
                  }
                }}
                onAddPayment={async (saleId, payment) => {
                  const res = await addPaymentToSale(currentStoreSlug, saleId, payment);
                  try {
                    const key = `atelier_local_sales_${currentStoreSlug}`;
                    const rawS = localStorage.getItem(key);
                    if (rawS) setSales(JSON.parse(rawS));
                  } catch (e) {
                    console.warn(e);
                  }
                  return res;
                }}
                onUpdateSaleItems={async (saleId, items, total) => {
                  const res = await updateSaleItems(currentStoreSlug, saleId, items, total);
                  if (res?.products) setProducts(res.products);
                  if (res?.sales) setSales(res.sales);
                  return res?.sale;
                }}
                onConfirmPreventaSale={async (saleId, paidAmount, paymentMethod) => {
                  const res = await confirmPreventaSale(currentStoreSlug, saleId, paidAmount, paymentMethod);
                  if (res?.products) setProducts(res.products);
                  if (res?.sales) setSales(res.sales);
                  return res?.sale;
                }}
              />
            )}

            {effectiveAdminTab === 'brand' && (
              <BrandCustomizerView
                settings={settings}
                allowDevicePhotos={activeStore?.featureFlags?.uploadDevicePhotos !== false}
                onSaveSettings={async (newSettings) => {
                  const updated = await updateStoreSettings(currentStoreSlug, newSettings, 'Administrador');
                  setSettings(updated);
                  return updated;
                }}
              />
            )}

            {effectiveAdminTab === 'payments' && (
              <PaymentsConfigView
                storeSlug={currentStoreSlug}
                settings={settings}
                isSandboxStore={Boolean(activeStore?.isSandbox || currentStoreSlug === 'sandbox' || activeStore?.id === 'sandbox')}
                onSaveSettings={async (newSettings) => {
                  const updated = await updateStoreSettings(currentStoreSlug, newSettings, 'Administrador');
                  setSettings(updated);
                  return updated;
                }}
                onReloadSettings={async () => {
                  const fresh = await getStoreSettingsFromDb(currentStoreSlug);
                  if (fresh) setSettings(fresh);
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Slide-Over Cart Drawer for Customers */}
      {isSlideOverCartOpen && (
        <CartDrawer
          isSlideOver={true}
          onClose={() => setIsSlideOverCartOpen(false)}
          cart={cart}
          products={products}
          onUpdateQuantity={handleUpdateCartQuantity}
          onRemoveItem={handleRemoveCartItem}
          onClearCart={handleClearCart}
          settings={settings}
          featureFlags={activeStore?.featureFlags}
          storeSlug={currentStoreSlug}
          onRecordSale={async (saleData) => {
            const res = await createSale(currentStoreSlug, saleData);
            if (res?.products) setProducts(res.products);
            if (res?.sales) setSales(res.sales);
            return res?.sale;
          }}
        />
      )}

      {/* Payment Confirmation Modal (Mercado Pago Return) */}
      {paymentModalInfo && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-neutral-100 text-center animate-in fade-in zoom-in-95">
            {paymentModalInfo.status === 'approved' ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <span className="material-symbols-outlined text-[36px]">check_circle</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold mb-3">
                  <span>Pago Confirmado</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                  ¡Gracias por tu compra!
                </h2>
                <p className="text-xs sm:text-sm text-neutral-600 mt-2 leading-relaxed">
                  Tu pago fue procesado correctamente por Mercado Pago. El comercio <strong>{settings.storeName || 'la tienda'}</strong> ya tiene registrado tu pedido.
                </p>

                {paymentModalInfo.extRef && (
                  <div className="my-4 p-3 rounded-xl bg-neutral-50 border border-neutral-200 inline-block font-mono text-xs text-neutral-800">
                    Comprobante: <strong className="text-black">{paymentModalInfo.extRef}</strong>
                  </div>
                )}

                <div className="mt-6 space-y-2.5">
                  {settings.whatsappNumber && (
                    <a
                      href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                        `Hola ${settings.storeName || ''}! Realicé el pago de mi pedido ${paymentModalInfo.extRef || ''} por Mercado Pago con éxito. ¡Aguardo la confirmación del envío!`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.299.144.347.491 1.2.534 1.288.043.088.072.19.014.305-.058.115-.087.187-.173.289l-.26.305c-.087.087-.179.18-.077.355.101.174.453.748.971 1.21.668.595 1.232.78 1.406.867.174.086.275.072.376-.044.101-.116.433-.506.549-.679.116-.174.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.044.073.044.42-.1 1.825zM12 2C6.477 2 2 6.477 2 12c0 1.891.527 3.662 1.444 5.176L2 22l4.981-1.306C8.424 21.528 10.151 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                      </svg>
                      <span>Avisar al Comercio por WhatsApp</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => setPaymentModalInfo(null)}
                    className="w-full py-2.5 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Continuar viendo catálogo
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <span className="material-symbols-outlined text-[36px]">help</span>
                </div>
                <h2 className="text-xl font-bold text-neutral-900">
                  Pago no completado
                </h2>
                <p className="text-xs sm:text-sm text-neutral-600 mt-2 leading-relaxed">
                  No se pudo confirmar el pago de tu orden en Mercado Pago. Si tuviste un inconveniente con el medio de pago, puedes intentar nuevamente o coordinar tu pedido directo por WhatsApp.
                </p>
                <div className="mt-6 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentModalInfo(null);
                      setIsSlideOverCartOpen(true);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    Reintentar desde el Carrito
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentModalInfo(null)}
                    className="w-full py-2.5 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}


      {/* Interactive AI Help Assistant for Shop Admin (guided by official docs & voice-enabled) */}
      {routeInfo.route === 'admin' && isAdminAuthenticated && (
        <AdminHelpAssistant
          storeSlug={currentStoreSlug}
          storeName={settings?.storeName || activeStore?.name}
          currentTab={effectiveAdminTab}
          isOpen={isHelpAssistantOpen}
          onToggle={() => setIsHelpAssistantOpen(prev => !prev)}
          onClose={() => setIsHelpAssistantOpen(false)}
        />
      )}

      {/* Global Footer with subtle discreet admin and superadmin access */}
      <Footer
        settings={settings}
        onOpenAdminAccess={handleOpenAdmin}
        isAdminView={routeInfo.route === 'admin' && isAdminAuthenticated}
        onOpenSuperAdmin={handleOpenSuperAdmin}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
