// js/charts/practice.js
'use strict';

var PracticeChart = {
    chart: null,

    init: function(containerId, data) {
        var container = document.getElementById(containerId);
        if (!container) return;
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded');
            return;
        }

        var canvas = document.createElement('canvas');
        canvas.id = containerId + '-canvas';
        container.appendChild(canvas);

        var ctx = canvas.getContext('2d');
        var gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(217, 119, 6, 0.8)');
        gradient.addColorStop(1, 'rgba(234, 88, 12, 0.4)');

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels || ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
                datasets: [{
                    label: '练习次数',
                    data: data.values || [0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: gradient,
                    borderColor: 'rgba(217, 119, 6, 1)',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        titleColor: '#e2e8f0',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return '练习 ' + context.parsed.y + ' 次';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', stepSize: 1 }
                    }
                },
                animation: { easing: 'easeOutQuart', duration: 1000 }
            }
        });
    },

    update: function(data) {
        if (!this.chart) return;
        this.chart.data.labels = data.labels;
        this.chart.data.datasets[0].data = data.values;
        this.chart.update();
    },

    destroy: function() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
};

window.PracticeChart = PracticeChart;
