import { Product, Sale, StoreSettings, Store, DEFAULT_FEATURE_FLAGS } from './types';

export const DEFAULT_STORE: Store = {
  id: 'apolo',
  slug: 'apolo',
  name: 'Apolo Store Online',
  active: true,
  isSandbox: false,
  featureFlags: { ...DEFAULT_FEATURE_FLAGS },
  adminPassword: 'AdminApolo2026!',
  logoUrl: 'https://tinchoschw.github.io/ApoloStore/logo.png',
  whatsappNumber: '+5491130025002',
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
  isSandbox: true,
  featureFlags: { ...DEFAULT_FEATURE_FLAGS },
  adminPassword: 'AdminSandbox2026!',
  logoUrl: '',
  whatsappNumber: '+5491100000000',
  primaryColor: '#4F46E5',
  description: 'Tienda de pruebas oficial para testear catálogos, pedidos y feature flags.',
  createdAt: '2026-10-12T00:00:00.000Z',
  updatedAt: new Date().toISOString()
};

export const INITIAL_STORES: Store[] = [DEFAULT_STORE, SANDBOX_STORE];

export const INITIAL_SETTINGS: StoreSettings = {
  "backgroundPresets": [
    {
      "hex": "#FFFFFF",
      "name": "Blanco Puro"
    },
    {
      "hex": "#F9F8F6",
      "name": "Crema Atelier"
    },
    {
      "hex": "#F5F5F7",
      "name": "Gris Suave"
    },
    {
      "hex": "#E8E8F7",
      "name": "Gris celesteado"
    }
  ],
  "secondaryColor": "#353131",
  "updatedAt": "2026-10-01T16:49:42.536Z",
  "primaryColor": "#314F2B",
  "masterColors": [
    {
      "name": "Negro Puro",
      "hex": "#1A1A1A"
    },
    {
      "hex": "#E5E5E5",
      "name": "Blanco Roto"
    },
    {
      "hex": "#C49A6C",
      "name": "Arena Camel"
    },
    {
      "hex": "#1130ac",
      "name": "azul"
    }
  ],
  "logoScale": 180,
  "whatsappNumber": "+5491130025002",
  "categories": [
    "Todas",
    "Camperas",
    "Pantalones",
    "Remeras",
    "Buzos",
    "Bermudas"
  ],
  "primaryPresets": [
    {
      "hex": "#1A1A1A",
      "name": "Negro Atelier"
    },
    {
      "name": "Verde Apolo",
      "hex": "#314F2B"
    },
    {
      "hex": "#00FFFF",
      "name": "Celeste"
    }
  ],
  "updatedBy": "Administrador",
  "logoUrl": "https://tinchoschw.github.io/ApoloStore/logo.png",
  "whatsappEnabled": true,
  "masterSizes": [
    {
      "name": "XS",
      "enabled": true
    },
    {
      "enabled": true,
      "name": "S"
    },
    {
      "name": "M",
      "enabled": true
    },
    {
      "enabled": true,
      "name": "L"
    },
    {
      "name": "XL",
      "enabled": true
    },
    {
      "enabled": true,
      "name": "XXL"
    },
    {
      "name": "38",
      "enabled": true
    },
    {
      "name": "40",
      "enabled": true
    }
  ],
  "backgroundColor": "#E8E8F7",
  "storeName": "Apolo Store Online",
  "secondaryPresets": [
    {
      "name": "Arcilla Natural",
      "hex": "#A0624C"
    },
    {
      "name": "Gris Topo",
      "hex": "#353131"
    }
  ],
  "mercadoPago": {
    "connected": false,
    "enabled": false,
    "accountNickname": "",
    "accountEmail": "",
    "accessToken": "",
    "publicKey": "",
    "sandboxMode": false
  }
};


export const INITIAL_PRODUCTS: Product[] = [
  {
    "id": "prod-1790614466111",
    "createdAt": "2026-09-28T16:54:26.111Z",
    "updatedAt": "2026-09-30T21:06:32.088Z",
    "variants": [
      {
        "color": "Negro Puro",
        "size": "XS",
        "id": "var-1790614540088-xb3o",
        "colorHex": "#1A1A1A",
        "sku": "RE-NEG-XS",
        "stock": 7,
        "enabled": true
      },
      {
        "id": "var-1790614540088-4e0i",
        "enabled": true,
        "color": "Negro Puro",
        "colorHex": "#1A1A1A",
        "size": "S",
        "sku": "RE-NEG-S",
        "stock": 0
      },
      {
        "colorHex": "#1A1A1A",
        "sku": "RE-NEG-M",
        "id": "var-1790614540088-z80q",
        "color": "Negro Puro",
        "enabled": true,
        "size": "M",
        "stock": 0
      },
      {
        "color": "Negro Puro",
        "size": "L",
        "sku": "REM-NEG-L",
        "colorHex": "#1A1A1A",
        "stock": 0,
        "id": "var-1790802341876-h1v0g",
        "enabled": true
      },
      {
        "colorHex": "#1A1A1A",
        "color": "Negro Puro",
        "sku": "REM-NEG-XL",
        "id": "var-1790802341876-wje8s",
        "stock": 0,
        "size": "XL",
        "enabled": true
      },
      {
        "id": "var-1790802341876-3xoqf",
        "sku": "REM-NEG-XXL",
        "stock": 8,
        "enabled": true,
        "colorHex": "#1A1A1A",
        "size": "XXL",
        "color": "Negro Puro"
      },
      {
        "colorHex": "#1130ac",
        "stock": 1,
        "size": "XS",
        "color": "azul",
        "sku": "REM-AZU-XS",
        "enabled": true,
        "id": "var-1790802341876-ssx5n"
      },
      {
        "stock": 6,
        "enabled": true,
        "size": "S",
        "colorHex": "#1130ac",
        "sku": "REM-AZU-S",
        "color": "azul",
        "id": "var-1790802341876-bx3an"
      },
      {
        "color": "azul",
        "enabled": true,
        "size": "M",
        "colorHex": "#1130ac",
        "sku": "REM-AZU-M",
        "stock": 0,
        "id": "var-1790802341876-9gsp5"
      },
      {
        "enabled": true,
        "stock": 1,
        "id": "var-1790802341876-9vsp9",
        "size": "L",
        "color": "azul",
        "colorHex": "#1130ac",
        "sku": "REM-AZU-L"
      },
      {
        "size": "XL",
        "color": "azul",
        "id": "var-1790802341876-zq277",
        "enabled": true,
        "stock": 3,
        "sku": "REM-AZU-XL",
        "colorHex": "#1130ac"
      },
      {
        "sku": "REM-AZU-XXL",
        "colorHex": "#1130ac",
        "stock": 1,
        "id": "var-1790802341876-tyzh1",
        "enabled": true,
        "size": "XXL",
        "color": "azul"
      },
      {
        "id": "var-1790802341876-i1qv7",
        "stock": 0,
        "enabled": false,
        "size": "XS",
        "sku": "REM-BLA-XS",
        "colorHex": "#E5E5E5",
        "color": "Blanco Roto"
      },
      {
        "stock": 0,
        "enabled": false,
        "colorHex": "#E5E5E5",
        "sku": "RE-BLA-S",
        "size": "S",
        "id": "var-1790614540088-8qah",
        "color": "Blanco Roto"
      },
      {
        "sku": "RE-BLA-M",
        "colorHex": "#E5E5E5",
        "id": "var-1790614540088-s5ky",
        "color": "Blanco Roto",
        "enabled": true,
        "stock": 5,
        "size": "M"
      },
      {
        "enabled": false,
        "stock": 0,
        "sku": "REM-BLA-L",
        "colorHex": "#E5E5E5",
        "id": "var-1790802341876-fhq20",
        "color": "Blanco Roto",
        "size": "L"
      },
      {
        "sku": "REM-BLA-XL",
        "stock": 1,
        "id": "var-1790802341876-5tqxv",
        "colorHex": "#E5E5E5",
        "size": "XL",
        "enabled": true,
        "color": "Blanco Roto"
      },
      {
        "color": "Blanco Roto",
        "size": "XXL",
        "colorHex": "#E5E5E5",
        "id": "var-1790802341876-6a78c",
        "sku": "REM-BLA-XXL",
        "stock": 0,
        "enabled": false
      }
    ],
    "enabledOnline": true,
    "cost": 10000,
    "coverIndex": 0,
    "category": "Remeras",
    "name": "Remera Over Lisa",
    "tags": [],
    "totalStock": 33,
    "description": "Remera Over Lisa",
    "images": [
      "https://raw.githubusercontent.com/tinchoschw/ApoloStore/main/videos/remera_over_crudo_bilbao.jpeg",
      "https://raw.githubusercontent.com/tinchoschw/ApoloStore/main/videos/remera_over_blanca_bilbao%20-%201.jpeg"
    ],
    "price": 20000
  },
  {
    "id": "prod-1790620907159",
    "description": "Jean Osaka",
    "createdAt": "2026-09-28T18:41:47.159Z",
    "updatedAt": "2026-09-30T21:05:21.186Z",
    "cost": 20000,
    "coverIndex": 0,
    "images": [
      "https://lh3.googleusercontent.com/d/17pe0s5wZJjIqFf4uKh0OPXPdt_fzQObN",
      "https://lh3.googleusercontent.com/d/1BVokNhoFBhYwB6Ja7BAkLY47tGqhDylh",
      "https://lh3.googleusercontent.com/d/1og12mtYt-2yNwpL2FwGhk4rkAmG3Uwod"
    ],
    "price": 45000,
    "enabledOnline": true,
    "variants": [
      {
        "enabled": true,
        "colorHex": "#1A1A1A",
        "stock": 1,
        "id": "var-1790621221177-p3xsu",
        "size": "38",
        "color": "Negro Puro",
        "sku": "JEA-NEG-38"
      },
      {
        "id": "var-1790708126820-w0y84",
        "stock": 2,
        "enabled": true,
        "sku": "JEA-NEG-40",
        "size": "40",
        "color": "Negro Puro",
        "colorHex": "#1A1A1A"
      },
      {
        "color": "Blanco Roto",
        "enabled": true,
        "size": "38",
        "colorHex": "#E5E5E5",
        "sku": "JEA-BLA-38",
        "id": "var-1790802307876-iesbp",
        "stock": 2
      },
      {
        "stock": 0,
        "size": "40",
        "colorHex": "#E5E5E5",
        "enabled": true,
        "color": "Blanco Roto",
        "id": "var-1790802307876-jfipg",
        "sku": "JEA-BLA-40"
      },
      {
        "color": "Arena Camel",
        "size": "38",
        "sku": "JEA-ARE-38",
        "stock": 1,
        "colorHex": "#C49A6C",
        "id": "var-1790802307876-i9b87",
        "enabled": true
      },
      {
        "id": "var-1790802307876-a058r",
        "sku": "JEA-ARE-40",
        "enabled": true,
        "colorHex": "#C49A6C",
        "color": "Arena Camel",
        "size": "40",
        "stock": 4
      },
      {
        "colorHex": "#1130ac",
        "sku": "JEA-AZU-38",
        "enabled": true,
        "color": "azul",
        "id": "var-1790708126820-3nzgq",
        "stock": 1,
        "size": "38"
      },
      {
        "enabled": true,
        "color": "azul",
        "size": "40",
        "sku": "JEA-AZU-40",
        "id": "var-1790708126820-auw94",
        "colorHex": "#1130ac",
        "stock": 0
      }
    ],
    "name": "Jean Osaka",
    "tags": [],
    "totalStock": 11,
    "category": "Pantalones"
  },
  {
    "id": "prod-1790872535638",
    "createdAt": "2026-10-01T16:35:35.638Z",
    "updatedAt": "2026-10-01T16:37:30.356Z",
    "description": "Descripcion prueba",
    "name": "Nombre prueba",
    "tags": [
      "Novedad ❤"
    ],
    "coverIndex": 0,
    "price": 5000,
    "variants": [
      {
        "id": "var-1790872560500-amkyp",
        "enabled": true,
        "color": "azul",
        "colorHex": "#1130ac",
        "size": "XS",
        "sku": "PRU-AZU-XS",
        "stock": 1
      },
      {
        "enabled": true,
        "color": "azul",
        "colorHex": "#1130ac",
        "size": "XXL",
        "sku": "PRU-AZU-XXL",
        "stock": 0,
        "id": "var-1790872560500-vbo9u"
      }
    ],
    "enabledOnline": true,
    "images": [],
    "cost": 5000,
    "category": "Camperas",
    "totalStock": 1
  },
  {
    "id": "prod-1790872840166",
    "description": "Descripcion prueba 2",
    "images": [],
    "price": 200000,
    "tags": [],
    "name": "Nombre prueba 2",
    "totalStock": 1005,
    "category": "Pantalones",
    "cost": 100000,
    "createdAt": "2026-10-01T16:40:40.166Z",
    "updatedAt": "2026-10-01T16:41:36.280Z",
    "enabledOnline": true,
    "coverIndex": 0,
    "variants": [
      {
        "id": "var-1790872876780-snt0k",
        "color": "Negro Puro",
        "size": "38",
        "colorHex": "#1A1A1A",
        "sku": "NOM-NEG-38",
        "enabled": true,
        "stock": 5
      },
      {
        "colorHex": "#1A1A1A",
        "stock": 0,
        "sku": "NOM-NEG-40",
        "size": "40",
        "color": "Negro Puro",
        "enabled": true,
        "id": "var-1790872876780-ds335"
      },
      {
        "enabled": true,
        "stock": 1000,
        "id": "var-1790872876780-ac5q5",
        "size": "38",
        "color": "Blanco Roto",
        "colorHex": "#E5E5E5",
        "sku": "NOM-BLA-38"
      },
      {
        "id": "var-1790872876780-sz6n9",
        "sku": "NOM-BLA-40",
        "color": "Blanco Roto",
        "size": "40",
        "stock": 0,
        "enabled": true,
        "colorHex": "#E5E5E5"
      }
    ]
  }
];

export const INITIAL_SALES: Sale[] = [
  {
    "id": "V-1001",
    "total": 155000,
    "payments": [
      {
        "method": "efectivo",
        "amount": 50000,
        "status": "Confirmado",
        "id": "pay-1790791993462",
        "date": "2026-09-30"
      }
    ],
    "pendingBalance": 105000,
    "createdAt": "2026-09-30T18:13:13.462Z",
    "paidTotal": 50000,
    "subtotal": 155000,
    "dueDate": "2026-10-10",
    "date": "2026-09-30",
    "items": [
      {
        "unitPrice": 45000,
        "totalPrice": 135000,
        "quantity": 3,
        "productId": "prod-1790620907159",
        "size": "38",
        "variantId": "var-1790621221177-p3xsu",
        "color": "Negro Puro",
        "productName": "Jean Osaka"
      },
      {
        "unitPrice": 20000,
        "color": "Blanco Roto",
        "totalPrice": 20000,
        "size": "M",
        "productName": "Remera Over Lisa",
        "productId": "prod-1790614466111",
        "quantity": 1,
        "variantId": "var-1790614540088-s5ky"
      }
    ],
    "contactInfo": "Mostrador Local",
    "customer": "Tincho",
    "status": "cobro_parcial"
  },
  {
    "id": "V-1002",
    "contactInfo": "Mostrador Local",
    "subtotal": 160000,
    "total": 160000,
    "paidTotal": 170000,
    "createdAt": "2026-09-30T18:15:12.638Z",
    "customer": "Nir",
    "dueDate": "2026-10-10",
    "status": "cobrada_total",
    "date": "2026-09-30",
    "items": [
      {
        "variantId": "var-1790614540088-z80q",
        "productId": "prod-1790614466111",
        "totalPrice": 80000,
        "size": "M",
        "productName": "Remera Over Lisa",
        "color": "Negro Puro",
        "unitPrice": 20000,
        "quantity": 4
      },
      {
        "productId": "prod-1790614466111",
        "productName": "Remera Over Lisa",
        "totalPrice": 80000,
        "variantId": "var-1790614540088-cuy6",
        "quantity": 4,
        "unitPrice": 20000,
        "color": "Arena Camel",
        "size": "M"
      }
    ],
    "payments": [
      {
        "method": "Transferencia Bancaria",
        "amount": 170000,
        "status": "Confirmado",
        "date": "2026-09-30",
        "id": "pay-1790792112638"
      }
    ],
    "pendingBalance": 0
  },
  {
    "id": "V-1003",
    "contactInfo": "Mostrador Local",
    "total": 45000,
    "status": "pendiente_total",
    "date": "2026-09-30",
    "payments": [],
    "subtotal": 45000,
    "dueDate": "2026-10-07",
    "createdAt": "2026-09-30T20:55:49.594Z",
    "customer": "Cliente Mostrador",
    "pendingBalance": 45000,
    "items": [
      {
        "unitPrice": 45000,
        "quantity": 1,
        "productId": "prod-1790620907159",
        "totalPrice": 45000,
        "productName": "Jean Osaka",
        "color": "Negro Puro",
        "size": "38",
        "variantId": "var-1790621221177-p3xsu"
      }
    ],
    "paidTotal": 0
  },
  {
    "id": "V-1004",
    "createdAt": "2026-09-30T20:58:32.514Z",
    "items": [
      {
        "productId": "prod-1790620907159",
        "productName": "Jean Osaka",
        "quantity": 1,
        "variantId": "var-1790708126820-3nzgq",
        "unitPrice": 45000,
        "size": "38",
        "totalPrice": 45000,
        "color": "azul"
      }
    ],
    "pendingBalance": 45000,
    "paidTotal": 0,
    "payments": [],
    "subtotal": 45000,
    "status": "pendiente_total",
    "contactInfo": "Mostrador Local",
    "dueDate": "2026-10-07",
    "customer": "Cliente Mostrador",
    "date": "2026-09-30",
    "total": 45000
  }
];
