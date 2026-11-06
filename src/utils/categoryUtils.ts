import { Product, StoreCategory, StoreSettings, StoreSubcategory } from '../types';

/**
 * Normalizes a string to a safe identifier key
 */
export function slugifyCategory(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Default starter 2-level category tree when a store has no categories
 */
export const DEFAULT_CATEGORY_TREE: StoreCategory[] = [
  {
    id: 'cat_mujer',
    name: 'Mujer',
    subcategories: [
      { id: 'sub_remeras_mujer', name: 'Remeras' },
      { id: 'sub_buzos_mujer', name: 'Buzos' },
      { id: 'sub_pantalones_mujer', name: 'Pantalones' }
    ]
  },
  {
    id: 'cat_hombre',
    name: 'Hombre',
    subcategories: [
      { id: 'sub_remeras_hombre', name: 'Remeras' },
      { id: 'sub_buzos_hombre', name: 'Buzos' },
      { id: 'sub_pantalones_hombre', name: 'Pantalones' }
    ]
  },
  {
    id: 'cat_calzado',
    name: 'Calzado',
    subcategories: []
  },
  {
    id: 'cat_accesorios',
    name: 'Accesorios',
    subcategories: []
  }
];

/**
 * Guarantees a valid, robust 2-level category tree from store settings
 */
export function ensureStoreCategoryTree(settings?: Partial<StoreSettings>): StoreCategory[] {
  // If settings explicitly defined categoryTree (even if empty []), respect it!
  if (settings && 'categoryTree' in settings && Array.isArray(settings.categoryTree)) {
    return settings.categoryTree.map((cat, idx) => ({
      id: cat.id || `cat_${idx}_${slugifyCategory(cat.name || 'cat')}`,
      name: cat.name || 'Sin nombre',
      subcategories: (cat.subcategories || []).map((sub, sIdx) => ({
        id: sub.id || `sub_${sIdx}_${slugifyCategory(sub.name || 'sub')}`,
        name: sub.name || 'Sin nombre'
      }))
    }));
  }

  // Backwards compatibility migration from settings.categories string[]
  if (settings && 'categories' in settings && Array.isArray(settings.categories)) {
    const rawCategories = settings.categories.filter((c) => c && c.trim() && c !== 'Todas');
    return rawCategories.map((name, idx) => ({
      id: `cat_${idx}_${slugifyCategory(name)}`,
      name: name.trim(),
      subcategories: []
    }));
  }

  return DEFAULT_CATEGORY_TREE;
}

/**
 * Flattens all valid category names for backwards compatibility with settings.categories
 */
export function flattenCategoryTreeNames(tree: StoreCategory[]): string[] {
  const set = new Set<string>();
  set.add('Todas');
  tree.forEach((cat) => {
    if (cat.name) set.add(cat.name);
    (cat.subcategories || []).forEach((sub) => {
      if (sub.name) set.add(sub.name);
    });
  });
  return Array.from(set);
}

/**
 * Returns the list of category IDs or raw strings assigned to a product
 */
export function getProductCategoryKeys(product: Product): string[] {
  if (product.categories && Array.isArray(product.categories) && product.categories.length > 0) {
    return product.categories.filter((c) => Boolean(c && String(c).trim()));
  }
  if (product.category && product.category.trim()) {
    return [product.category.trim()];
  }
  return [];
}

/**
 * Checks if a product belongs to a given category or subcategory
 */
export function isProductMatchingCategory(
  product: Product,
  targetIdOrName: string,
  tree: StoreCategory[]
): boolean {
  if (!targetIdOrName || targetIdOrName === 'all' || targetIdOrName === 'Todas') {
    return true;
  }

  const pKeys = getProductCategoryKeys(product).map((k) => k.toLowerCase().trim());
  const targetLower = targetIdOrName.toLowerCase().trim();

  // 1. Direct match on ID or name in product keys
  if (pKeys.includes(targetLower)) return true;

  // 2. Check if target is a Parent Category
  const parent = tree.find(
    (c) => c.id.toLowerCase() === targetLower || c.name.toLowerCase() === targetLower
  );

  if (parent) {
    // If product has parent ID or parent name
    if (pKeys.includes(parent.id.toLowerCase()) || pKeys.includes(parent.name.toLowerCase())) {
      return true;
    }
    // If product has any of parent's subcategories
    const hasAnySub = parent.subcategories.some(
      (sub) => pKeys.includes(sub.id.toLowerCase()) || pKeys.includes(sub.name.toLowerCase())
    );
    if (hasAnySub) return true;
  }

  // 3. Check if target is a Subcategory
  for (const cat of tree) {
    const sub = (cat.subcategories || []).find(
      (s) => s.id.toLowerCase() === targetLower || s.name.toLowerCase() === targetLower
    );
    if (sub) {
      if (pKeys.includes(sub.id.toLowerCase()) || pKeys.includes(sub.name.toLowerCase())) {
        return true;
      }
    }
  }

  // 4. Fallback legacy string match on product.category
  if (product.category && product.category.toLowerCase().trim() === targetLower) {
    return true;
  }

  return false;
}

/**
 * Checks if a product matches a multi-selection of categories from the filter menu
 */
export function isProductInSelectedCategoryFilters(
  product: Product,
  selectedCategoryKeys: string[],
  tree: StoreCategory[]
): boolean {
  if (!selectedCategoryKeys || selectedCategoryKeys.length === 0) {
    return true;
  }
  if (selectedCategoryKeys.includes('all') || selectedCategoryKeys.includes('Todas')) {
    return true;
  }

  return selectedCategoryKeys.some((targetKey) =>
    isProductMatchingCategory(product, targetKey, tree)
  );
}

/**
 * Returns human-readable label list for a product's assigned categories
 */
export function formatProductCategoryLabels(product: Product, tree: StoreCategory[]): string[] {
  const keys = getProductCategoryKeys(product);
  if (keys.length === 0) return [product.category || 'General'];

  const labels: string[] = [];

  keys.forEach((key) => {
    const kLower = key.toLowerCase();
    // Look for subcategory first
    let found = false;
    for (const cat of tree) {
      const sub = (cat.subcategories || []).find(
        (s) => s.id.toLowerCase() === kLower || s.name.toLowerCase() === kLower
      );
      if (sub) {
        labels.push(`${cat.name} > ${sub.name}`);
        found = true;
        break;
      }
    }
    if (!found) {
      const parent = tree.find(
        (c) => c.id.toLowerCase() === kLower || c.name.toLowerCase() === kLower
      );
      if (parent) {
        labels.push(parent.name);
        found = true;
      }
    }
    if (!found) {
      labels.push(key);
    }
  });

  return Array.from(new Set(labels));
}

/**
 * Counts how many products belong to a specific category or subcategory
 */
export function countProductsInCategory(
  products: Product[],
  targetIdOrName: string,
  tree: StoreCategory[]
): number {
  return products.filter((p) => isProductMatchingCategory(p, targetIdOrName, tree)).length;
}
