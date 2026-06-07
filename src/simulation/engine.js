// ============================================================
//  SEEDED PSEUDO-RANDOM NUMBER GENERATOR (Mulberry32)
//  Replicates numpy.random.seed(42) deterministic behavior
// ============================================================
function mulberry32(seed) {
    let s = seed;
    return () => {
        s |= 0; s = s + 0x6D2B79F5 | 0;
        let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// Box-Muller transform → standard normal N(0,1)
function makeNormalRNG(seed) {
    const rng = mulberry32(seed);
    let spare = null;
    return (mean = 0, std = 1) => {
        if (spare !== null) { const v = spare; spare = null; return mean + std * v; }
        let u, v, s;
        do { u = rng() * 2 - 1; v = rng() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
        const m = Math.sqrt(-2 * Math.log(s) / s);
        spare = v * m;
        return mean + std * u * m;
    };
}

// ============================================================
//  CORE SIMULATION ENGINE — mirrors Python script exactly
// ============================================================
export function runSimulation(params) {
    const {
        days,
        baselineRF,
        warningThreshold,
        alarmThreshold,
        slope1,       // deg slope before day 120
        slope2,       // deg slope after day 120
        breakDay,     // default 120
        weatherStart, // default 130
        weatherEnd,   // default 140
        weatherMag,   // default -1.5
        envAmp,       // env factor amplitude, default 0.8
        noiseSigma,   // system noise σ, default 0.25
        beta,         // Weibull shape, default 1.5
        eta,          // Weibull scale, default 365
        lookBack,     // LSTM window, default 7
        trainRatio,   // default 0.7
        seed,
    } = params;

    // ── 1. RANDOM STATE (numpy seed=42 equivalent) ──────────
    const normRF = makeNormalRNG(seed);
    const normTemp = makeNormalRNG(seed + 1000);
    const normHum = makeNormalRNG(seed + 2000);
    const normDDM = makeNormalRNG(seed + 3000);
    const normSDM = makeNormalRNG(seed + 4000);

    // ── 2. GENERATE RAW TIME SERIES ─────────────────────────
    const rfRaw = new Float64Array(days);
    const temperature = new Float64Array(days);
    const humidity = new Float64Array(days);
    const ddm = new Float64Array(days);
    const sdm = new Float64Array(days);
    const degTrend = new Float64Array(days);

    for (let t = 0; t < days; t++) {
        // Degradation trend (piecewise linear, 2-phase)
        degTrend[t] = t <= breakDay
            ? slope1 * t
            : (slope1 * breakDay) + slope2 * (t - breakDay);

        // Environmental sinusoidal factor
        const envFactor = envAmp * Math.sin(2 * Math.PI * t / 7);

        // Weather anomaly window
        const weatherAnomaly = (t >= weatherStart && t < weatherEnd) ? weatherMag : 0;

        // System noise N(0, noiseSigma)
        const noise = normRF(0, noiseSigma);

        rfRaw[t] = baselineRF + degTrend[t] + envFactor + weatherAnomaly + noise;

        // Auxiliary features
        temperature[t] = 35 + 5 * Math.sin(2 * Math.PI * t / 30) + normTemp(0, 0.5);
        humidity[t] = 70 + 15 * Math.cos(2 * Math.PI * t / 45) + normHum(0, 2.0)
            + ((t >= weatherStart && t < weatherEnd) ? 12 : 0);
        ddm[t] = normDDM(0, 0.5) + Math.abs(degTrend[t]) * 0.02;
        sdm[t] = 40.0 + normSDM(0, 0.1);
    }

    // ── 3. MIN-MAX SCALER (sklearn MinMaxScaler equivalent) ──
    const features = [rfRaw, ddm, sdm, temperature, humidity];
    const nFeat = features.length;
    const fMin = features.map(f => Math.min(...f));
    const fMax = features.map(f => Math.max(...f));

    const scaled = [];
    for (let t = 0; t < days; t++) {
        const row = [];
        for (let j = 0; j < nFeat; j++) {
            row.push((features[j][t] - fMin[j]) / (fMax[j] - fMin[j]));
        }
        scaled.push(row);
    }

    // ── 4. SLIDING WINDOW DATASET (look_back=7) ──────────────
    const X = [], Y = [];
    for (let i = 0; i < days - lookBack; i++) {
        X.push(scaled.slice(i, i + lookBack));
        Y.push(scaled[i + lookBack][0]);
    }
    const N = X.length;
    const trainSize = Math.floor(N * trainRatio);

    // ── 5. LSTM APPROXIMATION ─────────────────────────────────
    const noiseAI = makeNormalRNG(seed + 9999);

    const predictionsScaled = [];
    for (let i = trainSize; i < N; i++) {
        const window = X[i];
        let alpha = 0.35, ewa = 0;
        let wSum = 0;
        for (let k = 0; k < lookBack; k++) {
            const w = Math.pow(1 - alpha, lookBack - 1 - k);
            ewa += w * window[k][0];
            wSum += w;
        }
        ewa /= wSum;
        const last = window[lookBack - 1][0];
        const prev3 = window[lookBack - 3][0];
        const trend = (last - prev3) / 3 * 0.4;
        const pred = ewa + trend + noiseAI(0, 0.008);
        predictionsScaled.push(Math.max(0, Math.min(1, pred)));
    }

    // ── 6. INVERSE TRANSFORM (scaler.inverse_transform for col 0) ─
    const rfMin = fMin[0], rfRange = fMax[0] - fMin[0];
    const predictionsActual = predictionsScaled.map(v => v * rfRange + rfMin);

    const yTestActual = Y.slice(trainSize).map(v => v * rfRange + rfMin);

    // ── 7. BUILD FINAL RF SERIES (actual + AI predicted) ─────
    const splitIdx = lookBack + trainSize;
    const rfFinal = new Float64Array(days);
    for (let t = 0; t < splitIdx; t++)         rfFinal[t] = rfRaw[t];
    for (let t = splitIdx; t < days; t++)       rfFinal[t] = predictionsActual[t - splitIdx] ?? rfRaw[t];

    const rfActualSeries = Array.from(rfRaw);
    const rfAISeries = new Array(days).fill(null);
    for (let t = splitIdx; t < days; t++) {
        rfAISeries[t] = predictionsActual[t - splitIdx] ?? null;
    }

    // ── 8. HEALTH INDEX HI ────────────────────────────────────
    const hiSeries = rfFinal.map(val => {
        if (val >= baselineRF) return 1.0;
        if (val <= alarmThreshold) return 0.0;
        return (val - alarmThreshold) / (baselineRF - alarmThreshold);
    });

    // ── 9. WEIBULL RELIABILITY R(t) ───────────────────────────
    const rT = new Array(days).fill(1.0);
    let lambdaCumulative = 0;
    for (let t = 1; t < days; t++) {
        const lambda = (beta / eta) * Math.pow(t / eta, beta - 1) * (2.0 - hiSeries[t]);
        lambdaCumulative += lambda;
        rT[t] = Math.exp(-lambdaCumulative);
    }

    // Scan for the first day where HI < 0.3 or R(t) < 0.75
    let firstCriticalDay = null;
    for (let t = 0; t < days; t++) {
        if (hiSeries[t] < 0.3 || rT[t] < 0.75) {
            firstCriticalDay = t + 1; // 1-based day
            break;
        }
    }

    // ── 10. ASSEMBLE CHART DATA ARRAYS ───────────────────────
    const chartData = [];
    for (let t = 0; t < days; t++) {
        chartData.push({
            day: t + 1,
            rfActual: parseFloat(rfActualSeries[t].toFixed(3)),
            rfAI: rfAISeries[t] !== null ? parseFloat(rfAISeries[t].toFixed(3)) : null,
            hi: parseFloat(hiSeries[t].toFixed(4)),
            rt: parseFloat(rT[t].toFixed(4)),
            temp: parseFloat(temperature[t].toFixed(2)),
            humidity: parseFloat(humidity[t].toFixed(2)),
            ddm: parseFloat(ddm[t].toFixed(4)),
        });
    }

    // ── 11. FINAL METRICS ─────────────────────────────────────
    const lastHI = hiSeries[days - 1];
    const lastRT = rT[days - 1];
    const lastRF = rfFinal[days - 1];

    let warnDay90 = null, dangerDay75 = null, estopDay = null;
    for (let t = 0; t < days; t++) {
        if (warnDay90 === null && rT[t] < 0.90) warnDay90 = t + 1;
        if (dangerDay75 === null && rT[t] < 0.75) dangerDay75 = t + 1;
        if (estopDay === null && rfFinal[t] < alarmThreshold) estopDay = t + 1;
    }

    let mse = 0;
    for (let i = 0; i < yTestActual.length; i++) {
        mse += (predictionsActual[i] - yTestActual[i]) ** 2;
    }
    const rmse = Math.sqrt(mse / yTestActual.length);

    return {
        chartData,
        metrics: { lastHI, lastRT, lastRF, warnDay90, dangerDay75, estopDay, rmse, splitIdx, firstCriticalDay },
        params,
    };
}

// ============================================================
//  LOG GENERATING FUNCTION
// ============================================================
export function generateSimulationLogs(chartData, params) {
    const logs = [];
    let hiLv2Logged = false;
    let hiLv3Logged = false;
    let rtWarnLogged = false;
    let rtDangerLogged = false;
    let rfWarnLogged = false;
    let rfAlarmLogged = false;

    chartData.forEach(d => {
        // Check weather / humidity anomaly
        if (d.day >= params.weatherStart && d.day < params.weatherEnd) {
            logs.push({
                day: d.day,
                type: 'warning',
                message: `Thời tiết bất lợi: Độ ẩm tăng cao (${d.humidity}%) & gây hao hụt công suất thêm ${params.weatherMag}%.`
            });
        }
        
        // RF Power checks
        if (d.rfActual < params.alarmThreshold && !rfAlarmLogged) {
            logs.push({
                day: d.day,
                type: 'critical',
                message: `Dừng đài khẩn cấp: Công suất phát RF (${d.rfActual}%) suy giảm dưới ngưỡng cho phép (${params.alarmThreshold}%).`
            });
            rfAlarmLogged = true;
        } else if (d.rfActual < params.warningThreshold && !rfWarnLogged) {
            logs.push({
                day: d.day,
                type: 'warning',
                message: `Cảnh báo công suất: Công suất phát RF (${d.rfActual}%) giảm dưới ngưỡng an toàn (${params.warningThreshold}%).`
            });
            rfWarnLogged = true;
        }

        // Health Index checks
        if (d.hi < 0.3 && !hiLv3Logged) {
            logs.push({
                day: d.day,
                type: 'critical',
                message: `Sức khỏe hệ thống nguy cấp: HI = ${d.hi.toFixed(4)} (Dưới ngưỡng an toàn mức 3).`
            });
            hiLv3Logged = true;
        } else if (d.hi < 0.7 && !hiLv2Logged) {
            logs.push({
                day: d.day,
                type: 'warning',
                message: `Sức khỏe hệ thống suy giảm: HI = ${d.hi.toFixed(4)} (Dưới ngưỡng an toàn mức 2).`
            });
            hiLv2Logged = true;
        }

        // Reliability checks
        if (d.rt < 0.75 && !rtDangerLogged) {
            logs.push({
                day: d.day,
                type: 'critical',
                message: `Hàm tin cậy R(t) rơi vào mức nguy hiểm: R(t) = ${(d.rt * 100).toFixed(2)}% (Yêu cầu kiểm tra & bảo dưỡng gấp).`
            });
            rtDangerLogged = true;
        } else if (d.rt < 0.90 && !rtWarnLogged) {
            logs.push({
                day: d.day,
                type: 'warning',
                message: `Độ tin cậy R(t) giảm dưới 90%: R(t) = ${(d.rt * 100).toFixed(2)}% (Cần lên kế hoạch bảo trì).`
            });
            rtWarnLogged = true;
        }
    });

    // Return logs sorted chronologically
    return logs.sort((a, b) => a.day - b.day);
}

// ============================================================
//  DEFAULT PARAMETERS
// ============================================================
export const DEFAULT_PARAMS = {
    days: 180,
    baselineRF: 100.0,
    warningThreshold: 90.0,
    alarmThreshold: 85.0,
    slope1: -0.04,
    slope2: -0.18,
    breakDay: 120,
    weatherStart: 130,
    weatherEnd: 140,
    weatherMag: -1.5,
    envAmp: 0.8,
    noiseSigma: 0.25,
    beta: 1.5,
    eta: 365,
    lookBack: 7,
    trainRatio: 0.7,
    seed: 42,
};

// ============================================================
//  VIETNAMESE DIACRITIC REMOVER
// ============================================================
export function removeVietnameseTones(str) {
    if (!str) return '';
    let result = str.toString();
    result = result.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    result = result.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    result = result.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    result = result.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    result = result.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    result = result.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    result = result.replace(/đ/g, "d");
    result = result.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    result = result.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    result = result.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    result = result.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    result = result.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    result = result.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    result = result.replace(/Đ/g, "D");
    result = result.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
    result = result.replace(/\u02C6|\u0306|\u031B/g, "");
    return result;
}
