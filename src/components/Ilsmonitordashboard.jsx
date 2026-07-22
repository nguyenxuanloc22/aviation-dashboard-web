import React, { useState, useCallback, useMemo } from 'react';

// Simulation engine (pure logic, no UI)
import { runSimulation, generateSimulationLogs, computeMetrics, DEFAULT_PARAMS, removeVietnameseTones } from '../simulation/engine';
import pythonData from '../simulation/simulation_results.json';

// Modular UI components
// Modular UI components
import Toast from './ils/Toast';
import LogsDrawer from './ils/LogsDrawer';
import Topbar from './ils/Topbar';
import Sidebar from './ils/Sidebar';
import KpiCards from './ils/KpiCards';
import ChartViewToolbar from './ils/ChartViewToolbar';
import ChartsArea from './ils/ChartsArea';
import AirportInfoPanel from './ils/AirportInfoPanel';

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
//  MAIN DASHBOARD
// ============================================================
export default function ILSMonitorDashboard() {
    const [dataSourceMode, setDataSourceMode] = useState('python'); // 'python' | 'interactive'
    const [formParams, setFormParams] = useState({ ...DEFAULT_PARAMS });
    const [activeParams, setActiveParams] = useState({ ...DEFAULT_PARAMS });
    const [toasts, setToasts] = useState([]);
    const [pendingToast, setPendingToast] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [showLogsDrawer, setShowLogsDrawer] = useState(false);

    // Sidebar Accordions State
    const [expandedSections, setExpandedSections] = useState({
        basic: true,
        degradation: false,
        weather: false,
        weibull: false,
        lstm: false,
        vswr: false
    });

    // Logs Drawer State
    const [logSearchQuery, setLogSearchQuery] = useState('');
    const [logFilter, setLogFilter] = useState('all'); // 'all', 'critical', 'warning'
    const [logSortOrder, setLogSortOrder] = useState('day-asc'); // 'day-asc', 'severity-crit', 'severity-warn'
    const [copiedLogs, setCopiedLogs] = useState(false);
    const [brushRange, setBrushRange] = useState(null); // { startIndex, endIndex }


    // Chart View Mode: 'all' | 'rf' | 'health' | 'env'
    const [chartView, setChartView] = useState('all');

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    // Current parameters based on data mode
    const currentParams = useMemo(() => {
        return dataSourceMode === 'python' ? (pythonData?.params || activeParams) : activeParams;
    }, [dataSourceMode, activeParams]);

    // Run simulation with active params or use Python data
    const result = useMemo(() => {
        if (dataSourceMode === 'python' && pythonData) {
            return pythonData;
        }
        // Force 365 days internally
        const simParams = { ...activeParams, days: 365 };
        return runSimulation(simParams);
    }, [dataSourceMode, activeParams]);

    // Clamp days (N) between 1 and 365
    const N = useMemo(() => {
        return Math.min(365, Math.max(1, parseFloat(currentParams.days) || 365));
    }, [currentParams.days]);

    // Step 2: Progressive dynamic clipping filter
    const activeData = useMemo(() => {
        return result.chartData.filter(d => d.day <= N);
    }, [result.chartData, N]);

    // Step 3: Run the Rules Engine on activeData and compute metrics up to day N
    const currentMetrics = useMemo(() => {
        return computeMetrics(result.chartData, currentParams, N);
    }, [result.chartData, currentParams, N]);

    // Step 4: Dynamically scale X-Axis to fit exactly N days to fill the chart width
    const chartDataForPlotting = useMemo(() => {
        return result.chartData.filter(item => item.day <= N);
    }, [result.chartData, N]);

    const chartData = chartDataForPlotting;
    const metrics = currentMetrics;
    const { lastHI, lastRT, lastRF, warnDay90, dangerDay75, estopDay, rmse, splitIdx, firstVswrWarningDay, firstVswrCriticalDay } = metrics;

    // Reset brush range when simulation data changes
    React.useEffect(() => {
        setBrushRange(null);
    }, [result.chartData]);

    // Collapse sidebar by default on small screens
    React.useEffect(() => {
        if (window.innerWidth < 1024) {
            setIsSidebarCollapsed(true);
        }
    }, []);

    const addToast = useCallback((level, title, msg, day = null, date = null) => {
        const id = Date.now() + Math.random();
        setToasts([{ id, level, title, msg, day, date }]);
    }, []);

    const dismissToast = useCallback((id) => setToasts(p => p.filter(t => t.id !== id)), []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'days') {
            const num = parseFloat(value);
            if (!isNaN(num)) {
                if (num > 365) {
                    setFormParams(p => ({ ...p, days: '365' }));
                    return;
                }
                if (num < 1) {
                    setFormParams(p => ({ ...p, days: '1' }));
                    return;
                }
            }
        }
        setFormParams(p => ({ ...p, [name]: value }));
    };

    const handleUpdate = () => {
        if (dataSourceMode === 'python') {
            setDataSourceMode('interactive');
        }
        setIsRunning(true);
        setTimeout(() => {
            // Parse all parameter values to numeric floats before running simulation
            const parsed = {};
            Object.keys(formParams).forEach(k => {
                let val = parseFloat(formParams[k]);
                if (k === 'days') {
                    if (isNaN(val)) val = 365;
                    val = Math.min(365, Math.max(1, val));
                }
                parsed[k] = val;
            });
            // Synchronize clamped value back to form UI
            setFormParams(p => ({ ...p, days: parsed.days.toString() }));
            setActiveParams(parsed);
            setIsRunning(false);
            setPendingToast(true);
        }, 120);
    };

    // Detect if there are unsaved changes compared to the active simulation parameters
    const hasUnsavedChanges = useMemo(() => {
        return Object.keys(formParams).some(key => {
            const formVal = parseFloat(formParams[key]);
            const activeVal = parseFloat(activeParams[key]);
            if (isNaN(formVal) || isNaN(activeVal)) {
                return formParams[key] !== activeParams[key];
            }
            return formVal !== activeVal;
        });
    }, [formParams, activeParams]);

    const handleReset = () => {
        setFormParams({ ...DEFAULT_PARAMS });
        setActiveParams({ ...DEFAULT_PARAMS });
    };

    // Calculate logs based on simulation results
    const rawSimulationLogs = useMemo(() => {
        return generateSimulationLogs(activeData, currentParams);
    }, [activeData, currentParams]);

    // Filter raw simulation logs by brush zoom range
    const activeRangeLogs = useMemo(() => {
        if (!brushRange) return rawSimulationLogs;
        const startDay = chartData[brushRange.startIndex]?.day ?? 1;
        const endDay = chartData[brushRange.endIndex]?.day ?? currentParams.days;
        return rawSimulationLogs.filter(log => log.day >= startDay && log.day <= endDay);
    }, [rawSimulationLogs, brushRange, chartData, currentParams.days]);

    const criticalCount = useMemo(() => activeRangeLogs.filter(l => l.severity === 'NGUY_CAP').length, [activeRangeLogs]);
    const warningCount = useMemo(() => activeRangeLogs.filter(l => l.severity === 'CANH_BAO' || l.severity === 'THEO_DOI').length, [activeRangeLogs]);

    // Processed Warning Logs (Search + Filter + Sort + Brush)
    const filteredSortedLogs = useMemo(() => {
        let result = activeRangeLogs;

        // 1. Keyword search (accent-insensitive)
        if (logSearchQuery.trim()) {
            const queryNormalized = removeVietnameseTones(logSearchQuery.toLowerCase().trim());
            result = result.filter(log => {
                const messageNormalized = removeVietnameseTones(log.message.toLowerCase());
                const titleNormalized = removeVietnameseTones(log.title.toLowerCase());
                const dayTextNormalized = removeVietnameseTones(`ngày thứ ${log.day}`);
                return messageNormalized.includes(queryNormalized) || titleNormalized.includes(queryNormalized) || dayTextNormalized.includes(queryNormalized);
            });
        }

        // 2. Tab Filter
        if (logFilter === 'critical') {
            result = result.filter(log => log.severity === 'NGUY_CAP');
        } else if (logFilter === 'warning') {
            result = result.filter(log => log.severity === 'CANH_BAO' || log.severity === 'THEO_DOI');
        }

        // 3. Sorting logic
        const sorted = [...result];
        if (logSortOrder === 'day-asc') {
            sorted.sort((a, b) => a.day - b.day);
        } else if (logSortOrder === 'day-desc') {
            sorted.sort((a, b) => b.day - a.day);
        } else if (logSortOrder === 'severity-crit') {
            sorted.sort((a, b) => {
                if (a.severity === b.severity) return a.day - b.day;
                const rank = { NGUY_CAP: 3, CANH_BAO: 2, THEO_DOI: 1 };
                return (rank[b.severity] || 0) - (rank[a.severity] || 0);
            });
        } else if (logSortOrder === 'severity-warn') {
            sorted.sort((a, b) => {
                if (a.severity === b.severity) return a.day - b.day;
                const rank = { THEO_DOI: 3, CANH_BAO: 2, NGUY_CAP: 1 };
                return (rank[b.severity] || 0) - (rank[a.severity] || 0);
            });
        }

        return sorted;
    }, [activeRangeLogs, logSearchQuery, logFilter, logSortOrder]);

    // Copy formatted logs to clipboard
    const handleCopyLogs = useCallback(() => {
        if (filteredSortedLogs.length === 0) return;

        let text = `NHẬT KÝ CẢNH BÁO MÔ PHỎNG HỆ THỐNG ILS\n`;
        text += `Chu kỳ mô phỏng: ${currentParams.days} ngày | Sai số RMSE: ${rmse.toFixed(3)}%\n`;

        let filterSummary = 'Tất cả';
        if (logFilter === 'critical') filterSummary = 'Chỉ mục Nguy cấp';
        if (logFilter === 'warning') filterSummary = 'Chỉ mục Cảnh báo';
        if (logSearchQuery.trim()) filterSummary += ` + Tìm kiếm: "${logSearchQuery}"`;

        let sortSummary = 'Ngày tăng dần';
        if (logSortOrder === 'day-desc') sortSummary = 'Ngày giảm dần';
        if (logSortOrder === 'severity-crit') sortSummary = 'Nguy cấp trước';
        if (logSortOrder === 'severity-warn') sortSummary = 'Cảnh báo trước';

        text += `Bộ lọc áp dụng: ${filterSummary} | Sắp xếp: ${sortSummary}\n`;
        text += `Số lượng sự cố sao chép: ${filteredSortedLogs.length}/${rawSimulationLogs.length}\n`;
        text += `--------------------------------------------------\n\n`;

        filteredSortedLogs.forEach(log => {
            const levelStr = log.severity === 'NGUY_CAP' ? '[NGUY CẤP]' : (log.severity === 'CANH_BAO' ? '[CẢNH BÁO]' : '[THEO DÕI]');
            text += `Ngày thứ ${log.day} - ${levelStr} - ${log.title}\n`;
            text += `  Chi tiết: ${log.message}\n`;
            text += `  Xử lý: ${log.action}\n\n`;
        });

        navigator.clipboard.writeText(text)
            .then(() => {
                setCopiedLogs(true);
                setTimeout(() => setCopiedLogs(false), 2000);
            })
            .catch(err => console.error('Lỗi khi sao chép:', err));
    }, [filteredSortedLogs, rawSimulationLogs.length, activeParams.days, rmse, logFilter, logSearchQuery, logSortOrder]);

    // Trigger smart scan alert toast on metrics or day configuration changes
    // Trigger smart scan alert toast ONLY when pendingToast flag is active (e.g. from handleUpdate)
    React.useEffect(() => {
        if (!pendingToast) return;
        setPendingToast(false); // Reset the trigger

        const baseRF = currentParams.baselineRF || 100.0;
        const warnRF = currentParams.warningThreshold || 92.0;
        const alarmRF = currentParams.alarmThreshold || 88.0;
        const healthFloor = 85.0;

        const hiWarningThreshold = (warnRF - healthFloor) / (baseRF - healthFloor);
        const hiAlarmThreshold = (alarmRF - healthFloor) / (baseRF - healthFloor);

        const events = [];
        if (metrics.warnDay90) {
            events.push({
                day: metrics.warnDay90,
                level: 'info',
                title: 'Thông báo: R(t) suy giảm',
                msg: `Thông báo hệ thống (R(t) < 0.90 nhưng RF >= ${warnRF}%): Chưa sửa ngay; tăng theo dõi, kiểm tra định kỳ sớm hơn.`
            });
        }
        if (metrics.firstWarningDay) {
            const warnEventData = chartData[metrics.firstWarningDay - 1];
            const rtValue = warnEventData ? warnEventData.rt : 0;
            const rtFormatted = rtValue.toLocaleString('vi-VN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
            const warnDateStr = formatDayToDate(metrics.firstWarningDay);
            const shortWarnDate = warnDateStr ? warnDateStr.split('/').slice(0, 2).map(d => parseInt(d, 10)).join('/') : '';
            
            events.push({
                day: metrics.firstWarningDay,
                level: 'warning',
                title: 'Chạm ngưỡng cảnh báo',
                msg: `Cảnh báo R(t) chạm ngưỡng cảnh báo: R(t)=${rtFormatted} vào ngày ${shortWarnDate} (ngày ${metrics.firstWarningDay})-Lập kế hoạch bảo trì hệ thống tổng thể, rà soát lại cấu hình vận hành để tìm nguyên nhân suy hao`
            });
        }
        if (metrics.firstCriticalDay) {
            events.push({
                day: metrics.firstCriticalDay,
                level: 'critical',
                title: 'Nguy cấp: Cần bảo dưỡng gấp',
                msg: `Nguy hiểm hệ thống (RF < ${alarmRF}% hoặc HI < ${hiAlarmThreshold.toFixed(3)}): Vùng nguy hiểm; cần kiểm tra kỹ thuật khẩn cấp.`
            });
        }
        if (metrics.firstVswrWarningDay) {
            events.push({
                day: metrics.firstVswrWarningDay,
                level: 'warning',
                title: 'Cảnh báo: Tăng VSWR',
                msg: `Cảnh báo sóng đứng (VSWR >= ${(currentParams.vswrWarningThreshold || 1.5).toFixed(2)}): Kiểm tra đường truyền RF: cáp, anten, connector.`
            });
        }
        if (metrics.firstVswrCriticalDay) {
            events.push({
                day: metrics.firstVswrCriticalDay,
                level: 'critical',
                title: 'Nguy cấp: Lỗi sóng đứng VSWR',
                msg: `Nguy hiểm sóng đứng (VSWR >= ${(currentParams.vswrAlarmThreshold || 2.0).toFixed(2)}): Nguy cơ mismatch nghiêm trọng; cần ưu tiên xử lý đường truyền RF.`
            });
        }

        // Sort events by severity (critical > warning > info), then chronologically
        events.sort((a, b) => {
            const severityRank = { 'critical': 3, 'warning': 2, 'info': 1 };
            const rankA = severityRank[a.level] || 0;
            const rankB = severityRank[b.level] || 0;
            if (rankA !== rankB) return rankB - rankA;
            return a.day - b.day;
        });

        if (events.length > 0) {
            const firstEvent = events[0];
            const dateStr = formatDayToDate(firstEvent.day);
            addToast(
                firstEvent.level,
                firstEvent.title,
                firstEvent.msg,
                firstEvent.day,
                dateStr
            );
        } else {
            addToast(
                'success',
                'Mọi thứ hoạt động trơn tru!',
                'Hệ thống vận hành an toàn. Không phát hiện nguy cơ chạm ngưỡng nguy hiểm trong chu kỳ mô phỏng.',
                null,
                null
            );
        }
    }, [metrics, currentParams, pendingToast]);

    // Clear alert when data source mode changes (prevents modals from persisting)
    React.useEffect(() => {
        setToasts([]);
    }, [dataSourceMode]);

    return (
        <div className="min-h-screen bg-[#F0F5FA] text-slate-800 font-sans flex flex-col">
            <style>{`
                @keyframes toastIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes modalIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                @keyframes shrinkBar { from { width: 100%; } to { width: 0%; } }
                @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
                input[type=number]::-webkit-inner-spin-button { opacity:0.3; }
                input[type=number]:focus { border-color:#3b82f6 !important; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15); }
                ::-webkit-scrollbar { width:6px; height:6px; } 
                ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:4px; }
                ::-webkit-scrollbar-track { background:#f1f5f9; }
            `}</style>

            {/* Toast Notifications */}
            <Toast toasts={toasts} onDismiss={dismissToast} />

            {/* Warning Logs Drawer (backdrop + panel) */}
            <LogsDrawer
                showLogsDrawer={showLogsDrawer}
                setShowLogsDrawer={setShowLogsDrawer}
                rawSimulationLogs={rawSimulationLogs}
                filteredSortedLogs={filteredSortedLogs}
                activeRangeLogs={activeRangeLogs}
                criticalCount={criticalCount}
                warningCount={warningCount}
                logSearchQuery={logSearchQuery}
                setLogSearchQuery={setLogSearchQuery}
                logFilter={logFilter}
                setLogFilter={setLogFilter}
                logSortOrder={logSortOrder}
                setLogSortOrder={setLogSortOrder}
                copiedLogs={copiedLogs}
                handleCopyLogs={handleCopyLogs}
                brushRange={brushRange}
                setBrushRange={setBrushRange}
                chartData={chartData}
            />

            {/* Topbar / Taskbar */}
            <Topbar
                criticalCount={criticalCount}
                warningCount={warningCount}
                rawSimulationLogs={rawSimulationLogs}
                activeRangeLogs={activeRangeLogs}
                brushRange={brushRange}
                setShowLogsDrawer={setShowLogsDrawer}
                handleUpdate={handleUpdate}
                isRunning={isRunning}
                hasUnsavedChanges={dataSourceMode === 'python' ? false : hasUnsavedChanges}
                isSidebarCollapsed={isSidebarCollapsed}
                setIsSidebarCollapsed={setIsSidebarCollapsed}
                dataSourceMode={dataSourceMode}
                setDataSourceMode={setDataSourceMode}
            />

            <div className="flex flex-1 overflow-hidden relative">

                {/* Mobile Sidebar Backdrop Overlay */}
                {!isSidebarCollapsed && (
                    <div
                        className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden"
                        onClick={() => setIsSidebarCollapsed(true)}
                    />
                )}

                {/* Sidebar with Accordion Parameter Panels */}
                <Sidebar
                    isSidebarCollapsed={isSidebarCollapsed}
                    setIsSidebarCollapsed={setIsSidebarCollapsed}
                    expandedSections={expandedSections}
                    toggleSection={toggleSection}
                    formParams={dataSourceMode === 'python' ? (pythonData?.params || DEFAULT_PARAMS) : formParams}
                    handleChange={handleChange}
                    handleReset={handleReset}
                    hasUnsavedChanges={dataSourceMode === 'python' ? false : hasUnsavedChanges}
                    readOnly={dataSourceMode === 'python'}
                />

                {/* MAIN CHARTS AREA */}
                <main className="flex-1 overflow-y-auto p-6 space-y-6 min-w-0">

                    {/* KPI Summary Row */}
                    <KpiCards
                        lastRF={lastRF}
                        lastHI={lastHI}
                        lastRT={lastRT}
                        activeParams={currentParams}
                        metrics={metrics}
                    />

                    {/* Airport and ILS Specifications Panel */}
                    <AirportInfoPanel />

                    {/* Chart View Toggle Toolbar */}
                    <ChartViewToolbar chartView={chartView} setChartView={setChartView} />

                    {/* Conditional Charts */}
                    <ChartsArea
                        chartView={chartView}
                        chartData={chartData}
                        activeParams={currentParams}
                        splitIdx={splitIdx}
                        dangerDay75={dangerDay75}
                        brushRange={brushRange}
                        setBrushRange={setBrushRange}
                        metrics={metrics}
                    />

                </main>
            </div>
        </div>
    );
}