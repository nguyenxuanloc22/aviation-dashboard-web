import React, { useState, useCallback, useMemo } from 'react';

// Simulation engine (pure logic, no UI)
import { runSimulation, generateSimulationLogs, DEFAULT_PARAMS, removeVietnameseTones } from '../simulation/engine';

// Modular UI components
import Toast            from './ils/Toast';
import LogsDrawer       from './ils/LogsDrawer';
import Topbar           from './ils/Topbar';
import Sidebar          from './ils/Sidebar';
import KpiCards         from './ils/KpiCards';
import ChartViewToolbar from './ils/ChartViewToolbar';
import ChartsArea       from './ils/ChartsArea';

// ============================================================
//  MAIN DASHBOARD
// ============================================================
export default function ILSMonitorDashboard() {
    const [formParams, setFormParams] = useState({ ...DEFAULT_PARAMS });
    const [activeParams, setActiveParams] = useState({ ...DEFAULT_PARAMS });
    const [toasts, setToasts] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [showLogsDrawer, setShowLogsDrawer] = useState(false);

    // Sidebar Accordions State
    const [expandedSections, setExpandedSections] = useState({
        basic: true,
        degradation: false,
        weather: false,
        weibull: false,
        lstm: false
    });

    // Logs Drawer State
    const [logSearchQuery, setLogSearchQuery] = useState('');
    const [logFilter, setLogFilter] = useState('all'); // 'all', 'critical', 'warning'
    const [logSortOrder, setLogSortOrder] = useState('day-asc'); // 'day-asc', 'severity-crit', 'severity-warn'
    const [copiedLogs, setCopiedLogs] = useState(false);
    const [brushRange, setBrushRange] = useState(null); // { startIndex, endIndex }

    // Forecast Milestones Dropdown State
    const [showMilestonesDropdown, setShowMilestonesDropdown] = useState(false);
    const [pulseMilestones, setPulseMilestones] = useState(false);

    // Chart View Mode: 'all' | 'rf' | 'health' | 'env' | 'formula'
    const [chartView, setChartView] = useState('all');

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    // Run simulation with active params
    const result = useMemo(() => runSimulation(activeParams), [activeParams]);
    const { chartData, metrics } = result;
    const { lastHI, lastRT, lastRF, warnDay90, dangerDay75, estopDay, rmse, splitIdx } = metrics;

    // Reset brush range when simulation data changes
    React.useEffect(() => {
        setBrushRange(null);
    }, [chartData]);

    const addToast = useCallback((level, title, msg) => {
        const id = Date.now() + Math.random();
        setToasts(p => [...p, { id, level, title, msg }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 8000);
    }, []);

    const dismissToast = useCallback((id) => setToasts(p => p.filter(t => t.id !== id)), []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Keep the raw string value to support decimal points and minus signs during typing
        setFormParams(p => ({ ...p, [name]: value }));
    };

    const handleUpdate = () => {
        setIsRunning(true);
        setTimeout(() => {
            // Parse all parameter values to numeric floats before running simulation
            const parsed = {};
            Object.keys(formParams).forEach(k => {
                parsed[k] = parseFloat(formParams[k]);
            });
            setActiveParams(parsed);
            setIsRunning(false);
            // Pulse the milestones button to hint user to check updated values
            setPulseMilestones(true);
            setTimeout(() => setPulseMilestones(false), 5000);
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
        return generateSimulationLogs(chartData, activeParams);
    }, [chartData, activeParams]);

    // Filter raw simulation logs by brush zoom range
    const activeRangeLogs = useMemo(() => {
        if (!brushRange) return rawSimulationLogs;
        const startDay = chartData[brushRange.startIndex]?.day ?? 1;
        const endDay = chartData[brushRange.endIndex]?.day ?? activeParams.days;
        return rawSimulationLogs.filter(log => log.day >= startDay && log.day <= endDay);
    }, [rawSimulationLogs, brushRange, chartData, activeParams.days]);

    const criticalCount = useMemo(() => activeRangeLogs.filter(l => l.type === 'critical').length, [activeRangeLogs]);
    const warningCount = useMemo(() => activeRangeLogs.filter(l => l.type === 'warning').length, [activeRangeLogs]);

    // Processed Warning Logs (Search + Filter + Sort + Brush)
    const filteredSortedLogs = useMemo(() => {
        let result = activeRangeLogs;

        // 1. Keyword search (accent-insensitive)
        if (logSearchQuery.trim()) {
            const queryNormalized = removeVietnameseTones(logSearchQuery.toLowerCase().trim());
            result = result.filter(log => {
                const messageNormalized = removeVietnameseTones(log.message.toLowerCase());
                const dayTextNormalized = removeVietnameseTones(`ngày thứ ${log.day}`);
                return messageNormalized.includes(queryNormalized) || dayTextNormalized.includes(queryNormalized);
            });
        }

        // 2. Tab Filter
        if (logFilter !== 'all') {
            result = result.filter(log => log.type === logFilter);
        }

        // 3. Sorting logic
        const sorted = [...result];
        if (logSortOrder === 'day-asc') {
            sorted.sort((a, b) => a.day - b.day);
        } else if (logSortOrder === 'day-desc') {
            sorted.sort((a, b) => b.day - a.day);
        } else if (logSortOrder === 'severity-crit') {
            sorted.sort((a, b) => {
                if (a.type === b.type) return a.day - b.day;
                return a.type === 'critical' ? -1 : 1;
            });
        } else if (logSortOrder === 'severity-warn') {
            sorted.sort((a, b) => {
                if (a.type === b.type) return a.day - b.day;
                return a.type === 'warning' ? -1 : 1;
            });
        }

        return sorted;
    }, [activeRangeLogs, logSearchQuery, logFilter, logSortOrder]);

    // Copy formatted logs to clipboard
    const handleCopyLogs = useCallback(() => {
        if (filteredSortedLogs.length === 0) return;
        
        let text = `NHẬT KÝ CẢNH BÁO MÔ PHỎNG HỆ THỐNG ILS\n`;
        text += `Chu kỳ mô phỏng: ${activeParams.days} ngày | Sai số RMSE: ${rmse.toFixed(3)}%\n`;
        
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
            const levelStr = log.type === 'critical' ? '[NGUY CẤP]' : '[CẢNH BÁO]';
            text += `Ngày thứ ${log.day} - ${levelStr}: ${log.message}\n`;
        });

        navigator.clipboard.writeText(text)
            .then(() => {
                setCopiedLogs(true);
                setTimeout(() => setCopiedLogs(false), 2000);
            })
            .catch(err => console.error('Lỗi khi sao chép:', err));
    }, [filteredSortedLogs, rawSimulationLogs.length, activeParams.days, rmse, logFilter, logSearchQuery, logSortOrder]);

    // Trigger smart scan alert toast on metrics or day configuration changes
    React.useEffect(() => {
        setToasts([]); // Clear old alerts
        
        const { firstCriticalDay } = metrics;
        if (firstCriticalDay) {
            addToast(
                'critical', 
                'Cảnh báo chạm ngưỡng nguy hiểm', 
                `⚠️ CẢNH BÁO: Thiết bị sẽ chạm mức nguy hiểm vào Ngày thứ ${firstCriticalDay}. Yêu cầu lập kế hoạch thay thế hoặc kích hoạt hệ thống dự phòng!`
            );
        } else {
            addToast(
                'info',
                'Hệ thống vận hành an toàn',
                `✓ THÔNG TIN: Không phát hiện nguy cơ chạm ngưỡng nguy hiểm trong chu kỳ mô phỏng ${activeParams.days} ngày.`
            );
        }
    }, [metrics, activeParams.days]);

    return (
        <div className="min-h-screen bg-[#F0F5FA] text-slate-800 font-sans flex flex-col">
            <style>{`
                @keyframes toastIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
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
                showMilestonesDropdown={showMilestonesDropdown}
                setShowMilestonesDropdown={setShowMilestonesDropdown}
                pulseMilestones={pulseMilestones}
                setPulseMilestones={setPulseMilestones}
                warnDay90={warnDay90}
                dangerDay75={dangerDay75}
                estopDay={estopDay}
                splitIdx={splitIdx}
                activeParams={activeParams}
                criticalCount={criticalCount}
                warningCount={warningCount}
                rawSimulationLogs={rawSimulationLogs}
                activeRangeLogs={activeRangeLogs}
                brushRange={brushRange}
                setShowLogsDrawer={setShowLogsDrawer}
                handleUpdate={handleUpdate}
                isRunning={isRunning}
                hasUnsavedChanges={hasUnsavedChanges}
            />

            <div className="flex flex-1 overflow-hidden relative">

                {/* Sidebar with Accordion Parameter Panels */}
                <Sidebar
                    isSidebarCollapsed={isSidebarCollapsed}
                    setIsSidebarCollapsed={setIsSidebarCollapsed}
                    expandedSections={expandedSections}
                    toggleSection={toggleSection}
                    formParams={formParams}
                    handleChange={handleChange}
                    handleReset={handleReset}
                    hasUnsavedChanges={hasUnsavedChanges}
                />

                {/* MAIN CHARTS AREA */}
                <main className="flex-1 overflow-y-auto p-6 space-y-6 min-w-0">
                    
                    {/* KPI Summary Row */}
                    <KpiCards
                        lastRF={lastRF}
                        lastHI={lastHI}
                        lastRT={lastRT}
                        activeParams={activeParams}
                        metrics={metrics}
                    />

                    {/* Chart View Toggle Toolbar */}
                    <ChartViewToolbar chartView={chartView} setChartView={setChartView} />

                    {/* Conditional Charts */}
                    <ChartsArea
                        chartView={chartView}
                        chartData={chartData}
                        activeParams={activeParams}
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