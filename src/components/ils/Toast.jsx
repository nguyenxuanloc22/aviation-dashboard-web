// ============================================================
//  TOAST COMPONENT (LIGHT SEVERITIES)
// ============================================================
export default function Toast({ toasts, onDismiss }) {
    if (!toasts.length) return null;
    return (
        <div className="fixed top-16 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
            {toasts.map(t => (
                <div 
                    key={t.id} 
                    className={`pointer-events-auto bg-white border-l-4 ${
                        t.level === 'critical' ? 'border-red-500 shadow-red-50' : 
                        t.level === 'warning' ? 'border-amber-500 shadow-amber-50' : 'border-blue-500 shadow-blue-50'
                    } rounded-r-lg p-4 shadow-lg border border-sky-100 flex gap-3 animate-[toastIn_0.3s_ease]`}
                >
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wide ${
                                t.level === 'critical' ? 'bg-red-50 text-red-600' : 
                                t.level === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                            }`}>
                                {t.level === 'critical' ? '⚠️ CẢNH BÁO NGUY HIỂM' : 
                                 t.level === 'warning' ? '⚡ CẢNH BÁO' : 'ℹ️ THÔNG TIN'}
                            </span>
                        </div>
                        <div className="text-xs font-bold text-slate-800 mb-0.5">{t.title}</div>
                        <div className="text-[11px] text-slate-500 leading-normal">{t.msg}</div>
                    </div>
                    <button 
                        onClick={() => onDismiss(t.id)} 
                        className="text-slate-400 hover:text-slate-600 self-start text-xs p-1"
                    >
                        ✕
                    </button>
                </div>
            ))}
        </div>
    );
}
