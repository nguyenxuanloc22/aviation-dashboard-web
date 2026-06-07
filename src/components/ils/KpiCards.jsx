// ============================================================
//  KPI SUMMARY CARDS (3-column row)
//  Props:
//    lastRF, lastHI, lastRT
//    activeParams  (warningThreshold, alarmThreshold)
// ============================================================
export default function KpiCards({ lastRF, lastHI, lastRT, activeParams }) {
    return (
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
    );
}
