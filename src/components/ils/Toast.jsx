// ============================================================
//  REDESIGNED ALERT MODAL COMPONENT (CENTERED EMERALD SUCCESS STYLE)
// ============================================================
export default function Toast({ toasts, onDismiss }) {
    if (!toasts.length) return null;

    // We only show the first alert (there should only be one active warning at a time)
    const t = toasts[0];
    const isCritical = t.level === 'critical';
    const isWarning = t.level === 'warning';

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl relative border border-slate-100 flex flex-col items-center text-center animate-[modalIn_0.25s_ease-out]">
                {/* Close Button X in top right corner */}
                <button
                    onClick={() => onDismiss(t.id)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1.5 text-base font-bold cursor-pointer"
                    aria-label="Đóng"
                >
                    ✕
                </button>

                {/* Big Green Circle with checkmark (matches the success image styling) */}
                <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mb-6 border-4 border-emerald-100/60">
                    <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>

                {/* Header Title */}
                <h3 className="text-xl font-black text-slate-800 mb-3 tracking-wide px-4">
                    {t.title}
                </h3>

                {/* Alert Badge Info */}
                <div className="mb-4">
                    <span className={`text-[10px] font-bold px-3 py-1 rounded-full tracking-wide uppercase ${isCritical
                        ? 'bg-red-50 text-red-600 border border-red-100'
                        : isWarning
                            ? 'bg-amber-50 text-amber-600 border border-amber-100'
                            : 'bg-blue-50 text-blue-600 border border-blue-100'
                        }`}>
                        {isCritical ? '🔧 Cần Bảo Trì Khẩn Cấp' :
                            isWarning ? '⚠️ Cảnh Báo Hệ Thống' : 'ℹ️ Thông Tin'}
                    </span>
                </div>

                {/* Description details */}
                <p className="text-slate-500 text-[13px] leading-relaxed mb-6 font-medium max-w-sm">
                    {t.msg}
                </p>

                {/* Emerald green CTA button (Tuyệt vời) */}
                <button
                    onClick={() => onDismiss(t.id)}
                    className="w-full px-8 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-lg font-bold transition-all shadow-md shadow-emerald-500/20 hover:shadow-lg cursor-pointer text-xs uppercase tracking-wider"
                >
                    Đã hiểu
                </button>
            </div>
        </div>
    );
}
