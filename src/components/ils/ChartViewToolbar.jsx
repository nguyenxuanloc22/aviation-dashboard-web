// ============================================================
//  CHART VIEW TOOLBAR
//  Props:
//    chartView, setChartView
// ============================================================
export default function ChartViewToolbar({ chartView, setChartView }) {
    return (
        <div className="flex flex-wrap items-center gap-2 bg-white border border-sky-100 rounded-xl px-4 py-3 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1 hidden sm:inline">Hiển thị:</span>
            {[
                { id: 'all',     label: 'Tất cả',              icon: '⊞',  color: 'blue'   },
                { id: 'rf',      label: 'RF Power',             icon: '①',  color: 'indigo' },
                { id: 'health',  label: 'Sức khỏe & Độ tin cậy', icon: '②③', color: 'violet' },
                { id: 'vswr',    label: 'Chỉ số VSWR',          icon: '④',  color: 'emerald' },
                { id: 'env',     label: 'Môi trường',           icon: '⑤',  color: 'orange' },
            ].map(tab => {
                const active = chartView === tab.id;
                const colorMap = {
                    blue:   active ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200'   : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600',
                    indigo: active ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600',
                    violet: active ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-200' : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600',
                    emerald: active ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:text-emerald-600',
                    orange: active ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-200' : 'bg-white text-slate-500 border-slate-200 hover:border-orange-300 hover:text-orange-600',
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
    );
}
