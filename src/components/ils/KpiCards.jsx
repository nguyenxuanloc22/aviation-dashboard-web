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
//  KPI SUMMARY CARDS (4-column row)
//  Props:
//    lastRF, lastHI, lastRT
//    activeParams  (warningThreshold, alarmThreshold)
//    metrics (firstWarningDay, firstCriticalDay)
// ============================================================
export default function KpiCards({ lastRF, lastHI, lastRT, activeParams, metrics }) {
    const { 
        firstWarningDay, firstCriticalDay, lastVSWR, firstVswrWarningDay, firstVswrCriticalDay, 
        rfWarningDay, rfAlarmDay, hiWarningDay, hiAlarmDay, rtWarningDay, rtAlarmDay 
    } = metrics || {};
    
    const baseRF = activeParams.baselineRF || 100.0;
    const warnRF = activeParams.warningThreshold || 92.0;
    const alarmRF = activeParams.alarmThreshold || 88.0;
    const healthFloor = 85.0;
    const hiWarnThresh = ((warnRF - healthFloor) / (baseRF - healthFloor)).toFixed(4);
    const hiAlarmThresh = ((alarmRF - healthFloor) / (baseRF - healthFloor)).toFixed(4);
    
    // Status classification:
    // NGUY HIỂM (RF < 88), CẢNH BÁO (88 <= RF < 92), BÌNH THƯỜNG (RF >= 92)
    let status = "BÌNH THƯỜNG";
    let statusColor = "emerald";
    let statusText = "Hệ thống vận hành an toàn";
    
    if (lastRF < activeParams.alarmThreshold || lastVSWR >= activeParams.vswrAlarmThreshold) {
        status = "NGUY HIỂM";
        statusColor = "red";
        statusText = "Yêu cầu bảo dưỡng khẩn cấp!";
    } else if (lastRF < activeParams.warningThreshold || lastVSWR >= activeParams.vswrWarningThreshold) {
        status = "CẢNH BÁO";
        statusColor = "amber";
        statusText = "Cần tăng tần suất theo dõi";
    }
 
    const colorClasses = {
        emerald: {
            border: "border-emerald-500",
            text: "text-emerald-600",
            bg: "bg-emerald-50",
            dot: "bg-emerald-500"
        },
        amber: {
            border: "border-amber-500",
            text: "text-amber-600",
            bg: "bg-amber-50",
            dot: "bg-amber-500"
        },
        red: {
            border: "border-red-500",
            text: "text-red-600",
            bg: "bg-red-50",
            dot: "bg-red-500"
        }
    };
 
    const currentClasses = colorClasses[statusColor];
 
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            
            {/* KPI 1: System Status */}
            <div className={`bg-white border-t-4 ${currentClasses.border} border-x border-b border-sky-100 rounded-xl p-5 shadow-sm shadow-blue-50/50 hover:shadow-md transition-all flex flex-col justify-between`}>
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trạng thái hệ thống</span>
                        <span className="relative flex h-2 w-2">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${currentClasses.dot} opacity-75`}></span>
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${currentClasses.dot}`}></span>
                        </span>
                    </div>
                    <div className={`text-2xl font-black ${currentClasses.text} tracking-wide`}>
                        {status}
                    </div>
                </div>
                <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-50">
                    <div className="font-semibold text-slate-700">{statusText}</div>
                    <div className="mt-1 text-[10px] text-slate-400">
                        Cảnh báo đầu tiên: {firstWarningDay ? <span className="text-amber-600 font-bold">{formatDayToDate(firstWarningDay)} (Ngày {firstWarningDay})</span> : "Không"}
                    </div>
                </div>
            </div>
 
            {/* KPI 2: RF Power */}
            <div className={`bg-white border-t-4 ${
                lastRF < activeParams.alarmThreshold ? 'border-red-500' :
                lastRF < activeParams.warningThreshold ? 'border-amber-500' : 'border-blue-500'
            } border-x border-b border-sky-100 rounded-xl p-5 shadow-sm shadow-blue-50/50 hover:shadow-md transition-all flex flex-col justify-between`}>
                <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">RF Power (Cuối kỳ)</div>
                    <div className={`text-2xl font-extrabold ${
                        lastRF < activeParams.alarmThreshold ? 'text-red-600' :
                        lastRF < activeParams.warningThreshold ? 'text-amber-600' : 'text-blue-700'
                    }`}>
                        {lastRF.toFixed(2)}%
                    </div>
                </div>
                <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-50 leading-normal">
                    <div className="mb-2">
                        {lastRF < activeParams.alarmThreshold ? (
                            <span className="text-red-600 font-semibold">Dưới ngưỡng dừng đài ({activeParams.alarmThreshold}%).</span>
                        ) : lastRF < activeParams.warningThreshold ? (
                            <span className="text-amber-600 font-semibold">Dưới ngưỡng cảnh báo ({activeParams.warningThreshold}%).</span>
                        ) : (
                            <span className="text-emerald-600 font-semibold">Đạt chuẩn công suất thiết kế.</span>
                        )}
                    </div>
                    <div className="text-[10px] text-slate-400 leading-snug">
                        Chạm cảnh báo ({activeParams.warningThreshold}%): {rfWarningDay ? <span className="text-amber-600 font-bold">{formatDayToDate(rfWarningDay)} (Ngày {rfWarningDay})</span> : "Không"}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400 leading-snug">
                        Chạm dừng đài ({activeParams.alarmThreshold}%): {rfAlarmDay ? <span className="text-red-600 font-bold">{formatDayToDate(rfAlarmDay)} (Ngày {rfAlarmDay})</span> : "Không"}
                    </div>
                </div>
            </div>
 
            {/* KPI 3: Health Index */}
            <div className={`bg-white border-t-4 ${
                lastHI < 0.3 ? 'border-red-500' :
                lastHI < 0.7 ? 'border-amber-500' : 'border-emerald-500'
            } border-x border-b border-sky-100 rounded-xl p-5 shadow-sm shadow-blue-50/50 hover:shadow-md transition-all flex flex-col justify-between`}>
                <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Chỉ số sức khỏe (HI)</div>
                    <div className={`text-2xl font-extrabold ${
                        lastHI < 0.3 ? 'text-red-600' :
                        lastHI < 0.7 ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                        {lastHI.toFixed(4)}
                    </div>
                </div>
                <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-50 leading-normal">
                    Chỉ số sức khỏe HI cuối: <span className="font-semibold text-slate-700">{lastHI.toFixed(4)}</span>
                    <div className="mt-1 text-[10px] text-slate-400 leading-snug">
                        Chạm cảnh báo (&lt; {hiWarnThresh}): {hiWarningDay ? <span className="text-amber-600 font-bold">{formatDayToDate(hiWarningDay)} (Ngày {hiWarningDay})</span> : "Không"}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400 leading-snug">
                        Chạm nguy cấp (&lt; {hiAlarmThresh}): {hiAlarmDay ? <span className="text-red-600 font-bold">{formatDayToDate(hiAlarmDay)} (Ngày {hiAlarmDay})</span> : "Không"}
                    </div>
                </div>
            </div>
 
            {/* KPI 4: Reliability R(t) */}
            <div className={`bg-white border-t-4 ${
                lastRT < 0.75 ? 'border-red-500' :
                lastRT < 0.90 ? 'border-amber-500' : 'border-emerald-500'
            } border-x border-b border-sky-100 rounded-xl p-5 shadow-sm shadow-blue-50/50 hover:shadow-md transition-all flex flex-col justify-between`}>
                <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hàm độ tin cậy R(t)</div>
                    <div className={`text-2xl font-extrabold ${
                        lastRT < 0.75 ? 'text-red-600' :
                        lastRT < 0.90 ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                        {(lastRT * 100).toFixed(2)}%
                    </div>
                </div>
                <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-50 leading-normal">
                    <div className="mb-2">
                        {lastRT < 0.75 ? (
                            <span className="text-red-600 font-semibold">R(t) &lt; 0.75: Mức độ tin cậy nguy hiểm!</span>
                        ) : lastRT < 0.90 ? (
                            <span className="text-amber-600 font-semibold">R(t) &lt; 0.90: Suy giảm độ tin cậy.</span>
                        ) : (
                            <span className="text-emerald-600 font-semibold">Vận hành cực kỳ tin cậy.</span>
                        )}
                    </div>
                    <div className="text-[10px] text-slate-400 leading-snug">
                        Chạm cảnh báo (&lt; 90%): {rtWarningDay ? <span className="text-amber-600 font-bold">{formatDayToDate(rtWarningDay)} (Ngày {rtWarningDay})</span> : "Không"}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400 leading-snug">
                        Chạm nguy hiểm (&lt; 75%): {rtAlarmDay ? <span className="text-red-600 font-bold">{formatDayToDate(rtAlarmDay)} (Ngày {rtAlarmDay})</span> : "Không"}
                    </div>
                </div>
            </div>

            {/* KPI 5: VSWR System */}
            <div className={`bg-white border-t-4 ${
                lastVSWR >= activeParams.vswrAlarmThreshold ? 'border-red-500' :
                lastVSWR >= activeParams.vswrWarningThreshold ? 'border-amber-500' : 'border-emerald-500'
            } border-x border-b border-sky-100 rounded-xl p-5 shadow-sm shadow-blue-50/50 hover:shadow-md transition-all flex flex-col justify-between`}>
                <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hệ số sóng đứng (VSWR)</div>
                    <div className={`text-2xl font-extrabold ${
                        lastVSWR >= activeParams.vswrAlarmThreshold ? 'text-red-600' :
                        lastVSWR >= activeParams.vswrWarningThreshold ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                        {(lastVSWR ?? 1.00).toFixed(2)}
                    </div>
                </div>
                <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-50 leading-normal">
                    <div className="mb-2">
                        {lastVSWR >= activeParams.vswrAlarmThreshold ? (
                            <span className="text-red-600 font-semibold">VSWR vượt ngưỡng nguy cấp.</span>
                        ) : lastVSWR >= activeParams.vswrWarningThreshold ? (
                            <span className="text-amber-600 font-semibold">Vượt ngưỡng cảnh báo VSWR.</span>
                        ) : (
                            <span className="text-emerald-600 font-semibold">Phối hợp trở kháng anten tốt.</span>
                        )}
                    </div>
                    <div className="text-[10px] text-slate-400 leading-snug">
                        Vượt cảnh báo (&ge; {(activeParams.vswrWarningThreshold || 1.5).toFixed(2)}): {firstVswrWarningDay ? <span className="text-amber-600 font-bold">{formatDayToDate(firstVswrWarningDay)} (Ngày {firstVswrWarningDay})</span> : "Không"}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400 leading-snug">
                        Vượt nguy cấp (&ge; {(activeParams.vswrAlarmThreshold || 2.0).toFixed(2)}): {firstVswrCriticalDay ? <span className="text-red-600 font-bold">{formatDayToDate(firstVswrCriticalDay)} (Ngày {firstVswrCriticalDay})</span> : "Không"}
                    </div>
                </div>
            </div>
            
        </div>
    );
}
