import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ReferenceLine, ResponsiveContainer, Legend, Brush
} from 'recharts';
import { HelpCircle, TrendingDown, Activity, AlertTriangle, ShieldCheck } from 'lucide-react';
import ChartTooltip from './ChartTooltip';
import airportInfo from '../../simulation/ils_info.json';

// ============================================================
//  CHARTS AREA — all 4 chart panels (Primary & Secondary)
//  Props:
//    chartView
//    chartData
//    activeParams
//    splitIdx, dangerDay75
//    brushRange, setBrushRange
//    metrics
// ============================================================
export default function ChartsArea({
    chartView,
    chartData,
    activeParams,
    splitIdx,
    dangerDay75,
    brushRange,
    setBrushRange,
    metrics
}) {
    // Filter test data (from index splitIdx, which represents Oct 1st onwards)
    const testChartData = chartData.filter(d => d.day >= (splitIdx + 1));

    // Calculate HI thresholds dynamically to match the Python model exactly
    const baseRF = activeParams.baselineRF || 100.0;
    const warnRF = activeParams.warningThreshold || 92.0;
    const alarmRF = activeParams.alarmThreshold || 88.0;
    const healthFloor = 85.0;

    const hiWarningThreshold = (warnRF - healthFloor) / (baseRF - healthFloor);
    const hiAlarmThreshold = (alarmRF - healthFloor) / (baseRF - healthFloor);

    return (
        <div className="space-y-6">

            {/* SECTION 1: PRIMARY CHARTS (RF POWER ANALYSIS) */}
            {(chartView === 'all' || chartView === 'rf') && (
                <div className="space-y-6">
                    <div className="border-b border-sky-100 pb-2">
                        <h3 className="text-xs font-extrabold text-slate-700 flex items-center gap-2 tracking-wider">
                            <Activity size={16} className="text-blue-600 animate-pulse" />
                            BIỂU ĐỒ CHÍNH (PHÂN TÍCH CÔNG SUẤT RF POWER)
                        </h3>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-0.5">
                            Chu kỳ 365 ngày (năm 2026) - Dự án Đài dẫn đường ILS ${airportInfo.AIRPORT_NAME?.replace(" International Airport", "")?.replace(" Airport", "") || "Vinh"} (${airportInfo.AIRPORT_ICAO || "VVVH"})
                        </p>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        
                        {/* CHART 1: FULL CYCLE RF POWER */}
                        <div className="bg-white border border-sky-100 rounded-xl p-5 shadow-sm shadow-blue-50/50 hover:shadow-md hover:shadow-blue-100/40 transition-all duration-200">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                                <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                                    ① RF Power Toàn chu kỳ (365 ngày)
                                </h2>
                                <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-100 rounded px-2 py-0.5 self-start">
                                    Bắt đầu dự báo AI: Ngày {splitIdx + 1}
                                </span>
                            </div>
                            <ResponsiveContainer width="100%" height={280}>
                                <LineChart syncId="ils-charts" data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2EEF8" vertical={false} />
                                    <XAxis 
                                        dataKey="day" 
                                        tick={{ fill: '#64748B', fontSize: 10 }} 
                                        tickLine={false} 
                                        axisLine={{ stroke: '#E2E8F0' }}
                                    />
                                    <YAxis 
                                        domain={[85, 102]} 
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

                                    <Line type="monotone" dataKey="rfActual" name="Thực tế mô phỏng" stroke="#2563EB" strokeWidth={3.5} dot={false} />
                                    <Line type="monotone" dataKey="rfAI" name="Dự báo LSTM + Hiệu chỉnh" stroke="#EA580C" strokeWidth={3.5} strokeDasharray="6 4" dot={false} connectNulls={true} />
                                    
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

                        {/* CHART 2: ZOOM TEST PHASE & METRICS */}
                        <div className="bg-white border border-sky-100 rounded-xl p-5 shadow-sm shadow-blue-50/50 hover:shadow-md hover:shadow-blue-100/40 transition-all duration-200 flex flex-col justify-between">
                            <div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                                    <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse" />
                                        ② So sánh Giai đoạn Test (Tháng 10 - 12)
                                    </h2>
                                    <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-100 rounded px-2 py-0.5 self-start">
                                        Zoom: Ngày {splitIdx + 1} - 365
                                    </span>
                                </div>
                                <ResponsiveContainer width="100%" height={170}>
                                    <LineChart data={testChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E2EEF8" vertical={false} />
                                        <XAxis 
                                            dataKey="date" 
                                            tick={{ fill: '#64748B', fontSize: 9 }} 
                                            tickFormatter={(str) => {
                                                if (!str) return '';
                                                const parts = str.split('-');
                                                return `${parts[2]}/${parts[1]}`;
                                            }}
                                            tickLine={false} 
                                            axisLine={{ stroke: '#E2E8F0' }}
                                        />
                                        <YAxis 
                                            domain={[86, 96]} 
                                            tick={{ fill: '#64748B', fontSize: 10 }} 
                                            tickLine={false} 
                                            axisLine={{ stroke: '#E2E8F0' }}
                                        />
                                        <Tooltip content={<ChartTooltip unit="%" />} />
                                        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 5 }} />
                                        
                                        <ReferenceLine y={activeParams.alarmThreshold} stroke="#EF4444" strokeDasharray="4 4" />
                                        <ReferenceLine y={activeParams.warningThreshold} stroke="#F59E0B" strokeDasharray="4 4" />

                                        <Line type="monotone" dataKey="rfActual" name="Thực tế" stroke="#2563EB" strokeWidth={3.5} dot={false} />
                                        <Line type="monotone" dataKey="rfAI" name="Dự báo LSTM" stroke="#EA580C" strokeWidth={3.5} strokeDasharray="6 4" dot={false} />
                                        <Line type="monotone" dataKey="rfBaseline" name="Baseline MA" stroke="#64748B" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* METRICS BOX */}
                            {metrics && (
                                <div className="mt-4 bg-slate-50 border border-slate-100 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Sai số MAE</span>
                                        <span className="text-xs font-bold text-slate-700">{metrics.lstm_mae?.toFixed(3)}%</span>
                                        <span className="text-[8px] text-slate-400">Baseline: {metrics.base_mae?.toFixed(3)}%</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Sai số RMSE</span>
                                        <span className="text-xs font-bold text-slate-700">{metrics.lstm_rmse?.toFixed(3)}%</span>
                                        <span className="text-[8px] text-slate-400">Baseline: {metrics.base_rmse?.toFixed(3)}%</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Suy giảm thực tế</span>
                                        <span className="text-xs font-bold text-slate-700 text-amber-600">-{metrics.rf_drop_actual?.toFixed(2)}%</span>
                                        <span className="text-[8px] text-slate-400">Giai đoạn Test</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Sai lệch cuối</span>
                                        <span className="text-xs font-bold text-slate-700 text-blue-600">{metrics.rf_final_error?.toFixed(3)}%</span>
                                        <span className="text-[8px] text-slate-400">Ngày thứ 365</span>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            )}

            {/* SECTION 2: SECONDARY CHARTS (HEALTH & RELIABILITY) */}
            {(chartView === 'all' || chartView === 'health') && (
                <div className="space-y-6">
                    <div className="border-b border-sky-100 pb-2 pt-2">
                        <h3 className="text-xs font-extrabold text-slate-700 flex items-center gap-2 tracking-wider">
                            <TrendingDown size={16} className="text-violet-600" />
                            CHỈ SỐ SỨC KHỎE &amp; ĐỘ TIN CẬY (BIỂU ĐỒ PHỤ)
                        </h3>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-0.5">
                            Các thông số Weibull và HI bổ trợ cho công tác lên kế hoạch bảo dưỡng
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* CHART 3: HEALTH INDEX */}
                        <div className="bg-white border border-sky-100 rounded-xl p-5 shadow-sm shadow-blue-50/50 hover:shadow-md hover:shadow-blue-100/40 transition-all duration-200">
                            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
                                <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                                ③ Chỉ số sức khỏe (Health Index HI)
                            </h2>
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart syncId="ils-charts" data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2EEF8" vertical={false} />
                                    <XAxis dataKey="day" tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                                    <YAxis domain={[0, 1.05]} tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <ReferenceLine y={hiWarningThreshold} stroke="#D97706" strokeDasharray="4 4" label={{ value: `Ngưỡng cảnh báo HI < ${hiWarningThreshold.toFixed(3)}`, fill: '#B45309', fontSize: 9, position: 'insideTopLeft' }} />
                                    <ReferenceLine y={hiAlarmThreshold} stroke="#EF4444" strokeDasharray="4 4" label={{ value: `Ngưỡng nguy hiểm HI < ${hiAlarmThreshold.toFixed(3)}`, fill: '#B91C1C', fontSize: 9, position: 'insideTopLeft' }} />
                                    <Line type="monotone" dataKey="hi" name="Health Index HI" stroke="#7C3AED" strokeWidth={3.5} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        {/* CHART 4: RELIABILITY R(t) */}
                        <div className="bg-white border border-sky-100 rounded-xl p-5 shadow-sm shadow-blue-50/50 hover:shadow-md hover:shadow-blue-100/40 transition-all duration-200">
                            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                ④ Hàm độ tin cậy R(t) Weibull
                            </h2>
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart syncId="ils-charts" data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2EEF8" vertical={false} />
                                    <XAxis dataKey="day" tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                                    <YAxis domain={[0, 1.05]} tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <ReferenceLine y={0.90} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: 'Cảnh báo: 0.90', fill: '#F59E0B', fontSize: 9, position: 'right' }} />
                                    <ReferenceLine y={0.75} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'Nguy hiểm: 0.75', fill: '#EF4444', fontSize: 9, position: 'right' }} />
                                    {dangerDay75 && <ReferenceLine x={dangerDay75} stroke="#EF444433" strokeDasharray="3 3" label={{ value: `R<0.75: Ngày ${dangerDay75}`, fill: '#EF4444', fontSize: 8 }} />}
                                    <Line type="monotone" dataKey="rt" name="Độ tin cậy R(t)" stroke="#059669" strokeWidth={3.5} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                    </div>
                </div>
            )}

            {/* SECTION 2.5: VSWR CHART */}
            {(chartView === 'all' || chartView === 'vswr') && (
                <div className="space-y-6">
                    <div className="border-b border-sky-100 pb-2 pt-2">
                        <h3 className="text-xs font-extrabold text-slate-700 flex items-center gap-2 tracking-wider">
                            <TrendingDown size={16} className="text-emerald-600" />
                            HỆ SỐ SÓNG ĐỨNG VSWR
                        </h3>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-0.5">
                            Chỉ số phối hợp trở kháng đường truyền Anten của đài dẫn đường ILS
                        </p>
                    </div>

                    <div className="bg-white border border-sky-100 rounded-xl p-5 shadow-sm shadow-blue-50/50 hover:shadow-md hover:shadow-blue-100/40 transition-all duration-200">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                                Hệ số sóng đứng VSWR theo thời gian (365 ngày)
                            </h2>
                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-100 rounded px-2 py-0.5 self-start">
                                Ngưỡng lý tưởng ≈ 1.0 | Cảnh báo: {activeParams.vswrWarningThreshold} | Nguy hiểm: {activeParams.vswrAlarmThreshold}
                            </span>
                        </div>
                        <ResponsiveContainer width="100%" height={260}>
                            <LineChart syncId="ils-charts" data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2EEF8" vertical={false} />
                                <XAxis dataKey="day" tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                                <YAxis domain={[1.0, 2.5]} tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 5 }} />
                                <ReferenceLine y={activeParams.vswrWarningThreshold} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: `Cảnh báo: ${activeParams.vswrWarningThreshold}`, fill: '#F59E0B', fontSize: 9, position: 'right' }} />
                                <ReferenceLine y={activeParams.vswrAlarmThreshold} stroke="#EF4444" strokeDasharray="4 4" label={{ value: `Dừng đài: ${activeParams.vswrAlarmThreshold}`, fill: '#EF4444', fontSize: 9, position: 'right' }} />
                                <Line type="monotone" dataKey="vswr" name="Hệ số sóng đứng VSWR" stroke="#C026D3" strokeWidth={3.5} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* SECTION 3: CLIMATE & SENSORS (Only under 'env') */}
            {(chartView === 'env') && (
                <div className="bg-white border border-sky-100 rounded-xl p-5 shadow-sm shadow-blue-50/50 hover:shadow-md hover:shadow-blue-100/40 transition-all duration-200">
                    <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                        Nhiệt độ &amp; Độ ẩm môi trường trạm ${airportInfo.AIRPORT_NAME?.replace(" International Airport", "")?.replace(" Airport", "") || "Vinh"}
                    </h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart syncId="ils-charts" data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2EEF8" vertical={false} />
                            <XAxis dataKey="day" tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                            <YAxis yAxisId="temp" tick={{ fill: '#F97316', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} width={36} />
                            <YAxis yAxisId="hum" orientation="right" tick={{ fill: '#06B6D4', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} width={36} />
                            <Tooltip content={<ChartTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 5 }} />
                            <Line yAxisId="temp" type="monotone" dataKey="temp" name="Nhiệt độ (°C)" stroke="#F97316" strokeWidth={2.5} dot={false} />
                            <Line yAxisId="hum" type="monotone" dataKey="humidity" name="Độ ẩm không khí (%)" stroke="#0891B2" strokeWidth={2.5} dot={false} />
                            <Line yAxisId="hum" type="monotone" dataKey="shelterHum" name="Độ ẩm trong trạm (%)" stroke="#2563EB" strokeWidth={2.5} strokeDasharray="4 3" dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

        </div>
    );
}
