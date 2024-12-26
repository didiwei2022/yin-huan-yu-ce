class RiskAnalysis {
    constructor(map, data) {
        this.map = map;
        this.data = data;
        this.gridSize = 0.001;
        this.markers = [];
        this.init();
    }

    init() {
        this.createRankingPanel();
        this.createViolationPanel();
        this.analyzeRiskPoints();
    }

    createRankingPanel() {
        const panel = document.createElement('div');
        panel.className = 'risk-ranking';
        panel.innerHTML = `
            <h3 class="panel-title">东部公交隐患排序</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>序号</th>
                        <th>地点</th>
                        <th>风险指数</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `;
        document.body.appendChild(panel);
        this.rankingPanel = panel;
    }

    createViolationPanel() {
        const panel = document.createElement('div');
        panel.className = 'violation-hotspots';
        panel.innerHTML = `
            <h3 class="panel-title">2024年违章十大高发路段</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>序号</th>
                        <th>地点</th>
                        <th>次数</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.getViolationData().map((item, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${item.location}</td>
                            <td>${item.count}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        document.body.appendChild(panel);
    }

    getViolationData() {
        return [
            { location: '徐海路', count: 18 },
            { location: '安然村', count: 18 },
            { location: '儿童医院', count: 16 },
            { location: '沟棠路', count: 15 },
            { location: '时代大道', count: 10 },
            { location: '姚庄路口', count: 9 },
            { location: '韩园', count: 9 },
            { location: '南京银行', count: 8 },
            { location: '苏堤路口', count: 8 },
            { location: '文化宫', count: 7 }
        ];
    }

    analyzeRiskPoints() {
        // 创建网格
        const grids = {};
        
        // 统计每个网格内的点数
        this.data.forEach(point => {
            const gridX = Math.floor(point.lng / this.gridSize);
            const gridY = Math.floor(point.lat / this.gridSize);
            const gridKey = `${gridX},${gridY}`;
            
            if (!grids[gridKey]) {
                grids[gridKey] = {
                    count: 0,
                    center: {
                        lng: (gridX + 0.5) * this.gridSize,
                        lat: (gridY + 0.5) * this.gridSize
                    }
                };
            }
            grids[gridKey].count++;
        });

        // 转换为数组并排序
        const riskPoints = Object.entries(grids)
            .map(([key, value]) => ({
                location: value.center,
                count: value.count,
                riskIndex: value.count // 简单地用点数作为风险指数
            }))
            .sort((a, b) => b.riskIndex - a.riskIndex)
            .slice(0, 30);

        // 更新排名列表
        this.updateRankingList(riskPoints);
        
        // 添加地图标记
        this.addMapMarkers(riskPoints);
    }

    updateRankingList(riskPoints) {
        const tbody = this.rankingPanel.querySelector('tbody');
        tbody.innerHTML = riskPoints.map((point, index) => `
            <tr data-index="${index}">
                <td>${index + 1}</td>
                <td>${point.location.lng.toFixed(4)}, ${point.location.lat.toFixed(4)}</td>
                <td>${point.riskIndex}</td>
            </tr>
        `).join('');

        tbody.addEventListener('click', (e) => {
            const tr = e.target.closest('tr');
            if (tr) {
                const index = tr.dataset.index;
                const point = riskPoints[index];
                this.map.setCenter([point.location.lng, point.location.lat]);
                this.map.setZoom(16);
            }
        });
    }

    addMapMarkers(riskPoints) {
        this.markers.forEach(marker => marker.setMap(null));
        this.markers = [];

        riskPoints.forEach((point, index) => {
            const marker = new AMap.Marker({
                position: [point.location.lng, point.location.lat],
                map: this.map,
            });

            const info = new AMap.InfoWindow({
                content: `
                    <div class="info-window">
                        <h4>风险点 #${index + 1}</h4>
                        <p>风险指数：${point.riskIndex}</p>
                    </div>
                `,
                offset: new AMap.Pixel(0, -30)
            });

            marker.on('click', () => {
                info.open(this.map, marker.getPosition());
            });

            this.markers.push(marker);
        });
    }
} 