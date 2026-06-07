import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, Zap, ShieldAlert, RefreshCw, AlertTriangle, Info, CheckCircle2, TrendingDown, Menu, ChevronLeft } from 'lucide-react';

// Giả lập phân phối chuẩn
function randomNormal(mean = 0, stdev = 1) {
  let u = 1 - Math.random();
  let v = Math.random();
  let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdev + mean;
}

const generateSimulationData = (days, baseline, warning, alarm) => {
  const data = [];
  let lambdaCumulative = 0;
  const beta = 1.5;
  const eta = 365;

  for (let t = 0; t < days; t++) {
    let degTrend = t <= 120 ? -0.04 * t : (-0.04 * 120) - 0.18 * (t - 120);
    const envFactor = 0.8 * Math.sin(2 * Math.PI * t / 7);
    const weatherAnomaly = (t >= 130 && t < 140) ? -1.5 : 0;
    const systemNoise = randomNormal(0.0, 0.25);
    
    const rfPower = baseline + degTrend + envFactor + weatherAnomaly + systemNoise;
    
    let hi = 1.0;
    if (rfPower >= baseline) hi = 1.0;
    else if (rfPower <= alarm) hi = 0.0;
    else hi = (rfPower - alarm) / (baseline - alarm);

    let rt = 1.0;
    if (t > 0) {
      const lambdaT = (beta / eta) * Math.pow(t / eta, beta - 1) * (2.0 - hi);
      lambdaCumulative += lambdaT;
      rt = Math.exp(-lambdaCumulative);
    }

    let aiForecast = null;
    if (t >= days * 0.7) {
      aiForecast = baseline + degTrend; // Dự báo xu hướng không nhiễu
    }

    data.push({
      day: t,
      rfPower: parseFloat(rfPower.toFixed(2)),
      aiForecast: aiForecast ? parseFloat(aiForecast.toFixed(2)) : null,
      hi: parseFloat(hi.toFixed(4)),
      rt: parseFloat(rt.toFixed(4))
    });
  }
  return data;
};

export default function AviationDashboard() {
  const [params, setParams] = useState({
    days: 180,
    baseline: 100.0,
    warning: 90.0,
    alarm: 85.0
  });

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [toast, setToast] = useState(null);

  const simulate = (isManual = false) => {
    setLoading(true);
    setTimeout(() => {
      const newData = generateSimulationData(
        Number(params.days),
        Number(params.baseline),
        Number(params.warning),
        Number(params.alarm)
      );
      setData(newData);
      setLoading(false);

      if (isManual) {
        // Tìm ngày đầu tiên HI < 0.3 hoặc R(t) < 0.75
        const dangerDay = newData.find(item => item.hi < 0.3 || item.rt < 0.75);
        if (dangerDay) {
          setToast({
            type: 'warning',
            message: `⚠️ CẢNH BÁO HỆ THỐNG: Dự báo vào Ngày thứ ${dangerDay.day}, thiết bị sẽ chạm mức NGUY HIỂM. Yêu cầu lập kế hoạch thay thế linh kiện module RF hoặc kích hoạt hệ thống dự phòng trước ngày này!`
          });
        } else {
          setToast({
            type: 'success',
            message: `✅ HỆ THỐNG ỔN ĐỊNH: Dự báo trong vòng ${params.days} ngày tới không ghi nhận thông số chạm mức nguy hiểm.`
          });
        }
      }
    }, 800);
  };

  useEffect(() => {
    simulate(false);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setParams(prev => ({ ...prev, [name]: value }));
  };

  const lastDay = data.length > 0 ? data[data.length - 1] : { rfPower: 0, hi: 0, rt: 0 };
  
  const getRecommendation = () => {
    if (!lastDay) return null;
    if (lastDay.hi < 0.3 || lastDay.rt < 0.75 || lastDay.rfPower <= params.alarm) {
      return {
        level: 'CRITICAL',
        icon: <ShieldAlert className="w-6 h-6 text-red-400" />,
        color: 'border-red-500/50 bg-red-950/20 text-red-200',
        message: 'CẢNH BÁO KHẨN CẤP: Hệ thống có nguy cơ ngưng hoạt động cao. Yêu cầu dừng đài và bảo trì ngay lập tức!'
      };
    }
    if (lastDay.hi < 0.7 || lastDay.rt < 0.90 || lastDay.rfPower <= params.warning) {
      return {
        level: 'WARNING',
        icon: <AlertTriangle className="w-6 h-6 text-amber-400" />,
        color: 'border-amber-500/50 bg-amber-950/20 text-amber-200',
        message: 'CẢNH BÁO: Thông số đang suy giảm đáng kể. Cần lên lịch bảo trì trong thời gian sớm nhất.'
      };
    }
    return {
      level: 'INFO',
      icon: <CheckCircle2 className="w-6 h-6 text-emerald-400" />,
      color: 'border-emerald-500/50 bg-emerald-950/20 text-emerald-200',
      message: 'HỆ THỐNG ỔN ĐỊNH: Các thông số nằm trong ngưỡng an toàn. Tiếp tục theo dõi định kỳ.'
    };
  };

  const recommendation = getRecommendation();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-6 font-sans">
      <style>{`
        @keyframes slideInUp {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-in-up {
          animation: slideInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent drop-shadow-md uppercase tracking-wide">
            Hệ thống Phân tích & Dự báo Tham số Không lưu
          </h1>
          <p className="text-slate-400 mt-1 text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" /> Giám sát thời gian thực bằng mô hình học máy (AI)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="px-4 py-2.5 bg-slate-800 border border-slate-700/80 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors flex items-center gap-2 shadow-md"
            title={isSidebarCollapsed ? "Hiển thị bảng cấu hình" : "Thu gọn bảng cấu hình"}
          >
            <Menu className="w-5 h-5 text-indigo-400" />
            <span className="text-sm font-semibold">{isSidebarCollapsed ? "Mở Cấu hình" : "Thu gọn"}</span>
          </button>
          <button 
            onClick={() => simulate(true)}
            disabled={loading}
            className="group relative px-6 py-2.5 font-semibold rounded-lg overflow-hidden bg-indigo-600 hover:bg-indigo-500 transition-all duration-300 disabled:opacity-70 shadow-[0_0_15px_rgba(79,70,229,0.4)] hover:shadow-[0_0_25px_rgba(79,70,229,0.6)]"
          >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
            <div className="flex items-center gap-2 relative z-10">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Đang phân tích...' : 'Cập nhật Dự báo'}</span>
            </div>
          </button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { title: 'Công suất RF (Hiện tại)', value: `${lastDay.rfPower} %`, icon: <Zap className="w-5 h-5 text-blue-400" /> },
          { title: 'Chỉ số Sức khỏe (HI)', value: lastDay.hi, icon: <Activity className="w-5 h-5 text-fuchsia-400" /> },
          { title: 'Độ tin cậy R(t)', value: `${(lastDay.rt * 100).toFixed(2)} %`, icon: <TrendingDown className="w-5 h-5 text-emerald-400" /> }
        ].map((card, idx) => (
          <div key={idx} className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-800 p-6 shadow-lg backdrop-blur-sm transition-transform hover:-translate-y-1">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-slate-300 font-medium text-sm">{card.title}</h3>
              <div className="p-2 bg-slate-900 rounded-lg shadow-inner border border-slate-700/50">{card.icon}</div>
            </div>
            <div className="text-3xl font-bold text-slate-100 tracking-tight">
              {loading ? <span className="animate-pulse">...</span> : card.value}
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/5 rounded-full blur-2xl"></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar */}
        <div className={`transition-all duration-300 ${isSidebarCollapsed ? 'hidden lg:block lg:col-span-1' : 'block lg:col-span-3'} space-y-6`}>
          {isSidebarCollapsed ? (
            <button 
              onClick={() => setIsSidebarCollapsed(false)}
              className="w-full bg-slate-800 border border-slate-700/80 rounded-2xl p-4 shadow-xl hover:bg-slate-700/80 flex flex-col items-center gap-4 transition-all group"
              title="Mở rộng cấu hình"
            >
              <Menu className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-semibold text-slate-400 [writing-mode:vertical-lr] tracking-widest mt-2 uppercase">
                CẤU HÌNH
              </div>
            </button>
          ) : (
            <>
              <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
                    <Info className="w-5 h-5 text-indigo-400" /> Cấu hình Tham số
                  </h3>
                  <button 
                    onClick={() => setIsSidebarCollapsed(true)}
                    className="p-1 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded transition-colors"
                    title="Thu gọn"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  {[
                    { label: 'Chu kỳ theo dõi (ngày)', name: 'days', min: 30, max: 365 },
                    { label: 'Công suất định mức (%)', name: 'baseline', min: 50, max: 150 },
                    { label: 'Ngưỡng cảnh báo (%)', name: 'warning', min: 0, max: 100 },
                    { label: 'Ngưỡng dừng đài (%)', name: 'alarm', min: 0, max: 100 },
                  ].map((input, idx) => (
                    <div key={idx}>
                      <label className="block text-sm text-slate-400 mb-1">{input.label}</label>
                      <input 
                        type="number"
                        name={input.name}
                        value={params[input.name]}
                        onChange={handleInputChange}
                        min={input.min} max={input.max}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Recommendation */}
              {recommendation && (
                <div className={`rounded-2xl border ${recommendation.color} p-6 shadow-xl relative overflow-hidden transition-all duration-500`}>
                  <div className="flex items-center gap-3 mb-3">
                    {recommendation.icon}
                    <h3 className="font-bold text-lg">Khuyến nghị AI</h3>
                  </div>
                  <p className="text-sm leading-relaxed">{recommendation.message}</p>
                  
                  {/* Decorative background glow */}
                  <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 bg-current`}></div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Charts Area */}
        <div className={`${isSidebarCollapsed ? 'w-full lg:col-span-11' : 'w-full lg:col-span-9'} space-y-6 transition-all duration-300`}>
          
          {/* Chart 1: RF Power */}
          <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-slate-100">Diễn biến Công suất phát (RF Power)</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.6} vertical={false} />
                  <XAxis dataKey="day" stroke="#64748b" tick={{fill: '#94a3b8', fontSize: 12}} />
                  <YAxis domain={['auto', 'auto']} stroke="#64748b" tick={{fill: '#94a3b8', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '8px', color: '#f8fafc' }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '15px' }} />
                  <ReferenceLine y={params.alarm} label={{ position: 'insideBottomLeft', value: 'Ngưỡng dừng đài', fill: '#ef4444', fontSize: 12 }} stroke="#ef4444" strokeDasharray="3 3" />
                  <ReferenceLine y={params.warning} label={{ position: 'insideTopLeft', value: 'Ngưỡng cảnh báo', fill: '#eab308', fontSize: 12 }} stroke="#eab308" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="rfPower" name="Thực tế (Nhiễu)" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="aiForecast" name="AI Dự báo Xu hướng" stroke="#f43f5e" strokeWidth={3} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2 & 3 row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Chart 2: Health Index */}
            <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-semibold mb-4 text-slate-100">Chỉ số Sức khỏe (HI)</h3>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.6} vertical={false} />
                    <XAxis dataKey="day" stroke="#64748b" tick={{fill: '#94a3b8', fontSize: 12}} />
                    <YAxis domain={[0, 1.1]} stroke="#64748b" tick={{fill: '#94a3b8', fontSize: 12}} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '8px', color: '#f8fafc' }} />
                    <ReferenceLine y={0.7} label={{ value: 'Cảnh báo', fill: '#eab308', fontSize: 11 }} stroke="#eab308" strokeDasharray="3 3" />
                    <ReferenceLine y={0.3} label={{ value: 'Nguy hiểm', fill: '#ef4444', fontSize: 11 }} stroke="#ef4444" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="hi" name="HI" stroke="#d946ef" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Reliability */}
            <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-semibold mb-4 text-slate-100">Hàm Độ tin cậy R(t)</h3>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.6} vertical={false} />
                    <XAxis dataKey="day" stroke="#64748b" tick={{fill: '#94a3b8', fontSize: 12}} />
                    <YAxis domain={[0, 1.1]} stroke="#64748b" tick={{fill: '#94a3b8', fontSize: 12}} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '8px', color: '#f8fafc' }} />
                    <ReferenceLine y={0.9} label={{ value: 'Cảnh báo', fill: '#eab308', fontSize: 11 }} stroke="#eab308" strokeDasharray="3 3" />
                    <ReferenceLine y={0.75} label={{ value: 'Nguy hiểm', fill: '#ef4444', fontSize: 11 }} stroke="#ef4444" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="rt" name="R(t)" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 max-w-md p-4 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 flex items-start gap-3 animate-slide-in-up ${
          toast.type === 'warning' 
            ? 'bg-slate-800/95 border-amber-500/50 text-amber-200 shadow-amber-950/20' 
            : 'bg-slate-800/95 border-emerald-500/50 text-emerald-200 shadow-emerald-950/20'
        }`}>
          <div className="flex-1 text-sm font-medium leading-relaxed text-slate-200">
            {toast.message}
          </div>
          <button 
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-200 text-sm font-semibold p-1 hover:bg-slate-700/50 rounded transition-colors shrink-0"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

