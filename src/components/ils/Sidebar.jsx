import { Sliders, Settings, TrendingDown, Cloud, ShieldAlert, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import InputRow from './InputRow';

// ============================================================
//  SIDEBAR WITH ACCORDIONS
//  Props:
//    isSidebarCollapsed, setIsSidebarCollapsed
//    expandedSections, toggleSection
//    formParams, handleChange, handleReset
//    hasUnsavedChanges
// ============================================================
export default function Sidebar({
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    expandedSections,
    toggleSection,
    formParams,
    handleChange,
    handleReset,
    hasUnsavedChanges,
}) {
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
    );
}
