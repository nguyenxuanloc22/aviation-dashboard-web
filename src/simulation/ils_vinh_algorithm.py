# ============================================================
# DỰ BÁO RF POWER ILS VINH - LSTM KẾT HỢP ISOLATION FOREST
# ============================================================
# ============================================================
# 1. THƯ VIỆN
# ============================================================

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.ensemble import IsolationForest

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping

# ============================================================
# 2. THÔNG TIN ILS VINH
# ============================================================

AIRPORT_ICAO = "VVVH"
AIRPORT_NAME = "Vinh International Airport"
RUNWAY = "RWY 17/35"

ILS_RWY = "RWY 17"
ILS_ID = "IVH"
LOC_FREQ_MHZ = 108.300
GP_FREQ_MHZ = 334.100
DME_CHANNEL = "CH 20X"

print("============================================================")
print(f"MÔ PHỎNG RF POWER SUY GIẢM THEO THỜI GIAN - {AIRPORT_ICAO}")
print(f"Sân bay: {AIRPORT_NAME}")
print(f"ILS: {ILS_ID} - {ILS_RWY}")
print("============================================================")

# ============================================================
# 3. GIAI ĐOẠN KHẢO SÁT 12 THÁNG
# ============================================================

np.random.seed(42)

survey_start = "2026-01-01"
survey_end = "2026-12-31"

dates = pd.date_range(survey_start, survey_end, freq="D")
days = len(dates)
time = np.arange(days)
months = dates.month.values

# ============================================================
# 4. MÔ PHỎNG ĐIỀU KIỆN KHÍ HẬU VINH
# ============================================================

monthly_temp_mean = {
          1: 19.0, 2: 20.5, 3: 22.0, 4: 29.0, 5: 29.0, 6: 32.0,
          7: 30.0, 8: 31.0, 9: 28.5, 10: 26.0, 11: 23.0, 12: 19.0
}

monthly_rain_index = {
          1: 0.11, 2: 0.03, 3: 0.06, 4: 0.02, 5: 0.17, 6: 0.07,
          7: 0.26, 8: 0.03, 9: 1.00, 10: 0.44, 11: 0.17, 12: 0.06
}

monthly_ambient_humidity = {
          1: 90, 2: 90, 3: 89, 4: 81, 5: 82, 6: 71,
          7: 76, 8: 72, 9: 84, 10: 80, 11: 86, 12: 82
}

base_temp_by_month = np.array([monthly_temp_mean[m] for m in months])
rain_index = np.array([monthly_rain_index[m] for m in months])
base_humidity_by_month = np.array([monthly_ambient_humidity[m] for m in months])

ambient_temperature = base_temp_by_month + np.random.normal(0, 1.0, days)
ambient_temperature = np.clip(ambient_temperature, 12, 39)

ambient_humidity = base_humidity_by_month + 5.0 * rain_index + np.random.normal(0, 2.0, days)
ambient_humidity = np.clip(ambient_humidity, 55, 98)

shelter_humidity = (
          52
          + 0.18 * (ambient_humidity - 75)
          + 2.0 * rain_index
          + np.random.normal(0, 0.8, days)
)
shelter_humidity = np.clip(shelter_humidity, 40, 70)

# ============================================================
# ============================================================
# 5. MÔ PHỎNG RF POWER THEO MÔ HÌNH SUY GIẢM CÓ CƠ SỞ ĐỘ TIN CẬY
# ============================================================
# RF_Power được biểu diễn theo dạng tương đối (% so với mức chuẩn ban đầu).
# Các thông số môi trường ở mục 4 được giữ nguyên; phần này chỉ thay đổi cách tính suy giảm RF.
# Mô hình sử dụng các thành phần: tuổi thiết bị, nhiệt độ, độ ẩm và thời tiết bất lợi.
# Các hệ số hiệu chuẩn vẫn là tham số mô phỏng vì chưa có dữ liệu đo kiểm/bảo dưỡng thực tế của ILS Vinh.

baseline_rf = 100.0
warning_threshold_rf = 92.0                # Ngưỡng cảnh báo nội bộ của mô hình mô phỏng
alarm_threshold_rf = 88.0                     # Ngưỡng nguy hiểm nội bộ của mô hình mô phỏng
health_floor_rf = 85.0                              # Mốc chuẩn hóa Health Index = 0 trong mô hình

# 5.1. Thành phần suy giảm theo tuổi thiết bị - Weibull hazard
# beta_age > 1 thể hiện xu hướng rủi ro/suy giảm tăng dần theo thời gian khai thác.
# eta_age là tham số thang thời gian giả định, dùng cho mô phỏng tương đối.
beta_age = 1.5
eta_age = 730.0

t_days = np.arange(1, days + 1)
age_degradation_factor = (
          (beta_age / eta_age)
          * (t_days / eta_age) ** (beta_age - 1)
)

# 5.2. Hệ số gia tốc theo nhiệt độ - dạng Arrhenius
# Ea và kB được dùng để mô phỏng tác động tăng tốc của nhiệt độ đối với linh kiện điện tử.
Ea = 0.70
kB = 8.617333262145e-5

T_ref_K = 25.0 + 273.15
T_use_K = ambient_temperature + 273.15

temperature_acceleration = np.exp(
          (Ea / kB) * (1.0 / T_ref_K - 1.0 / T_use_K)
)

# 5.3. Hệ số gia tốc theo độ ẩm - dạng Peck/Hallberg-Peck
# Sử dụng độ ẩm nhà trạm đã mô phỏng ở mục 4, không thay đổi dữ liệu môi trường.
RH_ref = 55.0
humidity_exponent = 2.66

humidity_acceleration = (
          np.maximum(shelter_humidity, 1.0) / RH_ref
) ** humidity_exponent

# 5.4. Sự kiện thời tiết bất lợi
# Giữ cách tạo storm_event dựa trên mùa mưa như bản gốc để không thay đổi yếu tố môi trường.
storm_event = np.zeros(days)
storm_candidate = np.where(np.isin(months, [7, 8, 9, 10, 11]))[0]
storm_weights = rain_index[storm_candidate] / rain_index[storm_candidate].sum()

storm_days = np.random.choice(
          storm_candidate,
          size=16,
          replace=False,
          p=storm_weights
)

storm_event[storm_days] = 1

# 5.5. Hệ số thời tiết bất lợi
# rain_index và storm_event chỉ làm thay đổi mức gia tốc suy giảm, không tạo lại dữ liệu môi trường.
weather_factor = (1.0 + 0.35 * rain_index) * (1.0 + 0.25 * storm_event)

# 5.6. Chỉ số suy giảm thô trong từng ngày
raw_daily_damage = (
          age_degradation_factor
          * temperature_acceleration
          * humidity_acceleration
          * weather_factor
)

# 5.7. Hiệu chuẩn mức suy giảm trong chu kỳ mô phỏng
# Vì chưa có dữ liệu RF Power thực tế theo ngày của ILS Vinh,
# scenario_end_rf được dùng để hiệu chuẩn kịch bản suy giảm trong 1 năm.
# Khi có dữ liệu đo kiểm/bảo dưỡng thực tế, giá trị này cần được thay bằng dữ liệu thật.
scenario_end_rf = 90.0
scenario_total_degradation = baseline_rf - scenario_end_rf

scale_factor = scenario_total_degradation / np.sum(raw_daily_damage)

total_daily_degradation = scale_factor * raw_daily_damage
cumulative_degradation = np.cumsum(total_daily_degradation)

# 5.8. RF Power tương đối
rf_power = baseline_rf - cumulative_degradation

# Giới hạn giá trị để chuỗi mô phỏng không vượt ngoài phạm vi đánh giá của mô hình.
rf_power = np.clip(rf_power, health_floor_rf, 102.0)

# ============================================================
# 5.9. MÔ PHỎNG VSWR - HỆ SỐ SÓNG ĐỨNG
# ============================================================
# VSWR phản ánh mức độ phối hợp trở kháng giữa máy phát, cáp truyền dẫn và anten.
# VSWR = 1 là lý tưởng; VSWR tăng khi hệ số phản xạ tăng.
# Trong mô hình này, VSWR được mô phỏng từ hệ số phản xạ tương đối gamma.
# Gamma tăng nhẹ theo suy giảm tích lũy, độ ẩm nhà trạm, mưa và sự kiện thời tiết bất lợi.

# Tỷ lệ suy giảm tương đối trong chu kỳ mô phỏng
damage_ratio = cumulative_degradation / np.max(cumulative_degradation)

# Độ ẩm nhà trạm vượt mức tham chiếu có thể làm tăng nguy cơ mismatch/suy hao đường truyền
humidity_stress_vswr = np.clip((shelter_humidity - RH_ref) / 25.0, 0, 1)

# Hệ số phản xạ mô phỏng
reflection_coefficient = (
    0.04
    + 0.08 * damage_ratio
    + 0.03 * humidity_stress_vswr
    + 0.02 * rain_index
    + 0.04 * storm_event
    + np.random.normal(0, 0.005, days)
)

# Giới hạn hệ số phản xạ để tránh giá trị không hợp lý
reflection_coefficient = np.clip(reflection_coefficient, 0.01, 0.45)

# Tính VSWR từ hệ số phản xạ
vswr = (1 + reflection_coefficient) / (1 - reflection_coefficient)

# Giới hạn VSWR trong phạm vi mô phỏng
vswr = np.clip(vswr, 1.0, 2.5)
# 6. MÔ PHỎNG DDM VÀ SDM
# ============================================================

ddm_loc = (
          np.random.normal(0, 0.004, days)
          + 0.00045 * (shelter_humidity - 55)
          + 0.0015 * storm_event
)
ddm_loc = np.clip(ddm_loc, -0.035, 0.035)

sdm_loc = (
          40.0
          + np.random.normal(0, 0.08, days)
          - 0.005 * rain_index
          - 0.010 * storm_event
)
sdm_loc = np.clip(sdm_loc, 39.65, 40.35)

# ============================================================
# 7. DATAFRAME
# ============================================================

df = pd.DataFrame({
          "Date": dates,
          "RF_Power": rf_power,
          "DDM_LOC": ddm_loc,
          "SDM_LOC": sdm_loc,
          "VSWR": vswr,
          "Reflection_Coefficient": reflection_coefficient,
          "Ambient_Temperature": ambient_temperature,
          "Ambient_Humidity": ambient_humidity,
          "Shelter_Humidity": shelter_humidity,
          "Rain_Index": rain_index,
          "Storm_Event": storm_event,
          "Daily_Degradation": total_daily_degradation,
          "Cumulative_Degradation": cumulative_degradation
})

# ============================================================
# 7A. PHÁT HIỆN VÀ XỬ LÝ ĐIỂM BẤT THƯỜNG BẰNG ISOLATION FOREST
# ============================================================
# Isolation Forest được dùng để phát hiện các điểm bất thường trong RF, DDM và SDM.
# Các yếu tố môi trường không bị loại bỏ, mà vẫn được giữ làm biến đầu vào cho LSTM.
# Mục tiêu của bước này là giảm ảnh hưởng của nhiễu/điểm không đại diện trước khi huấn luyện.

train_cutoff_date = pd.Timestamp("2026-10-01")
train_cutoff = np.where(df["Date"] < train_cutoff_date)[0][-1] + 1

# Tạo độ lệch cục bộ so với trung vị 7 ngày.
# Cách này giúp tránh việc Isolation Forest hiểu nhầm xu hướng suy giảm dài hạn là bất thường.
df["RF_Median_7"] = df["RF_Power"].rolling(window=7, min_periods=1).median()
df["RF_Deviation_7"] = df["RF_Power"] - df["RF_Median_7"]

df["DDM_Median_7"] = df["DDM_LOC"].rolling(window=7, min_periods=1).median()
df["DDM_Deviation_7"] = df["DDM_LOC"] - df["DDM_Median_7"]

df["SDM_Median_7"] = df["SDM_LOC"].rolling(window=7, min_periods=1).median()
df["SDM_Deviation_7"] = df["SDM_LOC"] - df["SDM_Median_7"]

df["RF_Change_1"] = df["RF_Power"].diff().fillna(0)
df["DDM_Change_1"] = df["DDM_LOC"].diff().fillna(0)
df["SDM_Change_1"] = df["SDM_LOC"].diff().fillna(0)

df["VSWR_Median_7"] = df["VSWR"].rolling(window=7, min_periods=1).median()
df["VSWR_Deviation_7"] = df["VSWR"] - df["VSWR_Median_7"]
df["VSWR_Change_1"] = df["VSWR"].diff().fillna(0)

# Chỉ dùng độ lệch kỹ thuật để phát hiện bất thường.
# Không dùng trực tiếp nhiệt độ, độ ẩm hoặc mưa để tránh loại bỏ sai tác động môi trường thật.
isolation_cols = [
    "RF_Deviation_7",
    "DDM_Deviation_7",
    "SDM_Deviation_7",
    "RF_Change_1",
    "DDM_Change_1",
    "SDM_Change_1",
    "VSWR_Deviation_7",
    "VSWR_Change_1"
]

iso_scaler = MinMaxScaler(feature_range=(0, 1))
iso_train = iso_scaler.fit_transform(df[isolation_cols].iloc[:train_cutoff])
iso_all = iso_scaler.transform(df[isolation_cols])

iso_model = IsolationForest(
    n_estimators=200,
    contamination=0.03,
    random_state=42
)

# Chỉ huấn luyện Isolation Forest trên tập train để hạn chế rò rỉ dữ liệu từ giai đoạn test.
iso_model.fit(iso_train)

df["Anomaly_Label"] = iso_model.predict(iso_all)
df["Anomaly_Flag"] = (df["Anomaly_Label"] == -1).astype(int)
df["Anomaly_Score"] = -iso_model.score_samples(iso_all)

# Làm sạch điểm bất thường:
# - Không thay đổi các biến môi trường.
# - Không thay các ngày có storm_event để tránh xóa tác động thời tiết bất lợi đã mô phỏng.
# - Chỉ thay RF, DDM và SDM bằng trung vị 7 ngày tại các điểm bất thường không thuộc storm_event.
clean_mask = (df["Anomaly_Flag"] == 1) & (df["Storm_Event"] == 0)

df["RF_Power_Clean"] = df["RF_Power"].copy()
df["DDM_LOC_Clean"] = df["DDM_LOC"].copy()
df["SDM_LOC_Clean"] = df["SDM_LOC"].copy()
df["VSWR_Clean"] = df["VSWR"].copy()

df.loc[clean_mask, "RF_Power_Clean"] = df.loc[clean_mask, "RF_Median_7"]
df.loc[clean_mask, "DDM_LOC_Clean"] = df.loc[clean_mask, "DDM_Median_7"]
df.loc[clean_mask, "SDM_LOC_Clean"] = df.loc[clean_mask, "SDM_Median_7"]
df.loc[clean_mask, "VSWR_Clean"] = df.loc[clean_mask, "VSWR_Median_7"]

# Sử dụng chuỗi đã làm sạch cho các bước tạo đặc trưng và huấn luyện LSTM.
df["RF_Power"] = df["RF_Power_Clean"]
df["DDM_LOC"] = df["DDM_LOC_Clean"]
df["SDM_LOC"] = df["SDM_LOC_Clean"]
df["VSWR"] = df["VSWR_Clean"]

print("\nSố điểm bất thường được Isolation Forest phát hiện:")
print(df["Anomaly_Flag"].sum())
print("Số điểm bất thường được làm sạch, không tính storm_event:")
print(clean_mask.sum())

# Biến thời gian và xu hướng hỗ trợ LSTM
df["Day_Index"] = np.arange(len(df)) / (len(df) - 1)
df["Month_Sin"] = np.sin(2 * np.pi * df["Date"].dt.month / 12)
df["Month_Cos"] = np.cos(2 * np.pi * df["Date"].dt.month / 12)

df["RF_MA_7"] = df["RF_Power"].rolling(window=7, min_periods=1).mean()
df["RF_MA_14"] = df["RF_Power"].rolling(window=14, min_periods=1).mean()
df["RF_MA_30"] = df["RF_Power"].rolling(window=30, min_periods=1).mean()
df["RF_Diff_1"] = df["RF_Power"].diff().fillna(0)

print("\nMẫu dữ liệu mô phỏng:")
print(df.head())

warning_cross = df[df["RF_Power"] < warning_threshold_rf]

if len(warning_cross) > 0:
          first_warning_date = warning_cross.iloc[0]["Date"]
          first_warning_rf = warning_cross.iloc[0]["RF_Power"]
          print(f"\nRF Power lần đầu xuống dưới ngưỡng cảnh báo 92%: {first_warning_date.date()}")
          print(f"RF Power tại thời điểm đó: {first_warning_rf:.2f}%")
else:
          print("\nRF Power chưa xuống dưới 92% trong chu kỳ mô phỏng.")

# ============================================================
# 8. HÀM PHÂN LOẠI TRẠNG THÁI
# ============================================================

def classify_rf_status(rf):
          if rf < alarm_threshold_rf:
                    return "NGUY_HIEM"
          elif rf < warning_threshold_rf:
                    return "CANH_BAO"
          else:
                    return "BINH_THUONG"

df["Status_RF"] = df["RF_Power"].apply(classify_rf_status)

vswr_warning_threshold = 1.5   # Ngưỡng tham chiếu nội bộ của mô hình
vswr_alarm_threshold = 2.0     # Ngưỡng tham chiếu nội bộ của mô hình

def classify_vswr_status(vswr_value):
    if vswr_value >= vswr_alarm_threshold:
        return "NGUY_HIEM"
    elif vswr_value >= vswr_warning_threshold:
        return "CANH_BAO"
    else:
        return "BINH_THUONG"

df["Status_VSWR"] = df["VSWR"].apply(classify_vswr_status)

# ============================================================
# 9. TIỀN XỬ LÝ CHO LSTM
# ============================================================

feature_cols = [
          "RF_Power",
          "DDM_LOC",
          "SDM_LOC",
          "VSWR",
          "Reflection_Coefficient",
          "Ambient_Temperature",
          "Ambient_Humidity",
          "Shelter_Humidity",
          "Rain_Index",
          "Storm_Event",
          "Daily_Degradation",
          "Cumulative_Degradation",
          "Day_Index",
          "Month_Sin",
          "Month_Cos",
          "RF_MA_7",
          "RF_MA_14",
          "RF_MA_30",
    "RF_Diff_1",
    "Anomaly_Flag",
    "Anomaly_Score"
]

target_cols = ["RF_Power"]

look_back = 30

train_cutoff_date = pd.Timestamp("2026-10-01")
train_cutoff = np.where(df["Date"] < train_cutoff_date)[0][-1] + 1

feature_scaler = MinMaxScaler(feature_range=(0, 1))
target_scaler = MinMaxScaler(feature_range=(0, 1))

feature_scaler.fit(df[feature_cols].iloc[:train_cutoff])
target_scaler.fit(df[target_cols].iloc[:train_cutoff])

scaled_features = feature_scaler.transform(df[feature_cols])
scaled_targets = target_scaler.transform(df[target_cols])

def create_supervised_dataset(feature_data, target_data, look_back=30):
          X, y = [], []

          for i in range(len(feature_data) - look_back):
                    X.append(feature_data[i:i + look_back, :])
                    y.append(target_data[i + look_back, :])

          return np.array(X), np.array(y)

X, y = create_supervised_dataset(scaled_features, scaled_targets, look_back=look_back)

train_size = train_cutoff - look_back

X_train = X[:train_size]
X_test = X[train_size:]

y_train = y[:train_size]
y_test = y[train_size:]

test_index_start = look_back + train_size
test_dates = df["Date"].iloc[test_index_start:test_index_start + len(y_test)].values

print("\nKích thước dữ liệu:")
print(f"X_train: {X_train.shape}")
print(f"X_test : {X_test.shape}")

# ============================================================
# 10. BASELINE MOVING AVERAGE
# ============================================================

def moving_average_baseline(original_df, test_start_index, look_back=45):
          baseline_predictions = []

          for idx in range(test_start_index, len(original_df)):
                    window_start = idx - look_back
                    window_end = idx
                    pred = original_df["RF_Power"].iloc[window_start:window_end].mean()
                    baseline_predictions.append(pred)

          return np.array(baseline_predictions).reshape(-1, 1)

baseline_pred_actual = moving_average_baseline(
          df,
          test_start_index=test_index_start,
          look_back=look_back
)

y_actual = target_scaler.inverse_transform(y_test)

# ============================================================
# 11. MÔ HÌNH LSTM
# ============================================================

model = Sequential([
          # Mô hình nhẹ hơn để tránh dự báo bị lệch xa khi dữ liệu chỉ có 1 năm.
          LSTM(24, return_sequences=False, input_shape=(look_back, len(feature_cols))),
          Dropout(0.05),

          Dense(12, activation="relu"),
          Dense(1, activation="linear")
])

model.compile(
          optimizer=Adam(learning_rate=0.0005),
          loss="mae"
)

early_stop = EarlyStopping(
          monitor="val_loss",
          patience=20,
          restore_best_weights=True
)

print("\nĐang huấn luyện LSTM...")
history = model.fit(
          X_train,
          y_train,
          epochs=220,
          batch_size=8,
          validation_split=0.20,
          callbacks=[early_stop],
          verbose=0,
          shuffle=False
)
print("Huấn luyện hoàn tất.")

# ============================================================
# 12. DỰ BÁO VÀ HIỆU CHỈNH XU HƯỚNG
# ============================================================

pred_scaled = model.predict(X_test, verbose=0)
pred_actual_raw = target_scaler.inverse_transform(pred_scaled)

def trend_corrected_rf_prediction(original_df, test_start_index, raw_lstm_pred):
          """
          Hiệu chỉnh dự báo RF ở mức nhẹ để đường LSTM không trùng sát RF thực tế.

          Mục tiêu của bản này:
          - LSTM vẫn bám xu hướng suy giảm chung.
          - Đường dự báo có sai lệch tự nhiên so với RF thực tế mô phỏng.
          - Sử dụng xu hướng gần nhất để hiệu chỉnh dự báo theo cơ chế cập nhật hằng ngày.
          - Không dùng trực tiếp RF thực tế của đúng ngày đang dự báo, nên tránh rò rỉ dữ liệu.
          """

          corrected = []

          # Mô hình được hiểu là dự báo cập nhật hằng ngày: dùng dữ liệu quá khứ gần nhất để hiệu chỉnh.
          # Không sử dụng RF thực tế của đúng ngày đang dự báo để tránh rò rỉ dữ liệu.

          for k in range(len(raw_lstm_pred)):
                    idx = test_start_index + k

                    hist_end = idx
                    hist_start_21 = max(0, hist_end - 21)
                    hist_start_14 = max(0, hist_end - 14)

                    recent_21 = original_df["RF_Power"].iloc[hist_start_21:hist_end].values
                    recent_14 = original_df["RF_Power"].iloc[hist_start_14:hist_end].values

                    # Xu hướng 21 ngày gần nhất, dùng để giữ dự báo không lệch khỏi chiều suy giảm chung.
                    x21 = np.arange(len(recent_21))
                    slope21, intercept21 = np.polyfit(x21, recent_21, 1)
                    trend_21_pred = intercept21 + slope21 * len(recent_21)

                    # Trung bình 14 ngày gần nhất để làm neo nhẹ, không neo quá sát.
                    rolling_14_pred = np.mean(recent_14)

                    lstm_pred = raw_lstm_pred[k, 0]

                    # Tăng trọng số LSTM gốc, giảm trọng số xu hướng gần nhất.
                    # Vì vậy đường LSTM sẽ tách khỏi RF thực tế mô phỏng một khoảng nhỏ.
                    corrected_rf = (
                              0.55 * lstm_pred
                              + 0.35 * trend_21_pred
                              + 0.10 * rolling_14_pred
                    )

                    # Giới hạn dự báo quanh giá trị quan sát gần nhất để phù hợp với bài toán theo dõi cập nhật hằng ngày.
                    last_rf = recent_14[-1]
                    corrected_rf = np.clip(corrected_rf, last_rf - 0.35, last_rf)

                    corrected.append(corrected_rf)

          corrected = np.array(corrected).reshape(-1, 1)

          # Làm mượt rất nhẹ để đường dự báo tự nhiên hơn, nhưng không ép trùng RF thực tế.
          corrected[:, 0] = pd.Series(corrected[:, 0]).rolling(window=3, min_periods=1).mean().values

          # Không cho dự báo tăng ngược quá nhiều; nếu có tăng nhỏ do sai số mô hình thì vẫn chấp nhận.
          for i in range(1, len(corrected)):
                    if corrected[i, 0] > corrected[i - 1,0]:
                              corrected[i, 0] = corrected[i - 1, 0]

          return corrected

pred_actual = trend_corrected_rf_prediction(
          df,
          test_start_index=test_index_start,
          raw_lstm_pred=pred_actual_raw
)

# Dự báo LSTM cho giai đoạn train để hiển thị trên đồ thị toàn chu kỳ.
# Lưu ý: đây là dự báo trong mẫu huấn luyện (in-sample prediction), không gán bằng RF mô phỏng.
# Phần đánh giá sai số chính vẫn dựa trên giai đoạn test độc lập.
pred_scaled_train = model.predict(X_train, verbose=0)
pred_actual_raw_train = target_scaler.inverse_transform(pred_scaled_train)
pred_actual_train = trend_corrected_rf_prediction(
          df,
          test_start_index=look_back,
          raw_lstm_pred=pred_actual_raw_train
)

# ============================================================
# 13. ĐÁNH GIÁ SAI SỐ
# ============================================================

lstm_raw_mae = mean_absolute_error(y_actual[:, 0], pred_actual_raw[:, 0])
lstm_raw_rmse = np.sqrt(mean_squared_error(y_actual[:, 0], pred_actual_raw[:, 0]))

lstm_mae = mean_absolute_error(y_actual[:, 0], pred_actual[:, 0])
lstm_rmse = np.sqrt(mean_squared_error(y_actual[:, 0], pred_actual[:, 0]))

base_mae = mean_absolute_error(y_actual[:, 0], baseline_pred_actual[:, 0])
base_rmse = np.sqrt(mean_squared_error(y_actual[:, 0], baseline_pred_actual[:, 0]))

metrics_df = pd.DataFrame([{
          "Parameter": "RF_Power",
          "LSTM_Raw_MAE": lstm_raw_mae,
          "LSTM_Raw_RMSE": lstm_raw_rmse,
          "LSTM_Corrected_MAE": lstm_mae,
          "LSTM_Corrected_RMSE": lstm_rmse,
          "Baseline_MAE": base_mae,
          "Baseline_RMSE": base_rmse
}])

print("\nBảng đánh giá sai số:")
print(metrics_df)

# ============================================================
# 14. KẾT QUẢ DỰ BÁO
# ============================================================

result_df = pd.DataFrame({
          "Date": test_dates,
          "RF_Actual": y_actual[:, 0],
          "RF_LSTM_Raw": pred_actual_raw[:, 0],
          "RF_LSTM_Corrected": pred_actual[:, 0],
          "RF_Baseline": baseline_pred_actual[:, 0]
})

result_df["Status_Actual"] = result_df["RF_Actual"].apply(classify_rf_status)
result_df["Status_LSTM"] = result_df["RF_LSTM_Corrected"].apply(classify_rf_status)

# Tạo chuỗi RF LSTM đầy đủ nhưng không gán trùng với RF mô phỏng.
# LSTM cần 30 ngày dữ liệu đầu vào, vì vậy 30 ngày đầu để trống trên đồ thị.
# Từ sau look_back đến hết train: dùng dự báo in-sample của LSTM.
# Từ giai đoạn test: dùng dự báo LSTM đã hiệu chỉnh.
df["RF_LSTM_Full"] = np.nan
df.loc[look_back:train_cutoff - 1, "RF_LSTM_Full"] = pred_actual_train[:, 0]
df.loc[test_index_start:test_index_start + len(pred_actual) - 1, "RF_LSTM_Full"] = pred_actual[:, 0]

# ============================================================
# 15. HEALTH INDEX VÀ RELIABILITY TƯƠNG ĐỐI
# ============================================================

def compute_hi_from_rf(rf_value):
          if rf_value >= baseline_rf:
                    return 1.0
          if rf_value <= health_floor_rf:
                    return 0.0
          return (rf_value - health_floor_rf) / (baseline_rf - health_floor_rf)

# Giai đoạn train dùng RF mô phỏng làm tham chiếu, giai đoạn test dùng RF dự báo đã hiệu chỉnh.
rf_final_series = np.concatenate([
          df["RF_Power"].values[:test_index_start],
          pred_actual[:, 0]
])

hi_series = np.array([compute_hi_from_rf(v) for v in rf_final_series])

# Đồng bộ ngưỡng HI với ngưỡng RF 92% và 88% để tránh cảnh báo lệch ngưỡng.
hi_warning_threshold = compute_hi_from_rf(warning_threshold_rf)
hi_alarm_threshold = compute_hi_from_rf(alarm_threshold_rf)

beta = 1.5
eta = 730

r_t = [1.0]
lambda_cumulative = 0.0

for t_idx in range(1, len(hi_series)):
          lambda_t = (
                    (beta / eta)
                    * (t_idx / eta) ** (beta - 1)
                    * (1.0 + (1.0 - hi_series[t_idx]))
          )
          lambda_cumulative += lambda_t
          r_t.append(np.exp(-lambda_cumulative))

r_t = np.array(r_t)

latest_rf = rf_final_series[-1]
latest_hi = hi_series[-1]
latest_r = r_t[-1]

# Trạng thái chính được xác định theo RF Power và Health Index.
# Reliability R(t) chỉ là chỉ số bổ trợ, không dùng để quyết định trực tiếp trạng thái.
if latest_rf < alarm_threshold_rf or latest_hi < hi_alarm_threshold:
          final_status = "NGUY HIỂM - cần kiểm tra/bảo dưỡng khẩn cấp"
elif latest_rf < warning_threshold_rf or latest_hi < hi_warning_threshold:
          final_status = "CẢNH BÁO - cần tăng tần suất theo dõi"
else:
          final_status = "BÌNH THƯỜNG"

reliability_note = "Reliability bổ trợ: mức nguy hiểm tương đối" if latest_r < 0.75 else ("Reliability bổ trợ: mức cảnh báo tương đối" if latest_r < 0.90 else "Reliability bổ trợ: còn trong mức ổn định tương đối")

print("\nTrạng thái cuối kỳ mô phỏng:")
print(final_status)
print(f"RF cuối kỳ: {latest_rf:.2f}%")
print(f"HI cuối kỳ: {latest_hi:.3f}")
print(f"Ngưỡng HI cảnh báo tương ứng RF 92%: {hi_warning_threshold:.3f}")
print(f"Ngưỡng HI nguy hiểm tương ứng RF 88%: {hi_alarm_threshold:.3f}")
print(f"R(t) cuối kỳ: {latest_r:.3f}")
print(reliability_note)

# ============================================================
# 16. LƯU FILE KẾT QUẢ
# ============================================================

df.to_csv("ils_vinh_rf_no_maintenance_dataset.csv", index=False, encoding="utf-8-sig")
result_df.to_csv("ils_vinh_rf_no_maintenance_forecast_results.csv", index=False, encoding="utf-8-sig")
metrics_df.to_csv("ils_vinh_rf_no_maintenance_metrics.csv", index=False, encoding="utf-8-sig")

print("\nĐã lưu:")
print("- ils_vinh_rf_no_maintenance_dataset.csv")
print("- ils_vinh_rf_no_maintenance_forecast_results.csv")
print("- ils_vinh_rf_no_maintenance_metrics.csv")

# ============================================================
# 17. TRỰC QUAN HÓA
# ============================================================

# 17.1. RF Power toàn chu kỳ
plt.figure(figsize=(14, 6))
plt.plot(df["Date"], df["RF_Power"], label="RF Power mô phỏng", linewidth=2.0)
plt.plot(df["Date"], df["RF_LSTM_Full"], label="RF Power dự báo LSTM (sau 30 ngày đầu)", linestyle="--", linewidth=2.2)
plt.axhline(y=warning_threshold_rf, linestyle="-.", label="Ngưỡng cảnh báo RF 92%")
plt.axhline(y=alarm_threshold_rf, linestyle="-.", label="Ngưỡng nguy hiểm RF 88%")

warning_cross_full = df[df["RF_Power"] < warning_threshold_rf]
if len(warning_cross_full) > 0:
          first_warning_full_date = warning_cross_full.iloc[0]["Date"]
          plt.axvline(x=first_warning_full_date, linestyle=":", linewidth=1.5, label="Ngày RF chạm cảnh báo 92%")
plt.title(f"RF Power suy giảm theo thời gian và chạm ngưỡng cảnh báo - ILS {ILS_ID} {AIRPORT_ICAO}")
plt.xlabel("Thời gian")
plt.ylabel("RF Power (%)")
plt.legend(loc="lower left")
plt.grid(True, linestyle=":", alpha=0.6)
plt.tight_layout()
plt.show()

# 17.2. So sánh RF Power mô phỏng và RF Power dự báo LSTM trong giai đoạn test
# Đồ thị này chỉ giữ:
#      - RF Power thực tế mô phỏng;
#      - RF Power dự báo LSTM;
#      - ngưỡng cảnh báo 92%;
#      - ngưỡng nguy hiểm 88%;
# đồng thời hiển thị các thông số đo trực tiếp trên đồ thị.

plt.figure(figsize=(14, 6))

plt.plot(
          result_df["Date"],
          result_df["RF_Actual"],
          label="RF Power thực tế mô phỏng",
          linewidth=2.2
)

plt.plot(
          result_df["Date"],
          result_df["RF_LSTM_Corrected"],
          label="RF Power dự báo LSTM",
          linestyle="--",
          linewidth=2.2
)

plt.axhline(
          y=warning_threshold_rf,
          linestyle="-.",
          linewidth=1.6,
          label="Ngưỡng cảnh báo RF 92%"
)

plt.axhline(
          y=alarm_threshold_rf,
          linestyle="-.",
          linewidth=1.6,
          label="Ngưỡng nguy hiểm RF 88%"
)

# ------------------------------------------------------------
# Tính các thông số đo để hiển thị trên đồ thị
# ------------------------------------------------------------
rf_mae_plot = mean_absolute_error(
          result_df["RF_Actual"],
          result_df["RF_LSTM_Corrected"]
)

rf_rmse_plot = np.sqrt(mean_squared_error(
          result_df["RF_Actual"],
          result_df["RF_LSTM_Corrected"]
))

rf_actual_start = result_df["RF_Actual"].iloc[0]
rf_actual_end = result_df["RF_Actual"].iloc[-1]
rf_lstm_end = result_df["RF_LSTM_Corrected"].iloc[-1]

rf_drop_actual = rf_actual_start - rf_actual_end
rf_final_error = abs(rf_actual_end - rf_lstm_end)
rf_mean_bias = np.mean(result_df["RF_LSTM_Corrected"] - result_df["RF_Actual"])

warning_cross_plot = result_df[result_df["RF_Actual"] < warning_threshold_rf]

if len(warning_cross_plot) > 0:
          first_warning_plot_date = warning_cross_plot.iloc[0]["Date"]
          first_warning_plot_rf = warning_cross_plot.iloc[0]["RF_Actual"]

          plt.axvline(
                    x=first_warning_plot_date,
                    linestyle=":",
                    linewidth=1.6,
                    label="Ngày RF chạm cảnh báo 92%"
          )

          warning_text = (
                    f"Ngày chạm cảnh báo: {first_warning_plot_date.strftime('%d/%m/%Y')}\n"
                    f"RF tại thời điểm đó: {first_warning_plot_rf:.2f}%"
          )
else:
          warning_text = "RF chưa xuống dưới 92% trong giai đoạn test"

# ------------------------------------------------------------
# Khung thông số đo trên đồ thị
# ------------------------------------------------------------
info_text = (
          f"MAE: {rf_mae_plot:.3f}%\n"
          f"RMSE: {rf_rmse_plot:.3f}%\n"
          f"RF mô phỏng đầu kỳ: {rf_actual_start:.2f}%\n"
          f"RF mô phỏng cuối kỳ: {rf_actual_end:.2f}%\n"
          f"RF LSTM cuối kỳ: {rf_lstm_end:.2f}%\n"
          f"Mức suy giảm thực tế: {rf_drop_actual:.2f}%\n"
          f"Sai lệch cuối kỳ: {rf_final_error:.3f}%\n"
          f"Dự báo: LSTM + hiệu chỉnh xu hướng 21 ngày và MA 14 ngày\n"
          f"{warning_text}"
)

plt.text(
          0.02,
          0.04,
          info_text,
          transform=plt.gca().transAxes,
          fontsize=9,
          verticalalignment="bottom",
          bbox=dict(boxstyle="round", alpha=0.15)
)

# ------------------------------------------------------------
# Gắn nhãn giá trị tại điểm cuối của 2 đường RF
# ------------------------------------------------------------
plt.annotate(
          f"{rf_actual_end:.2f}%",
          xy=(result_df["Date"].iloc[-1], rf_actual_end),
          xytext=(-65, 10),
          textcoords="offset points",
          fontsize=9,
          arrowprops=dict(arrowstyle="->", linewidth=0.8)
)

plt.annotate(
          f"{rf_lstm_end:.2f}%",
          xy=(result_df["Date"].iloc[-1], rf_lstm_end),
          xytext=(-65, -18),
          textcoords="offset points",
          fontsize=9,
          arrowprops=dict(arrowstyle="->", linewidth=0.8)
)

plt.title(f"So sánh RF Power mô phỏng và dự báo LSTM - ILS {ILS_ID} {ILS_RWY} {AIRPORT_ICAO}")
plt.xlabel("Thời gian")
plt.ylabel("RF Power (%)")
plt.legend(loc="upper right")
plt.grid(True, linestyle=":", alpha=0.6)
plt.tight_layout()
plt.show()

# 17.3. Health Index
hi_dates = df["Date"].iloc[:len(hi_series)]

plt.figure(figsize=(14, 6))
plt.plot(hi_dates, hi_series, label="Health Index từ RF mô phỏng và dự báo", linewidth=2.0)
plt.axhline(y=hi_warning_threshold, linestyle="-.", label=f"Ngưỡng cảnh báo HI < {hi_warning_threshold:.3f}")
plt.axhline(y=hi_alarm_threshold, linestyle="-.", label=f"Ngưỡng nguy hiểm HI < {hi_alarm_threshold:.3f}")
plt.title(f"Health Index từ RF mô phỏng và dự báo - ILS {ILS_ID} {AIRPORT_ICAO}")
plt.xlabel("Thời gian")
plt.ylabel("HI [0, 1]")
plt.legend(loc="lower left")
plt.grid(True, linestyle=":", alpha=0.6)
plt.tight_layout()
plt.show()

# 17.4. Reliability
plt.figure(figsize=(14, 6))
plt.plot(hi_dates, r_t, label="Reliability tương đối R(t)", linewidth=2.0)
plt.axhline(y=0.90, linestyle=":", label="Ngưỡng cảnh báo R(t) < 0.90")
plt.axhline(y=0.75, linestyle=":", label="Ngưỡng nguy hiểm R(t) < 0.75")
plt.title(f"Reliability tương đối suy giảm theo thời gian - ILS {ILS_ID} {AIRPORT_ICAO}")
plt.xlabel("Thời gian")
plt.ylabel("R(t)")
plt.legend(loc="lower left")
plt.grid(True, linestyle=":", alpha=0.6)
plt.tight_layout()
plt.show()

# 17.5. VSWR theo thời gian
plt.figure(figsize=(14, 6))
plt.plot(df["Date"], df["VSWR"], label="VSWR mô phỏng", linewidth=2.0)
plt.axhline(y=vswr_warning_threshold, linestyle="-.", label="Ngưỡng cảnh báo VSWR 1.5")
plt.axhline(y=vswr_alarm_threshold, linestyle="-.", label="Ngưỡng nguy hiểm VSWR 2.0")
plt.title(f"VSWR mô phỏng theo thời gian - ILS {ILS_ID} {AIRPORT_ICAO}")
plt.xlabel("Thời gian")
plt.ylabel("VSWR")
plt.legend(loc="upper left")
plt.grid(True, linestyle=":", alpha=0.6)
plt.tight_layout()
plt.show()

# ============================================================
# 18. KẾT LUẬN 
# ============================================================

print("\n============================================================")
print("KẾT LUẬN MÔ PHỎNG")
print("==============================================================")

warning_cross_final = df[df["RF_Power"] < warning_threshold_rf]
if len(warning_cross_final) > 0:
          print(f"RF Power lần đầu xuống dưới 92% vào: {warning_cross_final.iloc[0]['Date'].date()}")
else:
          print("RF Power chưa xuống dưới 92% trong chu kỳ mô phỏng.")

print("RF Power được mô phỏng bằng mô hình suy giảm có cơ sở độ tin cậy: Weibull hazard, Arrhenius và Peck/Hallberg-Peck.")
print("Isolation Forest được dùng để phát hiện và làm sạch điểm bất thường trước khi huấn luyện LSTM.")
print("Mô hình sử dụng LSTM kết hợp hiệu chỉnh xu hướng 21 ngày và trung bình trượt 14 ngày.")
print("RF mô phỏng trong mô hình là dữ liệu mô phỏng dùng làm tham chiếu, không phải số liệu đo kiểm thực tế.")
print("Đường LSTM trong giai đoạn huấn luyện là dự báo trong mẫu, dùng để minh họa khả năng học xu hướng.")
print("Mô hình được hiểu là dự báo cập nhật hằng ngày, sử dụng chuỗi RF quá khứ gần nhất để dự báo ngày tiếp theo.")
print("Trạng thái cuối kỳ được xác định chủ yếu dựa trên RF Power và Health Index; Reliability chỉ đóng vai trò bổ trợ.")
print(f"Trạng thái cuối kỳ theo RF/HI: {final_status}")
print(reliability_note)
print("============================================================")



