import React from 'react';

export interface AttributeConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  affectedList?: string[];
  affectedListTitle?: string;
  confirmLabel: string;
  confirmColor?: 'red' | 'black';
  onConfirm: () => Promise<void> | void;
  isConfirming?: boolean;
}

export const AttributeConfirmationModal: React.FC<AttributeConfirmationModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  affectedList = [],
  affectedListTitle,
  confirmLabel,
  confirmColor = 'red',
  onConfirm,
  isConfirming = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95 duration-150">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
          confirmColor === 'red' ? 'bg-red-50 text-red-600' : 'bg-neutral-100 text-neutral-800'
        }`}>
          <span className="material-symbols-outlined text-2xl">
            {confirmColor === 'red' ? 'warning' : 'help'}
          </span>
        </div>

        <h3 className="text-base font-bold text-neutral-900 mb-1.5 leading-snug">
          {title}
        </h3>

        <p className="text-xs text-neutral-600 mb-4 leading-relaxed">
          {message}
        </p>

        {affectedList.length > 0 && (
          <div className="mb-5 space-y-1.5">
            {affectedListTitle && (
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block">
                {affectedListTitle} ({affectedList.length})
              </span>
            )}
            <div className="max-h-48 overflow-y-auto rounded-xl border border-neutral-200 bg-neutral-50/80 p-2.5 divide-y divide-neutral-200/60">
              {affectedList.map((item, idx) => (
                <div key={idx} className="py-1 text-[11px] text-neutral-700 leading-snug font-sans">
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
              confirmColor === 'red'
                ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                : 'bg-neutral-900 hover:bg-black active:bg-neutral-800'
            }`}
          >
            {isConfirming && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
