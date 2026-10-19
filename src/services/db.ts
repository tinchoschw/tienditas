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
import { Product, ProductVariant, Sale, StoreSettings, SalePayment, SaleItem, Store, StoreFeatureFlags, DEFAULT_FEATURE_FLAGS } from '../types';
import { INITIAL_PRODUCTS, INITIAL_SALES, INITIAL_SETTINGS, DEFAULT_STORE, SANDBOX_STORE, INITIAL_STORES } from '../initialData';
import { optimizeProductImages } from '../utils/imageOptimizer';

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

function getSettingsKey(storeId: string) {
  return storeId === 'apolo' ? 'atelier_local_settings' : `atelier_local_settings_${storeId}`;
}

function getProductsKey(storeId: string) {
  return storeId === 'apolo' ? 'atelier_local_products' : `atelier_local_products_${storeId}`;
}

function getSalesKey(storeId: string) {
  return storeId === 'apolo' ? 'atelier_local_sales' : `atelier_local_sales_${storeId}`;
}

function normalizeStoreId(val?: string): string {
  if (!val || val === 'default') return 'apolo';
  return val.trim().toLowerCase();
}

// ========================================================
// ------------------- STORES MANAGEMENT -------------------
// ========================================================

export const subscribeStores = (onData: (stores: Store[]) => void) => {
  const cached = getLocalItem<Store[]>(LOCAL_STORAGE_STORES_KEY, INITIAL_STORES);
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
            const data = sSnap.data() as Omit<Store, 'id'>;
            list.push({
              id: sSnap.id,
              ...data,
              featureFlags: data.featureFlags
                ? { ...DEFAULT_FEATURE_FLAGS, ...data.featureFlags }
                : { ...DEFAULT_FEATURE_FLAGS }
            });
          });

          // Ensure sandbox store is available if not in Firestore yet
          if (!list.some((s) => s.id === 'sandbox' || s.slug === 'sandbox')) {
            list.push(SANDBOX_STORE);
            // Optionally persist sandbox to firestore in background
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
  slug: string;
  adminPassword?: string;
  whatsappNumber?: string;
  isSandbox?: boolean;
  featureFlags?: StoreFeatureFlags;
}): Promise<Store> => {
  const slug = (data.slug || data.name.toLowerCase().replace(/[^a-z0-9]/g, '-')).replace(/^-+|-+$/g, '') || `tienda-${Date.now()}`;
  const storeId = slug;

  const newStore: Store = {
    id: storeId,
    slug: slug,
    name: data.name.trim(),
    active: true,
    isSandbox: !!data.isSandbox,
    featureFlags: data.featureFlags ? { ...DEFAULT_FEATURE_FLAGS, ...data.featureFlags } : { ...DEFAULT_FEATURE_FLAGS },
    adminPassword: data.adminPassword?.trim() || 'AdminApolo2026!',
    whatsappNumber: data.whatsappNumber?.trim() || '',
    primaryColor: data.isSandbox ? '#4F46E5' : '#1A1A1A',
    logoUrl: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Local save
  const currentStores = getLocalItem<Store[]>(LOCAL_STORAGE_STORES_KEY, INITIAL_STORES);
  const updatedStores = [...currentStores.filter((s) => s.id !== storeId), newStore];
  setLocalItem(LOCAL_STORAGE_STORES_KEY, updatedStores);

  // Initialize fresh store settings
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
    whatsappNumber: data.whatsappNumber?.trim() || '',
    categories: ['Todas', 'Ropa', 'Calzado', 'Accesorios'],
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
    onData(local);
  } else if (storeId === 'apolo') {
    onData(INITIAL_SETTINGS);
  }

  try {
    // Primary path: stores/{storeId}/settings/current
    const settingsDoc = doc(db, 'stores', storeId, 'settings', 'current');
    const unsubscribe = onSnapshot(
      settingsDoc,
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data() as StoreSettings;
          setLocalItem(key, data);
          onData(data);
        } else {
          // If store is 'apolo', fallback to check legacy storeSettings/default
          if (storeId === 'apolo') {
            try {
              const legacySnap = await getDoc(doc(db, 'storeSettings', 'default'));
              if (legacySnap.exists()) {
                const legacyData = legacySnap.data() as StoreSettings;
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

          // Otherwise seed INITIAL_SETTINGS
          const init = storeId === 'apolo' ? INITIAL_SETTINGS : { ...INITIAL_SETTINGS, storeName: storeId };
          try {
            await setDoc(settingsDoc, init);
            setLocalItem(key, init);
            onData(init);
          } catch (initErr) {
            console.warn('Could not seed settings into Firestore:', initErr);
          }
        }
      },
      (err) => {
        console.warn('Error reading storeSettings from Firestore, using local fallback:', err);
        if (local) onData(local);
        else if (storeId === 'apolo') onData(INITIAL_SETTINGS);
      }
    );
    return unsubscribe;
  } catch (e) {
    console.warn('Firestore settings listener error:', e);
    return () => {};
  }
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
  const updated: StoreSettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedBy: authorName
  };
  setLocalItem(key, updated);

  try {
    const settingsDoc = doc(db, 'stores', storeId, 'settings', 'current');
    await setDoc(settingsDoc, updated, { merge: true });

    // Also sync store metadata in stores collection
    await setDoc(doc(db, 'stores', storeId), {
      name: updated.storeName || storeId,
      logoUrl: updated.logoUrl || '',
      whatsappNumber: updated.whatsappNumber || '',
      primaryColor: updated.primaryColor || '#1A1A1A',
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // If apolo, mirror to legacy storeSettings/default as well
    if (storeId === 'apolo') {
      try {
        await setDoc(doc(db, 'storeSettings', 'default'), updated, { merge: true });
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
  const local = getLocalItem<Product[]>(key, storeId === 'apolo' ? INITIAL_PRODUCTS : []);
  if (local && local.length > 0) {
    onData(local);
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
              setLocalItem(key, legacyList);
              onData(legacyList);
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
        setLocalItem(key, list);
        onData(list);
      },
      (err) => {
        console.warn('Firestore products listener error, using local fallback:', err);
        onData(local || []);
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
  const totalStock = product.variants.reduce((acc, v) => acc + ((v.enabled !== false && (v.enabled as any) !== 'false') ? Number(v.stock || 0) : 0), 0);

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
      const totalStock = variants.reduce((acc, curr) => acc + ((curr.enabled !== false && (curr.enabled as any) !== 'false') ? curr.stock : 0), 0);
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
          const totalStock = variants.reduce((acc, curr) => acc + ((curr.enabled !== false && (curr.enabled as any) !== 'false') ? curr.stock : 0), 0);
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
          const totalStock = variants.reduce((acc, curr) => acc + ((curr.enabled !== false && (curr.enabled as any) !== 'false') ? curr.stock : 0), 0);
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
      const totalStock = variants.reduce((acc, curr) => acc + ((curr.enabled !== false && (curr.enabled as any) !== 'false') ? curr.stock : 0), 0);
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
