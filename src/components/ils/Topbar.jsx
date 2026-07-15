import { Activity, RefreshCw, Calendar, Info, TrendingDown, ChevronDown, Sliders, Database, Zap } from 'lucide-react';

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
    criticalCount,
    warningCount,
    rawSimulationLogs,
    activeRangeLogs,
    brushRange,
    setShowLogsDrawer,
    handleUpdate,
    isRunning,
    hasUnsavedChanges,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    dataSourceMode,
    setDataSourceMode,
}) {
    return (
        <header className="bg-white border-b border-sky-100 px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm z-30 relative">
            <div className="flex items-center gap-3">
                <button 
                    onClick={() => setIsSidebarCollapsed(prev => !prev)}
                    className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl lg:hidden flex items-center justify-center cursor-pointer shadow-xs"
                    title={isSidebarCollapsed ? "Mở bảng cấu hình" : "Đóng bảng cấu hình"}
                >
                    <Sliders size={18} />
                </button>
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

                {/* Data Source Mode Toggle Switch */}
                <div className="flex bg-[#F1F5F9] p-0.5 rounded-lg border border-sky-100 shadow-xs">
                    <button
                        onClick={() => setDataSourceMode('python')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-extrabold transition-all cursor-pointer ${
                            dataSourceMode === 'python'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                        title="Hiển thị dữ liệu kiểm định chính xác tuyệt đối được kết xuất trực tiếp từ thuật toán Python"
                    >
                        <Database size={12} />
                        <span>Dữ liệu Python (Chuẩn)</span>
                    </button>
                    <button
                        onClick={() => setDataSourceMode('interactive')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-extrabold transition-all cursor-pointer ${
                            dataSourceMode === 'interactive'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                        title="Chạy mô phỏng tương tác thời gian thực và cho phép thay đổi tham số đầu vào"
                    >
                        <Zap size={12} />
                        <span>Mô phỏng cát (Sandbox)</span>
                    </button>
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
