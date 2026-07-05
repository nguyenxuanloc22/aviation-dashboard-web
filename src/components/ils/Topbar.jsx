import { Activity, RefreshCw, Calendar, Info, TrendingDown, ChevronDown } from 'lucide-react';

// Helper to convert day index (1-365) to solar calendar date DD/MM/YYYY in 2026
const formatDayToDate = (day) => {
    if (!day) return '';
    const date = new Date(2026, 0, 1);
    date.setDate(date.getDate() + (day - 1));
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
};

// ============================================================
//  TOPBAR / TASKBAR
//  Props:
//    showMilestonesDropdown, setShowMilestonesDropdown
//    pulseMilestones, setPulseMilestones
//    warnDay90, dangerDay75, estopDay, splitIdx
//    activeParams
//    criticalCount, warningCount
//    rawSimulationLogs, activeRangeLogs
//    brushRange
//    setShowLogsDrawer
//    handleUpdate, isRunning, hasUnsavedChanges
// ============================================================
export default function Topbar({
    showMilestonesDropdown,
    setShowMilestonesDropdown,
    pulseMilestones,
    setPulseMilestones,
    warnDay90,
    dangerDay75,
    estopDay,
    splitIdx,
    activeParams,
    criticalCount,
    warningCount,
    rawSimulationLogs,
    activeRangeLogs,
    brushRange,
    setShowLogsDrawer,
    handleUpdate,
    isRunning,
    hasUnsavedChanges,
}) {
    return (
        <header className="bg-white border-b border-sky-100 px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm z-30 relative">
            <div className="flex items-center gap-3">
                <div className="bg-blue-600 text-white p-2 rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center">
                    <Activity size={20} className="animate-[pulse_2s_infinite]" />
                </div>
                <div>
                    <h1 className="text-sm font-black text-slate-800 tracking-wide flex items-center gap-1.5 uppercase">
                        Hệ thống giám sát ILS
                        <span className="text-[9px] bg-sky-50 text-blue-600 border border-blue-100 rounded px-1.5 py-0.5 tracking-normal">
                            Mạng LSTM + Weibull
                        </span>
                    </h1>
                    <p className="text-[10px] text-slate-400 font-bold tracking-wider mt-0.5 uppercase">
                        Giám sát &amp; dự báo bảo trì thiết bị đài dẫn đường hàng không
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">

                {/* Forecast Milestones Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => { setShowMilestonesDropdown(v => !v); setPulseMilestones(false); }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                            pulseMilestones
                                ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-500/20 animate-pulse'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                    >
                        <Calendar size={14} />
                        <span>Mốc dự báo</span>
                        {pulseMilestones && (
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                            </span>
                        )}
                        <ChevronDown size={12} className={`transition-transform duration-200 ${showMilestonesDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Panel */}
                    {showMilestonesDropdown && (
                        <>
                            {/* Click-outside backdrop */}
                            <div
                                className="fixed inset-0 z-[50]"
                                onClick={() => setShowMilestonesDropdown(false)}
                            />
                            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-[51] overflow-hidden">
                                {/* Dropdown Header */}
                                <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-100 flex items-center gap-2">
                                    <TrendingDown size={14} className="text-blue-600" />
                                    <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Mốc sự kiện dự báo</span>
                                </div>
                                {/* Milestones List */}
                                <div className="p-3 space-y-2">
                                    {[
                                        {
                                            label: 'R(t) < 90% lần đầu',
                                            val: warnDay90 ? `${formatDayToDate(warnDay90)} (Ngày thứ ${warnDay90})` : 'Không chạm',
                                            hit: !!warnDay90,
                                            color: 'amber',
                                            desc: 'Độ tin cậy bắt đầu suy giảm — cần lên kế hoạch bảo trì phòng ngừa.',
                                        },
                                        {
                                            label: 'R(t) < 75% (nguy hiểm)',
                                            val: dangerDay75 ? `${formatDayToDate(dangerDay75)} (Ngày thứ ${dangerDay75})` : 'Không chạm',
                                            hit: !!dangerDay75,
                                            color: 'red',
                                            desc: 'Hệ thống tiếp cận ngưỡng nguy hiểm — nguy cơ hỏng hóc cao.',
                                        },
                                        {
                                            label: 'RF dưới ngưỡng dừng đài',
                                            val: estopDay ? `${formatDayToDate(estopDay)} (Ngày thứ ${estopDay})` : 'Không chạm',
                                            hit: !!estopDay,
                                            color: 'red',
                                            desc: `Công suất phát RF sẽ rơi xuống dưới ${activeParams.alarmThreshold}% — cần dừng đài khẩn cấp.`,
                                        },
                                        {
                                            label: 'Bắt đầu dự báo AI (LSTM)',
                                            val: `${formatDayToDate(splitIdx + 1)} (Ngày thứ ${splitIdx + 1})`,
                                            hit: true,
                                            color: 'violet',
                                            desc: 'Mạng LSTM bắt đầu dự báo thay thế dữ liệu thực tế từ mốc này.',
                                        },
                                    ].map((item) => (
                                        <div
                                            key={item.label}
                                            className={`rounded-lg p-2.5 border text-[11px] ${
                                                item.color === 'red'    ? 'bg-red-50 border-red-100' :
                                                item.color === 'amber' ? 'bg-amber-50 border-amber-100' :
                                                item.color === 'violet'? 'bg-violet-50 border-violet-100' :
                                                'bg-slate-50 border-slate-100'
                                            }`}
                                        >
                                            <div className="flex flex-col gap-1 mb-1">
                                                <span className="font-semibold text-slate-700">{item.label}</span>
                                                <span className={`font-extrabold text-[10px] px-1.5 py-0.5 rounded self-start ${
                                                    item.color === 'red'    ? 'text-red-700 bg-red-100' :
                                                    item.color === 'amber' ? 'text-amber-700 bg-amber-100' :
                                                    item.color === 'violet'? 'text-violet-700 bg-violet-100' :
                                                    'text-slate-600 bg-slate-100'
                                                }`}>{item.val}</span>
                                            </div>
                                            <p className="text-slate-500 leading-relaxed">{item.desc}</p>
                                        </div>
                                    ))}
                                </div>
                                {/* Dropdown Footer */}
                                <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 text-[9px] text-slate-400 italic flex items-center gap-1">
                                    <Info size={10} className="flex-shrink-0" />
                                    Được quét tự động theo cấu hình mô phỏng hiện tại.
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Warning Logs Drawer Trigger Button */}
                <button 
                    onClick={() => setShowLogsDrawer(true)}
                    className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        criticalCount > 0 
                            ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100/70 shadow-sm shadow-red-50' 
                            : warningCount > 0
                            ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100/70 shadow-sm shadow-amber-50'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    <Calendar size={14} />
                    <span>Nhật ký cảnh báo {rawSimulationLogs.length > 0 && (
                        brushRange 
                            ? `(${activeRangeLogs.length}/${rawSimulationLogs.length})`
                            : `(${rawSimulationLogs.length})`
                    )}</span>
                </button>

                {/* Update Simulation Button */}
                <button 
                    onClick={handleUpdate} 
                    disabled={isRunning}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                        hasUnsavedChanges 
                            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-200 animate-pulse ring-2 ring-amber-300 ring-offset-1' 
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200'
                    }`}
                >
                    {isRunning ? (
                        <>
                            <RefreshCw size={12} className="animate-spin" />
                            <span>Đang chạy...</span>
                        </>
                    ) : (
                        <>
                            <RefreshCw size={12} />
                            <span>Cập nhật mô phỏng</span>
                        </>
                    )}
                </button>
            </div>
        </header>
    );
}
