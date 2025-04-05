document.addEventListener('DOMContentLoaded', function() {
    // Set default dates
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    // Format dates as YYYY-MM-DD for input fields
    document.getElementById('startDate').value = formatDate(oneYearAgo);
    document.getElementById('endDate').value = formatDate(today);

    // Initialize chart variable
    let priceChart = null;

    // Form submission handler
    document.getElementById('stockForm').addEventListener('submit', async function(e) {
        e.preventDefault();

        // Show loading spinner
        document.getElementById('loading').style.display = 'block';
        document.getElementById('results').style.display = 'none';
        document.getElementById('error').style.display = 'none';

        try {
            // Get form values
            const ticker = document.getElementById('ticker').value.trim().toUpperCase();
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const lookback = parseInt(document.getElementById('lookback').value);
            const forecast = parseInt(document.getElementById('forecast').value);

            // Basic validation
            if (!ticker) {
                throw new Error('Please enter a stock ticker symbol');
            }
            if (lookback <= 0 || forecast <= 0) {
                throw new Error('Lookback and forecast periods must be positive numbers');
            }
            if (new Date(startDate) >= new Date(endDate)) {
                throw new Error('End date must be after start date');
            }

            // Call backend API
            const response = await fetch('/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ticker: ticker,
                    start_date: startDate,
                    end_date: endDate,
                    lookback: lookback,
                    forecast: forecast
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get prediction');
            }

            const data = await response.json();
            displayResults(data);

        } catch (error) {
            showError(error.message || 'An error occurred while processing your request.');
            console.error('Prediction error:', error);
        } finally {
            document.getElementById('loading').style.display = 'none';
        }
    });

    function displayResults(data) {
        // Display stock info
        document.getElementById('stockInfo').innerHTML = `
            <p><strong>Ticker:</strong> ${data.ticker}</p>
            <p><strong>Date Range:</strong> ${formatDisplayDate(data.start_date)} to ${formatDisplayDate(data.end_date)}</p>
            <p><strong>Last Close Price:</strong> $${data.last_close_price?.toFixed(2) || 'N/A'}</p>
        `;

        // Display model metrics
        document.getElementById('modelMetrics').innerHTML = `
            <p><strong>RMSE:</strong> ${data.rmse?.toFixed(4) || 'N/A'}</p>
            <p><strong>Mean Absolute Error:</strong> ${data.mae?.toFixed(4) || 'N/A'}</p>
            <p><strong>R-squared:</strong> ${data.r2?.toFixed(4) || 'N/A'}</p>
        `;

        // Display predictions in table
        const tableBody = document.getElementById('predictionTable');
        tableBody.innerHTML = '';

        if (data.predictions && data.predictions.length > 0) {
            data.predictions.forEach(pred => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${formatDisplayDate(pred.date)}</td>
                    <td>$${pred.price?.toFixed(2) || 'N/A'}</td>
                `;
                tableBody.appendChild(row);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="2">No predictions available</td></tr>';
        }

        // Create chart if we have data
        if (data.historical_prices && data.predictions) {
            createChart(data.historical_prices, data.predictions);
        }

        // Show results
        document.getElementById('results').style.display = 'block';
    }

    function createChart(historicalData, predictions) {
        const ctx = document.getElementById('priceChart').getContext('2d');

        // Destroy previous chart if exists
        if (priceChart) {
            priceChart.destroy();
        }

        try {
            // Prepare data
            const historicalLabels = historicalData.map(item => item.date);
            const historicalPrices = historicalData.map(item => item.price);

            const predictionLabels = predictions.map(item => item.date);
            const predictedPrices = predictions.map(item => item.price);

            // Combine all dates for x-axis
            const allLabels = [...historicalLabels, ...predictionLabels];

            priceChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: allLabels,
                    datasets: [
                        {
                            label: 'Historical Prices',
                            data: [...historicalPrices, ...new Array(predictions.length).fill(null)],
                            borderColor: 'rgb(75, 192, 192)',
                            backgroundColor: 'rgba(75, 192, 192, 0.2)',
                            tension: 0.1,
                            borderWidth: 2,
                            pointRadius: 2
                        },
                        {
                            label: 'Predicted Prices',
                            data: [...new Array(historicalPrices.length).fill(null), ...predictedPrices],
                            borderColor: 'rgb(255, 99, 132)',
                            backgroundColor: 'rgba(255, 99, 132, 0.2)',
                            tension: 0.1,
                            borderWidth: 2,
                            borderDash: [5, 5],
                            pointRadius: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: false,
                            title: {
                                display: true,
                                text: 'Price ($)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Date'
                            },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45,
                                callback: function(value) {
                                    // Show fewer labels for better readability
                                    const index = this.getLabelForValue(value);
                                    return index % Math.ceil(allLabels.length / 10) === 0 ? allLabels[index] : '';
                                }
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                label: function(context) {
                                    return `${context.dataset.label}: $${context.parsed.y?.toFixed(2) || 'N/A'}`;
                                }
                            }
                        },
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: true,
                            text: 'Stock Price Prediction'
                        }
                    },
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    }
                }
            });
        } catch (error) {
            console.error('Chart creation error:', error);
            showError('Failed to create chart visualization');
        }
    }

    function showError(message) {
        const errorDiv = document.getElementById('error');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }

    // Helper function to format date as YYYY-MM-DD for input fields
    function formatDate(date) {
        const d = new Date(date);
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        const year = d.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return [year, month, day].join('-');
    }

    // Helper function to format date for display
    function formatDisplayDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }
});