import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  getDoc,
  getDocs, 
  updateDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Product, 
  ProductVariant, 
  Sale, 
  StoreSettings, 
  MercadoPagoConfig, 
  SalePayment, 
  SaleItem, 
  Store, 
  StoreFeatureFlags, 
  DEFAULT_FEATURE_FLAGS,
  StoreStatus,
  StorePlan,
  StorePeriod,
  StoreExtension,
  StoreFeedback,
  PlatformConfig,
  StoreAttribute,
  Rubro
} from '../types';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_SALES, 
  INITIAL_SETTINGS, 
  DEFAULT_STORE, 
  SANDBOX_STORE, 
  INITIAL_STORES,
  INITIAL_RUBRO,
  INITIAL_RUBROS
} from '../initialData';
import { optimizeProductImages } from '../utils/imageOptimizer';
import { ensureStoreAttributes, normalizeProductWithAttributes } from '../utils/attributeUtils';

const LOCAL_STORAGE_STORES_KEY = 'atelier_stores_list';

// Helper to get cached or default items
function getLocalItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('LocalStorage read error:', e);
  }
  return fallback;
}

function setLocalItem<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('LocalStorage write error:', e);
  }
}

export function getSettingsKey(storeId: string) {
  return storeId === 'apolo' ? 'atelier_local_settings' : `atelier_local_settings_${storeId}`;
}

export function getProductsKey(storeId: string) {
  return storeId === 'apolo' ? 'atelier_local_products' : `atelier_local_products_${storeId}`;
}

export function getSalesKey(storeId: string) {
  return storeId === 'apolo' ? 'atelier_local_sales' : `atelier_local_sales_${storeId}`;
}

export function normalizeStoreId(val?: string): string {
  if (!val || val === 'default') return 'apolo';
  return val.trim().toLowerCase();
}

// Deep clean helper to ensure Firestore NEVER encounters undefined values
export function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data, (_, value) => (value === undefined ? null : value)));
}

// ========================================================
// ------------------- STORES MANAGEMENT -------------------
// ========================================================

// Helper to normalize and migrate store records with subscription fields
export const normalizeStoreData = (data: any, id: string): Store => {
  return {
    id,
    ...data,
    name: data.name || id,
    slug: data.slug || id,
    active: data.active !== false && data.status !== 'suspended' && data.status !== 'closed',
    status: (data.status as StoreStatus) || (data.active === false ? 'suspended' : 'active'),
    plan: (data.plan as StorePlan) || 'internal',
    planEndsAt: data.planEndsAt || '',
    ownerEmail: data.ownerEmail ? String(data.ownerEmail).trim().toLowerCase() : 'yunior@gmail.com',
    ownerFirstName: data.ownerFirstName || '',
    ownerLastName: data.ownerLastName || '',
    ownerPhone: data.ownerPhone || data.whatsappNumber || '',
    rubro: (data.rubro && (data.rubro === 'Indumentaria y Calzado' || data.rubro === 'Indumentaria y Moda'))
      ? 'Indumentaria'
      : (data.rubro || 'Indumentaria'),
    termsAcceptedAt: data.termsAcceptedAt || data.createdAt || '2026-09-28T00:00:00.000Z',
    extensions: Array.isArray(data.extensions) ? data.extensions : [],
    featureFlags: data.featureFlags
      ? { ...DEFAULT_FEATURE_FLAGS, ...data.featureFlags }
      : { ...DEFAULT_FEATURE_FLAGS }
  };
};

export function generateUniqueSlug(rawName: string, existingStores: Store[]): string {
  const base = rawName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tienda';
  
  const existingSlugs = new Set(existingStores.map((s) => s.slug.toLowerCase()));
  if (!existingSlugs.has(base)) return base;

  let counter = 2;
  while (existingSlugs.has(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}

export const subscribeStores = (onData: (stores: Store[]) => void) => {
  const cached = getLocalItem<Store[]>(LOCAL_STORAGE_STORES_KEY, INITIAL_STORES).map((s) => normalizeStoreData(s, s.id));
  if (cached && cached.length > 0) {
    onData(cached);
  }

  try {
    const storesCol = collection(db, 'stores');
    const unsubscribe = onSnapshot(
      storesCol,
      async (snapshot) => {
        if (snapshot.empty) {
          // Seed default store and sandbox store
          try {
            await setDoc(doc(db, 'stores', DEFAULT_STORE.id), DEFAULT_STORE);
            await setDoc(doc(db, 'stores', SANDBOX_STORE.id), SANDBOX_STORE);
            setLocalItem(LOCAL_STORAGE_STORES_KEY, INITIAL_STORES);
            onData(INITIAL_STORES);
          } catch (seedErr) {
            console.warn('Could not seed default store to Firestore:', seedErr);
            onData(cached);
          }
        } else {
          const list: Store[] = [];
          snapshot.forEach((sSnap) => {
            const data = sSnap.data();
            const store = normalizeStoreData(data, sSnap.id);
            // Standarize rubro for existing stores to 'Indumentaria'
            if (data.rubro === 'Indumentaria y Calzado' || data.rubro === 'Indumentaria y Moda' || (!data.rubro && (sSnap.id === 'apolo' || sSnap.id === 'sandbox'))) {
              updateDoc(doc(db, 'stores', sSnap.id), { rubro: 'Indumentaria' }).catch(() => {});
            }
            list.push(store);
          });

          // Ensure sandbox store is available if not in Firestore yet
          if (!list.some((s) => s.id === 'sandbox' || s.slug === 'sandbox')) {
            list.push(SANDBOX_STORE);
            try {
              setDoc(doc(db, 'stores', SANDBOX_STORE.id), SANDBOX_STORE);
            } catch (e) {
              console.warn(e);
            }
          }

          setLocalItem(LOCAL_STORAGE_STORES_KEY, list);
          onData(list);
        }
      },
      (err) => {
        console.warn('Firestore stores listener error, using local fallback:', err);
        onData(cached);
      }
    );
    return unsubscribe;
  } catch (e) {
    console.warn('Firestore stores subscription exception:', e);
    return () => {};
  }
};

export const createNewStore = async (data: {
  name: string;
  slug?: string;
  ownerEmail?: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerPhone?: string;
  rubro?: string;
  attribute1?: StoreAttribute;
  attribute2?: StoreAttribute;
  termsAcceptedAt?: string;
  adminPassword?: string;
  whatsappNumber?: string;
  isSandbox?: boolean;
  featureFlags?: StoreFeatureFlags;
}): Promise<Store> => {
  const currentStores = getLocalItem<Store[]>(LOCAL_STORAGE_STORES_KEY, INITIAL_STORES);
  const slug = data.slug?.trim() || generateUniqueSlug(data.name, currentStores);
  const storeId = slug;

  // Rule: Al registrarse: status 'active', plan 'trial', planEndsAt = hoy + 14 días.
  const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const newStore: Store = {
    id: storeId,
    slug: slug,
    name: data.name.trim(),
    active: true,
    status: 'active',
    plan: 'trial',
    planEndsAt: trialEnds,
    ownerEmail: (data.ownerEmail || 'yunior@gmail.com').trim().toLowerCase(),
    ownerFirstName: data.ownerFirstName?.trim() || '',
    ownerLastName: data.ownerLastName?.trim() || '',
    ownerPhone: data.ownerPhone?.trim() || data.whatsappNumber?.trim() || '',
    rubro: data.rubro?.trim() || 'Indumentaria',
    termsAcceptedAt: data.termsAcceptedAt || new Date().toISOString(),
    extensions: [],
    isSandbox: !!data.isSandbox,
    featureFlags: data.featureFlags ? { ...DEFAULT_FEATURE_FLAGS, ...data.featureFlags } : { ...DEFAULT_FEATURE_FLAGS },
    adminPassword: data.adminPassword?.trim() || 'AdminApolo2026!',
    whatsappNumber: data.whatsappNumber?.trim() || data.ownerPhone?.trim() || '',
    primaryColor: data.isSandbox ? '#4F46E5' : '#1A1A1A',
    logoUrl: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Local save
  const updatedStores = [...currentStores.filter((s) => s.id !== storeId), newStore];
  setLocalItem(LOCAL_STORAGE_STORES_KEY, updatedStores);

  // Initialize fresh store settings with rubro attributes if provided
  const storeSettings: StoreSettings = {
    storeName: data.name.trim(),
    adminPassword: data.adminPassword?.trim() || 'AdminApolo2026!',
    logoUrl: '',
    logoScale: 100,
    primaryColor: data.isSandbox ? '#4F46E5' : '#1A1A1A',
    secondaryColor: '#1A1A1A',
    backgroundColor: '#ffffff',
    primaryPresets: INITIAL_SETTINGS.primaryPresets,
    secondaryPresets: INITIAL_SETTINGS.secondaryPresets,
    backgroundPresets: INITIAL_SETTINGS.backgroundPresets,
    whatsappEnabled: true,
    whatsappNumber: data.whatsappNumber?.trim() || data.ownerPhone?.trim() || '',
    categories: ['Todas', 'Ropa', 'Calzado', 'Accesorios'],
    attribute1: data.attribute1 || INITIAL_SETTINGS.attribute1,
    attribute2: data.attribute2 || INITIAL_SETTINGS.attribute2,
    masterSizes: INITIAL_SETTINGS.masterSizes,
    masterColors: INITIAL_SETTINGS.masterColors,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Administrador'
  };

  setLocalItem(getSettingsKey(storeId), storeSettings);

  // Fresh store starts with 0 products and 0 sales (or sample products if sandbox)
  const storeProducts: Product[] = data.isSandbox ? JSON.parse(JSON.stringify(INITIAL_PRODUCTS)) : [];
  const storeSales: Sale[] = data.isSandbox ? JSON.parse(JSON.stringify(INITIAL_SALES)) : [];

  setLocalItem(getProductsKey(storeId), storeProducts);
  setLocalItem(getSalesKey(storeId), storeSales);

  // Save to Firestore
  try {
    await setDoc(doc(db, 'stores', storeId), newStore);
    await setDoc(doc(db, 'stores', storeId, 'settings', 'current'), storeSettings);
    if (data.isSandbox && storeProducts.length > 0) {
      const batch = writeBatch(db);
      storeProducts.forEach((p) => {
        batch.set(doc(db, 'stores', storeId, 'products', p.id), p);
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('Could not save new store to Firestore, persisted locally:', err);
  }

  return newStore;
};

export const resetStoreToFactory = async (storeId: string): Promise<boolean> => {
  const normalized = normalizeStoreId(storeId);
  const currentStores = getLocalItem<Store[]>(LOCAL_STORAGE_STORES_KEY, INITIAL_STORES);
  const target = currentStores.find((s) => s.id === normalized || s.slug === normalized);

  // 1. Reset Store Settings
  const defaultSettings: StoreSettings = {
    ...INITIAL_SETTINGS,
    storeName: target?.name || (target?.isSandbox ? 'Tienda Sandbox (Pruebas)' : 'Apolo Store Online'),
    updatedAt: new Date().toISOString(),
    updatedBy: 'Reset Factory'
  };
  setLocalItem(getSettingsKey(normalized), defaultSettings);

  // 2. Reset Products to INITIAL_PRODUCTS
  const resetProducts: Product[] = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
  setLocalItem(getProductsKey(normalized), resetProducts);

  // 3. Reset Sales to INITIAL_SALES
  const resetSales: Sale[] = JSON.parse(JSON.stringify(INITIAL_SALES));
  setLocalItem(getSalesKey(normalized), resetSales);

  // 4. Reset store feature flags to all true
  if (target) {
    const updatedTarget: Store = {
      ...target,
      active: true,
      featureFlags: { ...DEFAULT_FEATURE_FLAGS },
      updatedAt: new Date().toISOString()
    };
    const newStores = currentStores.map((s) => (s.id === target.id ? updatedTarget : s));
    setLocalItem(LOCAL_STORAGE_STORES_KEY, newStores);
    try {
      await setDoc(doc(db, 'stores', target.id), updatedTarget, { merge: true });
    } catch (e) {
      console.warn('Could not update store meta in Firestore:', e);
    }
  }

  // 5. Sync to Firestore
  try {
    await setDoc(doc(db, 'stores', normalized, 'settings', 'current'), defaultSettings);

    // Clean old Firestore products & set demo products in batch
    const prodCol = collection(db, 'stores', normalized, 'products');
    const existingProds = await getDocs(prodCol);
    const batch = writeBatch(db);
    existingProds.forEach((d) => batch.delete(d.ref));
    resetProducts.forEach((p) => {
      batch.set(doc(db, 'stores', normalized, 'products', p.id), p);
    });
    await batch.commit();

    // Clean old Firestore sales & set demo sales in batch
    const salesCol = collection(db, 'stores', normalized, 'sales');
    const existingSales = await getDocs(salesCol);
    const batchSales = writeBatch(db);
    existingSales.forEach((d) => batchSales.delete(d.ref));
    resetSales.forEach((s) => {
      batchSales.set(doc(db, 'stores', normalized, 'sales', s.id), s);
    });
    await batchSales.commit();
  } catch (err) {
    console.warn('Firestore factory reset error (persisted locally):', err);
  }

  return true;
};

export const updateStoreMeta = async (storeId: string, data: Partial<Store>): Promise<Store | null> => {
  const currentStores = getLocalItem<Store[]>(LOCAL_STORAGE_STORES_KEY, INITIAL_STORES);
  const target = currentStores.find((s) => s.id === storeId || s.slug === storeId);
  if (!target) return null;

  const updated: Store = {
    ...target,
    ...data,
    updatedAt: new Date().toISOString()
  };

  const newStores = currentStores.map((s) => (s.id === target.id ? updated : s));
  setLocalItem(LOCAL_STORAGE_STORES_KEY, newStores);

  try {
    await setDoc(doc(db, 'stores', target.id), updated, { merge: true });
  } catch (err) {
    console.warn('Could not update store in Firestore:', err);
  }

  return updated;
};

export const deleteStoreRecord = async (storeId: string): Promise<boolean> => {
  const currentStores = getLocalItem<Store[]>(LOCAL_STORAGE_STORES_KEY, INITIAL_STORES);
  const newStores = currentStores.filter((s) => s.id !== storeId && s.slug !== storeId);
  setLocalItem(LOCAL_STORAGE_STORES_KEY, newStores);

  try {
    await deleteDoc(doc(db, 'stores', storeId));
  } catch (err) {
    console.warn('Could not delete store in Firestore:', err);
  }

  return true;
};

// ========================================================
// ----------------- PLATFORM CONFIG & PRICING -------------
// ========================================================

const LOCAL_PLATFORM_CONFIG_KEY = 'atelier_platform_config';
export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  basePrice: 24900,
  supportWhatsApp: '5491122334455',
  updatedAt: new Date().toISOString()
};

export const subscribePlatformConfig = (onData: (config: PlatformConfig) => void) => {
  const cached = getLocalItem<PlatformConfig>(LOCAL_PLATFORM_CONFIG_KEY, DEFAULT_PLATFORM_CONFIG);
  onData(cached);

  try {
    const configDoc = doc(db, 'platformConfig', 'global');
    return onSnapshot(
      configDoc,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as PlatformConfig;
          const merged: PlatformConfig = {
            basePrice: typeof data.basePrice === 'number' ? data.basePrice : 24900,
            supportWhatsApp: data.supportWhatsApp || '5491122334455',
            updatedAt: data.updatedAt || new Date().toISOString()
          };
          setLocalItem(LOCAL_PLATFORM_CONFIG_KEY, merged);
          onData(merged);
        } else {
          setDoc(configDoc, DEFAULT_PLATFORM_CONFIG).catch(() => {});
          onData(cached);
        }
      },
      (err) => {
        console.warn('Firestore platformConfig error, using cached:', err);
        onData(cached);
      }
    );
  } catch (e) {
    console.warn('subscribePlatformConfig error:', e);
    return () => {};
  }
};

export const updatePlatformConfig = async (patch: Partial<PlatformConfig>): Promise<PlatformConfig> => {
  const current = getLocalItem<PlatformConfig>(LOCAL_PLATFORM_CONFIG_KEY, DEFAULT_PLATFORM_CONFIG);
  const updated: PlatformConfig = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  setLocalItem(LOCAL_PLATFORM_CONFIG_KEY, updated);

  try {
    await setDoc(doc(db, 'platformConfig', 'global'), updated, { merge: true });
  } catch (e) {
    console.warn('Could not update platformConfig in Firestore:', e);
  }
  return updated;
};

// ========================================================
// ------------------- RUBROS MANAGEMENT ------------------
// ========================================================

const LOCAL_STORAGE_RUBROS_KEY = 'atelier_rubros_list';

export const subscribeRubros = (onData: (rubros: Rubro[]) => void) => {
  const cached = getLocalItem<Rubro[]>(LOCAL_STORAGE_RUBROS_KEY, INITIAL_RUBROS);
  if (cached && cached.length > 0) {
    onData(cached);
  }

  try {
    const rubrosCol = collection(db, 'rubros');
    const unsubscribe = onSnapshot(
      rubrosCol,
      async (snapshot) => {
        if (snapshot.empty) {
          // Seed initial 'Indumentaria' rubro
          try {
            await setDoc(doc(db, 'rubros', INITIAL_RUBRO.id), sanitizeForFirestore(INITIAL_RUBRO));
            setLocalItem(LOCAL_STORAGE_RUBROS_KEY, INITIAL_RUBROS);
            onData(INITIAL_RUBROS);
          } catch (seedErr) {
            console.warn('Could not seed initial rubro to Firestore:', seedErr);
            onData(cached);
          }
        } else {
          const list: Rubro[] = [];
          snapshot.forEach((snap) => {
            const data = snap.data();
            list.push({
              id: snap.id,
              name: data.name || snap.id,
              active: data.active !== false,
              attribute1: data.attribute1 || INITIAL_RUBRO.attribute1,
              attribute2: data.attribute2 || INITIAL_RUBRO.attribute2,
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt || new Date().toISOString()
            });
          });

          // Ensure 'indumentaria' exists in the list
          if (!list.some((r) => r.id === 'indumentaria' || r.name.toLowerCase() === 'indumentaria')) {
            list.unshift(INITIAL_RUBRO);
            setDoc(doc(db, 'rubros', INITIAL_RUBRO.id), sanitizeForFirestore(INITIAL_RUBRO)).catch(() => {});
          }

          setLocalItem(LOCAL_STORAGE_RUBROS_KEY, list);
          onData(list);
        }
      },
      (err) => {
        console.warn('Firestore rubros error, using local fallback:', err);
        onData(cached);
      }
    );
    return unsubscribe;
  } catch (e) {
    console.warn('subscribeRubros error:', e);
    return () => {};
  }
};

export const saveRubro = async (rubro: Rubro): Promise<Rubro> => {
  const current = getLocalItem<Rubro[]>(LOCAL_STORAGE_RUBROS_KEY, INITIAL_RUBROS);
  const updated: Rubro = {
    ...rubro,
    updatedAt: new Date().toISOString()
  };
  const list = [...current.filter((r) => r.id !== rubro.id), updated];
  setLocalItem(LOCAL_STORAGE_RUBROS_KEY, list);

  try {
    await setDoc(doc(db, 'rubros', rubro.id), sanitizeForFirestore(updated), { merge: true });
  } catch (e) {
    console.warn('Could not save rubro in Firestore:', e);
  }
  return updated;
};

export const deleteRubro = async (rubroId: string): Promise<boolean> => {
  const current = getLocalItem<Rubro[]>(LOCAL_STORAGE_RUBROS_KEY, INITIAL_RUBROS);
  const list = current.filter((r) => r.id !== rubroId);
  setLocalItem(LOCAL_STORAGE_RUBROS_KEY, list);

  try {
    await deleteDoc(doc(db, 'rubros', rubroId));
  } catch (e) {
    console.warn('Could not delete rubro in Firestore:', e);
  }
  return true;
};

// ========================================================
// ----------------- STORE PERIODS (30 DAYS) --------------
// ========================================================

export const subscribeStorePeriods = (storeId: string, onData: (periods: StorePeriod[]) => void) => {
  const localKey = `atelier_store_periods_${storeId}`;
  const cached = getLocalItem<StorePeriod[]>(localKey, []);
  onData(cached);

  try {
    const periodsCol = collection(db, 'stores', storeId, 'periods');
    return onSnapshot(
      periodsCol,
      (snapshot) => {
        const list: StorePeriod[] = [];
        snapshot.forEach((snap) => {
          list.push({ id: snap.id, ...snap.data() } as StorePeriod);
        });
        list.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
        setLocalItem(localKey, list);
        onData(list);
      },
      (err) => {
        console.warn('subscribeStorePeriods error:', err);
        onData(cached);
      }
    );
  } catch (e) {
    console.warn('subscribeStorePeriods exception:', e);
    return () => {};
  }
};

export const createStorePeriod = async (
  storeId: string, 
  data: Omit<StorePeriod, 'id'>
): Promise<StorePeriod> => {
  const periodId = `period_${Date.now()}`;
  const newPeriod: StorePeriod = {
    id: periodId,
    ...data,
    createdAt: new Date().toISOString()
  };

  const localKey = `atelier_store_periods_${storeId}`;
  const current = getLocalItem<StorePeriod[]>(localKey, []);
  const updated = [newPeriod, ...current];
  setLocalItem(localKey, updated);

  try {
    await setDoc(doc(db, 'stores', storeId, 'periods', periodId), newPeriod);
  } catch (e) {
    console.warn('Could not create store period in Firestore:', e);
  }

  return newPeriod;
};

export const updateStorePeriod = async (
  storeId: string,
  periodId: string,
  patch: Partial<StorePeriod>
): Promise<void> => {
  const localKey = `atelier_store_periods_${storeId}`;
  const current = getLocalItem<StorePeriod[]>(localKey, []);
  const updated = current.map((p) => (p.id === periodId ? { ...p, ...patch } : p));
  setLocalItem(localKey, updated);

  try {
    await setDoc(doc(db, 'stores', storeId, 'periods', periodId), patch, { merge: true });
  } catch (e) {
    console.warn('Could not update store period in Firestore:', e);
  }
};

// ========================================================
// ----------------- STORE EXTENSIONS ---------------------
// ========================================================

export const addStoreExtension = async (
  storeId: string,
  extension: { days: number; reason: string; date?: string }
): Promise<Store | null> => {
  const currentStores = getLocalItem<Store[]>(LOCAL_STORAGE_STORES_KEY, INITIAL_STORES);
  const target = currentStores.find((s) => s.id === storeId || s.slug === storeId);
  if (!target) return null;

  const now = new Date();
  let baseDate = now;
  if (target.planEndsAt) {
    const existingDate = new Date(target.planEndsAt);
    if (!isNaN(existingDate.getTime()) && existingDate > now) {
      baseDate = existingDate;
    }
  }

  const newEndsAt = new Date(baseDate.getTime() + extension.days * 24 * 60 * 60 * 1000).toISOString();
  const newExtensionItem: StoreExtension = {
    id: `ext_${Date.now()}`,
    date: extension.date || now.toISOString().split('T')[0],
    days: extension.days,
    reason: extension.reason.trim()
  };

  const updatedExtensions = [...(target.extensions || []), newExtensionItem];
  const updatedStore: Store = {
    ...target,
    planEndsAt: newEndsAt,
    status: target.status === 'suspended' ? 'active' : target.status,
    active: true,
    extensions: updatedExtensions,
    updatedAt: now.toISOString()
  };

  const newStores = currentStores.map((s) => (s.id === target.id ? updatedStore : s));
  setLocalItem(LOCAL_STORAGE_STORES_KEY, newStores);

  try {
    await setDoc(doc(db, 'stores', target.id), {
      planEndsAt: newEndsAt,
      status: updatedStore.status,
      active: true,
      extensions: updatedExtensions,
      updatedAt: updatedStore.updatedAt
    }, { merge: true });
  } catch (e) {
    console.warn('Could not save store extension in Firestore:', e);
  }

  return updatedStore;
};

// ========================================================
// ----------------- FEEDBACK (CLOSURE & F&F) --------------
// ========================================================

export const saveStoreFeedback = async (data: Omit<StoreFeedback, 'id' | 'date'> & { date?: string }): Promise<void> => {
  const feedbackDoc: StoreFeedback = {
    ...data,
    date: data.date || new Date().toISOString()
  };

  try {
    const feedbackCol = collection(db, 'feedback');
    const docRef = doc(feedbackCol);
    await setDoc(docRef, feedbackDoc);
  } catch (e) {
    console.warn('Could not save store feedback to Firestore:', e);
  }
};

export const subscribeStoreFeedback = (onData: (list: StoreFeedback[]) => void) => {
  try {
    const feedbackCol = collection(db, 'feedback');
    return onSnapshot(
      feedbackCol,
      (snapshot) => {
        const list: StoreFeedback[] = [];
        snapshot.forEach((snap) => {
          list.push({ id: snap.id, ...snap.data() } as StoreFeedback);
        });
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        onData(list);
      },
      (err) => {
        console.warn('subscribeStoreFeedback error:', err);
        onData([]);
      }
    );
  } catch (e) {
    console.warn('subscribeStoreFeedback exception:', e);
    return () => {};
  }
};

// ========================================================
// ----------- STORE OWNER & SUBSCRIPTION ACTIONS ----------
// ========================================================

export const updateStoreOwnerInfo = async (
  storeId: string,
  data: { ownerFirstName?: string; ownerLastName?: string; ownerPhone?: string }
): Promise<Store | null> => {
  return updateStoreMeta(storeId, {
    ownerFirstName: data.ownerFirstName?.trim(),
    ownerLastName: data.ownerLastName?.trim(),
    ownerPhone: data.ownerPhone?.trim(),
    whatsappNumber: data.ownerPhone?.trim()
  });
};

export const closeStoreByOwner = async (
  storeId: string,
  feedback: { motivos: string[]; text: string; storeName: string; userEmail: string; userName: string }
): Promise<void> => {
  await updateStoreMeta(storeId, {
    status: 'closed',
    active: false
  });
  await saveStoreFeedback({
    storeId,
    storeName: feedback.storeName,
    userEmail: feedback.userEmail,
    userName: feedback.userName,
    motivos: feedback.motivos,
    text: feedback.text,
    type: 'closure'
  });
};

export const updateStorePlanAndStatus = async (
  storeId: string,
  data: {
    plan?: StorePlan;
    status?: StoreStatus;
    planEndsAt?: string;
    ownerEmail?: string;
    ownerFirstName?: string;
    ownerLastName?: string;
    ownerPhone?: string;
    whatsappNumber?: string;
    rubro?: string;
    name?: string;
    isSandbox?: boolean;
  }
): Promise<Store | null> => {
  return updateStoreMeta(storeId, {
    ...data,
    active: data.status ? data.status === 'active' : undefined
  });
};

// ========================================================
// ------------------- STORE SETTINGS -------------------
// ========================================================

export function subscribeStoreSettings(
  storeIdOrCb: string | ((settings: StoreSettings) => void),
  maybeCb?: (settings: StoreSettings) => void
) {
  let storeId = 'apolo';
  let onData: (settings: StoreSettings) => void;

  if (typeof storeIdOrCb === 'function') {
    onData = storeIdOrCb;
  } else {
    storeId = normalizeStoreId(storeIdOrCb);
    onData = maybeCb || (() => {});
  }

  const key = getSettingsKey(storeId);
  const local = getLocalItem<StoreSettings | null>(key, null);
  if (local && (local.storeName || local.logoUrl)) {
    onData(ensureStoreAttributes(local).settings);
  } else if (storeId === 'apolo') {
    onData(ensureStoreAttributes(INITIAL_SETTINGS).settings);
  }

  try {
    // Primary path: stores/{storeId}/settings/current
    const settingsDoc = doc(db, 'stores', storeId, 'settings', 'current');
    const unsubscribe = onSnapshot(
      settingsDoc,
      async (snap) => {
        if (snap.exists()) {
          const rawData = snap.data() as StoreSettings;
          const { settings: data } = ensureStoreAttributes(rawData);
          setLocalItem(key, data);
          onData(data);
        } else {
          // If store is 'apolo', fallback to check legacy storeSettings/default
          if (storeId === 'apolo') {
            try {
              const legacySnap = await getDoc(doc(db, 'storeSettings', 'default'));
              if (legacySnap.exists()) {
                const legacyRaw = legacySnap.data() as StoreSettings;
                const { settings: legacyData } = ensureStoreAttributes(legacyRaw);
                setLocalItem(key, legacyData);
                onData(legacyData);
                // Also mirror it to stores/apolo/settings/current
                await setDoc(settingsDoc, legacyData, { merge: true });
                return;
              }
            } catch (legacyErr) {
              console.warn(legacyErr);
            }
          }

          // Otherwise seed settings: prefer existing local changes if available, otherwise INITIAL_SETTINGS
          const baseInit = (local && (local.storeName || local.mercadoPago?.connected)) 
            ? local 
            : (storeId === 'apolo' ? INITIAL_SETTINGS : { ...INITIAL_SETTINGS, storeName: storeId });
          const { settings: init } = ensureStoreAttributes(baseInit);
          try {
            await setDoc(settingsDoc, sanitizeForFirestore(init));
            setLocalItem(key, init);
            if (storeId === 'apolo') {
              setLocalItem('atelier_local_settings_apolo', init);
            }
            onData(init);
          } catch (initErr) {
            console.warn('Could not seed settings into Firestore:', initErr);
          }
        }
      },
      (err) => {
        console.warn('Error reading storeSettings from Firestore, using local fallback:', err);
        if (local) onData(ensureStoreAttributes(local).settings);
        else if (storeId === 'apolo') onData(ensureStoreAttributes(INITIAL_SETTINGS).settings);
      }
    );
    return unsubscribe;
  } catch (e) {
    console.warn('Firestore settings listener error:', e);
    return () => {};
  }
}

// Helper to fetch fresh store settings directly from Firestore (Rule 1: read fresh settings after OAuth)
export async function getStoreSettingsFromDb(storeId: string): Promise<StoreSettings | null> {
  const normalized = normalizeStoreId(storeId);
  try {
    const snap = await getDoc(doc(db, 'stores', normalized, 'settings', 'current'));
    if (snap.exists()) {
      const data = snap.data() as StoreSettings;
      const key = getSettingsKey(normalized);
      setLocalItem(key, data);
      if (normalized === 'apolo') {
        setLocalItem('atelier_local_settings_apolo', data);
      }
      return data;
    }
  } catch (err) {
    console.warn(`Error reading storeSettings from Firestore for ${normalized}:`, err);
  }
  return null;
}

export async function updateStoreSettings(
  storeIdOrSettings: string | Partial<StoreSettings>,
  settingsOrAuthor?: Partial<StoreSettings> | string,
  authorParam?: string
): Promise<StoreSettings> {
  let storeId = 'apolo';
  let settings: Partial<StoreSettings>;
  let authorName = 'Administrador';

  if (typeof storeIdOrSettings === 'string') {
    storeId = normalizeStoreId(storeIdOrSettings);
    settings = (settingsOrAuthor as Partial<StoreSettings>) || {};
    if (authorParam) authorName = authorParam;
  } else {
    settings = storeIdOrSettings;
    if (typeof settingsOrAuthor === 'string') authorName = settingsOrAuthor;
  }

  const key = getSettingsKey(storeId);
  const current = getLocalItem<StoreSettings>(key, INITIAL_SETTINGS);

  const preservedMp: MercadoPagoConfig | undefined = (settings.mercadoPago || current.mercadoPago) ? {
    connected: false,
    enabled: false,
    ...(current.mercadoPago || {}),
    ...(settings.mercadoPago || {}),
    expiresAt: settings.mercadoPago?.expiresAt || current.mercadoPago?.expiresAt || '',
  } : undefined;

  const updated: StoreSettings = {
    ...current,
    ...settings,
    ...(preservedMp ? { mercadoPago: preservedMp } : {}),
    updatedAt: new Date().toISOString(),
    updatedBy: authorName
  };
  setLocalItem(key, updated);
  if (storeId === 'apolo') {
    setLocalItem('atelier_local_settings_apolo', updated);
  }

  try {
    const cleanUpdated = sanitizeForFirestore(updated);

    // Los tokens secretos NUNCA se guardan en settings desde el cliente (viven en stores/{id}/private/mercadopago)
    if (cleanUpdated.mercadoPago) {
      delete (cleanUpdated.mercadoPago as any).accessToken;
      delete (cleanUpdated.mercadoPago as any).publicKey;
      delete (cleanUpdated.mercadoPago as any).refreshToken;
      delete (cleanUpdated.mercadoPago as any).expiresIn;
    }

    const settingsDoc = doc(db, 'stores', storeId, 'settings', 'current');
    await setDoc(settingsDoc, cleanUpdated, { merge: true });

    // Also sync store metadata in stores collection
    await setDoc(doc(db, 'stores', storeId), sanitizeForFirestore({
      name: updated.storeName || storeId,
      logoUrl: updated.logoUrl || '',
      whatsappNumber: updated.whatsappNumber || '',
      primaryColor: updated.primaryColor || '#1A1A1A',
      updatedAt: new Date().toISOString()
    }), { merge: true });

    // If apolo, mirror to legacy storeSettings/default as well
    if (storeId === 'apolo') {
      try {
        await setDoc(doc(db, 'storeSettings', 'default'), cleanUpdated, { merge: true });
      } catch (legacyErr) {
        console.warn(legacyErr);
      }
    }
  } catch (err) {
    console.warn('Could not write settings to Firestore, saved locally:', err);
  }
  return updated;
}

// ========================================================
// ------------------- PRODUCTS ---------------------------
// ========================================================

export function subscribeProducts(
  storeIdOrCb: string | ((products: Product[]) => void),
  maybeCb?: (products: Product[]) => void
) {
  let storeId = 'apolo';
  let onData: (products: Product[]) => void;

  if (typeof storeIdOrCb === 'function') {
    onData = storeIdOrCb;
  } else {
    storeId = normalizeStoreId(storeIdOrCb);
    onData = maybeCb || (() => {});
  }

  const key = getProductsKey(storeId);
  const settingsKey = getSettingsKey(storeId);
  const currentSettings = getLocalItem<StoreSettings>(settingsKey, INITIAL_SETTINGS);

  const local = getLocalItem<Product[]>(key, storeId === 'apolo' ? INITIAL_PRODUCTS : []);
  if (local && local.length > 0) {
    const normalizedLocal = local.map((p) => normalizeProductWithAttributes(p, currentSettings));
    onData(normalizedLocal);
  }

  try {
    const colRef = collection(db, 'stores', storeId, 'products');
    const unsubscribe = onSnapshot(
      colRef,
      async (snapshot) => {
        if (snapshot.empty && storeId === 'apolo') {
          // Check legacy products collection
          try {
            const legacySnap = await getDocs(collection(db, 'products'));
            if (!legacySnap.empty) {
              const legacyList: Product[] = [];
              legacySnap.forEach((d) => legacyList.push({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }));
              const normLegacyList = legacyList.map((p) => normalizeProductWithAttributes(p, currentSettings));
              setLocalItem(key, normLegacyList);
              onData(normLegacyList);
              return;
            }
          } catch (e) {
            console.warn(e);
          }
        }

        const list: Product[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as Omit<Product, 'id'>) });
        });
        const normList = list.map((p) => normalizeProductWithAttributes(p, currentSettings));
        setLocalItem(key, normList);
        onData(normList);
      },
      (err) => {
        console.warn('Firestore products listener error, using local fallback:', err);
        const normFallback = (local || []).map((p) => normalizeProductWithAttributes(p, currentSettings));
        onData(normFallback);
      }
    );
    return unsubscribe;
  } catch (e) {
    console.warn('Firestore subscription exception:', e);
    return () => {};
  }
}

export async function saveProduct(
  storeIdOrProduct: string | Product,
  maybeProduct?: Product
): Promise<Product> {
  let storeId = 'apolo';
  let product: Product;

  if (typeof storeIdOrProduct === 'string') {
    storeId = normalizeStoreId(storeIdOrProduct);
    product = maybeProduct!;
  } else {
    product = storeIdOrProduct;
  }

  const key = getProductsKey(storeId);
  const totalStock = product.variants.reduce((acc, v) => acc + ((v.enabled !== false && (v.enabled as any) !== 'false' && !v.unlimited) ? Number(v.stock || 0) : 0), 0);
  const isUnlimited = product.variants.length > 0 && product.variants.every((v) => v.unlimited);

  // Automatically compress base64 images so the document stays well within Firestore's 1MB limit (< 750KB total)
  let safeImages = product.images || [];
  if (safeImages.some((img) => typeof img === 'string' && img.startsWith('data:image/'))) {
    try {
      safeImages = await optimizeProductImages(safeImages);
    } catch (optErr) {
      console.warn('Could not compress images in saveProduct, using original:', optErr);
    }
  }

  const updatedProduct: Product = {
    ...product,
    images: safeImages,
    totalStock,
    isUnlimited,
    updatedAt: new Date().toISOString()
  };

  // Update local
  const currentList = getLocalItem<Product[]>(key, storeId === 'apolo' ? INITIAL_PRODUCTS : []);
  const idx = currentList.findIndex((p) => p.id === product.id);
  let newList: Product[];
  if (idx >= 0) {
    newList = [...currentList];
    newList[idx] = updatedProduct;
  } else {
    newList = [updatedProduct, ...currentList];
  }
  setLocalItem(key, newList);

  // Firestore
  try {
    const pRef = doc(db, 'stores', storeId, 'products', product.id);
    await setDoc(pRef, updatedProduct, { merge: true });

    // If apolo, mirror to legacy products collection
    if (storeId === 'apolo') {
      try {
        await setDoc(doc(db, 'products', product.id), updatedProduct, { merge: true });
      } catch (legacyErr) {
        console.warn(legacyErr);
      }
    }
  } catch (err) {
    console.warn('Could not save product to Firestore, persisted locally:', err);
  }
  return updatedProduct;
}

export async function deleteProduct(
  storeIdOrProductId: string,
  maybeProductId?: string
): Promise<void> {
  let storeId = 'apolo';
  let productId: string;

  if (maybeProductId) {
    storeId = normalizeStoreId(storeIdOrProductId);
    productId = maybeProductId;
  } else {
    productId = storeIdOrProductId;
  }

  const key = getProductsKey(storeId);
  const currentList = getLocalItem<Product[]>(key, []);
  const newList = currentList.filter((p) => p.id !== productId);
  setLocalItem(key, newList);

  try {
    await deleteDoc(doc(db, 'stores', storeId, 'products', productId));
    if (storeId === 'apolo') {
      try {
        await deleteDoc(doc(db, 'products', productId));
      } catch (legacyErr) {
        console.warn(legacyErr);
      }
    }
  } catch (err) {
    console.warn('Could not delete product in Firestore:', err);
  }
}

// ========================================================
// ------------------- SALES & STOCK MANAGEMENT -----------
// ========================================================

export function subscribeSales(
  storeIdOrCb: string | ((sales: Sale[]) => void),
  maybeCb?: (sales: Sale[]) => void
) {
  let storeId = 'apolo';
  let onData: (sales: Sale[]) => void;

  if (typeof storeIdOrCb === 'function') {
    onData = storeIdOrCb;
  } else {
    storeId = normalizeStoreId(storeIdOrCb);
    onData = maybeCb || (() => {});
  }

  const key = getSalesKey(storeId);
  const local = getLocalItem<Sale[]>(key, storeId === 'apolo' ? INITIAL_SALES : []);
  onData(local);

  try {
    const colRef = collection(db, 'stores', storeId, 'sales');
    const unsubscribe = onSnapshot(
      colRef,
      async (snapshot) => {
        if (snapshot.empty && storeId === 'apolo') {
          // Check legacy sales collection
          try {
            const legacySnap = await getDocs(collection(db, 'sales'));
            if (!legacySnap.empty) {
              const legacyList: Sale[] = [];
              legacySnap.forEach((d) => legacyList.push({ id: d.id, ...(d.data() as Omit<Sale, 'id'>) }));
              setLocalItem(key, legacyList);
              onData(legacyList);
              return;
            }
          } catch (e) {
            console.warn(e);
          }
        }

        const list: Sale[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as Omit<Sale, 'id'>) });
        });
        setLocalItem(key, list);
        onData(list);
      },
      (err) => {
        console.warn('Firestore sales listener error, using local fallback:', err);
        onData(local);
      }
    );
    return unsubscribe;
  } catch (e) {
    console.warn('Firestore sales subscription exception:', e);
    return () => {};
  }
}

function matchSaleItemToVariant(item: SaleItem, prod: Product, v: ProductVariant): boolean {
  if (item.variantId && item.variantId === v.id) return true;
  const sameProd = 
    (item.productId && item.productId === prod.id) || 
    item.productName.trim().toLowerCase() === prod.name.trim().toLowerCase();
  if (!sameProd) return false;
  if (prod.variants.length === 1) return true;

  if (item.attributeValues) {
    let matchAttrs = true;
    if (item.attributeValues.attr1 && v.attributeOptionId1 && item.attributeValues.attr1 !== v.attributeOptionId1) {
      matchAttrs = false;
    }
    if (item.attributeValues.attr2 && v.attributeOptionId2 && item.attributeValues.attr2 !== v.attributeOptionId2) {
      matchAttrs = false;
    }
    if (matchAttrs && (item.attributeValues.attr1 || item.attributeValues.attr2)) {
      return true;
    }
  }
  
  const itemSize = (item.size || '').trim().toLowerCase();
  const vSize = (v.size || '').trim().toLowerCase();
  const sameSize = itemSize === vSize;
  
  const itemColor = (item.color || '').trim().toLowerCase();
  const vColor = (v.color || '').trim().toLowerCase();
  const sameColor = itemColor === vColor || vColor.includes(itemColor) || itemColor.includes(vColor);
  
  if (sameSize && sameColor) return true;
  
  const sameSizeVariants = prod.variants.filter((x) => (x.size || '').trim().toLowerCase() === itemSize);
  if (sameSizeVariants.length === 1 && sameSizeVariants[0].id === v.id) {
    return true;
  }
  
  return false;
}

export async function createSale(
  storeIdOrSale: string | Sale,
  maybeSale?: Sale
) {
  let storeId = 'apolo';
  let newSale: Sale;

  if (typeof storeIdOrSale === 'string') {
    storeId = normalizeStoreId(storeIdOrSale);
    newSale = maybeSale!;
  } else {
    newSale = storeIdOrSale;
  }

  const salesKey = getSalesKey(storeId);
  const productsKey = getProductsKey(storeId);

  // If sale is a preventa or explicitly requested to skip stock discount, do NOT discount inventory
  const isPreventa = newSale.status === 'preventa' || newSale.stockDiscounted === false;
  newSale.stockDiscounted = !isPreventa;

  // Update Sales
  const currentSales = getLocalItem<Sale[]>(salesKey, storeId === 'apolo' ? INITIAL_SALES : []);
  const updatedSales = [newSale, ...currentSales.filter((s) => s.id !== newSale.id)];
  setLocalItem(salesKey, updatedSales);

  const currentProducts = getLocalItem<Product[]>(productsKey, storeId === 'apolo' ? INITIAL_PRODUCTS : []);

  if (isPreventa) {
    // Save sale to Firestore without touching product stock
    try {
      const saleRef = doc(db, 'stores', storeId, 'sales', newSale.id);
      await setDoc(saleRef, newSale, { merge: true });
    } catch (err) {
      console.warn('Could not persist preventa sale to Firestore, saved locally:', err);
    }
    return { sale: newSale, sales: updatedSales, products: currentProducts };
  }

  // Discount Stock from Products (for real/immediate sales)
  const modifiedProductIds = new Set<string>();

  const updatedProducts = currentProducts.map((prod) => {
    let modified = false;
    const variants = prod.variants.map((v) => {
      // Unlimited variants never decrease stock
      if (v.unlimited) {
        return v;
      }

      const soldQty = newSale.items
        .filter((it) => matchSaleItemToVariant(it, prod, v))
        .reduce((sum, it) => sum + it.quantity, 0);

      if (soldQty > 0) {
        modified = true;
        modifiedProductIds.add(prod.id);
        const newStock = Math.max(0, v.stock - soldQty);
        return { ...v, stock: newStock };
      }
      return v;
    });

    if (modified) {
      const totalStock = variants.reduce((acc, curr) => acc + ((curr.enabled !== false && (curr.enabled as any) !== 'false' && !curr.unlimited) ? curr.stock : 0), 0);
      return { ...prod, variants, totalStock, updatedAt: new Date().toISOString() };
    }
    return prod;
  });

  setLocalItem(productsKey, updatedProducts);

  // Persist to Firestore
  try {
    const saleRef = doc(db, 'stores', storeId, 'sales', newSale.id);
    await setDoc(saleRef, newSale, { merge: true });

    for (const prodId of modifiedProductIds) {
      const prod = updatedProducts.find((p) => p.id === prodId);
      if (prod) {
        const pRef = doc(db, 'stores', storeId, 'products', prod.id);
        await setDoc(pRef, prod, { merge: true });
        if (storeId === 'apolo') {
          try {
            await setDoc(doc(db, 'products', prod.id), prod, { merge: true });
          } catch (e) {
            console.warn(e);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Could not persist sale to Firestore, saved locally:', err);
  }

  return { sale: newSale, sales: updatedSales, products: updatedProducts };
}

export async function confirmPreventaSale(
  storeIdOrSaleId: string,
  maybeSaleId?: string,
  paidAmount?: number,
  paymentMethod?: string
) {
  let storeId = 'apolo';
  let saleId: string;

  if (maybeSaleId) {
    storeId = normalizeStoreId(storeIdOrSaleId);
    saleId = maybeSaleId;
  } else {
    saleId = storeIdOrSaleId;
  }

  const salesKey = getSalesKey(storeId);
  const productsKey = getProductsKey(storeId);

  const currentSales = getLocalItem<Sale[]>(salesKey, storeId === 'apolo' ? INITIAL_SALES : []);
  const targetSale = currentSales.find((s) => s.id === saleId);
  if (!targetSale) return { sales: currentSales, products: getLocalItem<Product[]>(productsKey, []) };

  const currentProducts = getLocalItem<Product[]>(productsKey, storeId === 'apolo' ? INITIAL_PRODUCTS : []);
  const pay = typeof paidAmount === 'number' ? paidAmount : targetSale.paidTotal;
  const newPending = Math.max(0, targetSale.total - pay);
  let newStatus: Sale['status'] = 'pendiente_total';
  if (pay >= targetSale.total && targetSale.total > 0) {
    newStatus = 'cobrada_total';
  } else if (pay > 0) {
    newStatus = 'cobro_parcial';
  }

  const newPayments = [...targetSale.payments];
  if (typeof paidAmount === 'number' && paidAmount > targetSale.paidTotal) {
    newPayments.push({
      id: `pay-${Date.now()}`,
      amount: paidAmount - targetSale.paidTotal,
      date: new Date().toISOString().slice(0, 10),
      method: paymentMethod || 'Transferencia Bancaria',
      status: 'Confirmado'
    });
  }

  // Discount stock if not already discounted
  const modifiedProductIds = new Set<string>();
  const updatedProducts = targetSale.stockDiscounted
    ? currentProducts
    : currentProducts.map((prod) => {
        let modified = false;
        const variants = prod.variants.map((v) => {
          if (v.unlimited) return v;
          const soldQty = targetSale.items
            .filter((it) => matchSaleItemToVariant(it, prod, v))
            .reduce((sum, it) => sum + it.quantity, 0);

          if (soldQty > 0) {
            modified = true;
            modifiedProductIds.add(prod.id);
            const newStock = Math.max(0, v.stock - soldQty);
            return { ...v, stock: newStock };
          }
          return v;
        });

        if (modified) {
          const totalStock = variants.reduce((acc, curr) => acc + ((curr.enabled !== false && (curr.enabled as any) !== 'false' && !curr.unlimited) ? curr.stock : 0), 0);
          return { ...prod, variants, totalStock, updatedAt: new Date().toISOString() };
        }
        return prod;
      });

  const updatedSale: Sale = {
    ...targetSale,
    status: newStatus,
    stockDiscounted: true,
    paidTotal: pay,
    pendingBalance: newPending,
    payments: newPayments,
    updatedAt: new Date().toISOString()
  };

  const updatedSales = currentSales.map((s) => (s.id === saleId ? updatedSale : s));
  setLocalItem(salesKey, updatedSales);
  setLocalItem(productsKey, updatedProducts);

  try {
    const saleRef = doc(db, 'stores', storeId, 'sales', saleId);
    await setDoc(saleRef, updatedSale, { merge: true });

    for (const prodId of modifiedProductIds) {
      const prod = updatedProducts.find((p) => p.id === prodId);
      if (prod) {
        const pRef = doc(db, 'stores', storeId, 'products', prod.id);
        await setDoc(pRef, prod, { merge: true });
        if (storeId === 'apolo') {
          try {
            await setDoc(doc(db, 'products', prod.id), prod, { merge: true });
          } catch (e) {
            console.warn(e);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Could not confirm preventa in Firestore:', err);
  }

  return { sale: updatedSale, sales: updatedSales, products: updatedProducts };
}

export async function confirmMercadoPagoOrder(
  storeId: string,
  externalRef: string,
  paymentDetails?: { paymentId?: string; payerEmail?: string; amount?: number }
) {
  const normStoreId = normalizeStoreId(storeId);
  const salesKey = getSalesKey(normStoreId);
  const productsKey = getProductsKey(normStoreId);

  const currentSales = getLocalItem<Sale[]>(salesKey, normStoreId === 'apolo' ? INITIAL_SALES : []);
  const targetSale = currentSales.find((s) => s.id === externalRef);
  if (!targetSale) return null;

  const paidAmount = paymentDetails?.amount || targetSale.total;
  const currentPayments = targetSale.payments || [];
  const mpPaymentRecord: SalePayment = {
    id: paymentDetails?.paymentId ? `mp-${paymentDetails.paymentId}` : `mp-pay-${Date.now()}`,
    amount: paidAmount,
    date: new Date().toISOString().slice(0, 10),
    method: 'Mercado Pago (Online)',
    status: 'Confirmado'
  };

  // Discount stock if not discounted yet
  const currentProducts = getLocalItem<Product[]>(productsKey, normStoreId === 'apolo' ? INITIAL_PRODUCTS : []);
  const modifiedProductIds = new Set<string>();

  const updatedProducts = targetSale.stockDiscounted
    ? currentProducts
    : currentProducts.map((prod) => {
        let modified = false;
        const variants = prod.variants.map((v) => {
          if (v.unlimited) return v;
          const soldQty = targetSale.items
            .filter((it) => matchSaleItemToVariant(it, prod, v))
            .reduce((sum, it) => sum + it.quantity, 0);

          if (soldQty > 0) {
            modified = true;
            modifiedProductIds.add(prod.id);
            const newStock = Math.max(0, v.stock - soldQty);
            return { ...v, stock: newStock };
          }
          return v;
        });

        if (modified) {
          const totalStock = variants.reduce((acc, curr) => acc + ((curr.enabled !== false && (curr.enabled as any) !== 'false' && !curr.unlimited) ? curr.stock : 0), 0);
          return { ...prod, variants, totalStock, updatedAt: new Date().toISOString() };
        }
        return prod;
      });

  const updatedSale: Sale = {
    ...targetSale,
    status: 'cobrada_total',
    paidTotal: paidAmount,
    pendingBalance: 0,
    stockDiscounted: true,
    payments: [...currentPayments.filter((p) => !p.id.startsWith('mp-')), mpPaymentRecord],
    updatedAt: new Date().toISOString()
  };

  const updatedSales = currentSales.map((s) => (s.id === targetSale.id ? updatedSale : s));
  setLocalItem(salesKey, updatedSales);
  setLocalItem(productsKey, updatedProducts);

  try {
    const saleRef = doc(db, 'stores', normStoreId, 'sales', targetSale.id);
    await setDoc(saleRef, updatedSale, { merge: true });

    for (const prodId of modifiedProductIds) {
      const prod = updatedProducts.find((p) => p.id === prodId);
      if (prod) {
        const pRef = doc(db, 'stores', normStoreId, 'products', prod.id);
        await setDoc(pRef, prod, { merge: true });
        if (normStoreId === 'apolo') {
          try {
            await setDoc(doc(db, 'products', prod.id), prod, { merge: true });
          } catch (e) {
            console.warn(e);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Could not confirm MP order in Firestore:', err);
  }

  return { sale: updatedSale, sales: updatedSales, products: updatedProducts };
}

export async function cancelSale(
  storeIdOrSaleId: string,
  maybeSaleId?: string
) {
  let storeId = 'apolo';
  let saleId: string;

  if (maybeSaleId) {
    storeId = normalizeStoreId(storeIdOrSaleId);
    saleId = maybeSaleId;
  } else {
    saleId = storeIdOrSaleId;
  }

  const salesKey = getSalesKey(storeId);
  const productsKey = getProductsKey(storeId);

  const currentSales = getLocalItem<Sale[]>(salesKey, storeId === 'apolo' ? INITIAL_SALES : []);
  const targetSale = currentSales.find((s) => s.id === saleId);
  if (!targetSale) return { sales: currentSales, products: getLocalItem<Product[]>(productsKey, []) };

  if (targetSale.status === 'cancelada') {
    return { sales: currentSales, products: getLocalItem<Product[]>(productsKey, []) };
  }

  // Mark sale as cancelled
  const updatedSales = currentSales.map((s) => {
    if (s.id === saleId) {
      return {
        ...s,
        status: 'cancelada' as const,
        pendingBalance: 0,
        updatedAt: new Date().toISOString()
      };
    }
    return s;
  });
  setLocalItem(salesKey, updatedSales);

  const currentProducts = getLocalItem<Product[]>(productsKey, storeId === 'apolo' ? INITIAL_PRODUCTS : []);

  // If the sale was a preventa or stock was never discounted, DO NOT re-add stock!
  if (targetSale.stockDiscounted === false) {
    try {
      const saleRef = doc(db, 'stores', storeId, 'sales', saleId);
      await setDoc(saleRef, {
        status: 'cancelada',
        pendingBalance: 0,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('Could not cancel preventa sale in Firestore:', err);
    }
    return { sales: updatedSales, products: currentProducts };
  }

  // Reintegrate stock to products (only for sales where stock was actually discounted)
  const modifiedProductIds = new Set<string>();

  const updatedProducts = currentProducts.map((prod) => {
    let modified = false;
    const variants = prod.variants.map((v) => {
      if (v.unlimited) return v;
      const returnedQty = targetSale.items
        .filter((it) => matchSaleItemToVariant(it, prod, v))
        .reduce((sum, it) => sum + it.quantity, 0);

      if (returnedQty > 0) {
        modified = true;
        modifiedProductIds.add(prod.id);
        return { ...v, stock: v.stock + returnedQty };
      }
      return v;
    });

    if (modified) {
      const totalStock = variants.reduce((acc, curr) => acc + ((curr.enabled !== false && (curr.enabled as any) !== 'false' && !curr.unlimited) ? curr.stock : 0), 0);
      return { ...prod, variants, totalStock, updatedAt: new Date().toISOString() };
    }
    return prod;
  });

  setLocalItem(productsKey, updatedProducts);

  // Persist to Firestore
  try {
    const saleRef = doc(db, 'stores', storeId, 'sales', saleId);
    await setDoc(saleRef, {
      status: 'cancelada',
      pendingBalance: 0,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    for (const prodId of modifiedProductIds) {
      const prod = updatedProducts.find((p) => p.id === prodId);
      if (prod) {
        const pRef = doc(db, 'stores', storeId, 'products', prod.id);
        await setDoc(pRef, prod, { merge: true });
        if (storeId === 'apolo') {
          try {
            await setDoc(doc(db, 'products', prod.id), prod, { merge: true });
          } catch (e) {
            console.warn(e);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Could not cancel sale in Firestore:', err);
  }

  return { sales: updatedSales, products: updatedProducts };
}

export async function deleteSale(
  storeIdOrSaleId: string,
  maybeSaleId?: string
) {
  let storeId = 'apolo';
  let saleId: string;

  if (maybeSaleId) {
    storeId = normalizeStoreId(storeIdOrSaleId);
    saleId = maybeSaleId;
  } else {
    saleId = storeIdOrSaleId;
  }

  const key = getSalesKey(storeId);
  const currentSales = getLocalItem<Sale[]>(key, []);
  const updatedSales = currentSales.filter((s) => s.id !== saleId);
  setLocalItem(key, updatedSales);

  try {
    await deleteDoc(doc(db, 'stores', storeId, 'sales', saleId));
    if (storeId === 'apolo') {
      try {
        await deleteDoc(doc(db, 'sales', saleId));
      } catch (legacyErr) {
        console.warn(legacyErr);
      }
    }
  } catch (err) {
    console.warn('Could not delete sale from Firestore:', err);
  }
}

export async function addPaymentToSale(
  storeIdOrSaleId: string,
  saleIdOrPayment: string | Omit<SalePayment, 'id'>,
  maybePayment?: Omit<SalePayment, 'id'>
) {
  let storeId = 'apolo';
  let saleId: string;
  let payment: Omit<SalePayment, 'id'>;

  if (maybePayment) {
    storeId = normalizeStoreId(storeIdOrSaleId);
    saleId = saleIdOrPayment as string;
    payment = maybePayment;
  } else {
    saleId = storeIdOrSaleId;
    payment = saleIdOrPayment as Omit<SalePayment, 'id'>;
  }

  const key = getSalesKey(storeId);
  const currentSales = getLocalItem<Sale[]>(key, storeId === 'apolo' ? INITIAL_SALES : []);
  const targetSale = currentSales.find((s) => s.id === saleId);
  if (!targetSale) return;

  const newPayment: SalePayment = {
    ...payment,
    id: `pay-${Date.now()}`
  };

  const newPayments = [...targetSale.payments, newPayment];
  const newPaidTotal = newPayments.reduce((acc, p) => acc + p.amount, 0);
  const newPending = Math.max(0, targetSale.total - newPaidTotal);

  let newStatus: Sale['status'] = targetSale.status;
  if (newPending === 0) {
    newStatus = 'cobrada_total';
  } else if (newPaidTotal > 0) {
    newStatus = 'cobro_parcial';
  } else {
    newStatus = 'pendiente_total';
  }

  const updatedSale: Sale = {
    ...targetSale,
    payments: newPayments,
    paidTotal: newPaidTotal,
    pendingBalance: newPending,
    status: newStatus,
    updatedAt: new Date().toISOString()
  };

  const updatedSales = currentSales.map((s) => (s.id === saleId ? updatedSale : s));
  setLocalItem(key, updatedSales);

  try {
    const sRef = doc(db, 'stores', storeId, 'sales', saleId);
    await updateDoc(sRef, {
      payments: newPayments,
      paidTotal: newPaidTotal,
      pendingBalance: newPending,
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Could not update payments in Firestore:', err);
  }

  return updatedSale;
}

export async function updateSaleItems(
  storeIdOrSaleId: string,
  saleIdOrItems: string | SaleItem[],
  itemsOrTotal?: SaleItem[] | number,
  maybeTotal?: number
) {
  let storeId = 'apolo';
  let saleId: string;
  let newItems: SaleItem[];
  let newTotal: number | undefined;

  if (typeof saleIdOrItems === 'string' && Array.isArray(itemsOrTotal)) {
    storeId = normalizeStoreId(storeIdOrSaleId);
    saleId = saleIdOrItems;
    newItems = itemsOrTotal;
    newTotal = maybeTotal;
  } else {
    saleId = storeIdOrSaleId;
    newItems = saleIdOrItems as SaleItem[];
    newTotal = itemsOrTotal as number | undefined;
  }

  const salesKey = getSalesKey(storeId);
  const productsKey = getProductsKey(storeId);

  const currentSales = getLocalItem<Sale[]>(salesKey, storeId === 'apolo' ? INITIAL_SALES : []);
  const targetSale = currentSales.find((s) => s.id === saleId);
  if (!targetSale) return;

  const subtotal = newItems.reduce((acc, it) => acc + it.totalPrice, 0);
  const total = newTotal !== undefined ? newTotal : subtotal;
  const pendingBalance = Math.max(0, total - targetSale.paidTotal);

  let status: Sale['status'] = targetSale.status;
  if (targetSale.status !== 'cancelada') {
    if (pendingBalance === 0 && targetSale.paidTotal > 0) {
      status = 'cobrada_total';
    } else if (targetSale.paidTotal > 0) {
      status = 'cobro_parcial';
    } else {
      status = 'pendiente_total';
    }
  }

  const updatedSale: Sale = {
    ...targetSale,
    items: newItems,
    subtotal,
    total,
    pendingBalance,
    status,
    updatedAt: new Date().toISOString()
  };

  const updatedSales = currentSales.map((s) => (s.id === saleId ? updatedSale : s));
  setLocalItem(salesKey, updatedSales);

  let updatedProducts = getLocalItem<Product[]>(productsKey, storeId === 'apolo' ? INITIAL_PRODUCTS : []);

  if (targetSale.status !== 'cancelada') {
    const currentProducts = updatedProducts;
    const modifiedProductIds = new Set<string>();

    updatedProducts = currentProducts.map((prod) => {
      let modified = false;
      const variants = prod.variants.map((v) => {
        const oldQty = targetSale.items
          .filter((it) => matchSaleItemToVariant(it, prod, v))
          .reduce((sum, it) => sum + it.quantity, 0);
        const newQty = newItems
          .filter((it) => matchSaleItemToVariant(it, prod, v))
          .reduce((sum, it) => sum + it.quantity, 0);
        const delta = newQty - oldQty;

        if (delta !== 0) {
          modified = true;
          modifiedProductIds.add(prod.id);
          const newStock = Math.max(0, v.stock - delta);
          return { ...v, stock: newStock };
        }
        return v;
      });

      if (modified) {
        const totalStock = variants.reduce((acc, curr) => acc + ((curr.enabled !== false && (curr.enabled as any) !== 'false') ? curr.stock : 0), 0);
        return { ...prod, variants, totalStock, updatedAt: new Date().toISOString() };
      }
      return prod;
    });

    setLocalItem(productsKey, updatedProducts);

    for (const prodId of modifiedProductIds) {
      const prod = updatedProducts.find((p) => p.id === prodId);
      if (prod) {
        try {
          const pRef = doc(db, 'stores', storeId, 'products', prod.id);
          setDoc(pRef, prod, { merge: true }).catch(() => {});
          if (storeId === 'apolo') {
            setDoc(doc(db, 'products', prod.id), prod, { merge: true }).catch(() => {});
          }
        } catch (e) {
          console.warn(e);
        }
      }
    }
  }

  try {
    const sRef = doc(db, 'stores', storeId, 'sales', saleId);
    await setDoc(sRef, updatedSale, { merge: true });
  } catch (err) {
    console.warn('Could not update sale items in Firestore:', err);
  }

  return { sale: updatedSale, sales: updatedSales, products: updatedProducts };
}

export async function dismissSalePaymentAlert(storeSlug: string, saleId: string): Promise<void> {
  const cleanStore = normalizeStoreId(storeSlug);
  const salesKey = getSalesKey(cleanStore);
  const sales = getLocalItem<Sale[]>(salesKey, cleanStore === 'apolo' ? INITIAL_SALES : []);
  const updated = sales.map((s) => {
    if (s.id === saleId && s.paymentAlert) {
      return { ...s, paymentAlert: { ...s.paymentAlert, dismissed: true } };
    }
    return s;
  });
  setLocalItem(salesKey, updated);

  try {
    const sRef = doc(db, 'stores', cleanStore, 'sales', saleId);
    await updateDoc(sRef, {
      'paymentAlert.dismissed': true,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Could not dismiss payment alert in Firestore:', err);
  }
}
