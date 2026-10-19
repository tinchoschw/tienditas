export interface ProductVariant {
  id: string;
  color: string;
  colorHex: string;
  size: string;
  sku: string;
  stock: number;
  enabled: boolean;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  price: number;
  cost: number;
  enabledOnline: boolean;
  images: string[];
  coverIndex: number;
  variants: ProductVariant[];
  totalStock: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  productId: string;
  productName: string;
  variantId: string;
  size: string;
  color: string;
  price: number;
  quantity: number;
  image?: string;
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
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Sale {
  id: string;
  date: string;
  customer: string;
  contactInfo: string;
  customerEmail?: string;
  customerPhone?: string;
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
  publicKey?: string;
  accessToken?: string;
  lastVerifiedAt?: string;
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

export interface Store {
  id: string;
  slug: string;
  name: string;
  active: boolean;
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
  masterSizes: MasterSize[];
  masterColors: MasterColor[];
  storeName: string;
  adminPassword?: string;
  primaryPresets?: ColorPreset[];
  secondaryPresets?: ColorPreset[];
  backgroundPresets?: ColorPreset[];
  mercadoPago?: MercadoPagoConfig;
  updatedAt?: string;
  updatedBy?: string;
}

