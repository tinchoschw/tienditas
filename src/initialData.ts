import { Product, Sale, StoreSettings, Store, DEFAULT_FEATURE_FLAGS, StoreAttribute, Rubro } from './types';

export const DEFAULT_ATTRIBUTE1: StoreAttribute = {
  id: 'attr1',
  name: 'Color',
  type: 'color',
  enabled: true,
  options: [
    { id: 'opt-col-negro', label: 'Negro Puro', hex: '#1A1A1A' },
    { id: 'opt-col-blanco', label: 'Blanco Roto', hex: '#E5E5E5' },
    { id: 'opt-col-arena', label: 'Arena Camel', hex: '#C49A6C' },
    { id: 'opt-col-azul', label: 'Azul', hex: '#1130ac' }
  ],
  hideUnusedWarning: false
};

export const DEFAULT_ATTRIBUTE2: StoreAttribute = {
  id: 'attr2',
  name: 'Talle',
  type: 'text',
  enabled: true,
  options: [
    { id: 'opt-sz-xs', label: 'XS' },
    { id: 'opt-sz-s', label: 'S' },
    { id: 'opt-sz-m', label: 'M' },
    { id: 'opt-sz-l', label: 'L' },
    { id: 'opt-sz-xl', label: 'XL' },
    { id: 'opt-sz-xxl', label: 'XXL' },
    { id: 'opt-sz-38', label: '38' },
    { id: 'opt-sz-40', label: '40' }
  ],
  hideUnusedWarning: false
};

export const INITIAL_RUBRO: Rubro = {
  id: 'indumentaria',
  name: 'Indumentaria',
  active: true,
  attribute1: {
    ...DEFAULT_ATTRIBUTE1,
    id: 'attr1'
  },
  attribute2: {
    ...DEFAULT_ATTRIBUTE2,
    id: 'attr2'
  },
  createdAt: '2026-09-28T00:00:00.000Z',
  updatedAt: new Date().toISOString()
};

export const INITIAL_RUBROS: Rubro[] = [INITIAL_RUBRO];

export const DEFAULT_STORE: Store = {
  id: 'apolo',
  slug: 'apolo',
  name: 'Apolo Store Online',
  active: true,
  status: 'active',
  plan: 'internal',
  ownerEmail: 'yunior@gmail.com',
  ownerFirstName: 'Yunior',
  ownerLastName: '',
  ownerPhone: '5491122334455',
  rubro: 'Indumentaria',
  termsAcceptedAt: '2026-09-28T00:00:00.000Z',
  isSandbox: false,
  featureFlags: { ...DEFAULT_FEATURE_FLAGS },
  logoUrl: '',
  whatsappNumber: '',
  primaryColor: '#314F2B',
  description: 'Tienda oficial de indumentaria y calzado Apolo Store Online',
  createdAt: '2026-09-28T00:00:00.000Z',
  updatedAt: new Date().toISOString()
};

export const SANDBOX_STORE: Store = {
  id: 'sandbox',
  slug: 'sandbox',
  name: 'Tienda Sandbox (Pruebas)',
  active: true,
  status: 'active',
  plan: 'internal',
  ownerEmail: 'yunior@gmail.com',
  ownerFirstName: 'Yunior',
  ownerLastName: '',
  ownerPhone: '5491122334455',
  rubro: 'Indumentaria',
  termsAcceptedAt: '2026-10-12T00:00:00.000Z',
  isSandbox: true,
  featureFlags: { ...DEFAULT_FEATURE_FLAGS },
  logoUrl: '',
  whatsappNumber: '',
  primaryColor: '#4F46E5',
  description: 'Tienda de pruebas oficial para testear catálogos, pedidos y feature flags.',
  createdAt: '2026-10-12T00:00:00.000Z',
  updatedAt: new Date().toISOString()
};

export const INITIAL_STORES: Store[] = [DEFAULT_STORE, SANDBOX_STORE];

export const INITIAL_SETTINGS: StoreSettings = {
  backgroundPresets: [
    { hex: '#FFFFFF', name: 'Blanco Puro' },
    { hex: '#F9F8F6', name: 'Crema Atelier' },
    { hex: '#F5F5F7', name: 'Gris Suave' },
    { hex: '#E8E8F7', name: 'Gris celesteado' }
  ],
  secondaryColor: '#353131',
  updatedAt: new Date().toISOString(),
  primaryColor: '#314F2B',
  attribute1: DEFAULT_ATTRIBUTE1,
  attribute2: DEFAULT_ATTRIBUTE2,
  masterColors: [
    { name: 'Negro Puro', hex: '#1A1A1A' },
    { name: 'Blanco Roto', hex: '#E5E5E5' },
    { name: 'Arena Camel', hex: '#C49A6C' },
    { name: 'Azul', hex: '#1130ac' }
  ],
  logoScale: 180,
  whatsappNumber: '',
  categories: [
    'Todas',
    'Camperas',
    'Pantalones',
    'Remeras',
    'Buzos',
    'Bermudas'
  ],
  primaryPresets: [
    { hex: '#1A1A1A', name: 'Negro Atelier' },
    { name: 'Verde Apolo', hex: '#314F2B' },
    { hex: '#00FFFF', name: 'Celeste' }
  ],
  updatedBy: 'Administrador',
  logoUrl: '',
  whatsappEnabled: true,
  masterSizes: [
    { name: 'XS', enabled: true },
    { enabled: true, name: 'S' },
    { name: 'M', enabled: true },
    { enabled: true, name: 'L' },
    { name: 'XL', enabled: true },
    { enabled: true, name: 'XXL' },
    { name: '38', enabled: true },
    { name: '40', enabled: true }
  ],
  backgroundColor: '#F9F8F6',
  storeName: 'Apolo Store Online',
  secondaryPresets: [
    { name: 'Arcilla Natural', hex: '#A0624C' },
    { name: 'Gris Topo', hex: '#353131' }
  ],
  mercadoPago: {
    connected: false,
    enabled: false,
    accountNickname: '',
    accountEmail: '',
    sandboxMode: false
  }
};

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_SALES: Sale[] = [];
