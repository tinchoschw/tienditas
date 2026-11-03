import React, { useState, useMemo, useRef } from 'react';
import { Product, ProductVariant, StoreSettings, Supplier } from '../types';
import { useModalHistory } from '../hooks/useModalHistory';
import { ensureStoreAttributes, getOptionLabel } from '../utils/attributeUtils';
import { createSupplier } from '../services/db';

interface CatalogImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  settings: StoreSettings;
  suppliers: Supplier[];
  onSaveProduct: (product: Product) => Promise<any>;
  onUpdateSettings?: (settings: Partial<StoreSettings>) => Promise<any>;
  storeSlug?: string;
  onSuccess?: (stats: { created: number; updated: number; variants: number }) => void;
}

interface ParsedVariantRow {
  rowNum: number;
  idSistema: string;
  customSku: string;
  name: string;
  description: string;
  category: string;
  attr1Val: string;
  attr2Val: string;
  stock: number;
  isUnlimited: boolean;
  cost: number;
  price: number;
  discountPrice?: number;
  supplierName: string;
  variantSku: string;
  images: string[];
}

interface GroupedProductPlan {
  productKey: string;
  matchType: 'id' | 'sku' | 'name_category' | 'new';
  existingProduct?: Product;
  targetName: string;
  targetCategory: string;
  targetDescription: string;
  targetCustomSku: string;
  targetSupplierName: string;
  targetPrice: number;
  targetCost: number;
  targetDiscountPrice?: number;
  targetImages: string[];
  variantRows: ParsedVariantRow[];
}

/**
 * Standard CSV line parser that properly handles quotes, commas, semicolons, and escaped quotes.
 */
function parseCsvToMatrix(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, '').trim(); // Remove UTF-8 BOM
  if (!cleanText) return [];

  // Detect delimiter: check first line for semicolons vs commas
  const firstLine = cleanText.split('\n')[0] || '';
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \r\n
      }
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export const CatalogImportModal: React.FC<CatalogImportModalProps> = ({
  isOpen,
  onClose,
  products,
  settings,
  suppliers,
  onSaveProduct,
  onUpdateSettings,
  storeSlug = '',
  onSuccess
}) => {
  useModalHistory({
    isOpen,
    onClose,
    modalKey: 'catalog-import-modal'
  });

  const { attribute1, attribute2 } = useMemo(() => ensureStoreAttributes(settings), [settings]);

  const [step, setStep] = useState<'upload' | 'preview' | 'processing' | 'success' | 'error'>('upload');
  const [stockMode, setStockMode] = useState<'replace' | 'add'>('replace');
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [groupedPlans, setGroupedPlans] = useState<GroupedProductPlan[]>([]);
  const [totalVariantCount, setTotalVariantCount] = useState<number>(0);
  const [newSuppliersDetected, setNewSuppliersDetected] = useState<string[]>([]);

  // Execution states
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [importSessionId, setImportSessionId] = useState<string>('');
  const [finalStats, setFinalStats] = useState<{ created: number; updated: number; variants: number }>({
    created: 0,
    updated: 0,
    variants: 0
  });
  const [fatalErrorMessage, setFatalErrorMessage] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Generate and download a sample CSV matching the store's configured attributes and categories
  const handleDownloadSampleCsv = () => {
    const attr1Header = 'Atributo_1';
    const attr2Header = 'Atributo_2';

    const sampleCat = settings.categories.find((c) => c !== 'Todas') || 'General';
    const sampleOpt1A = attribute1.options[0]?.label || 'Negro';
    const sampleOpt1B = attribute1.options[1]?.label || 'Blanco';
    const sampleOpt2A = attribute2.options[0]?.label || 'M';
    const sampleOpt2B = attribute2.options[1]?.label || 'L';

    const header = [
      'ID_Sistema',
      'Codigo_Producto',
      'Nombre',
      'Descripcion',
      'Categoria',
      attr1Header,
      attr2Header,
      'Stock',
      'Costo',
      'Precio',
      'Precio_Promo',
      'Proveedor',
      'SKU_Variante',
      'Fotos'
    ].join(',');

    const row1 = [
      '""',
      '"REM-001"',
      '"Remera Lisa Algodon"',
      '"Remera clásica peinada"',
      `"${sampleCat}"`,
      `"${sampleOpt1A}"`,
      `"${sampleOpt2A}"`,
      '20',
      '4500',
      '9900',
      '8900',
      '"Textil Central"',
      '"REM-001-NEG-M"',
      '"https://ejemplo.com/foto1.jpg"'
    ].join(',');

    const row2 = [
      '""',
      '"REM-001"',
      '"Remera Lisa Algodon"',
      '"Remera clásica peinada"',
      `"${sampleCat}"`,
      `"${sampleOpt1B}"`,
      `"${sampleOpt2B}"`,
      '15',
      '4500',
      '9900',
      '8900',
      '"Textil Central"',
      '"REM-001-BLA-L"',
      '""'
    ].join(',');

    const sampleContent = `${header}\n${row1}\n${row2}\n`;
    const blob = new Blob([sampleContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla-importacion-${settings.storeName || 'tienda'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Process chosen CSV file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileSize(`${(file.size / 1024).toFixed(1)} KB`);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseAndValidateCsv(text);
    };
    reader.onerror = () => {
      setParseErrors(['No se pudo leer el archivo seleccionado. Por favor intentá nuevamente.']);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const parseAndValidateCsv = (csvText: string) => {
    const matrix = parseCsvToMatrix(csvText);
    if (matrix.length < 2) {
      setParseErrors([
        'El archivo CSV está vacío o solo contiene la cabecera. Debe incluir al menos una fila de productos.'
      ]);
      setGroupedPlans([]);
      setStep('preview');
      return;
    }

    const rawHeaders = matrix[0].map((h) =>
      h.toLowerCase().replace(/[^a-z0-9_]/g, '')
    );

    // Map column positions
    const findCol = (candidates: string[]) =>
      rawHeaders.findIndex((h) => candidates.some((c) => h.includes(c)));

    const colId = findCol(['idsistema', 'id_sistema', 'id']);
    const colCustomSku = findCol(['codigoproducto', 'codigo_producto', 'codigoproducto', 'articulo', 'art']);
    const colName = findCol(['nombre', 'titulo', 'prenda', 'modelo']);
    const colDesc = findCol(['descripcion', 'detalle']);
    const colCat = findCol(['categoria', 'rubro']);
    const colAttr1 = findCol(['atributo1', 'atributo_1', 'color', 'attr1']);
    const colAttr2 = findCol(['atributo2', 'atributo_2', 'talle', 'tamano', 'attr2', 'medida']);
    const colStock = findCol(['stock', 'cantidad', 'existencia', 'stocktotal']);
    const colCost = findCol(['costo', 'preciocosto']);
    const colPrice = findCol(['precio', 'precioventa', 'pvp']);
    const colDiscount = findCol(['preciopromo', 'precio_promo', 'oferta', 'descuento']);
    const colSupplier = findCol(['proveedor', 'distribuidor', 'fabricante']);
    const colVariantSku = findCol(['skuvariante', 'sku_variante', 'sku']);
    const colImages = findCol(['fotos', 'imagenes', 'imagen', 'fotosurls', 'images']);

    if (colName === -1) {
      setParseErrors([
        'No se encontró la columna requerida "Nombre" o "Titulo" en la cabecera del archivo CSV.'
      ]);
      setGroupedPlans([]);
      setStep('preview');
      return;
    }

    const errors: string[] = [];
    const parsedRows: ParsedVariantRow[] = [];

    for (let i = 1; i < matrix.length; i++) {
      const row = matrix[i];
      const rowNum = i + 1;

      // Skip completely empty lines
      if (row.every((f) => !f.trim())) continue;

      const name = (colName !== -1 ? row[colName] : '')?.trim() || '';
      if (!name) {
        errors.push(`Fila ${rowNum}: El nombre de la prenda es obligatorio.`);
        continue;
      }

      // Price validation
      const rawPrice = (colPrice !== -1 ? row[colPrice] : '')?.trim() || '0';
      const cleanPrice = rawPrice.replace('$', '').replace(/\./g, '').replace(',', '.');
      const priceNum = parseFloat(cleanPrice);
      if (isNaN(priceNum) || priceNum < 0) {
        errors.push(`Fila ${rowNum} ("${name}"): El precio de venta "${rawPrice}" no es un número válido.`);
      }

      // Cost validation
      const rawCost = (colCost !== -1 ? row[colCost] : '')?.trim() || '0';
      const cleanCost = rawCost ? rawCost.replace('$', '').replace(/\./g, '').replace(',', '.') : '0';
      const costNum = cleanCost ? parseFloat(cleanCost) : 0;
      if (isNaN(costNum) || costNum < 0) {
        errors.push(`Fila ${rowNum} ("${name}"): El costo "${rawCost}" no es un número válido.`);
      }

      // Discount price
      let discountPriceNum: number | undefined = undefined;
      const rawDiscount = (colDiscount !== -1 ? row[colDiscount] : '')?.trim();
      if (rawDiscount) {
        const cleanDiscount = rawDiscount.replace('$', '').replace(/\./g, '').replace(',', '.');
        const parsedDiscount = parseFloat(cleanDiscount);
        if (!isNaN(parsedDiscount) && parsedDiscount > 0) {
          discountPriceNum = parsedDiscount;
        }
      }

      // Stock validation
      const rawStock = (colStock !== -1 ? row[colStock] : '')?.trim() || '0';
      const isUnlimited = rawStock.toUpperCase() === 'ILIMITADO' || rawStock === '∞';
      let stockNum = 0;
      if (!isUnlimited) {
        stockNum = parseInt(rawStock.replace(/[^0-9-]/g, ''), 10);
        if (isNaN(stockNum) || stockNum < 0) {
          errors.push(
            `Fila ${rowNum} ("${name}"): El stock "${rawStock}" debe ser un número entero mayor o igual a 0 o la palabra "ILIMITADO".`
          );
        }
      }

      const idSistema = (colId !== -1 ? row[colId] : '')?.trim() || '';
      const customSku = (colCustomSku !== -1 ? row[colCustomSku] : '')?.trim() || '';
      const description = (colDesc !== -1 ? row[colDesc] : '')?.trim() || '';
      const category = (colCat !== -1 ? row[colCat] : '')?.trim() || 'General';
      const attr1Val = (colAttr1 !== -1 ? row[colAttr1] : '')?.trim() || '';
      const attr2Val = (colAttr2 !== -1 ? row[colAttr2] : '')?.trim() || '';
      const supplierName = (colSupplier !== -1 ? row[colSupplier] : '')?.trim() || '';
      const variantSku = (colVariantSku !== -1 ? row[colVariantSku] : '')?.trim() || '';

      // Photos separation by semicolon or comma if urls
      const rawPhotos = (colImages !== -1 ? row[colImages] : '')?.trim() || '';
      const images = rawPhotos
        ? rawPhotos
            .split(/[;|\n]/)
            .map((u) => u.trim())
            .filter((u) => u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:image'))
        : [];

      parsedRows.push({
        rowNum,
        idSistema,
        customSku,
        name,
        description,
        category,
        attr1Val,
        attr2Val,
        stock: isUnlimited ? 999999 : stockNum,
        isUnlimited,
        cost: costNum,
        price: priceNum,
        discountPrice: discountPriceNum,
        supplierName,
        variantSku,
        images
      });
    }

    // Now group parsedRows by resolved target product
    // Matching hierarchy:
    // 1. By idSistema if matches existing product.id
    // 2. By customSku if matches existing product.customSku
    // 3. By exact name + category (case-insensitive)
    // 4. Otherwise -> new product
    const groupsMap = new Map<string, GroupedProductPlan>();
    const knownSuppliers = new Set(suppliers.map((s) => s.name.trim().toLowerCase()));
    const newSuppliersFound = new Set<string>();

    parsedRows.forEach((row) => {
      if (row.supplierName && !knownSuppliers.has(row.supplierName.trim().toLowerCase())) {
        newSuppliersFound.add(row.supplierName.trim());
      }

      // Check match in existing products
      let matchedProd: Product | undefined;
      let matchType: 'id' | 'sku' | 'name_category' | 'new' = 'new';

      if (row.idSistema) {
        matchedProd = products.find((p) => p.id === row.idSistema);
        if (matchedProd) matchType = 'id';
      }

      if (!matchedProd && row.customSku) {
        matchedProd = products.find(
          (p) => p.customSku && p.customSku.toLowerCase() === row.customSku.toLowerCase()
        );
        if (matchedProd) matchType = 'sku';
      }

      if (!matchedProd) {
        matchedProd = products.find(
          (p) =>
            p.name.trim().toLowerCase() === row.name.trim().toLowerCase() &&
            p.category.trim().toLowerCase() === row.category.trim().toLowerCase()
        );
        if (matchedProd) matchType = 'name_category';
      }

      // Product grouping key
      const key = matchedProd
        ? `existing:${matchedProd.id}`
        : row.customSku
        ? `sku:${row.customSku.toLowerCase()}`
        : `name:${row.name.trim().toLowerCase()}__cat:${row.category.trim().toLowerCase()}`;

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          productKey: key,
          matchType,
          existingProduct: matchedProd,
          targetName: row.name,
          targetCategory: row.category,
          targetDescription: row.description || matchedProd?.description || '',
          targetCustomSku: row.customSku || matchedProd?.customSku || '',
          targetSupplierName: row.supplierName || matchedProd?.supplierName || '',
          targetPrice: row.price,
          targetCost: row.cost || matchedProd?.cost || 0,
          targetDiscountPrice: row.discountPrice ?? matchedProd?.discountPrice,
          targetImages: row.images.length > 0 ? row.images : matchedProd?.images || [],
          variantRows: []
        });
      }

      const plan = groupsMap.get(key)!;
      plan.variantRows.push(row);
      // If row has images and plan doesn't, add them
      if (row.images.length > 0 && plan.targetImages.length === 0) {
        plan.targetImages = row.images;
      }
    });

    setParseErrors(errors);
    setGroupedPlans(Array.from(groupsMap.values()));
    setTotalVariantCount(parsedRows.length);
    setNewSuppliersDetected(Array.from(newSuppliersFound));
    setStep('preview');
  };

  const newProductsCount = groupedPlans.filter((p) => !p.existingProduct).length;
  const updatedProductsCount = groupedPlans.filter((p) => Boolean(p.existingProduct)).length;

  // Execute the import in chunked batches
  const handleExecuteImport = async () => {
    if (parseErrors.length > 0 || groupedPlans.length === 0) return;

    setStep('processing');
    setProgressPercent(5);
    setProgressMessage('Iniciando sesión de importación y registrando proveedores...');

    const sessionId = `IMP_${(storeSlug || 'store').toUpperCase()}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;
    setImportSessionId(sessionId);

    console.log(
      `[IMPORT_CATALOG][${sessionId}] Iniciando importación: ${groupedPlans.length} productos agrupados, ${totalVariantCount} variantes. Modo stock=${stockMode}.`
    );

    try {
      // 1. Auto-register new suppliers
      const supplierMap = new Map<string, Supplier>();
      suppliers.forEach((s) => supplierMap.set(s.name.trim().toLowerCase(), s));

      for (const supName of newSuppliersDetected) {
        try {
          const created = await createSupplier(storeSlug, { name: supName });
          supplierMap.set(created.name.trim().toLowerCase(), created);
          console.log(`[IMPORT_CATALOG][${sessionId}] Nuevo proveedor registrado automáticamente: "${supName}" (ID: ${created.id})`);
        } catch (supErr) {
          console.warn(`[IMPORT_CATALOG][${sessionId}] No se pudo registrar proveedor "${supName}":`, supErr);
        }
      }

      // 2. Track new categories to update settings if needed
      const currentCategories = new Set(settings.categories);
      const categoriesToAdd = new Set<string>();

      // 3. Process products in batches of 20 to keep UI alive and respect Firestore batch limits
      const BATCH_SIZE = 25;
      const totalBatches = Math.ceil(groupedPlans.length / BATCH_SIZE);
      let createdCounter = 0;
      let updatedCounter = 0;
      let processedVariants = 0;

      for (let b = 0; b < totalBatches; b++) {
        const batchPlans = groupedPlans.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        const batchProgress = Math.round(((b + 1) / totalBatches) * 90);
        setProgressPercent(Math.min(90, Math.max(10, batchProgress)));
        setProgressMessage(
          `Guardando productos (Lote ${b + 1} de ${totalBatches}) - ${createdCounter + updatedCounter} de ${groupedPlans.length} procesados...`
        );

        for (const plan of batchPlans) {
          if (plan.targetCategory && !currentCategories.has(plan.targetCategory)) {
            categoriesToAdd.add(plan.targetCategory);
          }

          const matchedSupplier = plan.targetSupplierName
            ? supplierMap.get(plan.targetSupplierName.trim().toLowerCase())
            : undefined;

          if (plan.existingProduct) {
            // ================= UPDATE EXISTING PRODUCT =================
            const existing = plan.existingProduct;
            const updatedVariants: ProductVariant[] = [...existing.variants];

            plan.variantRows.forEach((vRow) => {
              processedVariants++;
              // Try to find variant in existing product
              const matchedVarIndex = updatedVariants.findIndex((ev) => {
                if (vRow.variantSku && ev.sku && ev.sku.toLowerCase() === vRow.variantSku.toLowerCase()) {
                  return true;
                }
                const match1 = (ev.color || '').trim().toLowerCase() === vRow.attr1Val.trim().toLowerCase();
                const match2 = (ev.size || '').trim().toLowerCase() === vRow.attr2Val.trim().toLowerCase();
                return match1 && match2;
              });

              if (matchedVarIndex !== -1) {
                // Update variant
                const ev = updatedVariants[matchedVarIndex];
                const newStock =
                  vRow.isUnlimited
                    ? 999999
                    : stockMode === 'add'
                    ? Math.max(0, (ev.stock || 0) + vRow.stock)
                    : Math.max(0, vRow.stock);

                updatedVariants[matchedVarIndex] = {
                  ...ev,
                  stock: newStock,
                  unlimited: vRow.isUnlimited || ev.unlimited,
                  sku: vRow.variantSku || ev.sku
                };
              } else {
                // Variant does not exist in product -> add it
                const prefix = (existing.name || 'PR').trim().slice(0, 3).toUpperCase();
                const newVarSku =
                  vRow.variantSku ||
                  `${prefix}-${vRow.attr1Val.slice(0, 3).toUpperCase()}-${vRow.attr2Val.slice(0, 3).toUpperCase()}`;

                updatedVariants.push({
                  id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                  color: vRow.attr1Val,
                  size: vRow.attr2Val,
                  sku: newVarSku,
                  stock: vRow.stock,
                  enabled: true,
                  unlimited: vRow.isUnlimited
                });
              }
            });

            // Recalculate totalStock
            const newTotalStock = updatedVariants.reduce(
              (acc, v) => acc + (v.enabled !== false && !v.unlimited ? Number(v.stock || 0) : 0),
              0
            );

            // Images: preserve existing if CSV had none
            const finalImages = plan.targetImages.length > 0 ? plan.targetImages : existing.images;

            const productToSave: Product = {
              ...existing,
              name: plan.targetName || existing.name,
              category: plan.targetCategory || existing.category,
              description: plan.targetDescription || existing.description,
              customSku: plan.targetCustomSku || existing.customSku,
              price: plan.targetPrice > 0 ? plan.targetPrice : existing.price,
              cost: plan.targetCost > 0 ? plan.targetCost : existing.cost,
              discountPrice: plan.targetDiscountPrice ?? existing.discountPrice,
              supplierId: matchedSupplier?.id || existing.supplierId,
              supplierName: plan.targetSupplierName || existing.supplierName,
              images: finalImages,
              variants: updatedVariants,
              totalStock: newTotalStock,
              isUnlimited: updatedVariants.length > 0 && updatedVariants.every((v) => v.unlimited),
              updatedAt: new Date().toISOString()
            };

            await onSaveProduct(productToSave);
            updatedCounter++;
          } else {
            // ================= CREATE NEW PRODUCT =================
            const newProductId =
              plan.variantRows[0]?.idSistema ||
              `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

            const prefix = (plan.targetName || 'PR').trim().slice(0, 3).toUpperCase();
            const newVariants: ProductVariant[] = plan.variantRows.map((vRow, vIdx) => {
              processedVariants++;
              const varSku =
                vRow.variantSku ||
                `${prefix}-${vRow.attr1Val.slice(0, 3).toUpperCase() || 'V'}-${vRow.attr2Val.slice(0, 3).toUpperCase() || vIdx}`;

              return {
                id: `var-${Date.now()}-${vIdx}-${Math.random().toString(36).substring(2, 6)}`,
                color: vRow.attr1Val,
                size: vRow.attr2Val,
                sku: varSku,
                stock: vRow.stock,
                enabled: true,
                unlimited: vRow.isUnlimited
              };
            });

            const newTotalStock = newVariants.reduce(
              (acc, v) => acc + (!v.unlimited ? Number(v.stock || 0) : 0),
              0
            );

            const newProduct: Product = {
              id: newProductId,
              name: plan.targetName,
              category: plan.targetCategory || 'General',
              description: plan.targetDescription || '',
              customSku: plan.targetCustomSku || undefined,
              tags: [],
              tagColors: {},
              price: plan.targetPrice,
              discountPrice: plan.targetDiscountPrice,
              cost: plan.targetCost || 0,
              enabledOnline: true,
              images: plan.targetImages,
              coverIndex: 0,
              totalStock: newTotalStock,
              isUnlimited: newVariants.length > 0 && newVariants.every((v) => v.unlimited),
              attributesUsed: ['attr1', 'attr2'],
              variants: newVariants,
              supplierId: matchedSupplier?.id,
              supplierName: plan.targetSupplierName || undefined,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            await onSaveProduct(newProduct);
            createdCounter++;
          }

          // Small yield to allow React DOM re-renders and smooth progress
          await new Promise((r) => setTimeout(r, 15));
        }
      }

      // 4. Update new categories in store settings if any were introduced
      if (categoriesToAdd.size > 0 && onUpdateSettings) {
        const mergedCategories = [...settings.categories, ...Array.from(categoriesToAdd)];
        await onUpdateSettings({ categories: mergedCategories });
        console.log(`[IMPORT_CATALOG][${sessionId}] Categorías nuevas incorporadas:`, Array.from(categoriesToAdd));
      }

      setProgressPercent(100);
      setProgressMessage('¡Importación finalizada con éxito!');

      const stats = {
        created: createdCounter,
        updated: updatedCounter,
        variants: processedVariants
      };
      setFinalStats(stats);
      setStep('success');

      console.log(
        `[IMPORT_CATALOG][${sessionId}] Operación completada con éxito. Creados: ${createdCounter}, Actualizados: ${updatedCounter}, Variantes procesadas: ${processedVariants}.`
      );

      if (onSuccess) {
        onSuccess(stats);
      }
    } catch (err: any) {
      console.error(`[IMPORT_CATALOG][${sessionId}] Error fatal al procesar importación:`, err);
      setFatalErrorMessage(err?.message || 'Error inesperado durante la escritura de datos.');
      setStep('error');
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFileName('');
    setFileSize('');
    setParseErrors([]);
    setGroupedPlans([]);
    setTotalVariantCount(0);
    setNewSuppliersDetected([]);
    setProgressPercent(0);
    setProgressMessage('');
    setFatalErrorMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-neutral-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#fbf9f8] border-b border-[#efeded] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[22px]">upload_file</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Importar Catálogo (CSV)
              </h2>
              <p className="text-xs text-neutral-500">
                Carga y actualización masiva de inventario, precios y variantes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={step === 'processing'}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors cursor-pointer disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* STEP 1: UPLOAD & INSTRUCTIONS */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Informational Guidance Box */}
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2.5">
                <div className="flex items-center gap-2 text-neutral-900 font-bold text-xs">
                  <span className="material-symbols-outlined text-[18px] text-neutral-700">info</span>
                  <span>¿Cómo funciona la importación masiva?</span>
                </div>
                <ul className="space-y-1.5 text-neutral-600 leading-relaxed list-disc list-inside">
                  <li>
                    <strong className="text-black">1 fila por variante:</strong> Cada combinación de producto (color/talle) debe ocupar un renglón.
                  </li>
                  <li>
                    <strong className="text-black">Productos nuevos:</strong> Si no coinciden con ninguno existente, se crean automáticamente.
                  </li>
                  <li>
                    <strong className="text-black">Productos existentes:</strong> Se identifican por <code className="bg-neutral-200 px-1 py-0.5 rounded text-[11px]">ID_Sistema</code>, <code className="bg-neutral-200 px-1 py-0.5 rounded text-[11px]">Codigo_Producto</code> o <code className="bg-neutral-200 px-1 py-0.5 rounded text-[11px]">Nombre + Categoria</code>. Solo se actualizarán stock, precios, costo y proveedor.
                  </li>
                  <li>
                    <strong className="text-black">Fotos protegidas:</strong> Si dejas la columna de fotos vacía en un producto existente, sus imágenes actuales no se borrarán.
                  </li>
                </ul>

                <div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
                  <span className="text-[11px] text-neutral-500">¿Primera vez usando esta función?</span>
                  <button
                    type="button"
                    onClick={handleDownloadSampleCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 font-semibold text-[11px] transition-colors cursor-pointer shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">download</span>
                    <span>Descargar planilla CSV de ejemplo</span>
                  </button>
                </div>
              </div>

              {/* Stock Strategy Selector */}
              <div className="p-4 rounded-2xl border border-neutral-200 bg-white space-y-3">
                <label className="block text-xs font-bold text-neutral-900">
                  Modo de actualización de Stock:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      stockMode === 'replace'
                        ? 'border-black bg-neutral-50 ring-1 ring-black'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="stockMode"
                      value="replace"
                      checked={stockMode === 'replace'}
                      onChange={() => setStockMode('replace')}
                      className="mt-0.5 text-black focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-black text-xs">Reemplazar stock</div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        Fija el inventario de cada prenda al valor exacto que viene en la planilla.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      stockMode === 'add'
                        ? 'border-black bg-neutral-50 ring-1 ring-black'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="stockMode"
                      value="add"
                      checked={stockMode === 'add'}
                      onChange={() => setStockMode('add')}
                      className="mt-0.5 text-black focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-black text-xs">Sumar stock (Ingreso)</div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        Suma las unidades de la planilla al stock que ya tenías cargado.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Dropzone / File Picker */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-300 hover:border-black rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-neutral-50/50 hover:bg-white group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv,application/vnd.ms-excel"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-neutral-200 group-hover:bg-black group-hover:text-white text-neutral-700 flex items-center justify-center transition-all mb-3 shadow-2xs">
                  <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
                </div>
                <p className="font-bold text-neutral-800 text-sm">
                  Haz clic para seleccionar tu archivo CSV
                </p>
                <p className="text-neutral-500 text-[11px] mt-1">
                  Compatible con Excel, Google Sheets y LibreOffice (formato .csv delimitado por coma o punto y coma)
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & VALIDATION SUMMARY */}
          {step === 'preview' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* File Info Bar */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-100 border border-neutral-200">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[20px] text-neutral-700">description</span>
                  <div>
                    <span className="font-bold text-black text-xs">{fileName}</span>
                    <span className="text-neutral-500 text-[11px] ml-2 font-mono">({fileSize})</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-semibold text-neutral-600 hover:text-black hover:underline cursor-pointer"
                >
                  Cambiar archivo
                </button>
              </div>

              {/* Parse Errors if any */}
              {parseErrors.length > 0 && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-red-800">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    <span>Se detectaron {parseErrors.length} inconsistencias en el archivo:</span>
                  </div>
                  <ul className="max-h-40 overflow-y-auto space-y-1 text-[11px] pl-5 list-disc leading-relaxed text-red-700">
                    {parseErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-red-800 pt-1 font-medium">
                    Por favor corregí tu planilla y subila nuevamente para continuar.
                  </p>
                </div>
              )}

              {/* Validation Summary Cards */}
              {parseErrors.length === 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex flex-col">
                      <span className="text-[11px] text-neutral-500 font-medium">Nuevos Productos</span>
                      <span className="text-xl font-bold text-emerald-600 mt-1">{newProductsCount}</span>
                      <span className="text-[10px] text-neutral-400">Se darán de alta</span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex flex-col">
                      <span className="text-[11px] text-neutral-500 font-medium">A Actualizar</span>
                      <span className="text-xl font-bold text-blue-600 mt-1">{updatedProductsCount}</span>
                      <span className="text-[10px] text-neutral-400">Existentes en catálogo</span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex flex-col">
                      <span className="text-[11px] text-neutral-500 font-medium">Total Variantes</span>
                      <span className="text-xl font-bold text-neutral-900 mt-1">{totalVariantCount}</span>
                      <span className="text-[10px] text-neutral-400">Renglones de stock</span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex flex-col">
                      <span className="text-[11px] text-neutral-500 font-medium">Modo de Stock</span>
                      <span className="text-sm font-bold text-neutral-900 mt-1 truncate">
                        {stockMode === 'replace' ? 'Reemplazar' : 'Sumar (+)'}
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        {stockMode === 'replace' ? 'Pisa existencias' : 'Ingreso mercadería'}
                      </span>
                    </div>
                  </div>

                  {newSuppliersDetected.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-amber-600">local_shipping</span>
                      <span>
                        Se registrarán automáticamente <strong>{newSuppliersDetected.length}</strong> nuevos proveedores detectados ({newSuppliersDetected.join(', ')}).
                      </span>
                    </div>
                  )}

                  {/* Sample Preview Table */}
                  <div className="border border-neutral-200 rounded-2xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 font-bold text-neutral-700 text-[11px] flex items-center justify-between">
                      <span>Vista previa de productos detectados ({groupedPlans.length})</span>
                      <span className="text-neutral-400 font-normal">Mostrando los primeros 6</span>
                    </div>
                    <div className="divide-y divide-neutral-100 max-h-56 overflow-y-auto">
                      {groupedPlans.slice(0, 6).map((plan, idx) => (
                        <div key={idx} className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-neutral-50">
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="font-bold text-neutral-900 truncate">{plan.targetName}</span>
                            <span className="text-[10px] text-neutral-500">
                              {plan.targetCategory} • {plan.variantRows.length} variante(s)
                              {plan.targetSupplierName ? ` • Prov: ${plan.targetSupplierName}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-bold text-neutral-900">
                              ${plan.targetPrice.toLocaleString('es-AR')}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                plan.existingProduct
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {plan.existingProduct ? 'Actualizar' : 'Nuevo'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: PROCESSING & PROGRESS */}
          {step === 'processing' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-200">
              <div className="w-14 h-14 rounded-2xl bg-neutral-900 text-white flex items-center justify-center animate-pulse shadow-md">
                <span className="material-symbols-outlined text-[28px]">sync</span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  Procesando importación masiva...
                </h3>
                <p className="text-neutral-500 text-xs mt-1 max-w-sm">
                  {progressMessage}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md bg-neutral-100 rounded-full h-3 overflow-hidden border border-neutral-200">
                <div
                  className="bg-black h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold max-w-md">
                Por favor no actualices ni cierres la página, espera hasta que termine el proceso.
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS CONFIRMATION */}
          {step === 'success' && (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-[36px]">check_circle</span>
              </div>

              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  ¡Importación completada con éxito!
                </h3>
                <p className="text-neutral-500 text-xs mt-1">
                  Los registros fueron validados y sincronizados con la base de datos de tu tienda.
                </p>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-md">
                <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200">
                  <span className="text-[11px] text-neutral-500">Nuevos</span>
                  <p className="text-lg font-bold text-emerald-700 mt-0.5">{finalStats.created}</p>
                </div>
                <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200">
                  <span className="text-[11px] text-neutral-500">Actualizados</span>
                  <p className="text-lg font-bold text-blue-700 mt-0.5">{finalStats.updated}</p>
                </div>
                <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200">
                  <span className="text-[11px] text-neutral-500">Variantes</span>
                  <p className="text-lg font-bold text-neutral-900 mt-0.5">{finalStats.variants}</p>
                </div>
              </div>

              <div className="text-[11px] text-neutral-400 font-mono">
                Código de seguimiento: {importSessionId}
              </div>
            </div>
          )}

          {/* STEP 5: FATAL ERROR */}
          {step === 'error' && (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 rounded-3xl bg-red-100 text-red-700 flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-[36px]">report_problem</span>
              </div>

              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Ocurrió un inconveniente al procesar la importación
                </h3>
                <p className="text-neutral-500 text-xs mt-1 max-w-md">
                  Por favor intentá más tarde o comunicate con el administrador con el siguiente código de seguimiento:
                </p>
              </div>

              <div className="p-3 bg-neutral-100 border border-neutral-200 rounded-xl font-mono text-xs text-neutral-800 select-all font-bold">
                {importSessionId || 'IMP_ERROR_GENERIC'}
              </div>

              {fatalErrorMessage && (
                <div className="text-[11px] text-red-600 bg-red-50 p-3 rounded-xl border border-red-200 max-w-md">
                  Detalle del error: {fatalErrorMessage}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 bg-[#fbf9f8] border-t border-[#efeded] flex items-center justify-end gap-2.5">
          {step === 'upload' && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-200 hover:bg-neutral-300 text-black text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl bg-neutral-200 hover:bg-neutral-300 text-black text-xs font-semibold transition-colors cursor-pointer"
              >
                Descartar y volver
              </button>
              <button
                type="button"
                disabled={parseErrors.length > 0 || groupedPlans.length === 0}
                onClick={handleExecuteImport}
                className="px-5 py-2 rounded-xl bg-black hover:bg-neutral-800 disabled:opacity-40 text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                <span>Confirmar e Importar ({groupedPlans.length} productos)</span>
              </button>
            </>
          )}

          {step === 'success' && (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              Cerrar y ver inventario
            </button>
          )}

          {step === 'error' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-neutral-200 hover:bg-neutral-300 text-black text-xs font-semibold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-5 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
              >
                Volver a intentar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
