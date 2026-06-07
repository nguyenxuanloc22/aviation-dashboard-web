import { Activity, RefreshCw, Calendar, Info, TrendingDown, ChevronDown } from 'lucide-react';

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
        <header className="bg-white border-b border-slate-200 h-14 flex items-center pr-6 gap-3 flex-shrink-0 shadow-sm z-10">
            {/* Brand Logo & Name Box in Soft Sea Blue */}
            <div className="bg-[#E2EFFC] border-r border-blue-200/50 px-5 h-full flex items-center gap-3 flex-shrink-0 rounded-r-xl shadow-xs">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-base font-bold shadow-md shadow-blue-200 flex-shrink-0">
                    <Activity size={18} />
                </div>
                <div className="min-w-0">
                    <span className="block text-xs font-extrabold text-blue-900 tracking-wider uppercase truncate">Hệ Thống Giám Sát ILS</span>
                    <span className="block text-[9px] font-bold text-blue-700 tracking-wide truncate">Mạng LSTM + Weibull</span>
                </div>
            </div>

            <div className="min-w-0 hidden lg:block">
                <span className="block text-[10px] text-slate-500 font-medium">Giám sát & dự báo bảo trì thiết bị đài dẫn đường hàng không</span>
            </div>

            <div className="flex-1" />

            {/* Actions Section in Header Right */}
            <div className="flex items-center gap-2.5 flex-shrink-0">

                {/* Forecast Milestones Dropdown Button */}
                <div className="relative hidden sm:block">
                    <button
                        onClick={() => { setShowMilestonesDropdown(v => !v); setPulseMilestones(false); }}
                        className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 relative ${
                            pulseMilestones
                                ? 'bg-violet-50 border-violet-300 text-violet-700 shadow-md shadow-violet-100 animate-pulse ring-2 ring-violet-300 ring-offset-1'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                    >
                        <TrendingDown size={14} className={pulseMilestones ? 'text-violet-600' : 'text-slate-500'} />
                        <span>Mốc dự báo</span>
                        {pulseMilestones && (
                            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500" />
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
                            <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-[51] overflow-hidden">
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
                                            val: warnDay90 ? `Ngày thứ ${warnDay90}` : 'Không chạm',
                                            hit: !!warnDay90,
                                            color: 'amber',
                                            desc: 'Độ tin cậy bắt đầu suy giảm — cần lên kế hoạch bảo trì phòng ngừa.',
                                        },
                                        {
                                            label: 'R(t) < 75% (nguy hiểm)',
                                            val: dangerDay75 ? `Ngày thứ ${dangerDay75}` : 'Không chạm',
                                            hit: !!dangerDay75,
                                            color: 'red',
                                            desc: 'Hệ thống tiếp cận ngưỡng nguy hiểm — nguy cơ hỏng hóc cao.',
                                        },
                                        {
                                            label: 'RF dưới ngưỡng dừng đài',
                                            val: estopDay ? `Ngày thứ ${estopDay}` : 'Không chạm',
                                            hit: !!estopDay,
                                            color: 'red',
                                            desc: `Công suất phát RF sẽ rơi xuống dưới ${activeParams.alarmThreshold}% — cần dừng đài khẩn cấp.`,
                                        },
                                        {
                                            label: 'Bắt đầu dự báo AI (LSTM)',
                                            val: `Ngày thứ ${splitIdx + 1}`,
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
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-semibold text-slate-700">{item.label}</span>
                                                <span className={`font-extrabold text-[10px] px-1.5 py-0.5 rounded ${
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
