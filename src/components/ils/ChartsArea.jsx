import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ReferenceLine, ResponsiveContainer, Legend, Brush
} from 'recharts';
import { HelpCircle } from 'lucide-react';
import ChartTooltip from './ChartTooltip';

// ============================================================
//  CHARTS AREA — all 4 chart panels, conditionally shown
//  Props:
//    chartView
//    chartData
//    activeParams  (alarmThreshold, warningThreshold)
//    splitIdx, dangerDay75
//    brushRange, setBrushRange
// ============================================================
export default function ChartsArea({
    chartView,
    chartData,
    activeParams,
    splitIdx,
    dangerDay75,
    brushRange,
    setBrushRange,
}) {
    return (
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

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
    );
}
