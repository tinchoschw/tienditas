export interface StoreAttributeOption {
  id: string;
  label: string;
  hex?: string; // used when type === "color"
}

export interface StoreAttribute {
  id: 'attr1' | 'attr2';
  name: string; // editable e.g. "Color", "Talle", "Tamaño", "Modelo"
  type: 'text' | 'color'; // strictly text or color (NO image)
  enabled: boolean;
  options: StoreAttributeOption[];
  hideUnusedWarning?: boolean;
}

export interface ProductVariant {
  id: string;
  color: string;
  colorHex?: string;
  size: string;
  sku: string;
  stock: number;
  enabled: boolean;
  attributeOptionId1?: string;
  attributeOptionId2?: string;
  unlimited?: boolean;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  tagColors?: Record<string, string>;
  price: number;
  discountPrice?: number;
  cost: number;
  enabledOnline: boolean;
  images: string[];
  coverIndex: number;
  attributesUsed?: ('attr1' | 'attr2')[];
  attributeOptions?: {
    attr1?: string[];
    attr2?: string[];
  };
  variants: ProductVariant[];
  totalStock: number;
  isUnlimited?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  productId: string;
  productName: string;
  variantId: string;
  size: string;
  color: string;
  attributeSummary?: string;
  price: number;
  quantity: number;
  image?: string;
  unlimited?: boolean;
}

export interface SalePayment {
  id: string;
  amount: number;
  date: string;
  method: string;
  status: 'Confirmado' | 'Pendiente';
}

export interface SaleItem {
  productId: string;
  productName: string;
  variantId?: string;
  size: string;
  color: string;
  attributeSummary?: string;
  attributeValues?: Record<string, string>;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unlimited?: boolean;
}

export interface SalePaymentAlert {
  type: 'underpaid' | 'overpaid' | 'cancelled_sale_paid';
  message: string;
  createdAt: string;
  dismissed: boolean;
}

export interface Sale {
  id: string;
  date: string;
  customer: string;
  contactInfo: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
  dueDate: string;
  items: SaleItem[];
  subtotal: number;
  total: number;
  paidTotal: number;
  pendingBalance: number;
  status: 'cobrada_total' | 'cobro_parcial' | 'pendiente_total' | 'preventa' | 'cancelada';
  stockDiscounted?: boolean;
  channel?: 'whatsapp' | 'mercadopago' | 'mostrador';
  payments: SalePayment[];
  checkoutId?: string;
  mpPaymentIds?: string[];
  paymentAlert?: SalePaymentAlert;
  createdAt?: string;
  updatedAt?: string;
}

export interface MasterSize {
  name: string;
  enabled: boolean;
}

export interface MasterColor {
  name: string;
  hex: string;
}

export interface ColorPreset {
  name: string;
  hex: string;
}

export interface StoreMercadoPagoConnection {
  connected: boolean;
  enabled: boolean;
  accountEmail?: string;
  accountNickname?: string;
  connectedAt?: string;
}

export interface PlatformMercadoPagoConfig {
  publicKey: string;
  accessToken: string;
  sandboxMode: boolean; // true = desarrollo/sandbox, false = producción
  accountEmail?: string;
  accountNickname?: string;
  lastVerifiedAt?: string;
}

export interface MercadoPagoConfig {
  connected?: boolean;
  enabled: boolean;
  accountEmail?: string;
  accountNickname?: string;
  connectedAt?: string;
  sandboxMode?: boolean;
  expiresAt?: string;
  lastVerifiedAt?: string;
}

export interface MercadoPagoStatusResponse {
  connected: boolean;
  enabled: boolean;
  accountEmail: string;
  accountNickname: string;
  sandboxMode: boolean;
  expiresAt: string;
}

export interface StoreFeatureFlags {
  publicCatalog: boolean;      // 1) Catalogo publico: Habilita o deshabilita el catalogo publico
  exportProducts: boolean;     // 2) Exportar productos: habilita el boton de exportar productos del administrador de productos
  exportSales: boolean;        // 3) Exportar ventas: habilita el boton de exportar ventas del administrador de ventas
  uploadDevicePhotos: boolean; // 4) Fotos del dispositivo: Le permite al usuario cargar fotos desde el dispositivo además de ingresar un link publico
  aiAssistant: boolean;        // 5) Asistente IA: Habilita o deshabilita la carga con IA desde fotos
  salesModule: boolean;        // 6) Modulo Ventas: Muestra u oculta la pestaña de Ventas & Cobros en el panel
  brandCustomizer: boolean;    // 7) Personalizador de Marca: Muestra u oculta la pestaña de Diseño & Marca
  maxProducts: number;         // 8) Max productos: Limite numerico de prendas (0 = ilimitado)
  whatsappCheckout: boolean;   // 9) WhatsApp Checkout: Carrito de compras directo por WhatsApp
  mercadoPagoCheckout: boolean;// 10) Mercado Pago Checkout: Cobro online con tarjetas y saldo MP
}

export const DEFAULT_FEATURE_FLAGS: StoreFeatureFlags = {
  publicCatalog: true,
  exportProducts: true,
  exportSales: true,
  uploadDevicePhotos: true,
  aiAssistant: true,
  salesModule: true,
  brandCustomizer: true,
  maxProducts: 0,
  whatsappCheckout: true,
  mercadoPagoCheckout: true
};

export type StoreStatus = 'active' | 'suspended' | 'closed';
export type StorePlan = 'trial' | 'friends_family' | 'paid' | 'internal';

export interface StorePeriod {
  id: string;
  startDate: string; // ISO date or YYYY-MM-DD
  dueDate: string;   // ISO date or YYYY-MM-DD
  amount: number;    // Monto a pagar
  paidAmount: number;// Monto pagado
  lastPaymentDate?: string;
  note?: string;
  status: 'paid' | 'pending';
  createdAt?: string;
}

export interface StoreExtension {
  id: string;
  date: string;
  days: number;
  reason: string;
}

export interface StoreFeedback {
  id?: string;
  storeId: string;
  storeName?: string;
  userEmail?: string;
  userName?: string;
  motivos?: string[];
  text: string;
  date: string;
  type: 'closure' | 'friends_family';
}

export interface PlatformConfig {
  basePrice: number;                 // Default $24.900
  baseSubscriptionPrice?: number;   // Alias for basePrice
  supportWhatsApp: string;           // WhatsApp de soporte del superadmin
  trialDays?: number;
  updatedAt?: string;
}

export interface Rubro {
  id: string;
  name: string;
  active: boolean;
  attribute1: StoreAttribute;
  attribute2: StoreAttribute;
  createdAt?: string;
  updatedAt?: string;
}

export interface Store {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  status?: StoreStatus;       // 'active' | 'suspended' | 'closed'
  plan?: StorePlan;           // 'trial' | 'friends_family' | 'paid' | 'internal'
  planEndsAt?: string;        // ISO date string; vacio o inexistente = no vence
  ownerEmail?: string;        // Email de Google del dueño
  ownerUid?: string;          // UID de Firebase Auth
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerPhone?: string;        // Celular / WhatsApp
  rubro?: string;             // Rubro del comercio
  termsAcceptedAt?: string;   // Fecha de aceptacion de TyC
  extensions?: StoreExtension[];
  currentPeriod?: StorePeriod;
  isSandbox?: boolean;
  featureFlags?: StoreFeatureFlags;
  logoUrl?: string;
  whatsappNumber?: string;
  primaryColor?: string;
  adminPassword?: string;
  description?: string;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoreSettings {
  logoUrl: string;
  logoScale: number;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  whatsappEnabled: boolean;
  whatsappNumber: string;
  categories: string[];
  attribute1?: StoreAttribute;
  attribute2?: StoreAttribute;
  masterSizes?: MasterSize[];
  masterColors?: MasterColor[];
  storeName: string;
  adminPassword?: string;
  primaryPresets?: ColorPreset[];
  secondaryPresets?: ColorPreset[];
  backgroundPresets?: ColorPreset[];
  mercadoPago?: MercadoPagoConfig;
  updatedAt?: string;
  updatedBy?: string;
}

