// ============================================================
//  KPI SUMMARY CARDS (4-column row)
//  Props:
//    lastRF, lastHI, lastRT
//    activeParams  (warningThreshold, alarmThreshold)
//    metrics (firstWarningDay, firstCriticalDay)
// ============================================================
export default function KpiCards({ lastRF, lastHI, lastRT, activeParams, metrics }) {
    const { firstWarningDay, firstCriticalDay } = metrics || {};
    
    // Status classification:
    // NGUY HIỂM (RF < 88), CẢNH BÁO (88 <= RF < 92), BÌNH THƯỜNG (RF >= 92)
    let status = "BÌNH THƯỜNG";
    let statusColor = "emerald";
    let statusText = "Hệ thống vận hành an toàn";
    
    if (lastRF < activeParams.alarmThreshold) {
        status = "NGUY HIỂM";
        statusColor = "red";
        statusText = "Yêu cầu bảo dưỡng khẩn cấp!";
    } else if (lastRF < activeParams.warningThreshold) {
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
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
                        Chạm cảnh báo (92%): {firstWarningDay ? <span className="text-amber-600 font-bold">Ngày {firstWarningDay}</span> : "Không"}
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
                    {lastRF < activeParams.alarmThreshold ? (
                        <span className="text-red-600 font-semibold">Dưới ngưỡng an toàn dừng đài ({activeParams.alarmThreshold}%).</span>
                    ) : lastRF < activeParams.warningThreshold ? (
                        <span className="text-amber-600 font-semibold">Dưới ngưỡng cảnh báo ({activeParams.warningThreshold}%).</span>
                    ) : (
                        <span className="text-emerald-600 font-semibold">Đạt chuẩn công suất thiết kế.</span>
                    )}
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
                    Chỉ số sức khỏe HI cuối: <span className="font-semibold text-slate-700">{lastHI.toFixed(2)}</span>
                    <div className="text-[10px] text-slate-400">
                        Chạm mức nguy cấp: {firstCriticalDay ? <span className="text-red-500 font-semibold">Ngày {firstCriticalDay}</span> : "Không"}
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
                    {lastRT < 0.75 ? (
                        <span className="text-red-600 font-semibold">R(t) &lt; 0.75: Mức độ tin cậy nguy hiểm!</span>
                    ) : lastRT < 0.90 ? (
                        <span className="text-amber-600 font-semibold">R(t) &lt; 0.90: Suy giảm độ tin cậy.</span>
                    ) : (
                        <span className="text-emerald-600 font-semibold">Vận hành cực kỳ tin cậy.</span>
                    )}
                </div>
            </div>
            
        </div>
    );
}
