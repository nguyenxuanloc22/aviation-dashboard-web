// ============================================================
//  STYLED TOOLTIP (LIGHT THEME)
// ============================================================
const ChartTooltip = ({ active, payload, label, unit }) => {
    if (!active || !payload?.length) return null;

    const dataPoint = payload[0]?.payload;
    let dateText = '';
    let dayNum = label;

    if (dataPoint) {
        if (dataPoint.date) {
            const parts = dataPoint.date.split('-');
            if (parts.length === 3) {
                dateText = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
        }
        if (dataPoint.day) {
            dayNum = dataPoint.day;
        }
    }

    const titleText = dateText ? `${dateText} (ngày thứ ${dayNum})` : `Ngày ${dayNum}`;

    return (
        <div className="bg-white border border-sky-100 rounded-lg p-3 shadow-lg text-xs">
            <p className="font-bold text-slate-800 mb-1.5">{titleText}</p>
            {payload.map((p, i) => {
                if (p.value === null) return null;
                let displayUnit = unit || '';
                const lowerName = p.name.toLowerCase();
                if (lowerName.includes('vswr') || lowerName.includes('sóng đứng') || lowerName.includes('index') || lowerName.includes('health') || lowerName.includes('tin cậy') || lowerName.includes('r(t)')) {
                    displayUnit = '';
                } else if (lowerName.includes('nhiệt độ')) {
                    displayUnit = ' °C';
                } else if (lowerName.includes('độ ẩm')) {
                    displayUnit = '%';
                } else if (lowerName.includes('mưa') || lowerName.includes('rain')) {
                    displayUnit = '';
                }
                return (
                    <p key={i} className="my-0.5" style={{ color: p.color }}>
                        {p.name}: <span className="font-semibold">{typeof p.value === 'number' ? p.value.toFixed(3) : p.value}</span>{displayUnit}
                    </p>
                );
            })}
        </div>
    );
};

export default ChartTooltip;
