import { Sliders, Settings, TrendingDown, Cloud, ShieldAlert, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import InputRow from './InputRow';
import airportInfo from '../../simulation/ils_info.json';

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
            className={`bg-gradient-to-b from-[#EBF4FC] to-[#F3F8FD] border-r border-slate-200 flex flex-col transition-all duration-300
                fixed lg:relative top-0 bottom-0 left-0 h-full lg:h-auto z-40 lg:z-20 flex-shrink-0 
                ${isSidebarCollapsed 
                    ? '-translate-x-full lg:translate-x-0 lg:w-12' 
                    : 'translate-x-0 lg:w-72 w-72 shadow-2xl lg:shadow-none'
                }`}
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
                                <InputRow label="Ngưỡng cảnh báo RF" name="warningThreshold" value={formParams.warningThreshold} onChange={handleChange} unit="%" />
                                <InputRow label="Ngưỡng dừng đài RF" name="alarmThreshold" value={formParams.alarmThreshold} onChange={handleChange} unit="%" />
                                <InputRow label="Cảnh báo VSWR" name="vswrWarningThreshold" value={formParams.vswrWarningThreshold} onChange={handleChange} step={0.05} min={1.1} max={2.0} hint="Ngưỡng cảnh báo phản xạ anten (mặc định 1.5)" />
                                <InputRow label="Dừng đài VSWR" name="vswrAlarmThreshold" value={formParams.vswrAlarmThreshold} onChange={handleChange} step={0.05} min={1.5} max={3.0} hint="Ngưỡng dừng đài do phản xạ anten (mặc định 2.0)" />
                            </div>
                        )}
                    </div>

                    {/* Accordion Section 2: Degradation */}
                    <div className="space-y-1">
                        {renderAccordionHeader('degradation', <TrendingDown size={14} className="text-blue-600" />, 'Độ suy hao (Degradation)')}
                        {expandedSections.degradation && (
                            <div className="bg-white border border-blue-100 rounded-lg p-3 shadow-xs space-y-1">
                                <InputRow label="RF Power mục tiêu" name="scenarioEndRF" value={formParams.scenarioEndRF} onChange={handleChange} step={0.5} min={85.0} max={98.0} unit="%" hint="Mức RF Power mô phỏng ở ngày thứ 365" />
                                <InputRow label="Năng lượng Ea" name="Ea" value={formParams.Ea} onChange={handleChange} step={0.05} min={0.1} max={2.0} unit="eV" hint="Hệ số nhiệt Arrhenius (mặc định 0.70)" />
                                <InputRow label="Mũ độ ẩm Peck" name="humidityExponent" value={formParams.humidityExponent} onChange={handleChange} step={0.1} min={1.0} max={5.0} hint="Hệ số Peck cho ẩm nhà trạm (mặc định 2.66)" />
                            </div>
                        )}
                    </div>

                    {/* Accordion Section 3: Weather Climatology */}
                    <div className="space-y-1">
                        {renderAccordionHeader('weather', <Cloud size={14} className="text-blue-600" />, `Khí hậu sân bay ${airportInfo.AIRPORT_NAME?.replace(" International Airport", "")?.replace(" Airport", "") || "Vinh"}`)}
                        {expandedSections.weather && (
                            <div className="bg-white border border-blue-100 rounded-lg p-3 shadow-xs space-y-2 text-[10px] text-slate-500 leading-relaxed font-medium">
                                <p>
                                    Hệ thống tự động đồng bộ hóa điều kiện nhiệt độ, độ ẩm trạm (Shelter Humidity), và lượng mưa theo các chu kỳ tháng thực tế của ${airportInfo.AIRPORT_NAME?.replace(" International Airport", "")?.replace(" Airport", "") || "Vinh"} (${airportInfo.AIRPORT_ICAO || "VVVH"}):
                                </p>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li>Mùa khô (Tháng 1-4): Ít mưa, nhiệt độ mát mẻ.</li>
                                    <li>Mùa hè ẩm (Tháng 5-6): Bắt đầu nắng nóng.</li>
                                    <li>Mùa bão (Tháng 7-11): Đỉnh lượng mưa và độ ẩm trạm tăng cao (Shelter Humidity đạt ~70%).</li>
                                    <li>Mùa đông ẩm (Tháng 12): Mát mẻ, mưa phùn nhẹ.</li>
                                </ul>
                                <p className="text-blue-600 font-semibold border-t border-slate-100 pt-1">
                                    ✓ Đã kích hoạt 16 sự kiện mưa dông ngẫu nhiên ở giai đoạn tháng 7-11 để mô phỏng tác động sụt giảm RF.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Accordion Section 4: Weibull Reliability */}
                    <div className="space-y-1">
                        {renderAccordionHeader('weibull', <ShieldAlert size={14} className="text-blue-600" />, 'Độ tin cậy R(t) Weibull')}
                        {expandedSections.weibull && (
                            <div className="bg-white border border-blue-100 rounded-lg p-3 shadow-xs space-y-1">
                                <InputRow label="Shape β" name="beta" value={formParams.beta} onChange={handleChange} step={0.1} min={0.5} max={5} hint="β=1.5 → Pha hao mòn (Wear-out)" />
                                <InputRow label="Scale η" name="eta" value={formParams.eta} onChange={handleChange} step={10} unit="ngày" hint="MTTF trung bình ≈ 730 ngày" />
                            </div>
                        )}
                    </div>

                    {/* Accordion Section 5: LSTM */}
                    <div className="space-y-1">
                        {renderAccordionHeader('lstm', <Settings size={14} className="text-blue-600" />, 'Cấu hình LSTM')}
                        {expandedSections.lstm && (
                            <div className="bg-white border border-blue-100 rounded-lg p-3 shadow-xs space-y-1">
                                <InputRow label="Look-back window" name="lookBack" value={formParams.lookBack} onChange={handleChange} step={1} min={10} max={60} unit="ngày" />
                                <InputRow label="Tỷ lệ tập Train" name="trainRatio" value={formParams.trainRatio} onChange={handleChange} step={0.01} min={0.5} max={0.9} hint="0.748 = ~273 ngày train (hết tháng 9)" />
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
