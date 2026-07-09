// ============================================================
//  SIDEBAR INPUT FIELD
// ============================================================
export default function InputRow({ label, name, value, onChange, step = 'any', min, max, unit, hint, disabled }) {
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
                    disabled={disabled}
                    className="flex-1 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors w-full" 
                />
                {unit && <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">{unit}</span>}
            </div>
            {hint && <p className="text-[9px] text-slate-400 mt-0.5 italic leading-tight">{hint}</p>}
        </div>
    );
}
