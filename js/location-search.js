class LocationSearch {
    constructor(map) {
        this.map = map;
        this.currentLocationMarker = null;
        this.searchMarker = null;
        this.init();
    }

    init() {
        this.createSearchBox();
        this.initGeolocation();
        this.initAutoComplete();
        this.locateCurrentPosition();
    }

    createSearchBox() {
        const container = document.createElement('div');
        container.className = 'search-container';
        container.innerHTML = `
            <input type="text" class="search-input" placeholder="搜索地点...">
            <button class="search-btn">确认</button>
        `;
        document.body.appendChild(container);

        this.searchInput = container.querySelector('.search-input');
        const searchBtn = container.querySelector('.search-btn');
        
        searchBtn.addEventListener('click', () => this.searchLocation());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchLocation();
            }
        });
    }

    initAutoComplete() {
        AMap.plugin(['AMap.AutoComplete', 'AMap.PlaceSearch'], () => {
            // 初始化输入提示
            this.autoComplete = new AMap.AutoComplete({
                input: this.searchInput,
                city: '徐州',
                citylimit: true,
                outPutDirAuto: true
            });

            // 初始化POI搜索
            this.placeSearch = new AMap.PlaceSearch({
                city: '徐州',
                citylimit: true,
                pageSize: 10,
                pageIndex: 1,
                extensions: 'all'
            });

            // 注册选择事件
            this.autoComplete.on('select', (e) => {
                this.placeSearch.setCity(e.poi.adcode);
                this.placeSearch.search(e.poi.name, (status, result) => {
                    if (status === 'complete') {
                        this.showSearchResult(result.poiList.pois[0]);
                    }
                });
            });
        });
    }

    searchLocation() {
        const keyword = this.searchInput.value.trim();
        if (!keyword) return;

        this.placeSearch.search(keyword, (status, result) => {
            if (status === 'complete' && result.poiList && result.poiList.pois.length > 0) {
                this.showSearchResult(result.poiList.pois[0]);
            } else {
                // 如果直接搜索失败，尝试模糊搜索
                this.autoComplete.search(keyword, (status, result) => {
                    if (status === 'complete' && result.tips.length > 0) {
                        // 使用第一个提示结果进行搜索
                        const firstTip = result.tips[0];
                        this.placeSearch.search(firstTip.name, (status, result) => {
                            if (status === 'complete' && result.poiList && result.poiList.pois.length > 0) {
                                this.showSearchResult(result.poiList.pois[0]);
                            } else {
                                this.showMessage('未找到相关地点，请尝试其他关键词', 'error');
                            }
                        });
                    } else {
                        this.showMessage('未找到相关地点，请尝试其他关键词', 'error');
                    }
                });
            }
        });
    }

    showSearchResult(poi) {
        if (this.searchMarker) {
            this.searchMarker.setMap(null);
        }

        this.searchMarker = new AMap.Marker({
            map: this.map,
            position: [poi.location.lng, poi.location.lat],
            animation: 'AMAP_ANIMATION_DROP'
        });

        const infoWindow = new AMap.InfoWindow({
            content: `
                <div class="info-window">
                    <h4>${poi.name}</h4>
                    <p>${poi.address || ''}</p>
                    ${poi.tel ? `<p>电话：${poi.tel}</p>` : ''}
                    ${poi.type ? `<p>类型：${poi.type}</p>` : ''}
                </div>
            `,
            offset: new AMap.Pixel(0, -30)
        });

        this.searchMarker.on('click', () => {
            infoWindow.open(this.map, this.searchMarker.getPosition());
        });

        this.map.setZoomAndCenter(17, [poi.location.lng, poi.location.lat]);
        infoWindow.open(this.map, this.searchMarker.getPosition());
    }

    initGeolocation() {
        AMap.plugin('AMap.Geolocation', () => {
            this.geolocation = new AMap.Geolocation({
                enableHighAccuracy: true,
                timeout: 10000,
                zoomToAccuracy: true
            });
        });
    }

    locateCurrentPosition() {
        this.geolocation.getCurrentPosition((status, result) => {
            if (status === 'complete') {
                const position = result.position;
                
                if (this.currentLocationMarker) {
                    this.currentLocationMarker.setMap(null);
                }

                this.currentLocationMarker = new AMap.Marker({
                    position: [position.lng, position.lat],
                    map: this.map,
                    icon: new AMap.Icon({
                        size: new AMap.Size(24, 24),
                        image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png',
                        imageSize: new AMap.Size(24, 24)
                    }),
                    offset: new AMap.Pixel(-12, -12)
                });

                this.map.setZoomAndCenter(17, [position.lng, position.lat]);
                this.showMessage('已定位到当前位置');
            } else {
                console.error('定位失败:', result);
                this.showMessage('定位失败，请检查定位权限', 'error');
            }
        });
    }

    showMessage(text, type = 'success') {
        const message = document.createElement('div');
        message.className = `location-message ${type}`;
        message.textContent = text;
        document.body.appendChild(message);
        setTimeout(() => message.remove(), 2000);
    }
} 