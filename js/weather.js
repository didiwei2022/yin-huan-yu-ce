class WeatherSystem {
    constructor(map) {
        this.map = map;
        this.apiKey = window.APP_CONFIG?.QWEATHER_KEY;
        
        if (!this.apiKey) {
            throw new Error('天气API密钥未配置');
        }
        
        this.location = '101190801';
        this.statusBanner = null;
        this.weatherWidgets = null;
        this.init();
    }

    async init() {
        this.createWeatherWidgets();
        this.createStatusBanner();
        await this.startWeatherMonitoring();
    }

    createWeatherWidgets() {
        // 创建组件容器
        this.weatherWidgets = document.createElement('div');
        this.weatherWidgets.className = 'weather-widgets';
        
        // 创建实时天气组件
        const nowWidget = document.createElement('div');
        nowWidget.className = 'weather-widget weather-now-widget';
        nowWidget.innerHTML = `
            <div class="weather-now">
                <div class="weather-content"></div>
            </div>
            <div class="weather-details"></div>
        `;

        // 创建天气预报组件
        const forecastWidget = document.createElement('div');
        forecastWidget.className = 'weather-widget forecast-widget';
        forecastWidget.innerHTML = `
            <div class="forecast-title">未来3天</div>
            <div class="forecast-days"></div>
        `;

        this.weatherWidgets.appendChild(nowWidget);
        this.weatherWidgets.appendChild(forecastWidget);
        document.body.appendChild(this.weatherWidgets);
    }

    createStatusBanner() {
        this.statusBanner = document.createElement('div');
        this.statusBanner.className = 'weather-status safe';
        this.statusBanner.textContent = '✓ 当前无天气预警';
        document.body.appendChild(this.statusBanner);
    }

    async startWeatherMonitoring() {
        // 初始加载
        await Promise.all([
            this.updateWeatherNow(),
            this.updateWeatherForecast(),
            this.checkWeatherAlerts()
        ]);

        // 定时更新
        setInterval(() => this.updateWeatherNow(), 10 * 60 * 1000); // 10分钟更新一次实时天气
        setInterval(() => this.updateWeatherForecast(), 30 * 60 * 1000); // 30分钟更新一次预报
        setInterval(() => this.checkWeatherAlerts(), 5 * 60 * 1000); // 5分钟检查一次预警
    }

    async updateWeatherNow() {
        try {
            const response = await fetch(
                `https://devapi.qweather.com/v7/weather/now?location=${this.location}&key=${this.apiKey}`
            );
            const data = await response.json();
            
            if (data.code === '200') {
                const now = data.now;
                const content = this.weatherWidgets.querySelector('.weather-content');
                const details = this.weatherWidgets.querySelector('.weather-details');
                
                content.innerHTML = `
                    <img src="https://a.hecdn.net/img/common/icon/202106d/${now.icon}.png" alt="${now.text}">
                    <span class="temp">${now.temp}°C</span>
                    <span class="text">${now.text}</span>
                `;

                details.innerHTML = `
                    <p>体感温度: ${now.feelsLike}°C</p>
                    <p>相对湿度: ${now.humidity}%</p>
                    <p>风向: ${now.windDir} ${now.windScale}级</p>
                    <p>能见度: ${now.vis}km</p>
                `;
            } else {
                console.error('天气API响应错误:', data);
                throw new Error(`天气API响应错误: ${data.code}`);
            }
        } catch (error) {
            console.error('获取实时天气失败:', error);
            this.showError('获取实时天气失败');
        }
    }

    async updateWeatherForecast() {
        try {
            const response = await fetch(
                `https://devapi.qweather.com/v7/weather/3d?location=${this.location}&key=${this.apiKey}`
            );
            const data = await response.json();
            
            if (data.code === '200') {
                const content = this.weatherWidgets.querySelector('.forecast-days');
                content.innerHTML = data.daily.map(day => `
                    <div class="forecast-day">
                        <div class="date">${this.formatDate(day.fxDate)}</div>
                        <img src="https://a.hecdn.net/img/common/icon/202106d/${day.iconDay}.png" alt="${day.textDay}">
                        <div class="temp-range">${day.tempMin}~${day.tempMax}°C</div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('获取天气预报失败:', error);
        }
    }

    async checkWeatherAlerts() {
        try {
            const response = await fetch(
                `https://devapi.qweather.com/v7/warning/now?location=${this.location}&key=${this.apiKey}`
            );
            const data = await response.json();
            
            if (data.code === '200') {
                if (data.warning && data.warning.length > 0) {
                    this.statusBanner.className = 'weather-status warning';
                    this.statusBanner.textContent = '⚠️ 有天气预警';
                    this.showAlertDialog(data.warning[0]);
                } else {
                    this.statusBanner.className = 'weather-status safe';
                    this.statusBanner.textContent = '徐州市当前无极端天气预警';
                }
            }
        } catch (error) {
            console.error('获取���气预警失败:', error);
        }
    }

    showAlertDialog(alert) {
        const dialog = document.createElement('div');
        dialog.className = 'weather-alert';
        dialog.innerHTML = `
            <h3>⚠️ ${alert.title}</h3>
            <p>${alert.text}</p>
            <p class="alert-time">发布时间: ${alert.pubTime}</p>
            <button onclick="this.parentElement.remove()">关闭</button>
        `;
        document.body.appendChild(dialog);
        dialog.style.display = 'block';
        dialog.style.animation = 'slideIn 0.5s ease-out';
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return `${weekdays[date.getDay()]} ${date.getMonth() + 1}/${date.getDate()}`;
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'weather-error';
        errorDiv.textContent = message;
        this.weatherWidgets.appendChild(errorDiv);
    }
} 