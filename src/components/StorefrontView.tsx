import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, CartItem, StoreSettings, StoreFeatureFlags, StoreAttribute } from '../types';
import { useModalHistory } from '../hooks/useModalHistory';
import { ensureStoreAttributes, formatVariantSummary } from '../utils/attributeUtils';

interface StorefrontViewProps {
  products: Product[];
  settings: StoreSettings;
  cart: CartItem[];
  isLoading?: boolean;
  isSettingsLoaded?: boolean;
  onAddToCart: (item: CartItem) => void;
  onOpenCart?: () => void;
  storeSlug?: string;
  initialProductId?: string;
  featureFlags?: StoreFeatureFlags;
}

export const isVariantVisible = (v: { enabled?: boolean | string | number | null }): boolean => {
  return v.enabled !== false && (v.enabled as any) !== 'false' && (v.enabled as any) !== 0 && (v.enabled as any) !== '0';
};

export function getVariantAttr1(
  v: { attributeOptionId1?: string; color?: string; size?: string; colorHex?: string },
  attr1?: StoreAttribute
): { label: string; hex?: string; optionId?: string } {
  if (v.attributeOptionId1 && attr1) {
    const match = attr1.options.find((o) => o.id === v.attributeOptionId1);
    if (match) return { label: match.label, hex: match.hex || v.colorHex, optionId: match.id };
  }
  const vColor = v.color ? v.color.trim().toLowerCase() : '';
  if (vColor && attr1) {
    const match = attr1.options.find((o) => o.label.toLowerCase() === vColor);
    if (match) return { label: match.label, hex: match.hex || v.colorHex, optionId: match.id };
  }
  const vSize = v.size ? v.size.trim().toLowerCase() : '';
  if (vSize && attr1 && attr1.type === 'text' && !vColor) {
    const match = attr1.options.find((o) => o.label.toLowerCase() === vSize);
    if (match) return { label: match.label, hex: v.colorHex, optionId: match.id };
  }
  const label = (v.color || (attr1?.type === 'text' && !v.attributeOptionId1 ? v.size : '') || '').trim();
  return { label, hex: v.colorHex, optionId: v.attributeOptionId1 };
}

export function getVariantAttr2(
  v: { attributeOptionId2?: string; color?: string; size?: string; colorHex?: string },
  attr2?: StoreAttribute
): { label: string; hex?: string; optionId?: string } {
  if (v.attributeOptionId2 && attr2) {
    const match = attr2.options.find((o) => o.id === v.attributeOptionId2);
    if (match) return { label: match.label, hex: match.hex || v.colorHex, optionId: match.id };
  }
  const vSize = v.size ? v.size.trim().toLowerCase() : '';
  if (vSize && attr2) {
    const match = attr2.options.find((o) => o.label.toLowerCase() === vSize);
    if (match) return { label: match.label, hex: match.hex || v.colorHex, optionId: match.id };
  }
  const vColor = v.color ? v.color.trim().toLowerCase() : '';
  if (vColor && attr2 && attr2.type === 'color' && !vSize) {
    const match = attr2.options.find((o) => o.label.toLowerCase() === vColor);
    if (match) return { label: match.label, hex: match.hex || v.colorHex, optionId: match.id };
  }
  const label = (v.size || (attr2?.type === 'color' && !v.attributeOptionId2 ? v.color : '') || '').trim();
  return { label, hex: v.colorHex, optionId: v.attributeOptionId2 };
}

export const StorefrontView: React.FC<StorefrontViewProps> = ({
  products,
  settings,
  cart,
  isLoading = false,
  isSettingsLoaded = true,
  onAddToCart,
  onOpenCart,
  storeSlug = '',
  initialProductId,
  featureFlags
}) => {
  const { attribute1, attribute2 } = useMemo(() => ensureStoreAttributes(settings), [settings]);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedAttr1, setSelectedAttr1] = useState<string[]>([]);
  const [selectedAttr2, setSelectedAttr2] = useState<string[]>([]);
  const [onlyInStock, setOnlyInStock] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<string>('recent');
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(() => 
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [lastAddedProduct, setLastAddedProduct] = useState<string | null>(null);
  const [stockNotice, setStockNotice] = useState<string | null>(null);

  const showStockNotice = (msg: string) => {
    setStockNotice(msg);
    setTimeout(() => setStockNotice((prev) => (prev === msg ? null : prev)), 3500);
  };

  // Deep link share feedback
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [isLinkCopied, setIsLinkCopied] = useState<boolean>(false);

  // Popover menus state
  const [activeDropdown, setActiveDropdown] = useState<'cat' | 'attr1' | 'attr2' | null>(null);

  // Product Detail Modal state
  const [selectedProductModal, setSelectedProductModal] = useState<Product | null>(null);
  const [modalActiveImageIndex, setModalActiveImageIndex] = useState<number>(0);
  const [modalSelectedColor, setModalSelectedColor] = useState<string>('');
  const [modalSelectedSize, setModalSelectedSize] = useState<string>('');
  const [modalQuantity, setModalQuantity] = useState<number>(1);

  // Active color and size selection per card
  const [cardSelectedColor, setCardSelectedColor] = useState<Record<string, string>>({});
  const [cardSelectedSize, setCardSelectedSize] = useState<Record<string, string>>({});

  // Dynamic available categories
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    settings.categories.forEach((c) => {
      if (c && c !== 'Todas') set.add(c);
    });
    products.forEach((p) => {
      if (p.category && p.category !== 'Todas') set.add(p.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [settings.categories, products]);

  // Dynamic available options for Attribute 1
  const attr1Options = useMemo(() => {
    if (!attribute1.enabled) return [];
    const usedIds = new Set<string>();
    products.filter((p) => p.enabledOnline).forEach((p) => {
      p.variants.filter(isVariantVisible).forEach((v) => {
        if (v.attributeOptionId1) usedIds.add(v.attributeOptionId1);
        else if (attribute1.type === 'color' && v.color) {
          const match = attribute1.options.find((o) => o.label.toLowerCase() === v.color.toLowerCase());
          if (match) usedIds.add(match.id);
        } else if (v.size) {
          const match = attribute1.options.find((o) => o.label.toLowerCase() === v.size.toLowerCase());
          if (match) usedIds.add(match.id);
        }
      });
    });
    const visible = attribute1.options.filter((o) => usedIds.size === 0 || usedIds.has(o.id));
    return visible.length > 0 ? visible : attribute1.options;
  }, [attribute1, products]);

  // Dynamic available options for Attribute 2
  const attr2Options = useMemo(() => {
    if (!attribute2.enabled) return [];
    const usedIds = new Set<string>();
    products.filter((p) => p.enabledOnline).forEach((p) => {
      p.variants.filter(isVariantVisible).forEach((v) => {
        if (v.attributeOptionId2) usedIds.add(v.attributeOptionId2);
        else if (attribute2.type === 'color' && v.color) {
          const match = attribute2.options.find((o) => o.label.toLowerCase() === v.color.toLowerCase());
          if (match) usedIds.add(match.id);
        } else if (v.size) {
          const match = attribute2.options.find((o) => o.label.toLowerCase() === v.size.toLowerCase());
          if (match) usedIds.add(match.id);
        }
      });
    });
    const visible = attribute2.options.filter((o) => usedIds.size === 0 || usedIds.has(o.id));
    return visible.length > 0 ? visible : attribute2.options;
  }, [attribute2, products]);

  // Check if an attribute value represents a meaningful distinction rather than empty or placeholder
  const isAttrValueMeaningful = (val?: string | null): boolean => {
    if (!val) return false;
    const trimmed = val.trim().toLowerCase();
    return trimmed !== '' && trimmed !== 'único' && trimmed !== 'unico' && trimmed !== 'u' && trimmed !== 'general' && trimmed !== '-' && trimmed !== 'default';
  };

  // Helper to determine whether a product actively uses Attribute 1 and/or Attribute 2
  const getProductAttributeUsage = (
    product: Product,
    attr1: StoreAttribute,
    attr2: StoreAttribute
  ) => {
    const visible = product.variants.filter(isVariantVisible);
    const declaredAttr1 = !product.attributesUsed || product.attributesUsed.includes('attr1');
    const declaredAttr2 = !product.attributesUsed || product.attributesUsed.includes('attr2');

    const usesAttr1 = Boolean(
      attr1.enabled &&
      declaredAttr1 &&
      visible.some((v) => {
        const val = getVariantAttr1(v, attr1).label;
        return isAttrValueMeaningful(val);
      })
    );

    const usesAttr2 = Boolean(
      attr2.enabled &&
      declaredAttr2 &&
      visible.some((v) => {
        const val = getVariantAttr2(v, attr2).label;
        return isAttrValueMeaningful(val);
      })
    );

    return { usesAttr1, usesAttr2 };
  };

  // Helper to check if a product has variants configured with Attribute 1
  const productHasAttr1 = (p: Product) => {
    if (!attribute1.enabled) return false;
    const { usesAttr1 } = getProductAttributeUsage(p, attribute1, attribute2);
    return usesAttr1;
  };

  // Helper to check if a product has variants configured with Attribute 2
  const productHasAttr2 = (p: Product) => {
    if (!attribute2.enabled) return false;
    const { usesAttr2 } = getProductAttributeUsage(p, attribute1, attribute2);
    return usesAttr2;
  };

  // Check if there are active products without Attribute 1 to show "Otros" filter
  const hasProductsWithoutAttr1 = useMemo(() => {
    if (!attribute1.enabled) return false;
    return products.some(
      (p) => p.enabledOnline && p.variants.some(isVariantVisible) && !productHasAttr1(p)
    );
  }, [attribute1, products]);

  // Check if there are active products without Attribute 2 to show "Otros" filter
  const hasProductsWithoutAttr2 = useMemo(() => {
    if (!attribute2.enabled) return false;
    return products.some(
      (p) => p.enabledOnline && p.variants.some(isVariantVisible) && !productHasAttr2(p)
    );
  }, [attribute2, products]);

  // Toggle filter helper functions
  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleAttr1 = (id: string) => {
    setSelectedAttr1((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleAttr2 = (id: string) => {
    setSelectedAttr2((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedAttr1([]);
    setSelectedAttr2([]);
    setOnlyInStock(true);
  };

  const hasSpecificFilters =
    selectedCategories.length > 0 ||
    selectedAttr1.length > 0 ||
    selectedAttr2.length > 0;
  const activeFiltersCount =
    selectedCategories.length +
    selectedAttr1.length +
    selectedAttr2.length +
    (!onlyInStock ? 1 : 0);

  // Filtered & Sorted products (Supporting multi-select, dynamic attributes, stock boolean, hiding 0 variants)
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => p.variants && p.variants.length > 0 && p.enabledOnline && p.variants.some(isVariantVisible))
      .filter((p) => {
        // Multi Category filter
        if (selectedCategories.length > 0) {
          const matchCat = selectedCategories.some(
            (c) => p.category.toLowerCase() === c.toLowerCase()
          );
          if (!matchCat) return false;
        }

        // Helper to check if a variant matches active attr1 and attr2 filters
        const variantMatchesCriteria = (v: any) => {
          if (!isVariantVisible(v)) return false;

          if (attribute1.enabled && selectedAttr1.length > 0) {
            const hasOther1 = selectedAttr1.includes('__other__');
            const hasSpecificOptions1 = selectedAttr1.some((s) => s !== '__other__');
            const pHas1 = productHasAttr1(p);

            if (!pHas1) {
              if (!hasOther1) return false;
            } else {
              if (!hasSpecificOptions1) return false;
              const val1 = getVariantAttr1(v, attribute1);
              const match1 = selectedAttr1.filter((s) => s !== '__other__').some((sel) => {
                if (val1.optionId && sel === val1.optionId) return true;
                const opt = attribute1.options.find((o) => o.id === sel);
                return opt && val1.label.toLowerCase() === opt.label.toLowerCase();
              });
              if (!match1) return false;
            }
          }

          if (attribute2.enabled && selectedAttr2.length > 0) {
            const hasOther2 = selectedAttr2.includes('__other__');
            const hasSpecificOptions2 = selectedAttr2.some((s) => s !== '__other__');
            const pHas2 = productHasAttr2(p);

            if (!pHas2) {
              if (!hasOther2) return false;
            } else {
              if (!hasSpecificOptions2) return false;
              const val2 = getVariantAttr2(v, attribute2);
              const match2 = selectedAttr2.filter((s) => s !== '__other__').some((sel) => {
                if (val2.optionId && sel === val2.optionId) return true;
                const opt = attribute2.options.find((o) => o.id === sel);
                return opt && val2.label.toLowerCase() === opt.label.toLowerCase();
              });
              if (!match2) return false;
            }
          }

          return true;
        };

        const matchingVariants = p.variants.filter(variantMatchesCriteria);
        if (matchingVariants.length === 0) return false;

        if (onlyInStock) {
          const hasMatchingStock = matchingVariants.some(
            (v) => v.unlimited || Number(v.stock || 0) > 0
          );
          if (!hasMatchingStock) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-low') return a.price - b.price;
        if (sortBy === 'price-high') return b.price - a.price;
        if (sortBy === 'popular') return b.totalStock - a.totalStock;
        return 0;
      });
  }, [products, selectedCategories, selectedAttr1, selectedAttr2, onlyInStock, sortBy, attribute1, attribute2]);

  // Helper to generate the exact deep link URL for a product
  const getProductShareUrl = (productId: string): string => {
    const slug = storeSlug || 'tienda';
    const origin = window.location.origin;
    const isHash = window.location.hash && window.location.hash.startsWith('#');
    if (isHash) {
      return `${origin}${window.location.pathname}#/${slug}?p=${encodeURIComponent(productId)}`;
    }
    return `${origin}/${slug}?p=${encodeURIComponent(productId)}`;
  };

  // Synchronize browser URL bar without page reload so customers can copy URL directly
  const updateUrlForProduct = (productId: string | null) => {
    try {
      const isHash = window.location.hash && window.location.hash.startsWith('#');
      if (productId) {
        if (isHash) {
          const baseHash = window.location.hash.split('?')[0];
          window.history.replaceState(null, '', `${baseHash}?p=${encodeURIComponent(productId)}`);
        } else {
          const pathname = window.location.pathname;
          window.history.replaceState(null, '', `${pathname}?p=${encodeURIComponent(productId)}`);
        }
      } else {
        if (isHash) {
          const baseHash = window.location.hash.split('?')[0];
          window.history.replaceState(null, '', baseHash);
        } else {
          const pathname = window.location.pathname;
          window.history.replaceState(null, '', pathname);
        }
      }
    } catch {
      // Safe fallback
    }
  };

  const closeProductModal = () => {
    setSelectedProductModal(null);
    updateUrlForProduct(null);
    try {
      document.title = settings.storeName || 'Atelier';
    } catch {}
  };

  const openProductModal = (product: Product) => {
    setSelectedProductModal(product);
    setModalActiveImageIndex(product.coverIndex || 0);
    const visibleVariants = product.variants.filter(isVariantVisible);
    const { usesAttr1, usesAttr2 } = getProductAttributeUsage(product, attribute1, attribute2);

    const attr1Map = new Map<string, string>();
    const attr2Map = new Map<string, string>();
    visibleVariants.forEach((v) => {
      const v1 = getVariantAttr1(v, attribute1).label;
      if (v1 && !attr1Map.has(v1.toLowerCase())) attr1Map.set(v1.toLowerCase(), v1);
      const v2 = getVariantAttr2(v, attribute2).label;
      if (v2 && !attr2Map.has(v2.toLowerCase())) attr2Map.set(v2.toLowerCase(), v2);
    });

    const availableAttr1 = Array.from(attr1Map.values());
    const availableAttr2 = Array.from(attr2Map.values());

    const initialColor = usesAttr1
      ? (cardSelectedColor[product.id] && availableAttr1.some((l) => l.toLowerCase() === cardSelectedColor[product.id].toLowerCase())
          ? cardSelectedColor[product.id]
          : availableAttr1[0] || '')
      : '';

    const initialSize = usesAttr2
      ? (cardSelectedSize[product.id] && availableAttr2.some((l) => l.toLowerCase() === cardSelectedSize[product.id].toLowerCase())
          ? cardSelectedSize[product.id]
          : availableAttr2[0] || '')
      : '';

    setModalSelectedColor(initialColor);
    setModalSelectedSize(initialSize);
    setModalQuantity(1);

    // Update URL with deep link
    updateUrlForProduct(product.id);
    try {
      document.title = `${product.name} | ${settings.storeName || 'Atelier'}`;
    } catch {}
  };

  // Auto-open product modal on page load if deep linked (?p=... or initialProductId)
  const hasAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (!isLoading && products.length > 0 && !hasAutoOpenedRef.current) {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = window.location.hash.includes('?')
        ? new URLSearchParams(window.location.hash.split('?')[1])
        : null;
      const targetId =
        initialProductId ||
        searchParams.get('p') ||
        searchParams.get('producto') ||
        searchParams.get('item') ||
        hashParams?.get('p') ||
        hashParams?.get('producto') ||
        hashParams?.get('item');

      if (targetId) {
        const found = products.find(
          (p) => p.id === targetId || p.id.toLowerCase() === targetId.toLowerCase()
        );
        if (found) {
          hasAutoOpenedRef.current = true;
          openProductModal(found);
          setTimeout(() => {
            const catalogEl = document.getElementById('catalog');
            if (catalogEl) {
              catalogEl.scrollIntoView({ behavior: 'smooth' });
            }
          }, 150);
        }
      }
    }
  }, [products, isLoading, initialProductId]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedProductModal) {
        closeProductModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProductModal]);

  // Intercept mobile device back button / swipe-back gesture to close product modal
  useModalHistory({
    isOpen: Boolean(selectedProductModal),
    onClose: closeProductModal,
    modalKey: 'storefront-product-modal'
  });

  // High-fidelity Share handler (Web Share API on mobile, Clipboard + Toast on desktop)
  const handleShareProduct = async (product: Product, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    const directUrl = getProductShareUrl(product.id);
    const shareTitle = product.name;
    const shareText = `Mirá ${product.name} en ${settings.storeName || 'Atelier'} ($${product.price.toLocaleString('es-AR')})`;

    // Use Web Share API if supported on mobile
    if (navigator.share && /mobile|android|iphone|ipad/i.test(navigator.userAgent || '')) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: directUrl,
        });
        return;
      } catch {
        // User cancelled or share dismissed
      }
    }

    // Clipboard writeText
    try {
      await navigator.clipboard.writeText(directUrl);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = directUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }

    setIsLinkCopied(true);
    setShareToast(`¡Enlace copiado! Ya podés compartir "${product.name}"`);
    setTimeout(() => setIsLinkCopied(false), 2500);
    setTimeout(() => setShareToast(null), 3500);
  };

  const handleModalAddToCart = () => {
    if (!selectedProductModal) return;
    const product = selectedProductModal;
    const visibleVariants = product.variants.filter(isVariantVisible);
    const { usesAttr1, usesAttr2 } = getProductAttributeUsage(product, attribute1, attribute2);

    let matchedVariant = visibleVariants.find((v) => {
      const v1 = getVariantAttr1(v, attribute1).label.toLowerCase();
      const v2 = getVariantAttr2(v, attribute2).label.toLowerCase();
      const m1 = !usesAttr1 || !modalSelectedColor || v1 === modalSelectedColor.toLowerCase();
      const m2 = !usesAttr2 || !modalSelectedSize || v2 === modalSelectedSize.toLowerCase();
      return m1 && m2;
    });

    if (!matchedVariant && usesAttr1 && modalSelectedColor) {
      matchedVariant = visibleVariants.find((v) => getVariantAttr1(v, attribute1).label.toLowerCase() === modalSelectedColor.toLowerCase());
    }
    if (!matchedVariant && usesAttr2 && modalSelectedSize) {
      matchedVariant = visibleVariants.find((v) => getVariantAttr2(v, attribute2).label.toLowerCase() === modalSelectedSize.toLowerCase());
    }
    if (!matchedVariant) {
      matchedVariant = visibleVariants[0];
    }

    if (!matchedVariant) {
      showStockNotice('Esta combinación no se encuentra disponible.');
      return;
    }

    const isUnlimited = Boolean(matchedVariant.unlimited || product.isUnlimited);

    const inCart =
      cart.find(
        (c) =>
          c.productId === selectedProductModal.id &&
          (c.variantId ? c.variantId === matchedVariant.id : true) &&
          (usesAttr1 ? (c.color || '').toLowerCase() === (matchedVariant.color || '').toLowerCase() : true) &&
          (usesAttr2 ? (c.size || '').toLowerCase() === (matchedVariant.size || '').toLowerCase() : true)
      )?.quantity || 0;

    const maxStock = isUnlimited ? 999999 : Number(matchedVariant.stock || 0);
    const remainingStock = isUnlimited ? 999999 : Math.max(0, maxStock - inCart);

    if (!isUnlimited && remainingStock <= 0) {
      showStockNotice(`Ya agregaste todo el stock disponible de esta combinación al carrito.`);
      return;
    }

    const qtyToAdd = isUnlimited ? modalQuantity : Math.min(modalQuantity, remainingStock);
    const image = selectedProductModal.images[modalActiveImageIndex] || selectedProductModal.images[0];
    const effectiveModalPrice = (
      selectedProductModal.discountPrice &&
      selectedProductModal.discountPrice > 0 &&
      selectedProductModal.discountPrice < selectedProductModal.price
    )
      ? selectedProductModal.discountPrice
      : selectedProductModal.price;

    onAddToCart({
      productId: selectedProductModal.id,
      productName: selectedProductModal.name,
      variantId: matchedVariant.id || 'v-default',
      size: usesAttr2 ? matchedVariant.size : '',
      color: usesAttr1 ? matchedVariant.color : '',
      attributeSummary: formatVariantSummary(matchedVariant, attribute1, attribute2, selectedProductModal),
      unlimited: isUnlimited,
      price: effectiveModalPrice,
      quantity: qtyToAdd,
      image
    });

    setLastAddedProduct(selectedProductModal.name);
    setTimeout(() => setLastAddedProduct(null), 3000);
  };

  const handleAddToCart = (product: Product) => {
    const visibleVariants = product.variants.filter(isVariantVisible);
    if (visibleVariants.length === 0) {
      showStockNotice('Esta prenda no tiene variantes disponibles.');
      return;
    }
    const { usesAttr1, usesAttr2 } = getProductAttributeUsage(product, attribute1, attribute2);

    const attr1Map = new Map<string, string>();
    const attr2Map = new Map<string, string>();
    visibleVariants.forEach((v) => {
      const v1 = getVariantAttr1(v, attribute1).label;
      if (v1 && !attr1Map.has(v1.toLowerCase())) attr1Map.set(v1.toLowerCase(), v1);
      const v2 = getVariantAttr2(v, attribute2).label;
      if (v2 && !attr2Map.has(v2.toLowerCase())) attr2Map.set(v2.toLowerCase(), v2);
    });

    const availableAttr1 = Array.from(attr1Map.values());
    const availableAttr2 = Array.from(attr2Map.values());

    const color = usesAttr1
      ? (cardSelectedColor[product.id] && availableAttr1.some((l) => l.toLowerCase() === cardSelectedColor[product.id].toLowerCase())
          ? cardSelectedColor[product.id]
          : availableAttr1[0] || '')
      : '';

    const size = usesAttr2
      ? (cardSelectedSize[product.id] && availableAttr2.some((l) => l.toLowerCase() === cardSelectedSize[product.id].toLowerCase())
          ? cardSelectedSize[product.id]
          : availableAttr2[0] || '')
      : '';

    let matchedVariant = visibleVariants.find((v) => {
      const v1 = getVariantAttr1(v, attribute1).label.toLowerCase();
      const v2 = getVariantAttr2(v, attribute2).label.toLowerCase();
      const m1 = !usesAttr1 || !color || v1 === color.toLowerCase();
      const m2 = !usesAttr2 || !size || v2 === size.toLowerCase();
      return m1 && m2;
    });

    if (!matchedVariant && usesAttr1 && color) {
      matchedVariant = visibleVariants.find((v) => getVariantAttr1(v, attribute1).label.toLowerCase() === color.toLowerCase());
    }
    if (!matchedVariant && usesAttr2 && size) {
      matchedVariant = visibleVariants.find((v) => getVariantAttr2(v, attribute2).label.toLowerCase() === size.toLowerCase());
    }
    if (!matchedVariant) {
      matchedVariant = visibleVariants[0];
    }

    if (!matchedVariant) {
      showStockNotice('Esta prenda no tiene combinaciones disponibles.');
      return;
    }

    const isUnlimited = Boolean(matchedVariant.unlimited || product.isUnlimited);

    const inCart =
      cart.find(
        (c) =>
          c.productId === product.id &&
          (c.variantId ? c.variantId === matchedVariant.id : true) &&
          (usesAttr1 ? (c.color || '').toLowerCase() === (matchedVariant.color || '').toLowerCase() : true) &&
          (usesAttr2 ? (c.size || '').toLowerCase() === (matchedVariant.size || '').toLowerCase() : true)
      )?.quantity || 0;

    const maxStock = isUnlimited ? 999999 : Number(matchedVariant.stock || 0);
    const remainingStock = isUnlimited ? 999999 : Math.max(0, maxStock - inCart);

    if (!isUnlimited && remainingStock <= 0) {
      showStockNotice(`Ya agregaste todo el stock disponible de "${product.name}" al carrito.`);
      return;
    }

    const image = product.images[product.coverIndex || 0] || product.images[0];
    const effectiveCardPrice = (
      product.discountPrice &&
      product.discountPrice > 0 &&
      product.discountPrice < product.price
    )
      ? product.discountPrice
      : product.price;

    onAddToCart({
      productId: product.id,
      productName: product.name,
      variantId: matchedVariant.id || 'v-default',
      size: usesAttr2 ? matchedVariant.size : '',
      color: usesAttr1 ? matchedVariant.color : '',
      attributeSummary: formatVariantSummary(matchedVariant, attribute1, attribute2, product),
      unlimited: isUnlimited,
      price: effectiveCardPrice,
      quantity: 1,
      image
    });

    setLastAddedProduct(product.name);
    setTimeout(() => setLastAddedProduct(null), 3000);
  };

  return (
    <div className="w-full flex flex-col">
      {/* Toast Notification for Added Item */}
      {lastAddedProduct && (
        <div 
          className="fixed top-20 sm:top-24 right-4 sm:right-8 z-[100] text-white text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200"
          style={{ backgroundColor: settings.primaryColor || '#1A1A1A' }}
        >
          <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
          <span><strong>{lastAddedProduct}</strong> agregado al carrito</span>
          {onOpenCart && (
            <button
              onClick={onOpenCart}
              className="ml-2 underline text-white font-semibold hover:opacity-80"
            >
              Ver carrito
            </button>
          )}
        </div>
      )}

      {/* Toast Notification for Shared / Copied Link */}
      {shareToast && (
        <div 
          className="fixed top-20 sm:top-24 right-4 sm:right-8 z-[100] text-white text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 bg-neutral-900 border border-neutral-700 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <span className="material-symbols-outlined text-[18px] text-emerald-400">check_circle</span>
          <span className="font-medium text-white">{shareToast}</span>
        </div>
      )}

      {/* Toast Notification for Stock Notice */}
      {stockNotice && (
        <div 
          className="fixed top-20 sm:top-24 right-4 sm:right-8 z-[100] text-amber-950 text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 bg-amber-50 border border-amber-200/90 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 max-w-sm"
        >
          <span className="material-symbols-outlined text-[19px] text-amber-600 shrink-0">inventory_2</span>
          <span className="font-medium leading-snug">{stockNotice}</span>
          <button
            type="button"
            onClick={() => setStockNotice(null)}
            className="ml-auto text-amber-800 hover:text-black text-sm px-1 cursor-pointer font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Filtros Multiselección: Categoría, Talle, Color, Stock y Ordenar con Botón Flotante */}
      <section className="w-full px-2.5 sm:px-8 mt-3 sm:mt-5 mb-5 sm:mb-6 max-w-[1600px] mx-auto">
        <div className="relative bg-white p-3 sm:p-3.5 rounded-2xl shadow-xs border border-[#efeded]">
          {/* Deck de Controles de Filtros y Ordenar en una sola fila fluida */}
          {isFiltersOpen && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {/* Categorías Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActiveDropdown(activeDropdown === 'cat' ? null : 'cat')}
                  className={`h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                    selectedCategories.length > 0
                      ? 'bg-black text-white border-black shadow-xs'
                      : 'bg-[#f5f3f3] hover:bg-[#efeded] text-neutral-800 border-transparent'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px]">category</span>
                  <span>
                    {selectedCategories.length === 0
                      ? 'Categorías'
                      : `Categorías (${selectedCategories.length})`}
                  </span>
                  <span className="material-symbols-outlined text-[16px] opacity-70">
                    {activeDropdown === 'cat' ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {activeDropdown === 'cat' && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setActiveDropdown(null)}
                    />
                    <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-neutral-200 p-3 z-30 flex flex-col gap-2 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-100 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                        <span>Filtrar Categorías</span>
                        {selectedCategories.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedCategories([])}
                            className="text-neutral-500 hover:text-black underline cursor-pointer"
                          >
                            Limpiar
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        {categoryOptions.map((cat) => {
                          const isChecked = selectedCategories.includes(cat);
                          const count = products.filter(
                            (p) => p.enabledOnline && p.category.toLowerCase() === cat.toLowerCase()
                          ).length;
                          return (
                            <label
                              key={cat}
                              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#f5f3f3] text-xs cursor-pointer select-none transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleCategory(cat)}
                                  className="w-4 h-4 rounded text-black focus:ring-0 border-neutral-300 cursor-pointer"
                                />
                                <span className={isChecked ? 'font-bold text-black' : 'text-neutral-700'}>
                                  {cat}
                                </span>
                              </div>
                              <span className="text-[11px] text-neutral-400 font-medium">({count})</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Atributo 1 Dropdown (si está habilitado) */}
              {attribute1.enabled && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveDropdown(activeDropdown === 'attr1' ? null : 'attr1')}
                    className={`h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                      selectedAttr1.length > 0
                        ? 'bg-black text-white border-black shadow-xs'
                        : 'bg-[#f5f3f3] hover:bg-[#efeded] text-neutral-800 border-transparent'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[17px]">
                      {attribute1.type === 'color' ? 'palette' : 'tune'}
                    </span>
                    <span>
                      {selectedAttr1.length === 0
                        ? attribute1.name
                        : `${attribute1.name} (${selectedAttr1.length})`}
                    </span>
                    <span className="material-symbols-outlined text-[16px] opacity-70">
                      {activeDropdown === 'attr1' ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>

                  {activeDropdown === 'attr1' && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setActiveDropdown(null)}
                      />
                      <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-neutral-200 p-3 z-30 flex flex-col gap-2 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                        <div className="flex items-center justify-between pb-2 border-b border-neutral-100 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                          <span>Filtrar {attribute1.name}</span>
                          {selectedAttr1.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedAttr1([])}
                              className="text-neutral-500 hover:text-black underline cursor-pointer"
                            >
                              Limpiar
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          {attr1Options.map((opt) => {
                            const isChecked = selectedAttr1.includes(opt.id);
                            return (
                              <label
                                key={opt.id}
                                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#f5f3f3] text-xs cursor-pointer select-none transition-colors"
                              >
                                <div className="flex items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleAttr1(opt.id)}
                                    className="w-4 h-4 rounded text-black focus:ring-0 border-neutral-300 cursor-pointer"
                                  />
                                  {attribute1.type === 'color' && (
                                    <span
                                      className="w-3.5 h-3.5 rounded-full border border-black/15 shrink-0"
                                      style={{ backgroundColor: opt.hex || '#000000' }}
                                    />
                                  )}
                                  <span className={isChecked ? 'font-bold text-black' : 'text-neutral-700'}>
                                    {opt.label}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                          {hasProductsWithoutAttr1 && (
                            <label className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#f5f3f3] text-xs cursor-pointer select-none transition-colors border-t border-neutral-100 pt-2 mt-1">
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={selectedAttr1.includes('__other__')}
                                  onChange={() => toggleAttr1('__other__')}
                                  className="w-4 h-4 rounded text-black focus:ring-0 border-neutral-300 cursor-pointer"
                                />
                                <span className="material-symbols-outlined text-[15px] text-neutral-400">help_outline</span>
                                <span className={selectedAttr1.includes('__other__') ? 'font-bold text-black' : 'text-neutral-700'}>
                                  Otros
                                </span>
                              </div>
                            </label>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Atributo 2 Dropdown (si está habilitado) */}
              {attribute2.enabled && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveDropdown(activeDropdown === 'attr2' ? null : 'attr2')}
                    className={`h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                      selectedAttr2.length > 0
                        ? 'bg-black text-white border-black shadow-xs'
                        : 'bg-[#f5f3f3] hover:bg-[#efeded] text-neutral-800 border-transparent'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[17px]">
                      {attribute2.type === 'color' ? 'palette' : 'straighten'}
                    </span>
                    <span>
                      {selectedAttr2.length === 0
                        ? attribute2.name
                        : `${attribute2.name} (${selectedAttr2.length})`}
                    </span>
                    <span className="material-symbols-outlined text-[16px] opacity-70">
                      {activeDropdown === 'attr2' ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>

                  {activeDropdown === 'attr2' && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setActiveDropdown(null)}
                      />
                      <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-neutral-200 p-3 z-30 flex flex-col gap-2 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                        <div className="flex items-center justify-between pb-2 border-b border-neutral-100 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                          <span>Filtrar {attribute2.name}</span>
                          {selectedAttr2.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedAttr2([])}
                              className="text-neutral-500 hover:text-black underline cursor-pointer"
                            >
                              Limpiar
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          {attr2Options.map((opt) => {
                            const isChecked = selectedAttr2.includes(opt.id);
                            return (
                              <label
                                key={opt.id}
                                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#f5f3f3] text-xs cursor-pointer select-none transition-colors"
                              >
                                <div className="flex items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleAttr2(opt.id)}
                                    className="w-4 h-4 rounded text-black focus:ring-0 border-neutral-300 cursor-pointer"
                                  />
                                  {attribute2.type === 'color' && (
                                    <span
                                      className="w-3.5 h-3.5 rounded-full border border-black/15 shrink-0"
                                      style={{ backgroundColor: opt.hex || '#000000' }}
                                    />
                                  )}
                                  <span className={isChecked ? 'font-bold text-black' : 'text-neutral-700'}>
                                    {opt.label}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                          {hasProductsWithoutAttr2 && (
                            <label className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#f5f3f3] text-xs cursor-pointer select-none transition-colors border-t border-neutral-100 pt-2 mt-1">
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={selectedAttr2.includes('__other__')}
                                  onChange={() => toggleAttr2('__other__')}
                                  className="w-4 h-4 rounded text-black focus:ring-0 border-neutral-300 cursor-pointer"
                                />
                                <span className="material-symbols-outlined text-[15px] text-neutral-400">help_outline</span>
                                <span className={selectedAttr2.includes('__other__') ? 'font-bold text-black' : 'text-neutral-700'}>
                                  Otros
                                </span>
                              </div>
                            </label>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Interruptor Booleano: Solo en Stock */}
              <div className="h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl bg-[#f5f3f3] border border-transparent hover:border-neutral-200 flex items-center gap-2.5 transition-colors">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyInStock}
                    onChange={(e) => setOnlyInStock(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center p-0.5 ${
                      onlyInStock ? 'bg-emerald-600' : 'bg-neutral-300'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full bg-white transition-transform shadow-xs ${
                        onlyInStock ? 'translate-x-3.5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                  <span className="text-xs font-semibold text-neutral-800">
                    Solo disponibles
                  </span>
                </label>
              </div>

              {/* Selector de Ordenar: en el MISMO renglón de los filtros */}
              <div className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl bg-[#f5f3f3] hover:bg-[#efeded] border border-transparent hover:border-neutral-200 flex items-center gap-1.5 transition-colors">
                <span className="material-symbols-outlined text-[17px] text-neutral-500">
                  swap_vert
                </span>
                <span className="text-xs text-neutral-600 font-semibold hidden xs:inline">
                  Ordenar:
                </span>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="appearance-none pl-1 pr-6 py-1 bg-transparent text-black text-xs font-semibold outline-none cursor-pointer"
                  >
                    <option value="recent">Más recientes</option>
                    <option value="price-low">Menor precio</option>
                    <option value="price-high">Mayor precio</option>
                    <option value="popular">Más stock / unidades</option>
                  </select>
                  <span className="material-symbols-outlined text-[16px] text-neutral-500 pointer-events-none absolute right-0 top-1/2 -translate-y-1/2">
                    expand_more
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Cuadrito de Filtros aplicados: siempre visible cuando hay filtros activos (incluso si los controles están ocultos) */}
          {activeFiltersCount > 0 && (
            <div className={`flex items-center gap-1.5 flex-wrap text-xs ${isFiltersOpen ? 'pt-2.5 mt-2.5 border-t border-neutral-100' : ''}`}>
              <span className="text-[11px] font-semibold text-neutral-400 mr-1">Filtros aplicados:</span>

              {selectedCategories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#efeded] text-black text-[11px] font-medium"
                >
                  <span>Cat: {cat}</span>
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className="hover:text-red-600 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}

              {selectedAttr1.map((id) => {
                const opt = attribute1.options.find((o) => o.id === id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#efeded] text-black text-[11px] font-medium"
                  >
                    <span>{attribute1.name}: {id === '__other__' ? 'Otros' : (opt?.label || id)}</span>
                    <button
                      type="button"
                      onClick={() => toggleAttr1(id)}
                      className="hover:text-red-600 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                );
              })}

              {selectedAttr2.map((id) => {
                const opt = attribute2.options.find((o) => o.id === id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#efeded] text-black text-[11px] font-medium"
                  >
                    <span>{attribute2.name}: {id === '__other__' ? 'Otros' : (opt?.label || id)}</span>
                    <button
                      type="button"
                      onClick={() => toggleAttr2(id)}
                      className="hover:text-red-600 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                );
              })}

              {!onlyInStock && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-200 text-neutral-800 text-[11px] font-medium">
                  <span>Incluye no disponibles</span>
                  <button
                    type="button"
                    onClick={() => setOnlyInStock(true)}
                    className="hover:text-red-600 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              )}

              {hasSpecificFilters && onlyInStock && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-medium">
                  <span>Solo disponibles</span>
                  <button
                    type="button"
                    onClick={() => setOnlyInStock(false)}
                    className="hover:text-red-600 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              )}

              {/* Botón 'Limpiar' integrado como un ítem más del listado en rojo y chiquito */}
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline px-2 py-0.5 cursor-pointer flex items-center gap-0.5 transition-colors"
                title="Limpiar todos los filtros aplicados"
              >
                <span>Limpiar</span>
              </button>
            </div>
          )}

          {/* Estado colapsado sin filtros activos: indicación mínima discreta */}
          {!isFiltersOpen && activeFiltersCount === 0 && (
            <div
              onClick={() => setIsFiltersOpen(true)}
              className="py-0.5 text-center text-xs text-neutral-400 font-medium cursor-pointer hover:text-neutral-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>Filtros y ordenación</span>
            </div>
          )}

          {/* Botón FLOTANTE debajo de los filtros aplicados, justo en el límite del área blanca */}
          <button
            type="button"
            onClick={() => setIsFiltersOpen((prev) => !prev)}
            className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900 border border-neutral-300 shadow-xs flex items-center justify-center transition-all cursor-pointer z-10 hover:scale-105 active:scale-95"
            title={isFiltersOpen ? "Ocultar filtros" : "Mostrar filtros"}
            aria-label={isFiltersOpen ? "Ocultar filtros" : "Mostrar filtros"}
          >
            <span className="material-symbols-outlined text-[18px]">
              {isFiltersOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
            </span>
          </button>
        </div>
      </section>

      {/* Main Product Showcase - Full Width */}
      <div className="w-full px-2.5 sm:px-8 pb-16 max-w-[1600px] mx-auto">
        <div className="w-full flex flex-col gap-6">
          {isLoading && products.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-6 animate-pulse">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <div key={n} className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-[#efeded] flex flex-col gap-2.5 shadow-xs">
                  <div className="w-full aspect-[3/4] bg-neutral-100 rounded-lg sm:rounded-xl" />
                  <div className="h-4 w-3/4 bg-neutral-100 rounded mt-1" />
                  <div className="h-3 w-1/3 bg-neutral-100 rounded" />
                  <div className="flex gap-1.5 mt-1">
                    <div className="h-5 w-8 bg-neutral-100 rounded" />
                    <div className="h-5 w-8 bg-neutral-100 rounded" />
                  </div>
                  <div className="h-8 sm:h-10 w-full bg-neutral-100 rounded-lg sm:rounded-xl mt-2" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-[#efeded]">
              <span className="material-symbols-outlined text-[40px] text-neutral-300 mb-2">
                checkroom
              </span>
              <h3 className="text-base font-bold text-neutral-800">
                No hay productos con los filtros seleccionados
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                No hay prendas disponibles en esta categoría.
              </p>
              <button
                onClick={clearAllFilters}
                className="mt-4 px-4 py-2 bg-black text-white text-xs rounded-lg font-medium hover:bg-neutral-800 transition-colors"
              >
                Ver Todas las Prendas
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-6">
                {filteredProducts.map((product) => {
                  const visibleVariants = product.variants.filter(isVariantVisible);
                  const { usesAttr1, usesAttr2 } = getProductAttributeUsage(product, attribute1, attribute2);

                  const cardImageSize = settings.cardImageSize || 'large';

                  // Available options for Attr1 & Attr2 for this product
                  const attr1Map = new Map<string, { label: string; hex?: string; optionId?: string }>();
                  const attr2Map = new Map<string, { label: string; hex?: string; optionId?: string }>();

                  visibleVariants.forEach((v) => {
                    if (usesAttr1) {
                      const o1 = getVariantAttr1(v, attribute1);
                      if (o1.label && !attr1Map.has(o1.label.toLowerCase())) {
                        attr1Map.set(o1.label.toLowerCase(), o1);
                      }
                    }
                    if (usesAttr2) {
                      const o2 = getVariantAttr2(v, attribute2);
                      if (o2.label && !attr2Map.has(o2.label.toLowerCase())) {
                        attr2Map.set(o2.label.toLowerCase(), o2);
                      }
                    }
                  });

                  const prodAttr1Options = Array.from(attr1Map.values());
                  const prodAttr2Options = Array.from(attr2Map.values());

                  const preferredFilter1 = selectedAttr1.find((s) => prodAttr1Options.some((o) => o.optionId === s || o.label.toLowerCase() === s.toLowerCase()));
                  const preferredFilter2 = selectedAttr2.find((s) => prodAttr2Options.some((o) => o.optionId === s || o.label.toLowerCase() === s.toLowerCase()));

                  const currentAttr1Label = usesAttr1
                    ? (cardSelectedColor[product.id] && prodAttr1Options.some((o) => o.label.toLowerCase() === cardSelectedColor[product.id].toLowerCase())
                        ? cardSelectedColor[product.id]
                        : (preferredFilter1 ? (prodAttr1Options.find((o) => o.optionId === preferredFilter1 || o.label.toLowerCase() === preferredFilter1.toLowerCase())?.label || prodAttr1Options[0]?.label || '') : prodAttr1Options[0]?.label || ''))
                    : '';

                  const currentAttr2Label = usesAttr2
                    ? (cardSelectedSize[product.id] && prodAttr2Options.some((o) => o.label.toLowerCase() === cardSelectedSize[product.id].toLowerCase())
                        ? cardSelectedSize[product.id]
                        : (preferredFilter2 ? (prodAttr2Options.find((o) => o.optionId === preferredFilter2 || o.label.toLowerCase() === preferredFilter2.toLowerCase())?.label || prodAttr2Options[0]?.label || '') : prodAttr2Options[0]?.label || ''))
                    : '';

                  let selectedVariant = visibleVariants.find((v) => {
                    const v1 = getVariantAttr1(v, attribute1).label.toLowerCase();
                    const v2 = getVariantAttr2(v, attribute2).label.toLowerCase();
                    const m1 = !usesAttr1 || !currentAttr1Label || v1 === currentAttr1Label.toLowerCase();
                    const m2 = !usesAttr2 || !currentAttr2Label || v2 === currentAttr2Label.toLowerCase();
                    return m1 && m2;
                  });
                  if (!selectedVariant && usesAttr1 && currentAttr1Label) {
                    selectedVariant = visibleVariants.find((v) => getVariantAttr1(v, attribute1).label.toLowerCase() === currentAttr1Label.toLowerCase());
                  }
                  if (!selectedVariant && usesAttr2 && currentAttr2Label) {
                    selectedVariant = visibleVariants.find((v) => getVariantAttr2(v, attribute2).label.toLowerCase() === currentAttr2Label.toLowerCase());
                  }
                  if (!selectedVariant) {
                    selectedVariant = visibleVariants[0];
                  }

                  const inCartCount = selectedVariant
                    ? (cart.find((ci) => ci.productId === product.id && (ci.variantId ? ci.variantId === selectedVariant.id : true))?.quantity || 0)
                    : 0;
                  const isVariantUnlimited = Boolean(selectedVariant?.unlimited || product.isUnlimited);
                  const variantStock = selectedVariant ? Number(selectedVariant.stock || 0) : 0;
                  const remainingStock = isVariantUnlimited ? 999999 : Math.max(0, variantStock - inCartCount);
                  const isVariantOutOfStock = !isVariantUnlimited && remainingStock <= 0;

                  // Dynamic Badge matching user's image ("Último!", "2 disp.", etc.)
                  let badgeText = '';
                  let badgeBg = '#fef08a';
                  let badgeTextColor = '#854d0e';
                  let isUrgent = false;

                  if (!isVariantUnlimited) {
                    if (selectedVariant && selectedVariant.stock === 1) {
                      badgeText = 'Último!';
                      badgeBg = '#fef08a';
                      badgeTextColor = '#854d0e';
                      isUrgent = true;
                    } else if (selectedVariant && selectedVariant.stock > 1 && selectedVariant.stock <= 3) {
                      badgeText = `${selectedVariant.stock} disp.`;
                      badgeBg = '#dcfce7';
                      badgeTextColor = '#166534';
                      isUrgent = true;
                    } else if (isVariantOutOfStock) {
                      badgeText = 'No disponible';
                      badgeBg = '#262626';
                      badgeTextColor = '#ffffff';
                    }
                  }
                  if (!badgeText && product.tags && product.tags.includes('Nueva Colección')) {
                    badgeText = 'Nuevo';
                    badgeBg = settings.primaryColor || '#1A1A1A';
                    badgeTextColor = '#ffffff';
                  }

                  const hasPhoto = product.images && product.images.length > 0;
                  const coverPhoto = product.images[product.coverIndex || 0] || product.images[0];

                  return (
                    <article
                      key={product.id}
                      className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-xs border border-[#e5e5e5] flex flex-col justify-between group transition-all hover:shadow-md hover:border-neutral-300"
                    >
                      <div className="flex flex-col flex-1">
                        {/* Area clickeable para abrir modal de fotos grandes y detalles */}
                        <div 
                          onClick={() => openProductModal(product)}
                          className="cursor-pointer group/clickable flex flex-col flex-1"
                          title="Click para ver fotos más grandes, detalles y variantes"
                        >
                          {/* Visual container based on store cardImageSize setting */}
                          {cardImageSize !== 'none' && (
                            <div 
                              className={`relative w-full bg-[#f5f5f5] rounded-lg sm:rounded-xl overflow-hidden mb-2 sm:mb-3 group/photo ${
                                cardImageSize === 'small'
                                  ? 'h-28 sm:h-32 flex items-center justify-center p-2'
                                  : cardImageSize === 'medium'
                                  ? 'aspect-square'
                                  : 'aspect-[3/4]'
                              }`}
                            >
                              {hasPhoto ? (
                                <img
                                  src={coverPhoto}
                                  alt={product.name}
                                  className={`transition-transform duration-500 group-hover/clickable:scale-105 ${
                                    cardImageSize === 'small'
                                      ? 'w-20 h-24 sm:w-24 sm:h-28 object-cover rounded-lg border border-neutral-200 shadow-2xs'
                                      : 'w-full h-full object-cover'
                                  }`}
                                />
                              ) : (
                                /* Fallback Silhouette: Solo el icono genérico sin texto sobre la imagen */
                                <div className="relative w-full h-full flex items-center justify-center p-3 text-center">
                                  <span className="material-symbols-outlined text-[36px] sm:text-[44px] text-neutral-300">
                                    checkroom
                                  </span>
                                </div>
                              )}

                              {/* Stock Scarcity Badge (Top-Left) */}
                              {badgeText && (
                                <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                                  <span 
                                    className={`px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold shadow-xs ${isUrgent ? 'tracking-tight' : ''}`}
                                    style={{ backgroundColor: badgeBg, color: badgeTextColor }}
                                  >
                                    {badgeText}
                                  </span>
                                </div>
                              )}

                              {/* Share Deep Link Button (Top-Right) */}
                              <button
                                type="button"
                                onClick={(e) => handleShareProduct(product, e)}
                                title="Compartir enlace de este producto"
                                className="absolute top-2 right-2 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 hover:bg-white text-neutral-700 hover:text-black shadow-xs flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-xs"
                              >
                                <span className="material-symbols-outlined text-[14px] sm:text-[16px]">share</span>
                              </button>

                              {/* Photo Counter Badge (Bottom-Right) */}
                              {product.images && product.images.length > 1 && (
                                <div className="absolute bottom-2 right-2 z-10 bg-black/60 backdrop-blur-xs text-white text-[10px] sm:text-xs font-medium px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-xs pointer-events-none">
                                  <span className="material-symbols-outlined text-[12px] sm:text-[14px]">photo_camera</span>
                                  <span>{product.images.length}</span>
                                </div>
                              )}

                              {/* Floating Product Tags (Wrapping to full width of image) */}
                              {product.tags && product.tags.length > 0 && (
                                <div className="absolute bottom-2 left-2 right-2 z-10 flex flex-wrap items-center gap-1 pointer-events-none">
                                  {product.tags.map((tag) => {
                                    const tagColor = product.tagColors?.[tag] || '#1f2937';
                                    return (
                                      <span
                                        key={tag}
                                        className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white shadow-xs backdrop-blur-xs max-w-full whitespace-normal break-words"
                                        style={{ backgroundColor: tagColor }}
                                      >
                                        {tag}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Top row when cardImageSize === 'none' */}
                          {cardImageSize === 'none' && (
                            <div className="flex items-center justify-between gap-2 mb-2">
                              {badgeText ? (
                                <span 
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shadow-xs ${isUrgent ? 'tracking-tight' : ''}`}
                                  style={{ backgroundColor: badgeBg, color: badgeTextColor }}
                                >
                                  {badgeText}
                                </span>
                              ) : <span />}
                              <button
                                type="button"
                                onClick={(e) => handleShareProduct(product, e)}
                                title="Compartir enlace de este producto"
                                className="w-7 h-7 rounded-full bg-[#f5f3f3] hover:bg-neutral-200 text-neutral-700 hover:text-black flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[14px]">share</span>
                              </button>
                            </div>
                          )}

                          {/* Tags inline when cardImageSize === 'none' */}
                          {cardImageSize === 'none' && product.tags && product.tags.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 mb-2">
                              {product.tags.map((tag) => {
                                const tagColor = product.tagColors?.[tag] || '#1f2937';
                                return (
                                  <span
                                    key={tag}
                                    className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white shadow-xs max-w-full whitespace-normal break-words"
                                    style={{ backgroundColor: tagColor }}
                                  >
                                    {tag}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Content details */}
                          <div className="flex flex-col flex-1">
                            {/* Product Title */}
                            <h3 
                              className="text-xs sm:text-base font-bold text-black tracking-tight leading-snug line-clamp-1 sm:line-clamp-2 group-hover/clickable:underline"
                            >
                              {product.name}
                            </h3>

                            {/* 1. Valores posibles del Atributo 1 (color o texto) */}
                            {usesAttr1 && prodAttr1Options.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                {prodAttr1Options.map((opt) => {
                                  const isSelected = currentAttr1Label.toLowerCase() === opt.label.toLowerCase();
                                  if (attribute1.type === 'color') {
                                    return (
                                      <button
                                        key={opt.label}
                                        type="button"
                                        title={opt.label}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCardSelectedColor((prev) => ({ ...prev, [product.id]: opt.label }));
                                        }}
                                        style={{ backgroundColor: opt.hex || '#000000' }}
                                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-black/15 transition-all cursor-pointer ${
                                          isSelected
                                            ? 'ring-2 ring-black ring-offset-1 scale-110 shadow-2xs'
                                            : 'hover:scale-110 opacity-80 hover:opacity-100'
                                        }`}
                                      />
                                    );
                                  }
                                  return (
                                    <button
                                      key={opt.label}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCardSelectedColor((prev) => ({ ...prev, [product.id]: opt.label }));
                                      }}
                                      className={`px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-semibold border transition-all ${
                                        isSelected
                                          ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                                          : 'bg-[#f5f5f5] text-neutral-700 border-neutral-200 hover:border-black cursor-pointer'
                                      }`}
                                      title={`Elegir ${opt.label}`}
                                    >
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* 2. Mostrar texto del valor del atributo 1 seleccionado, SOLO en caso de ser de tipo color */}
                            {attribute1.type === 'color' && usesAttr1 && currentAttr1Label && (
                              <p className="text-[11px] sm:text-xs text-neutral-500 font-normal truncate mt-0.5">
                                {currentAttr1Label}
                              </p>
                            )}

                            {/* 3. Valores posibles del Atributo 2 (color o texto) */}
                            {usesAttr2 && prodAttr2Options.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                {prodAttr2Options.map((opt) => {
                                  const isSelected = currentAttr2Label.toLowerCase() === opt.label.toLowerCase();
                                  const matchVar = visibleVariants.find((v) => {
                                    const v2 = getVariantAttr2(v, attribute2).label.toLowerCase();
                                    const v1 = getVariantAttr1(v, attribute1).label.toLowerCase();
                                    return v2 === opt.label.toLowerCase() && (!usesAttr1 || !currentAttr1Label || v1 === currentAttr1Label.toLowerCase());
                                  });
                                  const isOutOfStock = !matchVar?.unlimited && !product.isUnlimited && (!matchVar || matchVar.stock <= 0);

                                  if (attribute2.type === 'color') {
                                    return (
                                      <button
                                        key={opt.label}
                                        type="button"
                                        disabled={isOutOfStock}
                                        title={isOutOfStock ? `${opt.label} sin stock` : opt.label}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCardSelectedSize((prev) => ({ ...prev, [product.id]: opt.label }));
                                        }}
                                        style={{ backgroundColor: opt.hex || '#000000' }}
                                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-black/15 transition-all ${
                                          isOutOfStock
                                            ? 'opacity-30 cursor-not-allowed line-through'
                                            : isSelected
                                            ? 'ring-2 ring-black ring-offset-1 scale-110 shadow-2xs cursor-pointer'
                                            : 'hover:scale-110 opacity-80 hover:opacity-100 cursor-pointer'
                                        }`}
                                      />
                                    );
                                  }

                                  return (
                                    <button
                                      key={opt.label}
                                      type="button"
                                      disabled={isOutOfStock}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCardSelectedSize((prev) => ({ ...prev, [product.id]: opt.label }));
                                      }}
                                      className={`px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-semibold border transition-all ${
                                        isOutOfStock
                                          ? 'bg-neutral-100 text-neutral-300 border-neutral-200 line-through cursor-not-allowed'
                                          : isSelected
                                          ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                                          : 'bg-[#f5f5f5] text-neutral-700 border-neutral-200 hover:border-black cursor-pointer'
                                      }`}
                                      title={isOutOfStock ? `${opt.label} sin stock` : `Elegir ${opt.label}`}
                                    >
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* 4. Mostrar texto del valor del atributo 2 seleccionado, SOLO en caso de ser de tipo color */}
                            {attribute2.type === 'color' && usesAttr2 && currentAttr2Label && (
                              <p className="text-[11px] sm:text-xs text-neutral-500 font-normal truncate mt-0.5">
                                {currentAttr2Label}
                              </p>
                            )}

                            {/* 5. Precio */}
                            {product.discountPrice && product.discountPrice > 0 && product.discountPrice < product.price ? (
                              <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-0.5 mt-2">
                                <span className="text-sm sm:text-base font-extrabold text-emerald-700">
                                  ${product.discountPrice.toLocaleString('es-AR')}
                                </span>
                                <span className="text-[11px] sm:text-xs text-neutral-400 line-through font-medium">
                                  ${product.price.toLocaleString('es-AR')}
                                </span>
                                <span className="text-[9px] sm:text-[10px] font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                                  {Math.round(((product.price - product.discountPrice) / product.price) * 100)}% OFF
                                </span>
                              </div>
                            ) : (
                              <div 
                                className="text-sm sm:text-base font-bold mt-2"
                                style={{ color: settings.primaryColor || '#1A1A1A' }}
                              >
                                ${product.price.toLocaleString('es-AR')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Add to Cart CTA */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(product);
                        }}
                        disabled={isVariantOutOfStock}
                        style={
                          !isVariantOutOfStock
                            ? {
                                backgroundColor: settings.primaryColor || '#1A1A1A',
                                color: '#ffffff'
                              }
                            : undefined
                        }
                        className={`w-full mt-2 sm:mt-3 py-1.5 sm:py-2.5 px-2 sm:px-4 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-2 shadow-xs transition-all active:scale-[0.98] ${
                          isVariantOutOfStock
                            ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                            : 'hover:opacity-90 cursor-pointer'
                        }`}
                      >
                        {isVariantOutOfStock ? (
                          <span className="text-[11px] sm:text-xs">
                            {variantStock <= 0 ? 'No disponible' : 'En tu carrito'}
                          </span>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[15px] sm:text-[18px]">add_shopping_cart</span>
                            <span>Agregar</span>
                          </>
                        )}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Value Proposition Strip Below Catalog */}
            <div className="w-full bg-[#f5f3f3] rounded-xl p-5 border border-[#efeded] flex flex-col md:flex-row items-center justify-between gap-4 mt-2">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-black shadow-xs shrink-0">
                  <span className="material-symbols-outlined text-[24px]">swap_horiz</span>
                </div>
                <div>
                  <span className="block text-sm font-bold text-black">
                    Cambios Simples & Rápidos
                  </span>
                  
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium">
                <span className="material-symbols-outlined text-[16px]">eco</span>
                <span>Embalaje sustentable en papel kraft</span>
              </div>
            </div>
        </div>
      </div>

      {/* Product Detail Modal / Lightbox */}
      {selectedProductModal && (() => {
        const product = selectedProductModal;
        const images = product.images && product.images.length > 0 ? product.images : [];
        const activeImg = images[modalActiveImageIndex] || images[0];

        const visibleVariants = product.variants.filter(isVariantVisible);
        const { usesAttr1, usesAttr2 } = getProductAttributeUsage(product, attribute1, attribute2);

        const attr1Map = new Map<string, { label: string; hex?: string; optionId?: string }>();
        const attr2Map = new Map<string, { label: string; hex?: string; optionId?: string }>();

        visibleVariants.forEach((v) => {
          if (usesAttr1) {
            const o1 = getVariantAttr1(v, attribute1);
            if (o1.label && !attr1Map.has(o1.label.toLowerCase())) {
              attr1Map.set(o1.label.toLowerCase(), o1);
            }
          }
          if (usesAttr2) {
            const o2 = getVariantAttr2(v, attribute2);
            if (o2.label && !attr2Map.has(o2.label.toLowerCase())) {
              attr2Map.set(o2.label.toLowerCase(), o2);
            }
          }
        });

        const availableAttr1Options = Array.from(attr1Map.values());
        const availableAttr2Options = Array.from(attr2Map.values());

        let activeVariant = visibleVariants.find((v) => {
          const v1 = getVariantAttr1(v, attribute1).label.toLowerCase();
          const v2 = getVariantAttr2(v, attribute2).label.toLowerCase();
          const m1 = !usesAttr1 || !modalSelectedColor || v1 === modalSelectedColor.toLowerCase();
          const m2 = !usesAttr2 || !modalSelectedSize || v2 === modalSelectedSize.toLowerCase();
          return m1 && m2;
        });

        if (!activeVariant && usesAttr1 && modalSelectedColor) {
          activeVariant = visibleVariants.find((v) => getVariantAttr1(v, attribute1).label.toLowerCase() === modalSelectedColor.toLowerCase());
        }
        if (!activeVariant && usesAttr2 && modalSelectedSize) {
          activeVariant = visibleVariants.find((v) => getVariantAttr2(v, attribute2).label.toLowerCase() === modalSelectedSize.toLowerCase());
        }
        if (!activeVariant) {
          activeVariant = visibleVariants[0];
        }

        const inCartModal = activeVariant
          ? (cart.find((ci) => ci.productId === product.id && (ci.variantId ? ci.variantId === activeVariant.id : true))?.quantity || 0)
          : 0;

        const isModalVariantUnlimited = Boolean(activeVariant?.unlimited || product.isUnlimited);
        const rawVariantStock = activeVariant ? Number(activeVariant.stock || 0) : 0;
        const maxStock = isModalVariantUnlimited ? 99 : Math.max(0, rawVariantStock - inCartModal);
        const isOutOfStock = !isModalVariantUnlimited && maxStock <= 0;

        return (
          <div 
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeProductModal();
            }}
          >
            <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col md:flex-row my-auto max-h-[92vh]">
              {/* Share Button (Header) */}
              <button
                type="button"
                onClick={(e) => handleShareProduct(product, e)}
                className="absolute top-4 right-15 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-neutral-600 hover:text-black shadow-md flex items-center justify-center transition-colors cursor-pointer"
                title="Compartir este producto"
              >
                <span className="material-symbols-outlined text-[18px]">share</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={closeProductModal}
                className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-neutral-600 hover:text-black shadow-md flex items-center justify-center transition-colors cursor-pointer"
                title="Cerrar ventana"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>

              {/* Left Column: Photo Gallery */}
              <div className="w-full md:w-1/2 bg-[#f5f3f3] p-4 sm:p-6 flex flex-col justify-between overflow-hidden">
                {/* Main Large Image Container */}
                <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-white shadow-xs group/img">
                  {activeImg ? (
                    <img
                      src={activeImg}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400">
                      <span className="material-symbols-outlined text-[48px]">checkroom</span>
                      <span className="text-xs font-medium mt-1">Sin fotografía disponible</span>
                    </div>
                  )}

                  {/* Previous / Next Arrow Controls */}
                  {images.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalActiveImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
                        }}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-black shadow-md flex items-center justify-center transition-all cursor-pointer opacity-80 hover:opacity-100"
                        title="Foto anterior"
                      >
                        <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalActiveImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-black shadow-md flex items-center justify-center transition-all cursor-pointer opacity-80 hover:opacity-100"
                        title="Siguiente foto"
                      >
                        <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                      </button>
                    </>
                  )}

                  {/* Image Counter */}
                  {images.length > 1 && (
                    <div className="absolute bottom-2.5 right-2.5 bg-black/70 text-white text-[10px] font-mono px-2 py-0.5 rounded-full shadow-xs">
                      {modalActiveImageIndex + 1} / {images.length}
                    </div>
                  )}
                </div>

                {/* Thumbnails Carousel */}
                {images.length > 1 && (
                  <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
                    {images.map((imgUrl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setModalActiveImageIndex(idx)}
                        className={`relative w-14 h-18 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                          modalActiveImageIndex === idx
                            ? 'border-black ring-1 ring-black shadow-xs scale-105'
                            : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={imgUrl} alt={`Miniatura ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Product Details & Purchase Form */}
              <div className="w-full md:w-1/2 p-5 sm:p-7 flex flex-col justify-between overflow-y-auto max-h-[500px] md:max-h-none">
                <div className="space-y-4">
                  {/* Category & Urgency Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#f5f3f3] text-black text-xs font-semibold border border-neutral-200">
                      {product.category}
                    </span>
                    {activeVariant && !isModalVariantUnlimited && rawVariantStock > 0 && maxStock <= 3 && maxStock > 0 && (
                      <span 
                        className="px-2.5 py-0.5 rounded-full text-white text-xs font-bold shadow-xs"
                        style={{ backgroundColor: settings.secondaryColor || '#de5845' }}
                      >
                        ¡Últimas {maxStock} unidades disponibles!
                      </span>
                    )}
                    {isModalVariantUnlimited && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                        Stock Ilimitado
                      </span>
                    )}
                    {inCartModal > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-neutral-200 text-neutral-800 text-xs font-semibold">
                        {inCartModal} en tu carrito
                      </span>
                    )}
                    {isOutOfStock && !isModalVariantUnlimited && (
                      <span className="px-2.5 py-0.5 rounded-full bg-neutral-800 text-white text-xs font-bold">
                        {rawVariantStock <= 0
                          ? 'No disponible'
                          : 'Todo el stock disponible en tu carrito'}
                      </span>
                    )}
                  </div>

                  {/* Title & Price */}
                  <div>
                    <h2 className="font-headline-lg text-2xl font-bold text-black tracking-tight leading-tight">
                      {product.name}
                    </h2>
                    {product.discountPrice && product.discountPrice > 0 && product.discountPrice < product.price ? (
                      <div className="flex items-baseline flex-wrap gap-x-2.5 gap-y-1 mt-1.5">
                        <span className="text-2xl font-extrabold text-emerald-700">
                          ${product.discountPrice.toLocaleString('es-AR')}
                        </span>
                        <span className="text-base text-neutral-400 line-through font-medium">
                          ${product.price.toLocaleString('es-AR')}
                        </span>
                        <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                          {Math.round(((product.price - product.discountPrice) / product.price) * 100)}% OFF
                        </span>
                      </div>
                    ) : (
                      <div 
                        className="text-2xl font-bold mt-1"
                        style={{ color: settings.primaryColor || '#1A1A1A' }}
                      >
                        ${product.price.toLocaleString('es-AR')}
                      </div>
                    )}
                  </div>

                  {/* Description respecting newlines and literal <br> tags */}
                  <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed whitespace-pre-line">
                    {(product.description || '').replace(/<\s*br\s*\/?>/gi, '\n')}
                  </p>

                  {/* Tags */}
                  {product.tags && product.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {product.tags.map((tag) => {
                        const tagColor = product.tagColors?.[tag] || '#475569';
                        return (
                          <span
                            key={tag}
                            className="text-xs text-white font-semibold px-2.5 py-0.5 rounded-md shadow-2xs"
                            style={{ backgroundColor: tagColor }}
                          >
                            {tag}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Attr 1 Selector - visible even if single option (many-to-one) */}
                  {usesAttr1 && availableAttr1Options.length > 0 && (
                    <div className="pt-2 border-t border-neutral-100">
                      <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
                        <span>
                          {attribute1.name || 'Atributo 1'}: <strong className="text-black font-semibold">{modalSelectedColor}</strong>
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          {availableAttr1Options.length} disponible{availableAttr1Options.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {availableAttr1Options.map((opt) => {
                          const isSelected = modalSelectedColor.toLowerCase() === opt.label.toLowerCase();
                          const matchVar = visibleVariants.find((v) => {
                            const v1 = getVariantAttr1(v, attribute1).label.toLowerCase();
                            const v2 = getVariantAttr2(v, attribute2).label.toLowerCase();
                            return v1 === opt.label.toLowerCase() && (!usesAttr2 || !modalSelectedSize || v2 === modalSelectedSize.toLowerCase());
                          });
                          const isNoStock = !matchVar?.unlimited && !product.isUnlimited && (!matchVar || matchVar.stock <= 0);

                          if (attribute1.type === 'color') {
                            return (
                              <button
                                key={opt.label}
                                type="button"
                                disabled={isNoStock}
                                title={isNoStock ? `${opt.label} sin stock` : opt.label}
                                onClick={() => {
                                  setModalSelectedColor(opt.label);
                                }}
                                style={{ backgroundColor: opt.hex || '#000000' }}
                                className={`w-7 h-7 rounded-full border border-black/20 transition-all ${
                                  isNoStock
                                    ? 'opacity-30 cursor-not-allowed line-through'
                                    : isSelected
                                    ? 'ring-2 ring-black ring-offset-2 scale-110 shadow-xs cursor-pointer'
                                    : 'hover:scale-105 cursor-pointer'
                                }`}
                              />
                            );
                          }
                          return (
                            <button
                              key={opt.label}
                              type="button"
                              disabled={isNoStock}
                              onClick={() => {
                                setModalSelectedColor(opt.label);
                              }}
                              style={isSelected ? { backgroundColor: settings.primaryColor || '#1A1A1A' } : undefined}
                              className={`py-1.5 px-3.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                isNoStock
                                  ? 'bg-neutral-100 text-neutral-400 line-through cursor-not-allowed border border-neutral-200'
                                  : isSelected
                                  ? 'text-white shadow-xs'
                                  : 'bg-[#f5f3f3] text-black hover:bg-[#efeded] border border-transparent'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Attr 2 Selector - visible even if single option (many-to-one) */}
                  {usesAttr2 && availableAttr2Options.length > 0 && (
                    <div className="pt-2 border-t border-neutral-100">
                      <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
                        <span>
                          {attribute2.name || 'Atributo 2'}: {attribute2.type === 'color' ? (
                            <strong className="text-black font-semibold">{modalSelectedSize}</strong>
                          ) : (
                            <strong className="text-black font-semibold">{modalSelectedSize}</strong>
                          )}
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          {activeVariant ? (isModalVariantUnlimited ? 'Stock: Ilimitado' : `Stock: ${activeVariant.stock} u.`) : 'Sin stock'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {availableAttr2Options.map((opt) => {
                          const isSelected = modalSelectedSize.toLowerCase() === opt.label.toLowerCase();
                          const matchVar = visibleVariants.find((v) => {
                            const v2 = getVariantAttr2(v, attribute2).label.toLowerCase();
                            const v1 = getVariantAttr1(v, attribute1).label.toLowerCase();
                            return v2 === opt.label.toLowerCase() && (!usesAttr1 || !modalSelectedColor || v1 === modalSelectedColor.toLowerCase());
                          });
                          const isNoStock = !matchVar?.unlimited && !product.isUnlimited && (!matchVar || matchVar.stock <= 0);

                          if (attribute2.type === 'color') {
                            return (
                              <button
                                key={opt.label}
                                type="button"
                                disabled={isNoStock}
                                title={isNoStock ? `${opt.label} sin stock` : opt.label}
                                onClick={() => {
                                  setModalSelectedSize(opt.label);
                                  setModalQuantity(1);
                                }}
                                style={{ backgroundColor: opt.hex || '#000000' }}
                                className={`w-7 h-7 rounded-full border border-black/20 transition-all ${
                                  isNoStock
                                    ? 'opacity-30 cursor-not-allowed line-through'
                                    : isSelected
                                    ? 'ring-2 ring-black ring-offset-2 scale-110 shadow-xs cursor-pointer'
                                    : 'hover:scale-105 cursor-pointer'
                                }`}
                              />
                            );
                          }

                          return (
                            <button
                              key={opt.label}
                              type="button"
                              disabled={isNoStock}
                              onClick={() => {
                                setModalSelectedSize(opt.label);
                                setModalQuantity(1);
                              }}
                              style={isSelected ? { backgroundColor: settings.primaryColor || '#1A1A1A' } : undefined}
                              className={`py-1.5 px-3.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                isNoStock
                                  ? 'bg-neutral-100 text-neutral-400 line-through cursor-not-allowed border border-neutral-200'
                                  : isSelected
                                  ? 'text-white shadow-xs'
                                  : 'bg-[#f5f3f3] text-black hover:bg-[#efeded] border border-transparent'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Quantity Stepper */}
                  {!isOutOfStock && (
                    <div className="pt-1 flex items-center gap-3">
                      <span className="text-xs text-neutral-500 font-semibold">Cantidad:</span>
                      <div className="flex items-center bg-[#f5f3f3] rounded-lg border border-neutral-200 p-0.5">
                        <button
                          type="button"
                          onClick={() => setModalQuantity((q) => Math.max(1, q - 1))}
                          disabled={modalQuantity <= 1}
                          className="w-7 h-7 flex items-center justify-center text-black font-bold hover:bg-white rounded transition-colors disabled:opacity-30"
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-xs font-bold text-black">{modalQuantity}</span>
                        <button
                          type="button"
                          onClick={() => setModalQuantity((q) => Math.min(maxStock, q + 1))}
                          disabled={modalQuantity >= maxStock}
                          className="w-7 h-7 flex items-center justify-center text-black font-bold hover:bg-white rounded transition-colors disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-[11px] text-neutral-400 font-medium">
                        (Máx {isModalVariantUnlimited ? 'ilimitado' : `${maxStock} u.`})
                      </span>
                    </div>
                  )}
                </div>

                {/* Purchase CTAs */}
                <div className="space-y-2 pt-5 border-t border-neutral-100 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      handleModalAddToCart();
                      closeProductModal();
                    }}
                    disabled={isOutOfStock}
                    style={
                      !isOutOfStock
                        ? {
                            backgroundColor: settings.primaryColor || '#1A1A1A',
                            color: '#ffffff'
                          }
                        : undefined
                    }
                    className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.99] ${
                      isOutOfStock
                        ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                        : 'hover:opacity-90 cursor-pointer'
                    }`}
                  >
                    {isOutOfStock ? (
                      <>
                        <span className="material-symbols-outlined text-[18px]">block</span>
                        <span>
                          {rawVariantStock <= 0
                            ? 'No disponible'
                            : 'Todo el stock disponible ya en tu carrito'}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-0.5">
                          <span className="font-bold text-sm leading-none">+</span>
                          <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
                        </div>
                        <span>Agregar al Carrito ({modalQuantity} u. · ${(product.price * modalQuantity).toLocaleString('es-AR')})</span>
                      </>
                    )}
                  </button>

                  {/* WhatsApp Direct Order Button if enabled */}
                  {settings.whatsappEnabled && !isOutOfStock && (
                    <button
                      type="button"
                      onClick={() => {
                        const message = encodeURIComponent(
                          `Hola! Quisiera consultar/pedir la prenda *${product.name}* (Talle: ${modalSelectedSize}, Color: ${modalSelectedColor}, Cantidad: ${modalQuantity}) por un total de $${(product.price * modalQuantity).toLocaleString('es-AR')}.`
                        );
                        window.open(`https://wa.me/${settings.whatsappNumber}?text=${message}`, '_blank');
                      }}
                      className="w-full py-2 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.062-2.127-.53-1.833-.757-3.013-2.616-3.104-2.738-.093-.122-.738-.982-.738-1.873 0-.89.467-1.328.633-1.507.167-.179.366-.224.488-.224.122 0 .245.002.352.007.113.005.263-.043.412.316.155.374.529 1.29.576 1.385.047.094.078.204.016.327-.063.123-.094.199-.187.309-.094.109-.198.244-.282.327-.094.094-.192.196-.083.383.11.188.487.804 1.045 1.301.718.64 1.324.839 1.512.933.188.093.298.078.408-.047.11-.125.469-.546.594-.734.125-.187.25-.156.422-.093.172.062 1.09.514 1.277.608.188.094.313.141.359.219.047.078.047.453-.097.858z" />
                      </svg>
                      <span>Pedir directamente por WhatsApp</span>
                    </button>
                  )}

                  {/* Share Deep Link Options */}
                  <div className="pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleShareProduct(product, e)}
                        className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isLinkCopied
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700 hover:border-neutral-300'
                        }`}
                        title="Copiar enlace directo de este producto"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {isLinkCopied ? 'check' : 'link'}
                        </span>
                        <span>{isLinkCopied ? '¡Enlace copiado!' : 'Copiar enlace directo'}</span>
                      </button>

                      <a
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                          `¡Mirá esta prenda en ${settings.storeName || 'Atelier'}!\n*${product.name}* - $${product.price.toLocaleString('es-AR')}\n${getProductShareUrl(product.id)}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3.5 rounded-xl border border-[#25D366]/30 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Compartir enlace por WhatsApp"
                      >
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.062-2.127-.53-1.833-.757-3.013-2.616-3.104-2.738-.093-.122-.738-.982-.738-1.873 0-.89.467-1.328.633-1.507.167-.179.366-.224.488-.224.122 0 .245.002.352.007.113.005.263-.043.412.316.155.374.529 1.29.576 1.385.047.094.078.204.016.327-.063.123-.094.199-.187.309-.094.109-.198.244-.282.327-.094.094-.192.196-.083.383.11.188.487.804 1.045 1.301.718.64 1.324.839 1.512.933.188.093.298.078.408-.047.11-.125.469-.546.594-.734.125-.187.25-.156.422-.093.172.062 1.09.514 1.277.608.188.094.313.141.359.219.047.078.047.453-.097.858z" />
                        </svg>
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
