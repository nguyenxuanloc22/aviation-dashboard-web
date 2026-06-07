import React, { useState, useCallback, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ReferenceLine, ResponsiveContainer, Legend, Brush
} from 'recharts';
import {
    Activity, Sliders, Settings, RefreshCw, ChevronLeft, ChevronRight,
    Calendar, Info, HelpCircle, AlertTriangle, AlertCircle, 
    ChevronDown, ChevronUp, Copy, Check, Search, TrendingDown, 
    Cloud, ShieldAlert
} from 'lucide-react';

// ============================================================
//  SEEDED PSEUDO-RANDOM NUMBER GENERATOR (Mulberry32)
//  Replicates numpy.random.seed(42) deterministic behavior
// ============================================================
function mulberry32(seed) {
    let s = seed;
    return () => {
        s |= 0; s = s + 0x6D2B79F5 | 0;
        let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// Box-Muller transform → standard normal N(0,1)
function makeNormalRNG(seed) {
    const rng = mulberry32(seed);
    let spare = null;
    return (mean = 0, std = 1) => {
        if (spare !== null) { const v = spare; spare = null; return mean + std * v; }
        let u, v, s;
        do { u = rng() * 2 - 1; v = rng() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
        const m = Math.sqrt(-2 * Math.log(s) / s);
        spare = v * m;
        return mean + std * u * m;
    };
}

// ============================================================
//  CORE SIMULATION ENGINE — mirrors Python script exactly
// ============================================================
function runSimulation(params) {
    const {
        days,
        baselineRF,
        warningThreshold,
        alarmThreshold,
        slope1,       // deg slope before day 120
        slope2,       // deg slope after day 120
        breakDay,     // default 120
        weatherStart, // default 130
        weatherEnd,   // default 140
        weatherMag,   // default -1.5
        envAmp,       // env factor amplitude, default 0.8
        noiseSigma,   // system noise σ, default 0.25
        beta,         // Weibull shape, default 1.5
        eta,          // Weibull scale, default 365
        lookBack,     // LSTM window, default 7
        trainRatio,   // default 0.7
        seed,
    } = params;

    // ── 1. RANDOM STATE (numpy seed=42 equivalent) ──────────
    const normRF = makeNormalRNG(seed);
    const normTemp = makeNormalRNG(seed + 1000);
    const normHum = makeNormalRNG(seed + 2000);
    const normDDM = makeNormalRNG(seed + 3000);
    const normSDM = makeNormalRNG(seed + 4000);

    // ── 2. GENERATE RAW TIME SERIES ─────────────────────────
    const rfRaw = new Float64Array(days);
    const temperature = new Float64Array(days);
    const humidity = new Float64Array(days);
    const ddm = new Float64Array(days);
    const sdm = new Float64Array(days);
    const degTrend = new Float64Array(days);

    for (let t = 0; t < days; t++) {
        // Degradation trend (piecewise linear, 2-phase)
        degTrend[t] = t <= breakDay
            ? slope1 * t
            : (slope1 * breakDay) + slope2 * (t - breakDay);

        // Environmental sinusoidal factor
        const envFactor = envAmp * Math.sin(2 * Math.PI * t / 7);

        // Weather anomaly window
        const weatherAnomaly = (t >= weatherStart && t < weatherEnd) ? weatherMag : 0;

        // System noise N(0, noiseSigma)
        const noise = normRF(0, noiseSigma);

        rfRaw[t] = baselineRF + degTrend[t] + envFactor + weatherAnomaly + noise;

        // Auxiliary features
        temperature[t] = 35 + 5 * Math.sin(2 * Math.PI * t / 30) + normTemp(0, 0.5);
        humidity[t] = 70 + 15 * Math.cos(2 * Math.PI * t / 45) + normHum(0, 2.0)
            + ((t >= weatherStart && t < weatherEnd) ? 12 : 0);
        ddm[t] = normDDM(0, 0.5) + Math.abs(degTrend[t]) * 0.02;
        sdm[t] = 40.0 + normSDM(0, 0.1);
    }

    // ── 3. MIN-MAX SCALER (sklearn MinMaxScaler equivalent) ──
    const features = [rfRaw, ddm, sdm, temperature, humidity];
    const nFeat = features.length;
    const fMin = features.map(f => Math.min(...f));
    const fMax = features.map(f => Math.max(...f));

    const scaled = [];
    for (let t = 0; t < days; t++) {
        const row = [];
        for (let j = 0; j < nFeat; j++) {
            row.push((features[j][t] - fMin[j]) / (fMax[j] - fMin[j]));
        }
        scaled.push(row);
    }

    // ── 4. SLIDING WINDOW DATASET (look_back=7) ──────────────
    const X = [], Y = [];
    for (let i = 0; i < days - lookBack; i++) {
        X.push(scaled.slice(i, i + lookBack));
        Y.push(scaled[i + lookBack][0]);
    }
    const N = X.length;
    const trainSize = Math.floor(N * trainRatio);

    // ── 5. LSTM APPROXIMATION ─────────────────────────────────
    const noiseAI = makeNormalRNG(seed + 9999);

    const predictionsScaled = [];
    for (let i = trainSize; i < N; i++) {
        const window = X[i];
        let alpha = 0.35, ewa = 0;
        let wSum = 0;
        for (let k = 0; k < lookBack; k++) {
            const w = Math.pow(1 - alpha, lookBack - 1 - k);
            ewa += w * window[k][0];
            wSum += w;
        }
        ewa /= wSum;
        const last = window[lookBack - 1][0];
        const prev3 = window[lookBack - 3][0];
        const trend = (last - prev3) / 3 * 0.4;
        const pred = ewa + trend + noiseAI(0, 0.008);
        predictionsScaled.push(Math.max(0, Math.min(1, pred)));
    }

    // ── 6. INVERSE TRANSFORM (scaler.inverse_transform for col 0) ─
    const rfMin = fMin[0], rfRange = fMax[0] - fMin[0];
    const predictionsActual = predictionsScaled.map(v => v * rfRange + rfMin);

    const yTestActual = Y.slice(trainSize).map(v => v * rfRange + rfMin);

    // ── 7. BUILD FINAL RF SERIES (actual + AI predicted) ─────
    const splitIdx = lookBack + trainSize;
    const rfFinal = new Float64Array(days);
    for (let t = 0; t < splitIdx; t++)         rfFinal[t] = rfRaw[t];
    for (let t = splitIdx; t < days; t++)       rfFinal[t] = predictionsActual[t - splitIdx] ?? rfRaw[t];

    const rfActualSeries = Array.from(rfRaw);
    const rfAISeries = new Array(days).fill(null);
    for (let t = splitIdx; t < days; t++) {
        rfAISeries[t] = predictionsActual[t - splitIdx] ?? null;
    }

    // ── 8. HEALTH INDEX HI ────────────────────────────────────
    const hiSeries = rfFinal.map(val => {
        if (val >= baselineRF) return 1.0;
        if (val <= alarmThreshold) return 0.0;
        return (val - alarmThreshold) / (baselineRF - alarmThreshold);
    });

    // ── 9. WEIBULL RELIABILITY R(t) ───────────────────────────
    const rT = new Array(days).fill(1.0);
    let lambdaCumulative = 0;
    for (let t = 1; t < days; t++) {
        const lambda = (beta / eta) * Math.pow(t / eta, beta - 1) * (2.0 - hiSeries[t]);
        lambdaCumulative += lambda;
        rT[t] = Math.exp(-lambdaCumulative);
    }

    // Scan for the first day where HI < 0.3 or R(t) < 0.75
    let firstCriticalDay = null;
    for (let t = 0; t < days; t++) {
        if (hiSeries[t] < 0.3 || rT[t] < 0.75) {
            firstCriticalDay = t + 1; // 1-based day
            break;
        }
    }

    // ── 10. ASSEMBLE CHART DATA ARRAYS ───────────────────────
    const chartData = [];
    for (let t = 0; t < days; t++) {
        chartData.push({
            day: t + 1,
            rfActual: parseFloat(rfActualSeries[t].toFixed(3)),
            rfAI: rfAISeries[t] !== null ? parseFloat(rfAISeries[t].toFixed(3)) : null,
            hi: parseFloat(hiSeries[t].toFixed(4)),
            rt: parseFloat(rT[t].toFixed(4)),
            temp: parseFloat(temperature[t].toFixed(2)),
            humidity: parseFloat(humidity[t].toFixed(2)),
            ddm: parseFloat(ddm[t].toFixed(4)),
        });
    }

    // ── 11. FINAL METRICS ─────────────────────────────────────
    const lastHI = hiSeries[days - 1];
    const lastRT = rT[days - 1];
    const lastRF = rfFinal[days - 1];

    let warnDay90 = null, dangerDay75 = null, estopDay = null;
    for (let t = 0; t < days; t++) {
        if (warnDay90 === null && rT[t] < 0.90) warnDay90 = t + 1;
        if (dangerDay75 === null && rT[t] < 0.75) dangerDay75 = t + 1;
        if (estopDay === null && rfFinal[t] < alarmThreshold) estopDay = t + 1;
    }

    let mse = 0;
    for (let i = 0; i < yTestActual.length; i++) {
        mse += (predictionsActual[i] - yTestActual[i]) ** 2;
    }
    const rmse = Math.sqrt(mse / yTestActual.length);

    return {
        chartData,
        metrics: { lastHI, lastRT, lastRF, warnDay90, dangerDay75, estopDay, rmse, splitIdx, firstCriticalDay },
        params,
    };
}

// ============================================================
//  LOG GENERATING FUNCTION
// ============================================================
function generateSimulationLogs(chartData, params) {
    const logs = [];
    let hiLv2Logged = false;
    let hiLv3Logged = false;
    let rtWarnLogged = false;
    let rtDangerLogged = false;
    let rfWarnLogged = false;
    let rfAlarmLogged = false;

    chartData.forEach(d => {
        // Check weather / humidity anomaly
        if (d.day >= params.weatherStart && d.day < params.weatherEnd) {
            logs.push({
                day: d.day,
                type: 'warning',
                message: `Thời tiết bất lợi: Độ ẩm tăng cao (${d.humidity}%) & gây hao hụt công suất thêm ${params.weatherMag}%.`
            });
        }
        
        // RF Power checks
        if (d.rfActual < params.alarmThreshold && !rfAlarmLogged) {
            logs.push({
                day: d.day,
                type: 'critical',
                message: `Dừng đài khẩn cấp: Công suất phát RF (${d.rfActual}%) suy giảm dưới ngưỡng cho phép (${params.alarmThreshold}%).`
            });
            rfAlarmLogged = true;
        } else if (d.rfActual < params.warningThreshold && !rfWarnLogged) {
            logs.push({
                day: d.day,
                type: 'warning',
                message: `Cảnh báo công suất: Công suất phát RF (${d.rfActual}%) giảm dưới ngưỡng an toàn (${params.warningThreshold}%).`
            });
            rfWarnLogged = true;
        }

        // Health Index checks
        if (d.hi < 0.3 && !hiLv3Logged) {
            logs.push({
                day: d.day,
                type: 'critical',
                message: `Sức khỏe hệ thống nguy cấp: HI = ${d.hi.toFixed(4)} (Dưới ngưỡng an toàn mức 3).`
            });
            hiLv3Logged = true;
        } else if (d.hi < 0.7 && !hiLv2Logged) {
            logs.push({
                day: d.day,
                type: 'warning',
                message: `Sức khỏe hệ thống suy giảm: HI = ${d.hi.toFixed(4)} (Dưới ngưỡng an toàn mức 2).`
            });
            hiLv2Logged = true;
        }

        // Reliability checks
        if (d.rt < 0.75 && !rtDangerLogged) {
            logs.push({
                day: d.day,
                type: 'critical',
                message: `Hàm tin cậy R(t) rơi vào mức nguy hiểm: R(t) = ${(d.rt * 100).toFixed(2)}% (Yêu cầu kiểm tra & bảo dưỡng gấp).`
            });
            rtDangerLogged = true;
        } else if (d.rt < 0.90 && !rtWarnLogged) {
            logs.push({
                day: d.day,
                type: 'warning',
                message: `Độ tin cậy R(t) giảm dưới 90%: R(t) = ${(d.rt * 100).toFixed(2)}% (Cần lên kế hoạch bảo trì).`
            });
            rtWarnLogged = true;
        }
    });

    // Return logs sorted chronologically
    return logs.sort((a, b) => a.day - b.day);
}

// ============================================================
//  DEFAULT PARAMETERS
// ============================================================
const DEFAULT_PARAMS = {
    days: 180,
    baselineRF: 100.0,
    warningThreshold: 90.0,
    alarmThreshold: 85.0,
    slope1: -0.04,
    slope2: -0.18,
    breakDay: 120,
    weatherStart: 130,
    weatherEnd: 140,
    weatherMag: -1.5,
    envAmp: 0.8,
    noiseSigma: 0.25,
    beta: 1.5,
    eta: 365,
    lookBack: 7,
    trainRatio: 0.7,
    seed: 42,
};

// ============================================================
//  VIETNAMESE DIACRITIC REMOVER
// ============================================================
function removeVietnameseTones(str) {
    if (!str) return '';
    let result = str.toString();
    result = result.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    result = result.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    result = result.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    result = result.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    result = result.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    result = result.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    result = result.replace(/đ/g, "d");
    result = result.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    result = result.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    result = result.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    result = result.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    result = result.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    result = result.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    result = result.replace(/Đ/g, "D");
    result = result.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
    result = result.replace(/\u02C6|\u0306|\u031B/g, "");
    return result;
}

// ============================================================
//  STYLED TOOLTIP (LIGHT THEME)
// ============================================================
const ChartTooltip = ({ active, payload, label, unit }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-sky-100 rounded-lg p-3 shadow-lg text-xs">
            <p className="font-bold text-slate-800 mb-1.5">Ngày {label}</p>
            {payload.map((p, i) => p.value !== null && (
                <p key={i} className="my-0.5" style={{ color: p.color }}>
                    {p.name}: <span className="font-semibold">{typeof p.value === 'number' ? p.value.toFixed(3) : p.value}</span> {unit || ''}
                </p>
            ))}
        </div>
    );
};

// ============================================================
//  TOAST COMPONENT (LIGHT SEVERITIES)
// ============================================================
function Toast({ toasts, onDismiss }) {
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

// ============================================================
//  SIDEBAR INPUT FIELD
// ============================================================
function InputRow({ label, name, value, onChange, step = 'any', min, max, unit, hint }) {
    return (
        <div className="mb-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
            <div className="flex items-center gap-2">
                <input 
                    type="number" 
                    name={name} 
                    value={value} 
                    step={step} 
                    min={min} 
                    max={max} 
                    onChange={onChange}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors w-full" 
                />
                {unit && <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">{unit}</span>}
            </div>
            {hint && <p className="text-[9px] text-slate-400 mt-0.5 italic leading-tight">{hint}</p>}
        </div>
    );
}

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



    // Helper to render accordion headers
    const renderAccordionHeader = (id, icon, title) => {
        const isOpen = expandedSections[id];
        return (
            <button 
                onClick={() => toggleSection(id)}
                className={`w-full p-2.5 flex items-center justify-between text-left font-bold text-xs tracking-wider transition-all border rounded-lg cursor-pointer ${
                    isOpen 
                        ? 'bg-[#D6E6F5] text-blue-900 border-blue-300' 
                        : 'bg-white hover:bg-[#F4F8FC] text-slate-700 border-blue-100'
                }`}
            >
                <span className="flex items-center gap-2">
                    {icon}
                    {title}
                </span>
                {isOpen ? <ChevronUp size={14} className="text-blue-500" /> : <ChevronDown size={14} className="text-slate-400" />}
            </button>
        );
    };

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

            <Toast toasts={toasts} onDismiss={dismissToast} />

            {/* WARNING LOGS DRAWER OVERLAY BACKDROP */}
            {showLogsDrawer && (
                <div 
                    className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-[990] transition-opacity duration-300"
                    onClick={() => setShowLogsDrawer(false)}
                />
            )}

            {/* WARNING LOGS DRAWER */}
            <div className={`fixed inset-y-0 right-0 z-[999] w-80 sm:w-96 bg-white border-l border-slate-200 shadow-2xl flex flex-col transition-transform duration-300 transform ${
                showLogsDrawer ? 'translate-x-0' : 'translate-x-full'
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
                                className={`flex-1 py-1 px-2 border rounded-md text-[10px] font-bold transition-all cursor-pointer text-center ${
                                    logFilter === tab.id
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
                                className={`px-2 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                                    copiedLogs 
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
                        filteredSortedLogs.map((log, i) => (
                            <div 
                                key={i} 
                                className={`p-3 rounded-lg border text-[11px] leading-relaxed flex flex-col gap-1.5 ${
                                    log.type === 'critical' 
                                        ? 'bg-red-50/70 border-red-100 text-red-800 shadow-sm shadow-red-50/50' 
                                        : 'bg-amber-50/70 border-amber-100 text-amber-800 shadow-sm shadow-amber-50/50'
                                }`}
                            >
                                <div className="flex items-center justify-between font-bold">
                                    <span className="flex items-center gap-1">
                                        {log.type === 'critical' ? (
                                            <AlertTriangle size={12} className="text-red-500" />
                                        ) : (
                                            <AlertCircle size={12} className="text-amber-500" />
                                        )}
                                        Ngày thứ {log.day}
                                    </span>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold tracking-wide uppercase ${
                                        log.type === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                    }`}>
                                        {log.type === 'critical' ? 'Nguy cấp' : 'Cảnh báo'}
                                    </span>
                                </div>
                                <div className="font-medium">{log.message}</div>
                            </div>
                        ))
                    )}
                </div>

                {/* Drawer Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400 leading-normal flex-shrink-0">
                    Mức độ: <span className="text-amber-600 font-bold">Vàng</span> cho Cảnh báo thông số suy giảm, <span className="text-red-600 font-bold">Đỏ</span> cho Nguy cấp hoặc chạm ngưỡng dừng đài.
                </div>
            </div>

            {/* TOPBAR / TASKBAR */}
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

            <div className="flex flex-1 overflow-hidden relative">

                {/* SIDEBAR WITH ACCORDIONS AND SOFT BLUE GRADIENT */}
                <aside 
                    className={`bg-gradient-to-b from-[#EBF4FC] to-[#F3F8FD] border-r border-slate-200 flex flex-col transition-all duration-300 ${
                        isSidebarCollapsed ? 'w-12' : 'w-72'
                    } flex-shrink-0 z-20`}
                >
                    {/* Sidebar Toggle and Title */}
                    <div className="p-3 border-b border-blue-100/50 flex items-center justify-between min-h-[48px] bg-white/40">
                        {!isSidebarCollapsed && (
                            <span className="text-xs font-bold text-slate-600 tracking-wider flex items-center gap-1.5">
                                <Sliders size={14} className="text-blue-600" />
                                THÔNG SỐ ĐẦU VÀO
                            </span>
                        )}
                        <button 
                            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
                            className="p-1 hover:bg-white/60 rounded text-slate-400 hover:text-slate-600 transition-colors mx-auto"
                            title={isSidebarCollapsed ? "Mở rộng bảng cấu hình" : "Thu gọn bảng cấu hình"}
                        >
                            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                        </button>
                    </div>

                    {/* Sidebar Content (Accordion Panels) */}
                    {!isSidebarCollapsed ? (
                        <div className="flex-1 overflow-y-auto p-3 space-y-3">
                            {/* Unsaved Changes Banner */}
                            {hasUnsavedChanges && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[10px] text-amber-800 leading-normal font-semibold animate-pulse flex items-start gap-1.5 shadow-xs">
                                    <AlertTriangle size={12} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        Có thay đổi chưa áp dụng. Hãy nhấn <span className="text-blue-700 font-bold">"Cập nhật mô phỏng"</span> ở góc trên bên phải để cập nhật biểu đồ!
                                    </div>
                                </div>
                            )}
                            
                            {/* Accordion Section 1: Basic Params */}
                            <div className="space-y-1">
                                {renderAccordionHeader('basic', <Sliders size={14} className="text-blue-600" />, 'Thông số cơ bản')}
                                {expandedSections.basic && (
                                    <div className="bg-white border border-blue-100 rounded-lg p-3 shadow-xs space-y-1">
                                        <InputRow label="Số ngày mô phỏng" name="days" value={formParams.days} onChange={handleChange} step={1} min={60} max={365} unit="ngày" />
                                        <InputRow label="RF Power định mức" name="baselineRF" value={formParams.baselineRF} onChange={handleChange} unit="%" hint="100% = công suất phát chuẩn" />
                                        <InputRow label="Ngưỡng cảnh báo" name="warningThreshold" value={formParams.warningThreshold} onChange={handleChange} unit="%" />
                                        <InputRow label="Ngưỡng dừng đài" name="alarmThreshold" value={formParams.alarmThreshold} onChange={handleChange} unit="%" />
                                    </div>
                                )}
                            </div>

                            {/* Accordion Section 2: Degradation */}
                            <div className="space-y-1">
                                {renderAccordionHeader('degradation', <TrendingDown size={14} className="text-blue-600" />, 'Độ suy hao (Degradation)')}
                                {expandedSections.degradation && (
                                    <div className="bg-white border border-blue-100 rounded-lg p-3 shadow-xs space-y-1">
                                        <InputRow label="Hệ số suy hao pha 1" name="slope1" value={formParams.slope1} onChange={handleChange} step={0.01} unit="/ngày" hint="t ≤ breakDay" />
                                        <InputRow label="Hệ số suy hao pha 2" name="slope2" value={formParams.slope2} onChange={handleChange} step={0.01} unit="/ngày" hint="t > breakDay" />
                                        <InputRow label="Mốc chuyển pha" name="breakDay" value={formParams.breakDay} onChange={handleChange} step={1} unit="ngày" />
                                        <InputRow label="Biên độ môi trường (sin)" name="envAmp" value={formParams.envAmp} onChange={handleChange} step={0.1} />
                                        <InputRow label="Nhiễu hệ thống σ" name="noiseSigma" value={formParams.noiseSigma} onChange={handleChange} step={0.05} />
                                    </div>
                                )}
                            </div>

                            {/* Accordion Section 3: Weather */}
                            <div className="space-y-1">
                                {renderAccordionHeader('weather', <Cloud size={14} className="text-blue-600" />, 'Dị thường thời tiết')}
                                {expandedSections.weather && (
                                    <div className="bg-white border border-blue-100 rounded-lg p-3 shadow-xs space-y-1">
                                        <InputRow label="Bắt đầu" name="weatherStart" value={formParams.weatherStart} onChange={handleChange} step={1} unit="ngày" />
                                        <InputRow label="Kết thúc" name="weatherEnd" value={formParams.weatherEnd} onChange={handleChange} step={1} unit="ngày" />
                                        <InputRow label="Cường độ suy hao" name="weatherMag" value={formParams.weatherMag} onChange={handleChange} step={0.1} />
                                    </div>
                                )}
                            </div>

                            {/* Accordion Section 4: Weibull Reliability */}
                            <div className="space-y-1">
                                {renderAccordionHeader('weibull', <ShieldAlert size={14} className="text-blue-600" />, 'Độ tin cậy R(t) Weibull')}
                                {expandedSections.weibull && (
                                    <div className="bg-white border border-blue-100 rounded-lg p-3 shadow-xs space-y-1">
                                        <InputRow label="Shape β" name="beta" value={formParams.beta} onChange={handleChange} step={0.1} min={0.5} max={5} hint="β=1.5 → Pha hao mòn (Wear-out)" />
                                        <InputRow label="Scale η" name="eta" value={formParams.eta} onChange={handleChange} step={10} unit="ngày" hint="MTTF trung bình ≈ 365 ngày" />
                                    </div>
                                )}
                            </div>

                            {/* Accordion Section 5: LSTM */}
                            <div className="space-y-1">
                                {renderAccordionHeader('lstm', <Settings size={14} className="text-blue-600" />, 'Cấu hình LSTM')}
                                {expandedSections.lstm && (
                                    <div className="bg-white border border-blue-100 rounded-lg p-3 shadow-xs space-y-1">
                                        <InputRow label="Look-back window" name="lookBack" value={formParams.lookBack} onChange={handleChange} step={1} min={3} max={30} unit="ngày" />
                                        <InputRow label="Tỷ lệ tập Train" name="trainRatio" value={formParams.trainRatio} onChange={handleChange} step={0.05} min={0.5} max={0.9} hint="0.7 = 70% train / 30% test" />
                                        <InputRow label="Hạt giống Random (Seed)" name="seed" value={formParams.seed} onChange={handleChange} step={1} hint="Thay đổi để tạo nhiễu ngẫu nhiên" />
                                    </div>
                                )}
                            </div>

                            {/* Sidebar Action Footer */}
                            <div className="pt-2 pb-6">
                                <button 
                                    onClick={handleReset}
                                    className="w-full py-2 px-4 border border-blue-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-center block shadow-xs"
                                >
                                    Đặt lại mặc định
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 py-6 flex flex-col items-center gap-6 text-slate-400">
                            <button 
                                onClick={() => setIsSidebarCollapsed(false)}
                                className="p-2 bg-white/80 border border-blue-100 hover:bg-white text-slate-500 rounded-lg transition-all shadow-xs"
                                title="Mở cấu hình"
                            >
                                <Sliders size={18} />
                            </button>
                        </div>
                    )}
                </aside>

                {/* MAIN CHARTS AREA */}
                <main className="flex-1 overflow-y-auto p-6 space-y-6 min-w-0">
                    
                    {/* SUMMARY ROW (3 KPI Cards) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* KPI 1: RF Power */}
                        <div className={`bg-white border-t-4 ${
                            lastRF < activeParams.alarmThreshold ? 'border-red-500' :
                            lastRF < activeParams.warningThreshold ? 'border-amber-500' : 'border-blue-500'
                        } border-x border-b border-sky-100 rounded-xl p-5 shadow-sm shadow-blue-50/50 hover:shadow-md transition-all`}>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">RF Power (Đầu ra cuối)</div>
                            <div className={`text-2xl font-extrabold ${
                                lastRF < activeParams.alarmThreshold ? 'text-red-600' :
                                lastRF < activeParams.warningThreshold ? 'text-amber-600' : 'text-blue-700'
                            }`}>
                                {lastRF.toFixed(2)}%
                            </div>
                            <div className="text-[11px] text-slate-500 mt-2">
                                Ngưỡng cảnh báo: <span className="font-semibold text-slate-700">{activeParams.warningThreshold}%</span> &middot; Dừng đài: <span className="font-semibold text-slate-700">{activeParams.alarmThreshold}%</span>
                            </div>
                        </div>

                        {/* KPI 2: Health Index */}
                        <div className={`bg-white border-t-4 ${
                            lastHI < 0.3 ? 'border-red-500' :
                            lastHI < 0.7 ? 'border-amber-500' : 'border-emerald-500'
                        } border-x border-b border-sky-100 rounded-xl p-5 shadow-sm shadow-blue-50/50 hover:shadow-md transition-all`}>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Chỉ số sức khỏe (HI)</div>
                            <div className={`text-2xl font-extrabold ${
                                lastHI < 0.3 ? 'text-red-600' :
                                lastHI < 0.7 ? 'text-amber-600' : 'text-emerald-600'
                            }`}>
                                {lastHI.toFixed(4)}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-2">
                                Trạng thái: <span className={`font-semibold ${
                                    lastHI < 0.3 ? 'text-red-600' :
                                    lastHI < 0.7 ? 'text-amber-600' : 'text-emerald-600'
                                }`}>
                                    {lastHI < 0.3 ? 'Nguy cấp (Cần bảo dưỡng)' : lastHI < 0.7 ? 'Cảnh báo hạn chế' : 'Hoạt động tốt'}
                                </span>
                            </div>
                        </div>

                        {/* KPI 3: Reliability R(t) */}
                        <div className={`bg-white border-t-4 ${
                            lastRT < 0.75 ? 'border-red-500' :
                            lastRT < 0.90 ? 'border-amber-500' : 'border-emerald-500'
                        } border-x border-b border-sky-100 rounded-xl p-5 shadow-sm shadow-blue-50/50 hover:shadow-md transition-all`}>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hệ số tin cậy R(t) Weibull</div>
                            <div className={`text-2xl font-extrabold ${
                                lastRT < 0.75 ? 'text-red-600' :
                                lastRT < 0.90 ? 'text-amber-600' : 'text-emerald-600'
                            }`}>
                                {(lastRT * 100).toFixed(2)}%
                            </div>
                            <div className="text-[11px] text-slate-500 mt-2">
                                Trạng thái an toàn: <span className={`font-semibold ${
                                    lastRT < 0.75 ? 'text-red-600' :
                                    lastRT < 0.90 ? 'text-amber-600' : 'text-emerald-600'
                                }`}>
                                    {lastRT < 0.75 ? 'Không an toàn (Nguy cơ hỏng)' : lastRT < 0.90 ? 'Cần theo dõi sát sao' : 'An toàn tuyệt đối'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* CHART VIEW TOOLBAR */}
                    <div className="flex flex-wrap items-center gap-2 bg-white border border-sky-100 rounded-xl px-4 py-3 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1 hidden sm:inline">Hiển thị:</span>
                        {[
                            { id: 'all',     label: 'Tất cả',            icon: '⊞',  color: 'blue'   },
                            { id: 'rf',      label: 'RF Power',           icon: '①',  color: 'indigo' },
                            { id: 'health',  label: 'Sức khỏe & Độ tin cậy', icon: '②③', color: 'violet' },
                            { id: 'env',     label: 'Môi trường',         icon: '④',  color: 'orange' },
                            { id: 'formula', label: 'Công thức',          icon: '∫',  color: 'slate'  },
                        ].map(tab => {
                            const active = chartView === tab.id;
                            const colorMap = {
                                blue:   active ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200'   : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600',
                                indigo: active ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600',
                                violet: active ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-200' : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600',
                                orange: active ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-200' : 'bg-white text-slate-500 border-slate-200 hover:border-orange-300 hover:text-orange-600',
                                slate:  active ? 'bg-slate-700 text-white border-slate-700 shadow-md shadow-slate-200'  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700',
                            };
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setChartView(tab.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-200 cursor-pointer ${colorMap[tab.color]}`}
                                >
                                    <span className="font-mono text-[11px]">{tab.icon}</span>
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* CHARTS AREA — conditional on chartView */}
                    <div className="space-y-6">

                        {/* ① RF POWER — show in 'all' and 'rf' */}
                        {(chartView === 'all' || chartView === 'rf') && (
                        <div className="bg-white border border-sky-100 rounded-xl p-6 shadow-sm shadow-blue-50/50 hover:shadow-md hover:shadow-blue-100/40 transition-all duration-200">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                                <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                                    ① Công suất phát RF Power &amp; Dự báo AI (LSTM)
                                </h2>
                                <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-100 rounded px-2 py-0.5 self-start">
                                    Mốc phân tách Train/Test: Ngày {splitIdx + 1}
                                </span>
                            </div>
                            <ResponsiveContainer width="100%" height={chartView === 'rf' ? 320 : 260}>
                                <LineChart syncId="ils-charts" data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2EEF8" vertical={false} />
                                    <XAxis 
                                        dataKey="day" 
                                        tick={{ fill: '#64748B', fontSize: 10 }} 
                                        tickLine={false} 
                                        axisLine={{ stroke: '#E2E8F0' }}
                                    />
                                    <YAxis 
                                        domain={['auto', 'auto']} 
                                        tick={{ fill: '#64748B', fontSize: 10 }} 
                                        tickLine={false} 
                                        axisLine={{ stroke: '#E2E8F0' }}
                                    />
                                    <Tooltip content={<ChartTooltip unit="%" />} />
                                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                                    <ReferenceLine 
                                        y={activeParams.alarmThreshold} 
                                        stroke="#EF4444" 
                                        strokeDasharray="4 4" 
                                        label={{ value: `Dừng đài ${activeParams.alarmThreshold}%`, fill: '#EF4444', fontSize: 9, position: 'insideBottomRight' }} 
                                    />
                                    <ReferenceLine 
                                        y={activeParams.warningThreshold} 
                                        stroke="#F59E0B" 
                                        strokeDasharray="4 4" 
                                        label={{ value: `Cảnh báo ${activeParams.warningThreshold}%`, fill: '#F59E0B', fontSize: 9, position: 'insideTopRight' }} 
                                    />
                                    <ReferenceLine 
                                        x={splitIdx + 1} 
                                        stroke="#8B5CF6" 
                                        strokeDasharray="6 4" 
                                        label={{ value: 'Bắt đầu AI', fill: '#8B5CF6', fontSize: 9, position: 'insideTopLeft' }} 
                                    />
                                    <Line type="monotone" dataKey="rfActual" name="Thực tế (Đài)" stroke="#1D4ED8" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="rfAI" name="Dự báo AI (LSTM)" stroke="#60A5FA" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} />
                                    <Brush 
                                        dataKey="day" 
                                        height={16} 
                                        stroke="#E2E8F0" 
                                        fill="#F8FAFC" 
                                        travellerWidth={6} 
                                        startIndex={brushRange ? brushRange.startIndex : 0}
                                        endIndex={brushRange ? brushRange.endIndex : chartData.length - 1}
                                        onChange={(range) => setBrushRange(range)}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        )}

                        {/* ②③ HEALTH INDEX + RELIABILITY — show in 'all' and 'health' */}
                        {(chartView === 'all' || chartView === 'health') && (
                        <div className={`grid grid-cols-1 ${chartView === 'health' ? 'lg:grid-cols-2' : 'lg:grid-cols-2'} gap-6`}>

                            {/* CHART 2: HEALTH INDEX */}
                            <div className="bg-white border border-sky-100 rounded-xl p-6 shadow-sm shadow-blue-50/50 hover:shadow-md hover:shadow-blue-100/40 transition-all duration-200">
                                <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
                                    <span className="w-2 h-2 rounded-full bg-violet-500" />
                                    ② Chỉ số sức khỏe (Health Index HI)
                                </h2>
                                <ResponsiveContainer width="100%" height={chartView === 'health' ? 280 : 200}>
                                    <LineChart syncId="ils-charts" data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E2EEF8" vertical={false} />
                                        <XAxis dataKey="day" tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                                        <YAxis domain={[0, 1.05]} tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <ReferenceLine y={0.70} stroke="#F59E0B" strokeDasharray="5 5" label={{ value: 'Cảnh báo: 0.7', fill: '#F59E0B', fontSize: 9, position: 'right' }} />
                                        <ReferenceLine y={0.30} stroke="#EF4444" strokeDasharray="5 5" label={{ value: 'Nguy cấp: 0.3', fill: '#EF4444', fontSize: 9, position: 'right' }} />
                                        <Line type="monotone" dataKey="hi" name="Health Index HI" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* CHART 3: RELIABILITY R(t) */}
                            <div className="bg-white border border-sky-100 rounded-xl p-6 shadow-sm shadow-blue-50/50 hover:shadow-md hover:shadow-blue-100/40 transition-all duration-200">
                                <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    ③ Hàm độ tin cậy R(t) Weibull
                                </h2>
                                <ResponsiveContainer width="100%" height={chartView === 'health' ? 280 : 200}>
                                    <LineChart syncId="ils-charts" data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E2EEF8" vertical={false} />
                                        <XAxis dataKey="day" tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                                        <YAxis domain={[0, 1.05]} tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <ReferenceLine y={0.90} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: 'Cảnh báo: 0.90', fill: '#F59E0B', fontSize: 9, position: 'right' }} />
                                        <ReferenceLine y={0.75} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'Nguy hiểm: 0.75', fill: '#EF4444', fontSize: 9, position: 'right' }} />
                                        {dangerDay75 && <ReferenceLine x={dangerDay75} stroke="#EF444433" strokeDasharray="3 3" label={{ value: `Ngày R<0.75: ${dangerDay75}`, fill: '#EF4444', fontSize: 8 }} />}
                                        <Line type="monotone" dataKey="rt" name="Độ tin cậy R(t)" stroke="#10B981" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                        </div>
                        )}

                        {/* ④ TEMPERATURE & HUMIDITY — show in 'all' and 'env' */}
                        {(chartView === 'all' || chartView === 'env') && (
                        <div className="bg-white border border-sky-100 rounded-xl p-6 shadow-sm shadow-blue-50/50 hover:shadow-md hover:shadow-blue-100/40 transition-all duration-200">
                            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
                                <span className="w-2 h-2 rounded-full bg-orange-400" />
                                ④ Nhiệt độ &amp; Độ ẩm môi trường
                            </h2>
                            <ResponsiveContainer width="100%" height={chartView === 'env' ? 320 : 200}>
                                <LineChart syncId="ils-charts" data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2EEF8" vertical={false} />
                                    <XAxis dataKey="day" tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                                    <YAxis yAxisId="temp" tick={{ fill: '#F97316', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} width={36} />
                                    <YAxis yAxisId="hum" orientation="right" tick={{ fill: '#06B6D4', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} width={36} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 5 }} />
                                    <Line yAxisId="temp" type="monotone" dataKey="temp" name="Nhiệt độ (°C)" stroke="#F97316" strokeWidth={1.5} dot={false} />
                                    <Line yAxisId="hum" type="monotone" dataKey="humidity" name="Độ ẩm (%)" stroke="#06B6D4" strokeWidth={1.5} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        )}

                        {/* ∫ FORMULA REFERENCE — show in 'all' and 'formula' */}
                        {(chartView === 'all' || chartView === 'formula') && (
                        <div className="bg-white border border-sky-100 rounded-xl p-6 shadow-sm shadow-blue-50/50 hover:shadow-md hover:shadow-blue-100/40 transition-all duration-200">
                            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
                                <HelpCircle size={14} className="text-slate-500" />
                                Công thức toán học &amp; Mô hình hệ thống
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    { title: 'Xu hướng hao mòn (Degradation)', expr: 'D(t) = slope₁ · t   [t ≤ breakDay]\n     = slope₁ · breakDay + slope₂ · (t − breakDay)   [t > breakDay]' },
                                    { title: 'Công suất phát RF tổng hợp', expr: 'RF(t) = RF₀ + D(t) + envAmp · sin(2πt / 7) + WeatherAnomaly(t) + ε_noise' },
                                    { title: 'Chỉ số sức khỏe (Health Index)', expr: 'HI(t) = 1.0  [nếu RF(t) ≥ RF₀]\n      = (RF(t) − alarm) / (RF₀ − alarm)  [nếu alarm < RF(t) < RF₀]\n      = 0.0  [nếu RF(t) ≤ alarm]' },
                                    { title: 'Độ tin cậy tích lũy (Weibull)', expr: 'λ(t) = (β / η) · (t / η)^(β − 1) · (2.0 − HI(t))\nR(t) = exp(−∑_{k=1..t} λ(k))' },
                                ].map(f => (
                                    <div key={f.title} className="bg-slate-50 border border-slate-100 rounded-lg p-4">
                                        <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2">{f.title}</div>
                                        <pre className="text-[10px] text-slate-600 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">{f.expr}</pre>
                                    </div>
                                ))}
                            </div>
                        </div>
                        )}

                    </div>

                </main>
            </div>
        </div>
    );
}