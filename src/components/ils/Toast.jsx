// ============================================================
//  TOAST COMPONENT (LIGHT SEVERITIES)
// ============================================================
export default function Toast({ toasts, onDismiss }) {
    if (!toasts.length) return null;
    return (
        <div className="fixed top-16 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
            {toasts.map(t => {
                const isCritical = t.level === 'critical';
                return (
                    <div 
                        key={t.id} 
                        className={`pointer-events-auto relative overflow-hidden rounded-lg p-4 shadow-lg border flex gap-3 animate-[toastIn_0.3s_ease] ${
                            isCritical 
                                ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-100/30' 
                                : t.level === 'warning'
                                    ? 'bg-white border-l-4 border-amber-500 border-sky-100 shadow-amber-50 text-slate-800'
                                    : 'bg-white border-l-4 border-blue-500 border-sky-100 shadow-blue-50 text-slate-800'
                        }`}
                    >
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wide ${
                                    isCritical 
                                        ? 'bg-emerald-700/60 text-white border border-emerald-500/30' 
                                        : t.level === 'warning' 
                                            ? 'bg-amber-50 text-amber-600' 
                                            : 'bg-blue-50 text-blue-600'
                                }`}>
                                    {isCritical ? '🔧 CẦN BẢO TRÌ BẢO DƯỠNG' : 
                                     t.level === 'warning' ? '⚡ CẢNH BÁO' : 'ℹ️ THÔNG TIN'}
                                </span>
                            </div>
                            <div className={`text-xs font-bold mb-0.5 ${isCritical ? 'text-white' : 'text-slate-800'}`}>{t.title}</div>
                            <div className={`text-[11px] leading-normal ${isCritical ? 'text-emerald-100/90 font-medium' : 'text-slate-500'}`}>{t.msg}</div>
                        </div>
                        <button 
                            onClick={() => onDismiss(t.id)} 
                            className={`self-start text-xs p-1 transition-colors ${
                                isCritical ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            ✕
                        </button>
                        
                        {/* Progress timing bar */}
                        <div 
                            className={`absolute bottom-0 left-0 h-1 animate-[shrinkBar_8s_linear_forwards] ${
                                isCritical ? 'bg-white/80' : t.level === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                            }`}
                            style={{ width: '100%' }}
                        />
                    </div>
                );
            })}
        </div>
    );
}
