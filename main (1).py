from flask import Flask, render_template, request, jsonify
import numpy as np
import pandas as pd
from tensorflow.keras.models import load_model
from sklearn.preprocessing import MinMaxScaler
import yfinance as yf
import datetime

app = Flask(__name__)
model = load_model('model/lstm_Random_model.h5')

scaler = MinMaxScaler(feature_range=(0, 1))
time_step = 100


def preprocess_data(df):
    data = df['Close'].values.reshape(-1, 1)
    scaled = scaler.fit_transform(data)

    X = []
    for i in range(time_step, len(scaled)):
        X.append(scaled[i - time_step:i, 0])
    return np.array(X), data


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/predict', methods=['POST'])
def predict():
    ticker = request.form['ticker']
    start = request.form['start']
    end = request.form['end']

    df = yf.download(ticker, start=start, end=end)
    if df.empty or len(df) < time_step + 1:
        return jsonify({'error': 'Insufficient data to predict'})

    X, original_data = preprocess_data(df)
    X = X.reshape(X.shape[0], X.shape[1], 1)

    preds = model.predict(X)
    preds_rescaled = scaler.inverse_transform(preds)

    last_price = original_data[-1][0]
    future_price = preds_rescaled[-1][0]
    change = ((future_price - last_price) / last_price) * 100

    if change > 5:
        decision = "STRONG BUY"
    elif change > 2:
        decision = "BUY"
    elif change < -5:
        decision = "STRONG SELL"
    elif change < -2:
        decision = "SELL"
    else:
        decision = "HOLD"

    return jsonify({
        'historical': original_data.flatten().tolist(),
        'predicted': preds_rescaled.flatten().tolist(),
        'decision': decision,
        'change': round(change, 2),
        'last_price': round(last_price, 2),
        'future_price': round(future_price, 2)
    })


if __name__ == '__main__':
    app.run(debug=True)
