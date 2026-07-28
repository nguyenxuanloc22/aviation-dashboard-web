// ============================================================
//  REDESIGNED RF ALERT MODAL COMPONENT
// ============================================================
export default function Toast({ toasts, onDismiss }) {
    if (!toasts.length) return null;

    // We display the current active RF notification
    const t = toasts[0];
    const isCritical = t.level === 'critical';
    const isWarning = t.level === 'warning';

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative border border-slate-100 flex flex-col items-center text-center animate-[modalIn_0.25s_ease-out]">
                {/* Close Button X */}
                <button
                    onClick={() => onDismiss(t.id)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1.5 text-base font-bold cursor-pointer"
                    aria-label="Đóng"
                >
                    ✕
                </button>

                {/* Circle Icon - dynamic color & icon based on severity */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 border-4 transition-all ${
                    isCritical
                        ? 'bg-red-50 border-red-100 text-red-500'
                        : isWarning
                            ? 'bg-amber-50 border-amber-100 text-amber-500'
                            : 'bg-emerald-50 border-emerald-100 text-emerald-500'
                }`}>
                    {isCritical ? (
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    ) : isWarning ? (
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    ) : (
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </div>

                {/* Header Title */}
                <h3 className="text-xl font-black text-slate-800 mb-2 tracking-wide px-2">
                    {t.title}
                </h3>

                {/* Alert Badge Info */}
                <div className="mb-3">
                    <span className={`text-[11px] font-bold px-3 py-1 rounded-full tracking-wide uppercase ${
                        isCritical
                            ? 'bg-red-50 text-red-600 border border-red-200'
                            : isWarning
                                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    }`}>
                        {isCritical ? '🚨 CẢNH BÁO NGUY HIỂM RF' :
                         isWarning ? '⚠️ CẢNH BÁO HỆ THỐNG RF' : '✅ HỆ THỐNG ỔN ĐỊNH'}
                    </span>
                </div>

                {/* Description details */}
                <p className="text-slate-600 text-xs leading-relaxed mb-4 font-medium max-w-sm">
                    {t.msg}
                </p>

                {/* RF Data Summary Box */}
                {(t.rfVal !== undefined && t.rfVal !== null) && (
                    <div className="w-full bg-slate-50 border border-slate-200/70 rounded-xl p-3 mb-4 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
                            <span className="text-[10px] text-slate-400 font-medium block">Chỉ số RF</span>
                            <span className={`font-bold text-sm ${isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {typeof t.rfVal === 'number' ? `${t.rfVal.toFixed(2)}%` : t.rfVal}
                            </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
                            <span className="text-[10px] text-slate-400 font-medium block">Thời điểm</span>
                            <span className="font-bold text-slate-700 text-xs">
                                {t.date ? `${t.date.split('/').slice(0, 2).join('/')}` : t.day ? `Ngày ${t.day}` : 'Toàn chu kỳ'}
                            </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
                            <span className="text-[10px] text-slate-400 font-medium block">Ngưỡng RF</span>
                            <span className="font-bold text-slate-700 text-xs">
                                {t.threshold ? `${t.threshold}%` : 'Standard'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Recommendations Section */}
                {t.recommendations && t.recommendations.length > 0 && (
                    <div className="w-full bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 text-left mb-5">
                        <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-blue-900 tracking-wide">
                            <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            <span>Gợi ý xử lý tiếp theo:</span>
                        </div>
                        <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
                            {t.recommendations.map((rec, idx) => (
                                <li key={idx} className="flex items-start gap-1.5 leading-snug">
                                    <span className="text-blue-500 font-bold">•</span>
                                    <span>{rec}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Action button */}
                <button
                    onClick={() => onDismiss(t.id)}
                    className={`w-full px-8 py-2.5 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer text-xs uppercase tracking-wider ${
                        isCritical
                            ? 'bg-red-600 hover:bg-red-700 active:bg-red-800 shadow-red-500/20'
                            : isWarning
                                ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 shadow-amber-500/20'
                                : 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 shadow-emerald-500/20'
                    }`}
                >
                    Đã hiểu
                </button>
            </div>
        </div>
    );
}

