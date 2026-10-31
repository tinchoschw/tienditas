import React, { useState, useEffect } from 'react';
import { StoreFeedback } from '../types';
import { subscribeStoreFeedback } from '../services/db';

interface FeedbackViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackViewerModal: React.FC<FeedbackViewerModalProps> = ({
  isOpen,
  onClose
}) => {
  const [feedbackList, setFeedbackList] = useState<StoreFeedback[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'suggestion' | 'closure' | 'friends_family'>('all');

  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeStoreFeedback((list) => {
      setFeedbackList(list);
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = feedbackList.filter((fb) => {
    if (filterType === 'all') return true;
    if (filterType === 'suggestion') return fb.type === 'suggestion' || fb.type === 'bug' || fb.type === 'general';
    return fb.type === filterType;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-neutral-100 my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-500 text-[20px]">rate_review</span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Auditoría & Opiniones
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight mt-0.5">
              Feedback Recibido ({feedbackList.length})
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Comentarios de comercios, sugerencias, reportes y motivos de baja.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-black transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 my-4 flex-wrap">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'bg-neutral-100 text-neutral-600 hover:text-black'
            }`}
          >
            Todos ({feedbackList.length})
          </button>
          <button
            onClick={() => setFilterType('suggestion')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === 'suggestion'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            Comentarios & Sugerencias ({feedbackList.filter((f) => f.type === 'suggestion' || f.type === 'bug' || f.type === 'general').length})
          </button>
          <button
            onClick={() => setFilterType('closure')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === 'closure'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            Cierres de Tienda ({feedbackList.filter((f) => f.type === 'closure').length})
          </button>
          <button
            onClick={() => setFilterType('friends_family')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === 'friends_family'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            Friends & Family ({feedbackList.filter((f) => f.type === 'friends_family').length})
          </button>
        </div>

        {/* Feedback List */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-neutral-400 text-xs">
            No hay registros de feedback en esta categoría.
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {filtered.map((item, idx) => (
              <div
                key={item.id || idx}
                className={`p-4 rounded-2xl border transition-all space-y-2.5 ${
                  item.type === 'closure'
                    ? 'bg-red-50/40 border-red-200'
                    : item.type === 'friends_family'
                    ? 'bg-indigo-50/40 border-indigo-200'
                    : 'bg-neutral-50/70 border-neutral-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-neutral-900">
                        {item.storeName || item.storeId}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.type === 'closure'
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : item.type === 'friends_family'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : item.type === 'bug'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}
                      >
                        {item.type === 'closure'
                          ? 'Baja de Tienda'
                          : item.type === 'friends_family'
                          ? 'Friends & Family'
                          : item.type === 'bug'
                          ? 'Problema Reportado'
                          : 'Sugerencia / Idea'}
                      </span>
                      {item.section && (
                        <span className="px-2 py-0.5 rounded-md bg-neutral-200 text-neutral-700 text-[10px] font-bold">
                          📍 {item.section}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-neutral-500 font-mono">
                      {item.userName || item.userEmail}
                    </span>
                  </div>

                  <span className="text-[11px] text-neutral-400 font-mono shrink-0">
                    {new Date(item.date).toLocaleDateString('es-AR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>

                {/* Motives list if closure */}
                {item.motivos && item.motivos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {item.motivos.map((m, mIdx) => (
                      <span
                        key={mIdx}
                        className="px-2 py-0.5 rounded-lg bg-white/90 border border-red-200 text-[11px] font-semibold text-red-800"
                      >
                        • {m}
                      </span>
                    ))}
                  </div>
                )}

                {/* Text comment */}
                {item.text && (
                  <div className="p-3 bg-white/90 rounded-xl border border-neutral-200/60 text-xs text-neutral-800 leading-relaxed italic">
                    "{item.text}"
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-neutral-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
