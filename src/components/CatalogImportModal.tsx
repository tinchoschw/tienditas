import React, { useState, useMemo, useRef } from 'react';
import { Product, ProductVariant, StoreSettings, Supplier } from '../types';
import { useModalHistory } from '../hooks/useModalHistory';
import { ensureStoreAttributes } from '../utils/attributeUtils';
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
}

interface GroupedProductPlan {
  productKey: string;
  isExisting: boolean;
  existingProduct?: Product;
  targetName: string;
  targetCategory: string;
  targetDescription: string;
  targetCustomSku: string;
  targetSupplierName: string;
  targetPrice: number;
  targetCost: number;
  targetDiscountPrice?: number;
  variantRows: ParsedVariantRow[];
}

/**
 * Standard CSV parser that cleanly handles quotes, commas, semicolons, and CRLF line breaks.
 */
function parseCsvToMatrix(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, '').trim();
  if (!cleanText) return [];

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
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
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
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [groupedPlans, setGroupedPlans] = useState<GroupedProductPlan[]>([]);
  const [totalVariantCount, setTotalVariantCount] = useState<number>(0);

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

  // Download sample CSV template matching store attributes
  const handleDownloadSampleCsv = () => {
    const header = [
      'ID_Sistema',
      'Codigo_Producto',
      'Nombre',
      'Descripcion',
      'Categoria',
      'Atributo_1',
      'Atributo_2',
      'Stock',
      'Costo',
      'Precio',
      'Precio_Promo',
      'Proveedor',
      'SKU_Variante'
    ].join(',');

    const sampleCat = settings.categories.find((c) => c !== 'Todas') || 'General';
    const sampleOpt1A = attribute1.options[0]?.label || 'Negro';
    const sampleOpt1B = attribute1.options[1]?.label || 'Blanco';
    const sampleOpt2A = attribute2.options[0]?.label || 'M';
    const sampleOpt2B = attribute2.options[1]?.label || 'L';

    const row1 = [
      '""',
      '"REM-001"',
      '"Remera Lisa Algodon"',
      '"Remera 100% algodon peinado"',
      `"${sampleCat}"`,
      `"${sampleOpt1A}"`,
      `"${sampleOpt2A}"`,
      '20',
      '4500',
      '9900',
      '8900',
      '"Textil Central"',
      '"REM-001-NEG-M"'
    ].join(',');

    const row2 = [
      '""',
      '"REM-001"',
      '"Remera Lisa Algodon"',
      '"Remera 100% algodon peinado"',
      `"${sampleCat}"`,
      `"${sampleOpt1B}"`,
      `"${sampleOpt2B}"`,
      '15',
      '4500',
      '9900',
      '8900',
      '"Textil Central"',
      '"REM-001-BLA-L"'
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
      setParseErrors(['El archivo está vacío o solo contiene la cabecera. Debe incluir al menos una fila de productos.']);
      setGroupedPlans([]);
      setStep('preview');
      return;
    }

    const rawHeaders = matrix[0].map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
    const findCol = (candidates: string[]) => rawHeaders.findIndex((h) => candidates.some((c) => h.includes(c)));

    const colId = findCol(['idsistema', 'id_sistema', 'id']);
    const colCustomSku = findCol(['codigoproducto', 'codigo_producto', 'codigo', 'sku_producto']);
    const colName = findCol(['nombre', 'titulo', 'prenda', 'modelo']);
    const colDesc = findCol(['descripcion', 'detalle']);
    const colCat = findCol(['categoria', 'rubro']);
    const colAttr1 = findCol(['atributo1', 'atributo_1', 'color', 'attr1']);
    const colAttr2 = findCol(['atributo2', 'atributo_2', 'talle', 'tamano', 'attr2']);
    const colStock = findCol(['stock', 'cantidad', 'existencia', 'stocktotal']);
    const colCost = findCol(['costo', 'preciocosto']);
    const colPrice = findCol(['precio', 'precioventa', 'pvp']);
    const colDiscount = findCol(['preciopromo', 'precio_promo', 'oferta', 'descuento']);
    const colSupplier = findCol(['proveedor', 'distribuidor', 'fabricante']);
    const colVariantSku = findCol(['skuvariante', 'sku_variante', 'sku']);

    if (colName === -1) {
      setParseErrors(['No se encontró la columna "Nombre" o "Titulo" en la cabecera del archivo CSV.']);
      setGroupedPlans([]);
      setStep('preview');
      return;
    }

    const errors: string[] = [];
    const parsedRows: ParsedVariantRow[] = [];

    for (let i = 1; i < matrix.length; i++) {
      const row = matrix[i];
      const rowNum = i + 1;

      if (row.every((f) => !f.trim())) continue;

      const name = (colName !== -1 ? row[colName] : '')?.trim() || '';
      if (!name) {
        errors.push(`Fila ${rowNum}: El nombre del producto es obligatorio.`);
        continue;
      }

      const rawPrice = (colPrice !== -1 ? row[colPrice] : '')?.trim() || '0';
      const cleanPrice = rawPrice.replace('$', '').replace(/\./g, '').replace(',', '.');
      const priceNum = parseFloat(cleanPrice);
      if (isNaN(priceNum) || priceNum < 0) {
        errors.push(`Fila ${rowNum} ("${name}"): El precio "${rawPrice}" debe ser un número mayor o igual a 0.`);
      }

      const rawCost = (colCost !== -1 ? row[colCost] : '')?.trim() || '0';
      const cleanCost = rawCost ? rawCost.replace('$', '').replace(/\./g, '').replace(',', '.') : '0';
      const costNum = cleanCost ? parseFloat(cleanCost) : 0;
      if (isNaN(costNum) || costNum < 0) {
        errors.push(`Fila ${rowNum} ("${name}"): El costo "${rawCost}" debe ser un número válido.`);
      }

      let discountPriceNum: number | undefined = undefined;
      const rawDiscount = (colDiscount !== -1 ? row[colDiscount] : '')?.trim();
      if (rawDiscount) {
        const cleanDiscount = rawDiscount.replace('$', '').replace(/\./g, '').replace(',', '.');
        const parsedDiscount = parseFloat(cleanDiscount);
        if (!isNaN(parsedDiscount) && parsedDiscount > 0) {
          discountPriceNum = parsedDiscount;
        }
      }

      const rawStock = (colStock !== -1 ? row[colStock] : '')?.trim() || '0';
      const isUnlimited = rawStock.toUpperCase() === 'ILIMITADO' || rawStock === '∞';
      let stockNum = 0;
      if (!isUnlimited) {
        stockNum = parseInt(rawStock.replace(/[^0-9-]/g, ''), 10);
        if (isNaN(stockNum) || stockNum < 0) {
          errors.push(`Fila ${rowNum} ("${name}"): El stock "${rawStock}" debe ser un número entero o "ILIMITADO".`);
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
        variantSku
      });
    }

    // Group rows by target product
    // Hierarchy:
    // 1. By ID_Sistema if matches an existing product
    // 2. By Codigo_Producto if matches an existing product's customSku
    // 3. By exact Nombre (case-insensitive) if matches an existing product
    // 4. Otherwise -> New product (grouped by customSku if provided, else by Nombre)
    const groupsMap = new Map<string, GroupedProductPlan>();

    parsedRows.forEach((row) => {
      let matchedProd: Product | undefined;

      if (row.idSistema) {
        matchedProd = products.find((p) => p.id === row.idSistema);
      }
      if (!matchedProd && row.customSku) {
        matchedProd = products.find(
          (p) => p.customSku && p.customSku.toLowerCase() === row.customSku.toLowerCase()
        );
      }
      if (!matchedProd && row.name) {
        matchedProd = products.find(
          (p) => p.name.trim().toLowerCase() === row.name.trim().toLowerCase()
        );
      }

      const key = matchedProd
        ? `existing:${matchedProd.id}`
        : row.customSku
        ? `new_sku:${row.customSku.toLowerCase()}`
        : `new_name:${row.name.trim().toLowerCase()}`;

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          productKey: key,
          isExisting: Boolean(matchedProd),
          existingProduct: matchedProd,
          targetName: row.name,
          targetCategory: row.category || matchedProd?.category || 'General',
          targetDescription: row.description || matchedProd?.description || '',
          targetCustomSku: row.customSku || matchedProd?.customSku || '',
          targetSupplierName: row.supplierName || matchedProd?.supplierName || '',
          targetPrice: row.price,
          targetCost: row.cost || matchedProd?.cost || 0,
          targetDiscountPrice: row.discountPrice ?? matchedProd?.discountPrice,
          variantRows: []
        });
      }

      groupsMap.get(key)!.variantRows.push(row);
    });

    setParseErrors(errors);
    setGroupedPlans(Array.from(groupsMap.values()));
    setTotalVariantCount(parsedRows.length);
    setStep('preview');
  };

  const newProductsCount = groupedPlans.filter((p) => !p.isExisting).length;
  const updatedProductsCount = groupedPlans.filter((p) => p.isExisting).length;

  const handleExecuteImport = async () => {
    if (parseErrors.length > 0 || groupedPlans.length === 0) return;

    setStep('processing');
    setProgressPercent(5);
    setProgressMessage('Iniciando importación...');

    const sessionId = `IMP_${(storeSlug || 'store').toUpperCase()}_${Date.now()}`;
    setImportSessionId(sessionId);

    try {
      const knownSuppliers = new Map<string, Supplier>();
      suppliers.forEach((s) => knownSuppliers.set(s.name.trim().toLowerCase(), s));

      const currentCategories = new Set(settings.categories);
      const categoriesToAdd = new Set<string>();

      let createdCounter = 0;
      let updatedCounter = 0;
      let processedVariants = 0;

      const totalPlans = groupedPlans.length;

      for (let i = 0; i < totalPlans; i++) {
        const plan = groupedPlans[i];
        const pct = Math.round(((i + 1) / totalPlans) * 90);
        setProgressPercent(Math.min(95, pct));
        setProgressMessage(`Guardando producto ${i + 1} de ${totalPlans}: "${plan.targetName}"...`);

        // Check category
        if (plan.targetCategory && !currentCategories.has(plan.targetCategory)) {
          categoriesToAdd.add(plan.targetCategory);
        }

        // Auto-register supplier if new
        let supplierId = plan.existingProduct?.supplierId;
        if (plan.targetSupplierName && storeSlug) {
          const supKey = plan.targetSupplierName.trim().toLowerCase();
          if (knownSuppliers.has(supKey)) {
            supplierId = knownSuppliers.get(supKey)!.id;
          } else {
            try {
              const createdSup = await createSupplier(storeSlug, { name: plan.targetSupplierName.trim() });
              knownSuppliers.set(supKey, createdSup);
              supplierId = createdSup.id;
            } catch (err) {
              console.warn('No se pudo registrar proveedor en Firestore:', err);
            }
          }
        }

        if (plan.existingProduct) {
          // ================= ACTUALIZAR PRODUCTO EXISTENTE =================
          const existing = plan.existingProduct;
          let baseVariants = [...existing.variants];

          // REGLA CLAVE: Si el producto anterior tenía solo 1 variante simple/genérica (sin atributos reales)
          // y el archivo ahora define variantes explícitas (con color o talle), descartar la genérica anterior
          const hadOnlySimpleVariant =
            baseVariants.length === 1 &&
            (!baseVariants[0].color || baseVariants[0].color.toLowerCase() === 'único') &&
            (!baseVariants[0].size || baseVariants[0].size.toLowerCase() === 'u');

          if (hadOnlySimpleVariant && plan.variantRows.some((r) => r.attr1Val || r.attr2Val)) {
            baseVariants = [];
          }

          // Merge or append variants
          plan.variantRows.forEach((vRow, vIdx) => {
            processedVariants++;
            const matchIndex = baseVariants.findIndex((ev) => {
              if (vRow.variantSku && ev.sku && ev.sku.toLowerCase() === vRow.variantSku.toLowerCase()) {
                return true;
              }
              const match1 = (ev.color || '').trim().toLowerCase() === vRow.attr1Val.trim().toLowerCase();
              const match2 = (ev.size || '').trim().toLowerCase() === vRow.attr2Val.trim().toLowerCase();
              return match1 && match2;
            });

            if (matchIndex !== -1) {
              // Update existing variant stock
              baseVariants[matchIndex] = {
                ...baseVariants[matchIndex],
                stock: vRow.stock,
                unlimited: vRow.isUnlimited,
                sku: vRow.variantSku || baseVariants[matchIndex].sku
              };
            } else {
              // Add new variant
              const prefix = (existing.name || 'PR').trim().slice(0, 3).toUpperCase();
              const newSku =
                vRow.variantSku ||
                `${prefix}-${vRow.attr1Val.slice(0, 3).toUpperCase() || 'V'}-${vRow.attr2Val.slice(0, 3).toUpperCase() || vIdx}`;

              baseVariants.push({
                id: `var-${Date.now()}-${vIdx}-${Math.random().toString(36).substring(2, 6)}`,
                color: vRow.attr1Val,
                size: vRow.attr2Val,
                sku: newSku,
                stock: vRow.stock,
                enabled: true,
                unlimited: vRow.isUnlimited
              });
            }
          });

          const totalStock = baseVariants.reduce(
            (acc, v) => acc + (!v.unlimited ? Number(v.stock || 0) : 0),
            0
          );

          const updatedProduct: Product = {
            ...existing,
            name: plan.targetName || existing.name,
            category: plan.targetCategory || existing.category,
            description: plan.targetDescription || existing.description,
            customSku: plan.targetCustomSku || existing.customSku,
            price: plan.targetPrice > 0 ? plan.targetPrice : existing.price,
            cost: plan.targetCost > 0 ? plan.targetCost : existing.cost,
            discountPrice: plan.targetDiscountPrice ?? existing.discountPrice,
            supplierId: supplierId || existing.supplierId,
            supplierName: plan.targetSupplierName || existing.supplierName,
            variants: baseVariants,
            totalStock,
            isUnlimited: baseVariants.length > 0 && baseVariants.every((v) => v.unlimited),
            updatedAt: new Date().toISOString()
          };

          await onSaveProduct(updatedProduct);
          updatedCounter++;
        } else {
          // ================= CREAR PRODUCTO NUEVO =================
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

          const totalStock = newVariants.reduce(
            (acc, v) => acc + (!v.unlimited ? Number(v.stock || 0) : 0),
            0
          );

          const newProduct: Product = {
            id: `prod-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
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
            images: [],
            coverIndex: 0,
            totalStock,
            isUnlimited: newVariants.length > 0 && newVariants.every((v) => v.unlimited),
            attributesUsed: ['attr1', 'attr2'],
            variants: newVariants,
            supplierId: supplierId || undefined,
            supplierName: plan.targetSupplierName || undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          await onSaveProduct(newProduct);
          createdCounter++;
        }

        await new Promise((r) => setTimeout(r, 10));
      }

      // Add new categories if any
      if (categoriesToAdd.size > 0 && onUpdateSettings) {
        const mergedCategories = [...settings.categories, ...Array.from(categoriesToAdd)];
        await onUpdateSettings({ categories: mergedCategories });
      }

      setProgressPercent(100);
      setProgressMessage('¡Catálogo importado exitosamente!');

      const stats = {
        created: createdCounter,
        updated: updatedCounter,
        variants: processedVariants
      };
      setFinalStats(stats);
      setStep('success');

      if (onSuccess) {
        onSuccess(stats);
      }
    } catch (err: any) {
      console.error('Error durante la importación:', err);
      setFatalErrorMessage(err?.message || 'Error al guardar los productos en la base de datos.');
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
    setProgressPercent(0);
    setProgressMessage('');
    setFatalErrorMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-neutral-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#fbf9f8] border-b border-[#efeded] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[22px]">upload_file</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Importar Productos y Variantes
              </h2>
              <p className="text-xs text-neutral-500">
                Carga masiva de catálogo o nuevas presentaciones
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
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* STEP 1: UPLOAD & INSTRUCTIONS */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                <div className="flex items-center gap-2 text-neutral-900 font-bold text-xs">
                  <span className="material-symbols-outlined text-[18px] text-neutral-700">info</span>
                  <span>Instrucciones para la carga:</span>
                </div>
                <ul className="space-y-1.5 text-neutral-600 leading-relaxed list-disc list-inside">
                  <li>
                    <strong className="text-black">1 fila por cada variante:</strong> Cada combinación de talle o color debe figurar en un renglón.
                  </li>
                  <li>
                    <strong className="text-black">Mismo producto:</strong> Las filas con el mismo Código o Nombre se agruparán en una sola prenda con sus distintas presentaciones.
                  </li>
                  <li>
                    <strong className="text-black">Stock y precios:</strong> Cada variante tomará el stock indicado en su fila.
                  </li>
                </ul>

                <div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
                  <span className="text-[11px] text-neutral-500">¿Necesitas un modelo?</span>
                  <button
                    type="button"
                    onClick={handleDownloadSampleCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 font-semibold text-[11px] transition-colors cursor-pointer shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">download</span>
                    <span>Descargar plantilla CSV</span>
                  </button>
                </div>
              </div>

              {/* Dropzone */}
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
                  Haz clic para elegir tu archivo CSV
                </p>
                <p className="text-neutral-500 text-[11px] mt-1">
                  Formatos compatibles: .csv (delimitado por coma o punto y coma)
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW */}
          {step === 'preview' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-100 border border-neutral-200">
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

              {parseErrors.length > 0 && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-red-800">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    <span>Se detectaron {parseErrors.length} errores en la planilla:</span>
                  </div>
                  <ul className="max-h-40 overflow-y-auto space-y-1 text-[11px] pl-5 list-disc leading-relaxed text-red-700">
                    {parseErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-red-800 pt-1 font-medium">
                    Por favor corregí tu archivo para poder continuar.
                  </p>
                </div>
              )}

              {parseErrors.length === 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex flex-col">
                      <span className="text-[11px] text-neutral-500 font-medium">Productos Nuevos</span>
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
                  </div>

                  {/* Preview list */}
                  <div className="border border-neutral-200 rounded-2xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 font-bold text-neutral-700 text-[11px]">
                      Productos detectados ({groupedPlans.length})
                    </div>
                    <div className="divide-y divide-neutral-100 max-h-56 overflow-y-auto">
                      {groupedPlans.map((plan, idx) => (
                        <div key={idx} className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-neutral-50">
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="font-bold text-neutral-900 truncate">{plan.targetName}</span>
                            <span className="text-[10px] text-neutral-500">
                              {plan.targetCategory} • {plan.variantRows.length} variante(s)
                              {plan.targetSupplierName ? ` • Prov: ${plan.targetSupplierName}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold text-neutral-900">
                              ${plan.targetPrice.toLocaleString('es-AR')}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                plan.isExisting
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {plan.isExisting ? 'Actualizar' : 'Nuevo'}
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

          {/* STEP 3: PROCESSING */}
          {step === 'processing' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-200">
              <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center animate-pulse shadow-md">
                <span className="material-symbols-outlined text-[24px]">sync</span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  Guardando productos en el sistema...
                </h3>
                <p className="text-neutral-500 text-xs mt-1">
                  {progressMessage}
                </p>
              </div>

              <div className="w-full max-w-sm bg-neutral-100 rounded-full h-2.5 overflow-hidden border border-neutral-200">
                <div
                  className="bg-black h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="text-[11px] text-neutral-400">
                Por favor no cierres la ventana hasta finalizar.
              </p>
            </div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 'success' && (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in-95">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-[32px]">check_circle</span>
              </div>

              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  ¡Productos importados exitosamente!
                </h3>
                <p className="text-neutral-500 text-xs mt-1">
                  Tu catálogo fue actualizado y está listo para vender.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
                <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200">
                  <span className="text-[10px] text-neutral-500">Nuevos</span>
                  <p className="text-base font-bold text-emerald-700">{finalStats.created}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200">
                  <span className="text-[10px] text-neutral-500">Actualizados</span>
                  <p className="text-base font-bold text-blue-700">{finalStats.updated}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200">
                  <span className="text-[10px] text-neutral-500">Variantes</span>
                  <p className="text-base font-bold text-neutral-900">{finalStats.variants}</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: ERROR */}
          {step === 'error' && (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in-95">
              <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-[32px]">report_problem</span>
              </div>

              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Ocurrió un error al procesar el archivo
                </h3>
                <p className="text-neutral-500 text-xs mt-1 max-w-sm">
                  {fatalErrorMessage || 'Por favor revisá el formato de tu planilla e intentá nuevamente.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
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
                Volver
              </button>
              <button
                type="button"
                disabled={parseErrors.length > 0 || groupedPlans.length === 0}
                onClick={handleExecuteImport}
                className="px-5 py-2 rounded-xl bg-black hover:bg-neutral-800 disabled:opacity-40 text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                <span>Confirmar e Importar</span>
              </button>
            </>
          )}

          {step === 'success' && (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              Cerrar y ver catálogo
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
