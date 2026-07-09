import { Calendar, Info, Search, Copy, Check, AlertTriangle, AlertCircle } from 'lucide-react';

// ============================================================
//  WARNING LOGS DRAWER
//  Props:
//    showLogsDrawer, setShowLogsDrawer
//    rawSimulationLogs, filteredSortedLogs, activeRangeLogs
//    criticalCount, warningCount
//    logSearchQuery, setLogSearchQuery
//    logFilter, setLogFilter
//    logSortOrder, setLogSortOrder
//    copiedLogs, handleCopyLogs
//    brushRange, setBrushRange, chartData
// ============================================================
export default function LogsDrawer({
    showLogsDrawer,
    setShowLogsDrawer,
    rawSimulationLogs,
    filteredSortedLogs,
    activeRangeLogs,
    criticalCount,
    warningCount,
    logSearchQuery,
    setLogSearchQuery,
    logFilter,
    setLogFilter,
    logSortOrder,
    setLogSortOrder,
    copiedLogs,
    handleCopyLogs,
    brushRange,
    setBrushRange,
    chartData,
}) {
    return (
        <>
            {/* WARNING LOGS DRAWER OVERLAY BACKDROP */}
            {showLogsDrawer && (
                <div
                    className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-[990] transition-opacity duration-300"
                    onClick={() => setShowLogsDrawer(false)}
                />
            )}

            {/* WARNING LOGS DRAWER */}
            <div className={`fixed inset-y-0 right-0 z-[999] w-80 sm:w-96 bg-white border-l border-slate-200 shadow-2xl flex flex-col transition-transform duration-300 transform ${showLogsDrawer ? 'translate-x-0' : 'translate-x-full'
                }`}>
                {/* Drawer Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 flex-shrink-0">
                    <span className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar size={14} className="text-blue-600" />
                        Nhật ký cảnh báo ({rawSimulationLogs.length})
                    </span>
                    <button
                        onClick={() => setShowLogsDrawer(false)}
                        className="text-slate-400 hover:text-slate-600 p-1 font-bold text-sm"
                    >
                        ✕
                    </button>
                </div>

                {/* Filters, Search and Sort Panel */}
                <div className="p-4 border-b border-slate-100 bg-white space-y-3 flex-shrink-0">
                    {/* Search query */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Tìm kiếm nội dung cảnh báo..."
                            value={logSearchQuery}
                            onChange={(e) => setLogSearchQuery(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-700 outline-none w-full focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                        />
                        <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-1 border-b border-slate-100 pb-2">
                        {[
                            { id: 'all', label: 'Tất cả', count: rawSimulationLogs.length },
                            { id: 'critical', label: 'Nguy cấp', count: criticalCount, activeColor: 'text-red-600 bg-red-50 border-red-200' },
                            { id: 'warning', label: 'Cảnh báo', count: warningCount, activeColor: 'text-amber-700 bg-amber-50 border-amber-200' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setLogFilter(tab.id)}
                                className={`flex-1 py-1 px-2 border rounded-md text-[10px] font-bold transition-all cursor-pointer text-center ${logFilter === tab.id
                                        ? tab.activeColor || 'text-blue-700 bg-blue-50 border-blue-200'
                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                {tab.label} ({tab.count})
                            </button>
                        ))}
                    </div>

                    {/* Sort Order Selector and Copy Logs */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Sắp xếp:</span>
                            <select
                                value={logSortOrder}
                                onChange={(e) => setLogSortOrder(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-[10px] text-slate-600 outline-none focus:border-blue-500"
                            >
                                <option value="day-asc">Cũ nhất trước (Ngày tăng)</option>
                                <option value="day-desc">Mới nhất trước (Ngày giảm)</option>
                                <option value="severity-crit">Mức độ: Nguy cấp trước</option>
                                <option value="severity-warn">Mức độ: Cảnh báo trước</option>
                            </select>
                        </div>

                        {/* Copy button */}
                        {rawSimulationLogs.length > 0 && (
                            <button
                                onClick={handleCopyLogs}
                                className={`px-2 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${copiedLogs
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                {copiedLogs ? <Check size={10} /> : <Copy size={10} />}
                                {copiedLogs ? 'Đã sao chép!' : 'Sao chép nhật ký'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Brush Range Zoom Indicator */}
                {brushRange && (
                    <div className="px-4 py-2 bg-blue-50 border-b border-slate-100 flex items-center justify-between text-[10px] text-blue-800 font-semibold flex-shrink-0">
                        <span className="flex items-center gap-1">
                            <Info size={11} className="text-blue-500 font-bold" />
                            Lọc biểu đồ: Ngày {chartData[brushRange.startIndex]?.day} - {chartData[brushRange.endIndex]?.day}
                        </span>
                        <button
                            onClick={() => setBrushRange(null)}
                            className="text-blue-600 hover:text-blue-800 underline font-bold cursor-pointer"
                        >
                            Xem tất cả
                        </button>
                    </div>
                )}

                {/* Logs List Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {filteredSortedLogs.length === 0 ? (
                        <div className="text-slate-400 text-xs italic text-center py-8">
                            Không tìm thấy cảnh báo phù hợp với bộ lọc.
                        </div>
                    ) : (
                        filteredSortedLogs.map((log, i) => {
                            const isNguyCap = log.severity === 'NGUY_CAP';
                            const isCanhBao = log.severity === 'CANH_BAO';
                            
                            const bgBorderColor = isNguyCap
                                ? 'bg-red-50/75 border-red-100 text-red-950 shadow-xs'
                                : isCanhBao
                                    ? 'bg-amber-50/75 border-amber-100 text-amber-950 shadow-xs'
                                    : 'bg-sky-50/75 border-sky-100 text-sky-950 shadow-xs';
                                    
                            const labelBgColor = isNguyCap
                                ? 'bg-red-100 text-red-700 border border-red-200'
                                : isCanhBao
                                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                    : 'bg-sky-100 text-sky-700 border border-sky-200';
                                    
                            const labelText = isNguyCap ? 'Nguy cấp' : (isCanhBao ? 'Cảnh báo' : 'Theo dõi');
                            
                            return (
                                <div key={i} className={`p-3 rounded-xl border text-[11px] leading-relaxed flex flex-col gap-2 ${bgBorderColor}`}>
                                    <div className="flex items-center justify-between font-bold">
                                        <span className="flex items-center gap-1.5">
                                            {isNguyCap ? (
                                                <AlertTriangle size={13} className="text-red-600 animate-pulse" />
                                            ) : (
                                                <AlertCircle size={13} className={isCanhBao ? "text-amber-600" : "text-sky-600"} />
                                            )}
                                            {log.title}
                                        </span>
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase ${labelBgColor}`}>
                                            {labelText}
                                        </span>
                                    </div>
                                    <div className="font-semibold text-slate-700">{log.message}</div>
                                    
                                    <div className={`mt-1.5 pt-2 border-t border-dashed ${isNguyCap ? 'border-red-200' : (isCanhBao ? 'border-amber-200' : 'border-sky-200')} text-[10px] leading-normal font-medium`}>
                                        <strong className={`block mb-1 text-[9px] uppercase tracking-wider ${isNguyCap ? 'text-red-800' : (isCanhBao ? 'text-amber-800' : 'text-sky-800')}`}>
                                            ⚙️ Biện pháp xử lý kỹ thuật:
                                        </strong>
                                        <p className="text-slate-600 font-bold">{log.action}</p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Drawer Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400 leading-normal flex-shrink-0">
                    Mức độ: <span className="text-sky-600 font-bold">Xanh dương</span> cho Theo dõi, <span className="text-amber-600 font-bold">Vàng</span> cho Cảnh báo thông số suy giảm, và <span className="text-red-600 font-bold">Đỏ</span> cho Nguy cấp đe dọa dừng đài.
                </div>
            </div>
        </>
    );
}
