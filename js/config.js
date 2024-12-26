window.APP_CONFIG = {
    QWEATHER_KEY: process.env.QWEATHER_KEY || '',
    LOCATION_ID: '101190801',  // 徐州
    UPDATE_INTERVALS: {
        weather: 10 * 60 * 1000,    // 10分钟
        forecast: 30 * 60 * 1000,   // 30分钟
        alerts: 5 * 60 * 1000       // 5分钟
    }
}; 