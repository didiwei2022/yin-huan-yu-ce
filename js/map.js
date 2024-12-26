function initMap() {
    const map = new AMap.Map("container", {
        resizeEnable: true,
        center: [117.19, 34.26],
        zoom: 12
    });

    if (!isSupportCanvas()) {
        alert('热力图仅对支持canvas的浏览器适用,您所使用的浏览器不能使用热力图功能,请换个浏览器试试~')
    }

    loadHeatmapData().then(data => {
        initHeatmap(map, data);
    });

    return map;
}

function loadHeatmapData() {
    return fetch('/data/heatmap-data.json')
        .then(response => response.json())
        .then(json => json.data);
}

function initHeatmap(map, heatmapData) {
    var heatmap;
    map.plugin(["AMap.Heatmap"], function () {
        heatmap = new AMap.Heatmap(map, {
            radius: 20,
            opacity: [0, 0.8],
            gradient: {
                0.2: '#0000FF',
                0.7: '#00FF00',
                0.8: '#FFFF00',
                0.9: '#FFA500',
                1.0: '#FF0000'
            },
            zIndex: 2
        });
        
        heatmap.setDataSet({
            data: heatmapData,
            max: 100
        });
    });
}

function isSupportCanvas() {
    var elem = document.createElement('canvas');
    return !!(elem.getContext && elem.getContext('2d'));
} 