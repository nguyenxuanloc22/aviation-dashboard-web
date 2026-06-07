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

export default ChartTooltip;
