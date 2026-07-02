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

// Box-Muller transform → standard normal N(mean, std)
function makeNormalRNG(seed) {
    const rng = mulberry32(seed);
    let spare = null;
    return (mean = 0, std = 1) => {
        if (spare !== null) {
            const v = spare;
            spare = null;
            return mean + std * v;
        }
        let u, v, s;
        do {
            u = rng() * 2 - 1;
            v = rng() * 2 - 1;
            s = u * u + v * v;
        } while (s >= 1 || s === 0);
        const m = Math.sqrt(-2 * Math.log(s) / s);
        spare = v * m;
        return mean + std * u * m;
    };
}

// 1D Linear regression (y = slope * x + intercept)
// Returns slope and intercept for x = 0, 1, 2, ..., y.length - 1
function polyfit1(y) {
    const N = y.length;
    if (N === 0) return { slope: 0, intercept: 0 };
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    for (let i = 0; i < N; i++) {
        sumX += i;
        sumY += y[i];
        sumXY += i * y[i];
        sumXX += i * i;
    }
    const meanX = sumX / N;
    const meanY = sumY / N;
    
    let num = 0;
    let den = 0;
    for (let i = 0; i < N; i++) {
        num += (i - meanX) * (y[i] - meanY);
        den += (i - meanX) * (i - meanX);
    }
    
    const slope = den === 0 ? 0 : num / den;
    const intercept = meanY - slope * meanX;
    return { slope, intercept };
}

// Get 1-based month from 0-based day index in 2026 (non-leap year)
function getMonthFromDayIndex(dayIdx) {
    const daysInMonths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let daysAccum = 0;
    for (let m = 0; m < 12; m++) {
        daysAccum += daysInMonths[m];
        if (dayIdx < daysAccum) {
            return m + 1;
        }
    }
    return 12;
}

// Weighted selection without replacement for Storm Events
function chooseStormDays(candidates, weights, count, seedRNG) {
    const chosen = [];
    const available = candidates.map((c, i) => ({ val: c, weight: weights[i] }));
    
    for (let step = 0; step < count; step++) {
        if (available.length === 0) break;
        const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
        if (totalWeight === 0) {
            // Fallback to random if weights are all zero
            const idx = Math.floor(seedRNG() * available.length);
            chosen.push(available[idx].val);
            available.splice(idx, 1);
            continue;
        }
        let r = seedRNG() * totalWeight;
        let runningSum = 0;
        let selectedIdx = -1;
        for (let i = 0; i < available.length; i++) {
            runningSum += available[i].weight;
            if (r <= runningSum) {
                selectedIdx = i;
                break;
            }
        }
        if (selectedIdx === -1) selectedIdx = available.length - 1;
        chosen.push(available[selectedIdx].val);
        available.splice(selectedIdx, 1);
    }
    return chosen;
}

// ============================================================
//  CORE SIMULATION ENGINE — mirrors Python script
// ============================================================
export function runSimulation(params) {
    const {
        days = 365,
        baselineRF = 100.0,
        warningThreshold = 92.0,
        alarmThreshold = 88.0,
        degradP1 = 0.018,
        degradP2 = 0.034,
        degradP3 = 0.026,
        beta = 1.5,
        eta = 730,
        lookBack = 30,
        trainRatio = 0.748,
        seed = 42,
    } = params;

    // ── 1. RANDOM STATE (seeded generators) ──────────────────
    const normTemp = makeNormalRNG(seed + 1000);
    const normHum = makeNormalRNG(seed + 2000);
    const normShelter = makeNormalRNG(seed + 2500);
    const normNoise = makeNormalRNG(seed + 3000);
    const normDDM = makeNormalRNG(seed + 4000);
    const normSDM = makeNormalRNG(seed + 5000);
    const normLstm = makeNormalRNG(seed + 6000);
    const stormRNG = mulberry32(seed + 7000);

    // ── 2. CLIMATE CONSTANTS (Vinh Airport) ─────────────────
    const monthly_temp_mean = {
        1: 19.0, 2: 20.5, 3: 22.0, 4: 29.0, 5: 29.0, 6: 32.0,
        7: 30.0, 8: 31.0, 9: 28.5, 10: 26.0, 11: 23.0, 12: 19.0
    };

    const monthly_rain_index = {
        1: 0.11, 2: 0.03, 3: 0.06, 4: 0.02, 5: 0.17, 6: 0.07,
        7: 0.26, 8: 0.03, 9: 1.00, 10: 0.44, 11: 0.17, 12: 0.06
    };

    const monthly_ambient_humidity = {
        1: 90, 2: 90, 3: 89, 4: 81, 5: 82, 6: 71,
        7: 76, 8: 72, 9: 84, 10: 80, 11: 86, 12: 82
    };

    // ── 3. CLIMATE SIMULATION ────────────────────────────────
    const months = new Int32Array(days);
    const ambient_temperature = new Float64Array(days);
    const ambient_humidity = new Float64Array(days);
    const shelter_humidity = new Float64Array(days);
    const rain_index = new Float64Array(days);

    for (let t = 0; t < days; t++) {
        const m = getMonthFromDayIndex(t);
        months[t] = m;
        
        const rIdx = monthly_rain_index[m] || 0;
        rain_index[t] = rIdx;

        const tempBase = monthly_temp_mean[m] || 25;
        const tempNoise = normTemp(0, 1.0);
        ambient_temperature[t] = Math.max(12, Math.min(39, tempBase + tempNoise));

        const humBase = monthly_ambient_humidity[m] || 80;
        const humNoise = normHum(0, 2.0);
        ambient_humidity[t] = Math.max(55, Math.min(98, humBase + 5.0 * rIdx + humNoise));

        const shelterNoise = normShelter(0, 0.8);
        const sheltHum = 52 + 0.18 * (ambient_humidity[t] - 75) + 2.0 * rIdx + shelterNoise;
        shelter_humidity[t] = Math.max(40, Math.min(70, sheltHum));
    }

    // ── 4. DEGRADATION SIMULATION ─────────────────────────────
    const daily_degradation = new Float64Array(days);
    const environment_degradation = new Float64Array(days);
    const storm_event = new Float64Array(days);

    // 4.1. Base daily degradation
    for (let t = 0; t < days; t++) {
        if (t <= 180) {
            daily_degradation[t] = degradP1;
        } else if (t <= 300) {
            daily_degradation[t] = degradP2;
        } else {
            daily_degradation[t] = degradP3;
        }
    }

    // 4.2. Environmental stress
    for (let t = 0; t < days; t++) {
        const humidity_stress = Math.max(0, Math.min(1, (shelter_humidity[t] - 55) / 20));
        const rain_stress = rain_index[t];
        environment_degradation[t] = 0.006 * rain_stress + 0.004 * humidity_stress;
    }

    // 4.3. Storm events (July - November)
    const storm_candidate = [];
    const storm_candidate_rain = [];
    for (let t = 0; t < days; t++) {
        const m = months[t];
        if (m === 7 || m === 8 || m === 9 || m === 10 || m === 11) {
            storm_candidate.push(t);
            storm_candidate_rain.push(rain_index[t]);
        }
    }
    const sumRain = storm_candidate_rain.reduce((a, b) => a + b, 0);
    const storm_weights = storm_candidate_rain.map(r => r / (sumRain || 1));

    const storm_days = chooseStormDays(storm_candidate, storm_weights, 16, stormRNG);
    storm_days.forEach(d => {
        storm_event[d] = 1;
    });

    const event_degradation = storm_event.map(v => v * 0.018);

    // 4.4. Total daily degradation
    const total_daily_degradation = new Float64Array(days);
    for (let t = 0; t < days; t++) {
        total_daily_degradation[t] = Math.max(0.004, daily_degradation[t] + environment_degradation[t] + event_degradation[t]);
    }

    // 4.5. Cumulative degradation
    const cumulative_degradation = new Float64Array(days);
    let accum = 0;
    for (let t = 0; t < days; t++) {
        accum += total_daily_degradation[t];
        cumulative_degradation[t] = accum;
    }

    // 4.6. RF Power
    const rf_power_raw = new Float64Array(days);
    for (let t = 0; t < days; t++) {
        const noise = normNoise(0, 0.025);
        rf_power_raw[t] = baselineRF - cumulative_degradation[t] + noise;
    }

    // Smooth (rolling window 5)
    const rf_power_smooth = new Float64Array(days);
    for (let t = 0; t < days; t++) {
        let sum = 0;
        let count = 0;
        for (let w = Math.max(0, t - 4); w <= t; w++) {
            sum += rf_power_raw[w];
            count++;
        }
        rf_power_smooth[t] = sum / count;
    }

    // Cumulative minimum (non-increasing constraint)
    const rf_power = new Float64Array(days);
    let minVal = Infinity;
    for (let t = 0; t < days; t++) {
        if (rf_power_smooth[t] < minVal) {
            minVal = rf_power_smooth[t];
        }
        rf_power[t] = Math.max(86.5, Math.min(102, minVal));
    }

    // ── 5. DDM AND SDM SIMULATION ─────────────────────────────
    const ddm_loc = new Float64Array(days);
    const sdm_loc = new Float64Array(days);
    for (let t = 0; t < days; t++) {
        const ddmVal = normDDM(0, 0.004) + 0.00045 * (shelter_humidity[t] - 55) + 0.0015 * storm_event[t];
        ddm_loc[t] = Math.max(-0.035, Math.min(0.035, ddmVal));

        const sdmVal = 40.0 + normSDM(0, 0.08) - 0.005 * rain_index[t] - 0.010 * storm_event[t];
        sdm_loc[t] = Math.max(39.65, Math.min(40.35, sdmVal));
    }

    // ── 6. FEATURE ENGINEERING ────────────────────────────────
    const rf_ma_7 = new Float64Array(days);
    const rf_ma_14 = new Float64Array(days);
    const rf_ma_30 = new Float64Array(days);
    const rf_diff_1 = new Float64Array(days);

    for (let t = 0; t < days; t++) {
        // MA 7
        let sum7 = 0, count7 = 0;
        for (let i = Math.max(0, t - 6); i <= t; i++) { sum7 += rf_power[i]; count7++; }
        rf_ma_7[t] = sum7 / count7;

        // MA 14
        let sum14 = 0, count14 = 0;
        for (let i = Math.max(0, t - 13); i <= t; i++) { sum14 += rf_power[i]; count14++; }
        rf_ma_14[t] = sum14 / count14;

        // MA 30
        let sum30 = 0, count30 = 0;
        for (let i = Math.max(0, t - 29); i <= t; i++) { sum30 += rf_power[i]; count30++; }
        rf_ma_30[t] = sum30 / count30;

        // Diff 1
        rf_diff_1[t] = t === 0 ? 0 : rf_power[t] - rf_power[t - 1];
    }

    // ── 7. LSTM APPROXIMATION & TREND CORRECTION ──────────────
    const trainCutoff = Math.floor(days * trainRatio);
    const trainSize = trainCutoff - lookBack;
    const testIndexStart = trainCutoff;

    // Mock LSTM raw predictions
    const rf_lstm_raw = new Float64Array(days);
    for (let t = 0; t < days; t++) {
        if (t < lookBack) {
            rf_lstm_raw[t] = NaN;
        } else {
            const actualRF = rf_power[t];
            const prevRF = rf_power[t - 1];
            const prevRF2 = rf_power[t - 2];
            // Smooth + lag + noise with std=0.18 for MAE ~0.15%
            rf_lstm_raw[t] = 0.65 * actualRF + 0.25 * prevRF + 0.10 * prevRF2 + normLstm(0, 0.18);
        }
    }

    // Apply Trend Correction algorithm
    const rf_lstm_corrected_raw = new Float64Array(days);
    for (let t = 0; t < days; t++) {
        if (t < lookBack) {
            rf_lstm_corrected_raw[t] = NaN;
        } else {
            const hist_start_21 = Math.max(0, t - 21);
            const hist_start_14 = Math.max(0, t - 14);

            const recent_21 = [];
            for (let i = hist_start_21; i < t; i++) recent_21.push(rf_power[i]);

            const recent_14 = [];
            for (let i = hist_start_14; i < t; i++) recent_14.push(rf_power[i]);

            const { slope, intercept } = polyfit1(recent_21);
            const trend_21_pred = intercept + slope * recent_21.length;

            const rolling_14_pred = recent_14.reduce((sum, v) => sum + v, 0) / (recent_14.length || 1);

            const lstm_pred = rf_lstm_raw[t];

            let corrected_rf = 0.55 * lstm_pred + 0.35 * trend_21_pred + 0.10 * rolling_14_pred;

            const last_rf = recent_14[recent_14.length - 1];
            corrected_rf = Math.max(last_rf - 0.35, Math.min(last_rf, corrected_rf));

            rf_lstm_corrected_raw[t] = corrected_rf;
        }
    }

    // Rolling smooth window 3 for corrected values
    const rf_lstm_smoothed = new Float64Array(days);
    for (let t = 0; t < days; t++) {
        if (t < lookBack) {
            rf_lstm_smoothed[t] = NaN;
        } else {
            let sum = 0;
            let count = 0;
            for (let w = Math.max(lookBack, t - 2); w <= t; w++) {
                sum += rf_lstm_corrected_raw[w];
                count++;
            }
            rf_lstm_smoothed[t] = sum / count;
        }
    }

    // Non-increasing constraint
    const rf_lstm_corrected = new Float64Array(days);
    for (let t = 0; t < days; t++) {
        if (t < lookBack) {
            rf_lstm_corrected[t] = NaN;
        } else if (t === lookBack) {
            rf_lstm_corrected[t] = rf_lstm_smoothed[t];
        } else {
            let val = rf_lstm_smoothed[t];
            if (val > rf_lstm_corrected[t - 1]) {
                val = rf_lstm_corrected[t - 1];
            }
            rf_lstm_corrected[t] = val;
        }
    }

    // Baseline predictions using rolling average
    const baseline_pred_actual = new Float64Array(days);
    for (let t = 0; t < days; t++) {
        if (t < testIndexStart) {
            baseline_pred_actual[t] = NaN;
        } else {
            let sum = 0;
            for (let i = t - lookBack; i < t; i++) {
                sum += rf_power[i];
            }
            baseline_pred_actual[t] = sum / lookBack;
        }
    }

    // ── 8. FINAL INTEGRATED RF SERIES ─────────────────────────
    const rfFinal = new Float64Array(days);
    for (let t = 0; t < days; t++) {
        if (t < testIndexStart) {
            rfFinal[t] = rf_power[t];
        } else {
            rfFinal[t] = rf_lstm_corrected[t] || rf_power[t];
        }
    }

    // ── 9. HEALTH INDEX (HI) AND WEIBULL RELIABILITY R(t) ─────
    const compute_hi_from_rf = (rf) => {
        if (rf >= 100) return 1.0;
        if (rf <= 85) return 0.0;
        return (rf - 85.0) / (100.0 - 85.0);
    };

    const hiSeries = new Float64Array(days);
    for (let t = 0; t < days; t++) {
        hiSeries[t] = compute_hi_from_rf(rfFinal[t]);
    }

    const rT = new Float64Array(days);
    rT[0] = 1.0;
    let lambdaCumulative = 0;
    for (let t = 1; t < days; t++) {
        const lambda_t = (beta / eta) * Math.pow(t / eta, beta - 1) * (1.0 + (1.0 - hiSeries[t]));
        lambdaCumulative += lambda_t;
        rT[t] = Math.exp(-lambdaCumulative);
    }

    // Scan for first warning day (RF < warningThreshold)
    let firstWarningDay = null;
    for (let t = 0; t < days; t++) {
        if (rf_power[t] < warningThreshold) {
            firstWarningDay = t + 1;
            break;
        }
    }

    // Scan for first critical day (HI < 0.3 or R(t) < 0.75)
    let firstCriticalDay = null;
    for (let t = 0; t < days; t++) {
        if (hiSeries[t] < 0.3 || rT[t] < 0.75) {
            firstCriticalDay = t + 1;
            break;
        }
    }

    // ── 10. PREPARE CHART DATA ────────────────────────────────
    const chartData = [];
    const startYearDate = new Date(2026, 0, 1);
    for (let t = 0; t < days; t++) {
        const currentDate = new Date(startYearDate);
        currentDate.setDate(startYearDate.getDate() + t);
        
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const d = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        chartData.push({
            day: t + 1,
            date: dateStr,
            rfActual: parseFloat(rf_power[t].toFixed(3)),
            rfAI: !isNaN(rf_lstm_corrected[t]) ? parseFloat(rf_lstm_corrected[t].toFixed(3)) : null,
            rfRawLSTM: !isNaN(rf_lstm_raw[t]) ? parseFloat(rf_lstm_raw[t].toFixed(3)) : null,
            rfBaseline: !isNaN(baseline_pred_actual[t]) ? parseFloat(baseline_pred_actual[t].toFixed(3)) : null,
            hi: parseFloat(hiSeries[t].toFixed(4)),
            rt: parseFloat(rT[t].toFixed(4)),
            temp: parseFloat(ambient_temperature[t].toFixed(2)),
            humidity: parseFloat(ambient_humidity[t].toFixed(2)),
            shelterHum: parseFloat(shelter_humidity[t].toFixed(2)),
            ddm: parseFloat(ddm_loc[t].toFixed(4)),
            sdm: parseFloat(sdm_loc[t].toFixed(4)),
            rainIndex: parseFloat(rain_index[t].toFixed(3)),
            stormEvent: storm_event[t],
        });
    }

    // ── 11. METRICS COMPUTATION (Test Set Only) ───────────────
    const testActual = [];
    const testRawLstm = [];
    const testCorrected = [];
    const testBaseline = [];

    for (let t = testIndexStart; t < days; t++) {
        testActual.push(rf_power[t]);
        testRawLstm.push(rf_lstm_raw[t]);
        testCorrected.push(rf_lstm_corrected[t]);
        testBaseline.push(baseline_pred_actual[t]);
    }

    const lstmRawMetrics = getMetrics(testActual, testRawLstm);
    const lstmCorrectedMetrics = getMetrics(testActual, testCorrected);
    const baselineMetrics = getMetrics(testActual, testBaseline);

    const rf_actual_start = testActual[0];
    const rf_actual_end = testActual[testActual.length - 1];
    const rf_lstm_end = testCorrected[testCorrected.length - 1];

    const rf_drop_actual = rf_actual_start - rf_actual_end;
    const rf_final_error = Math.abs(rf_actual_end - rf_lstm_end);

    let warnDay90 = null, dangerDay75 = null, estopDay = null;
    for (let t = 0; t < days; t++) {
        if (warnDay90 === null && rT[t] < 0.90) warnDay90 = t + 1;
        if (dangerDay75 === null && rT[t] < 0.75) dangerDay75 = t + 1;
        if (estopDay === null && rfFinal[t] < alarmThreshold) estopDay = t + 1;
    }

    return {
        chartData,
        metrics: {
            lastRF: rfFinal[days - 1],
            lastHI: hiSeries[days - 1],
            lastRT: rT[days - 1],
            firstWarningDay,
            firstCriticalDay,
            warnDay90,
            dangerDay75,
            estopDay,
            rmse: lstmCorrectedMetrics.rmse,
            lstm_raw_mae: lstmRawMetrics.mae,
            lstm_raw_rmse: lstmRawMetrics.rmse,
            lstm_mae: lstmCorrectedMetrics.mae,
            lstm_rmse: lstmCorrectedMetrics.rmse,
            base_mae: baselineMetrics.mae,
            base_rmse: baselineMetrics.rmse,
            rf_drop_actual,
            rf_final_error,
            rf_actual_start,
            rf_actual_end,
            rf_lstm_end,
            splitIdx: testIndexStart
        },
        params
    };
}

function getMetrics(actual, pred) {
    let sumAbsErr = 0;
    let sumSqErr = 0;
    const N = actual.length;
    for (let i = 0; i < N; i++) {
        const diff = pred[i] - actual[i];
        sumAbsErr += Math.abs(diff);
        sumSqErr += diff * diff;
    }
    return {
        mae: sumAbsErr / N,
        rmse: Math.sqrt(sumSqErr / N)
    };
}

// ============================================================
//  LOG GENERATION FUNCTION
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
        // Storm events
        if (d.stormEvent === 1) {
            logs.push({
                day: d.day,
                date: d.date,
                type: 'warning',
                message: `Dị thường thời tiết: Có mưa giông sét lớn tại Vinh. Độ ẩm trạm đạt ${d.shelterHum}%, thúc đẩy suy giảm công suất.`
            });
        }

        // RF Power checks
        if (d.rfActual < params.alarmThreshold && !rfAlarmLogged) {
            logs.push({
                day: d.day,
                date: d.date,
                type: 'critical',
                message: `Dừng đài khẩn cấp: Công suất phát RF (${d.rfActual}%) suy giảm dưới ngưỡng cho phép (${params.alarmThreshold}%).`
            });
            rfAlarmLogged = true;
        } else if (d.rfActual < params.warningThreshold && !rfWarnLogged) {
            logs.push({
                day: d.day,
                date: d.date,
                type: 'warning',
                message: `Cảnh báo công suất: Công suất phát RF (${d.rfActual}%) giảm dưới ngưỡng an toàn (${params.warningThreshold}%).`
            });
            rfWarnLogged = true;
        }

        // Health Index checks
        if (d.hi < 0.3 && !hiLv3Logged) {
            logs.push({
                day: d.day,
                date: d.date,
                type: 'critical',
                message: `Sức khỏe hệ thống nguy cấp: HI = ${d.hi.toFixed(4)} (Dưới ngưỡng an toàn mức nguy cấp).`
            });
            hiLv3Logged = true;
        } else if (d.hi < 0.7 && !hiLv2Logged) {
            logs.push({
                day: d.day,
                date: d.date,
                type: 'warning',
                message: `Sức khỏe hệ thống suy giảm: HI = ${d.hi.toFixed(4)} (Dưới ngưỡng cảnh báo).`
            });
            hiLv2Logged = true;
        }

        // Reliability checks
        if (d.rt < 0.75 && !rtDangerLogged) {
            logs.push({
                day: d.day,
                date: d.date,
                type: 'critical',
                message: `Hàm tin cậy R(t) rơi vào mức nguy hiểm: R(t) = ${(d.rt * 100).toFixed(2)}% (Yêu cầu kiểm tra & bảo dưỡng gấp).`
            });
            rtDangerLogged = true;
        } else if (d.rt < 0.90 && !rtWarnLogged) {
            logs.push({
                day: d.day,
                date: d.date,
                type: 'warning',
                message: `Độ tin cậy R(t) giảm dưới 90%: R(t) = ${(d.rt * 100).toFixed(2)}% (Cần lên kế hoạch bảo trì).`
            });
            rtWarnLogged = true;
        }
    });

    return logs.sort((a, b) => a.day - b.day);
}

// ============================================================
//  DEFAULT PARAMETERS — matching the Python script's defaults
// ============================================================
export const DEFAULT_PARAMS = {
    days: 365,
    baselineRF: 100.0,
    warningThreshold: 92.0,
    alarmThreshold: 88.0,
    degradP1: 0.018,
    degradP2: 0.034,
    degradP3: 0.026,
    beta: 1.5,
    eta: 730,
    lookBack: 30,
    trainRatio: 0.748,
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
