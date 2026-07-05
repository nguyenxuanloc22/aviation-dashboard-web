import React from 'react';
import { Plane, Radio, Compass, MapPin } from 'lucide-react';
import airportInfo from '../../simulation/ils_info.json';

export default function AirportInfoPanel() {
    // Fallback if data is missing
    const info = airportInfo || {
        AIRPORT_ICAO: "VVVH",
        AIRPORT_NAME: "Vinh International Airport",
        RUNWAY: "RWY 17/35",
        ILS_RWY: "RWY 17",
        ILS_ID: "IVH",
        LOC_FREQ_MHZ: 108.300,
        GP_FREQ_MHZ: 334.100,
        DME_CHANNEL: "CH 20X"
    };

    return (
        <div className="bg-white border border-sky-100 rounded-xl p-5 shadow-sm shadow-blue-50/50 hover:shadow-md transition-all duration-200">
            <h3 className="text-xs font-extrabold text-slate-700 flex items-center gap-2 tracking-wider mb-4 uppercase">
                <Plane size={16} className="text-blue-600 animate-[pulse_3s_infinite]" />
                Thông tin đài dẫn đường ILS & Sân bay
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Airport Name & ICAO */}
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex gap-3 items-center">
                    <div className="bg-blue-50 text-blue-600 p-2 rounded-lg flex items-center justify-center flex-shrink-0">
                        <MapPin size={16} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Sân bay / ICAO</div>
                        <div className="text-xs font-bold text-slate-700 leading-tight truncate">{info.AIRPORT_NAME}</div>
                        <div className="text-[10px] text-blue-600 font-extrabold mt-0.5">{info.AIRPORT_ICAO}</div>
                    </div>
                </div>

                {/* Runway Info */}
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex gap-3 items-center">
                    <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Compass size={16} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Đường cất hạ cánh</div>
                        <div className="text-xs font-bold text-slate-700 leading-tight">{info.RUNWAY}</div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">Hướng ILS: <span className="font-bold text-emerald-600">{info.ILS_RWY}</span></div>
                    </div>
                </div>

                {/* LOC & GP Frequencies */}
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex gap-3 items-center">
                    <div className="bg-violet-50 text-violet-600 p-2 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Radio size={16} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tần số hoạt động</div>
                        <div className="text-xs font-bold text-slate-700 leading-tight">LOC: {info.LOC_FREQ_MHZ.toFixed(3)} MHz</div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">GP: <span className="font-bold text-violet-600">{info.GP_FREQ_MHZ.toFixed(3)} MHz</span></div>
                    </div>
                </div>

                {/* DME & Station ID */}
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex gap-3 items-center">
                    <div className="bg-amber-50 text-amber-600 p-2 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Radio size={16} className="rotate-12" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Định danh DME / ID</div>
                        <div className="text-xs font-bold text-slate-700 leading-tight">DME: {info.DME_CHANNEL}</div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">Mã nhận diện: <span className="font-bold text-amber-600">{info.ILS_ID}</span></div>
                    </div>
                </div>

            </div>
        </div>
    );
}
