import { Product, ProductVariant, StoreSettings, StoreAttribute, StoreAttributeOption } from '../types';
import { DEFAULT_ATTRIBUTE1, DEFAULT_ATTRIBUTE2, INITIAL_SETTINGS } from '../initialData';

/**
 * Ensures StoreSettings has attribute1 and attribute2 configured with backward compatibility.
 */
export function ensureStoreAttributes(settings?: Partial<StoreSettings> | null): {
  settings: StoreSettings;
  attribute1: StoreAttribute;
  attribute2: StoreAttribute;
} {
  const safeSettings = (settings || INITIAL_SETTINGS) as StoreSettings;
  let attr1: StoreAttribute = safeSettings.attribute1
    ? { ...safeSettings.attribute1 }
    : {
        id: 'attr1',
        name: 'Color',
        type: 'color',
        enabled: true,
        options: (safeSettings.masterColors && safeSettings.masterColors.length > 0)
          ? safeSettings.masterColors.map((c, i) => ({
              id: `col-${i}-${c.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              label: c.name,
              hex: c.hex
            }))
          : DEFAULT_ATTRIBUTE1.options,
        hideUnusedWarning: false
      };

  let attr2: StoreAttribute = safeSettings.attribute2
    ? { ...safeSettings.attribute2 }
    : {
        id: 'attr2',
        name: 'Talle',
        type: 'text',
        enabled: true,
        options: (safeSettings.masterSizes && safeSettings.masterSizes.length > 0)
          ? safeSettings.masterSizes.map((s, i) => ({
              id: `sz-${i}-${s.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              label: s.name
            }))
          : DEFAULT_ATTRIBUTE2.options,
        hideUnusedWarning: false
      };

  return {
    settings: {
      ...safeSettings,
      attribute1: attr1,
      attribute2: attr2
    },
    attribute1: attr1,
    attribute2: attr2
  };
}

/**
 * Resolves option label by id or fallback.
 */
export function getOptionLabel(
  attr: StoreAttribute | undefined,
  optionId?: string,
  fallback = ''
): string {
  if (!attr) return fallback;
  if (optionId) {
    const found = attr.options.find((o) => o.id === optionId);
    if (found) return found.label;
  }
  return fallback;
}

/**
 * Resolves option hex for color attributes.
 */
export function getOptionHex(
  attr: StoreAttribute | undefined,
  optionId?: string,
  fallback = '#000000'
): string {
  if (!attr) return fallback;
  if (optionId) {
    const found = attr.options.find((o) => o.id === optionId);
    if (found?.hex) return found.hex;
  }
  return fallback;
}

/**
 * Formats a single-line summary of variant attributes:
 * e.g. "Color: Negro · Talle: M" or "Modelo: Pro" or "Sin atributos"
 */
export function formatVariantSummary(
  v: ProductVariant,
  attr1?: StoreAttribute,
  attr2?: StoreAttribute,
  prod?: Product
): string {
  const parts: string[] = [];

  const usesAttr1 = !prod?.attributesUsed || prod.attributesUsed.includes('attr1');
  const usesAttr2 = !prod?.attributesUsed || prod.attributesUsed.includes('attr2');

  if (usesAttr1 && attr1 && attr1.enabled) {
    const label = getOptionLabel(attr1, v.attributeOptionId1, v.color);
    if (label) parts.push(`${attr1.name}: ${label}`);
  }

  if (usesAttr2 && attr2 && attr2.enabled) {
    const label = getOptionLabel(attr2, v.attributeOptionId2, v.size);
    if (label) parts.push(`${attr2.name}: ${label}`);
  }

  if (parts.length === 0) {
    if (v.color && v.size) return `${v.color} / ${v.size}`;
    if (v.color) return v.color;
    if (v.size) return v.size;
    return 'Única';
  }

  return parts.join(' · ');
}

/**
 * Returns formatted line for deletion/warning: "nombre producto · valor atributo 1 · valor atributo 2"
 */
export function formatVariantLine(
  productName: string,
  v: ProductVariant,
  attr1?: StoreAttribute,
  attr2?: StoreAttribute
): string {
  const parts: string[] = [productName];
  const val1 = attr1 ? getOptionLabel(attr1, v.attributeOptionId1, v.color) : v.color;
  const val2 = attr2 ? getOptionLabel(attr2, v.attributeOptionId2, v.size) : v.size;

  if (val1) parts.push(val1);
  if (val2) parts.push(val2);

  return parts.join(' · ');
}

/**
 * Migrates a product ensuring its variants have attribute IDs and attributesUsed is populated.
 */
export function normalizeProductWithAttributes(
  product: Product,
  settings: StoreSettings
): Product {
  const { attribute1, attribute2 } = ensureStoreAttributes(settings);

  let attributesUsed: ('attr1' | 'attr2')[] = product.attributesUsed || [];
  if (!product.attributesUsed) {
    if (product.variants.length > 0) {
      const hasColors = product.variants.some((v) => !!v.color);
      const hasSizes = product.variants.some((v) => !!v.size);
      if (hasColors && hasSizes) {
        attributesUsed = ['attr1', 'attr2'];
      } else if (hasColors) {
        attributesUsed = ['attr1'];
      } else if (hasSizes) {
        attributesUsed = ['attr2'];
      } else {
        attributesUsed = [];
      }
    } else {
      attributesUsed = ['attr1', 'attr2'];
    }
  }

  const updatedVariants = product.variants.map((v) => {
    let optId1 = v.attributeOptionId1;
    let optId2 = v.attributeOptionId2;

    if (!optId1 && v.color) {
      const match = attribute1.options.find(
        (o) => o.label.toLowerCase() === v.color.toLowerCase()
      );
      if (match) optId1 = match.id;
    }

    if (!optId2 && v.size) {
      const match = attribute2.options.find(
        (o) => o.label.toLowerCase() === v.size.toLowerCase()
      );
      if (match) optId2 = match.id;
    }

    return {
      ...v,
      attributeOptionId1: optId1,
      attributeOptionId2: optId2,
      unlimited: !!v.unlimited,
      stock: typeof v.stock === 'number' ? v.stock : 0
    };
  });

  const totalStock = updatedVariants.reduce((sum, v) => {
    if (v.enabled !== false && !v.unlimited) {
      return sum + Number(v.stock || 0);
    }
    return sum;
  }, 0);

  return {
    ...product,
    attributesUsed,
    variants: updatedVariants,
    totalStock,
    isUnlimited: product.variants.length === 1 && product.variants[0].unlimited ? true : !!product.isUnlimited
  };
}

/**
 * Stock Fusion: Groups variants by remaining attribute options and merges stocks.
 */
export function fuseProductVariants(
  product: Product,
  remainingAttrIds: ('attr1' | 'attr2')[],
  settings: StoreSettings
): {
  updatedProduct: Product;
  summaryLines: string[];
} {
  const { attribute1, attribute2 } = ensureStoreAttributes(settings);
  const prefix = (product.name || 'PR').trim().slice(0, 3).toUpperCase();
  const summaryLines: string[] = [];

  // Case 1: 0 attributes left -> Simple product with 1 implicit variant
  if (remainingAttrIds.length === 0) {
    const limitedStockSum = product.variants
      .filter((v) => !v.unlimited)
      .reduce((acc, v) => acc + Number(v.stock || 0), 0);

    const hasUnlimited = product.variants.some((v) => v.unlimited);
    const hasEnabled = product.variants.length === 0 ? true : product.variants.some((v) => v.enabled !== false);

    const singleVariant: ProductVariant = {
      id: product.variants[0]?.id || `var-${Date.now()}`,
      color: '',
      size: '',
      sku: `${prefix}-SIMPLE`,
      stock: limitedStockSum,
      enabled: hasEnabled,
      unlimited: hasUnlimited,
      attributeOptionId1: undefined,
      attributeOptionId2: undefined
    };

    summaryLines.push(
      `${product.name}: ${hasUnlimited ? 'Ilimitado' : `${limitedStockSum} unidades`}, de ${product.variants.length} variantes`
    );

    return {
      updatedProduct: {
        ...product,
        attributesUsed: [],
        variants: [singleVariant],
        totalStock: limitedStockSum,
        isUnlimited: hasUnlimited
      },
      summaryLines
    };
  }

  // Case 2: 1 attribute remains ('attr1' OR 'attr2')
  const remaining = remainingAttrIds[0];
  const remainingAttr = remaining === 'attr1' ? attribute1 : attribute2;

  // Group by remaining option ID
  const groups = new Map<string, ProductVariant[]>();
  product.variants.forEach((v) => {
    const key = remaining === 'attr1'
      ? (v.attributeOptionId1 || v.color || 'default')
      : (v.attributeOptionId2 || v.size || 'default');

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(v);
  });

  const newVariants: ProductVariant[] = [];
  const usedSkus = new Set<string>();

  groups.forEach((groupVars, groupKey) => {
    const first = groupVars[0];
    const optId = remaining === 'attr1' ? first.attributeOptionId1 : first.attributeOptionId2;
    const opt = remainingAttr.options.find((o) => o.id === optId) || {
      id: groupKey,
      label: remaining === 'attr1' ? first.color : first.size,
      hex: first.colorHex
    };

    const limitedStockSum = groupVars
      .filter((v) => !v.unlimited)
      .reduce((acc, v) => acc + Number(v.stock || 0), 0);

    const hasUnlimited = groupVars.some((v) => v.unlimited);
    const hasEnabled = groupVars.some((v) => v.enabled !== false);

    let baseSku = `${prefix}-${(opt.label || 'VAR').slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
    let sku = baseSku;
    let counter = 2;
    while (usedSkus.has(sku)) {
      sku = `${baseSku}-${counter++}`;
    }
    usedSkus.add(sku);

    const mergedVariant: ProductVariant = {
      id: first.id || `var-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      color: remainingAttr.type === 'color' ? opt.label : '',
      colorHex: opt.hex,
      size: remainingAttr.type === 'text' ? opt.label : '',
      sku,
      stock: limitedStockSum,
      enabled: hasEnabled,
      unlimited: hasUnlimited,
      attributeOptionId1: remaining === 'attr1' ? optId : undefined,
      attributeOptionId2: remaining === 'attr2' ? optId : undefined
    };

    newVariants.push(mergedVariant);

    summaryLines.push(
      `${product.name} · ${opt.label}: ${hasUnlimited ? 'Ilimitado' : `${limitedStockSum} unidades`}, de ${groupVars.length} variantes`
    );
  });

  const totalStock = newVariants.reduce((sum, v) => (v.enabled && !v.unlimited ? sum + v.stock : sum), 0);

  return {
    updatedProduct: {
      ...product,
      attributesUsed: [remaining],
      variants: newVariants,
      totalStock,
      isUnlimited: newVariants.every((v) => v.unlimited)
    },
    summaryLines
  };
}
