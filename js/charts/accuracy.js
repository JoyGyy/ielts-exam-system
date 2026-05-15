// js/charts/accuracy.js
'use strict';

var AccuracyChart = {
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
        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['正确', '错误'],
                datasets: [{
                    data: [data.correct || 0, data.incorrect || 0],
                    backgroundColor: [
                        'rgba(34, 197, 94, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                    ],
                    borderColor: [
                        'rgba(34, 197, 94, 1)',
                        'rgba(239, 68, 68, 1)'
                    ],
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        titleColor: '#e2e8f0',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                var total = context.dataset.data.reduce(function(a, b) { return a + b; }, 0);
                                var value = context.parsed;
                                var percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return context.label + ': ' + value + ' (' + percentage + '%)';
                            }
                        }
                    }
                },
                animation: { animateScale: true, animateRotate: true }
            },
            plugins: [{
                id: 'centerText',
                afterDraw: function(chart) {
                    var width = chart.width;
                    var height = chart.height;
                    var ctx = chart.ctx;
                    ctx.restore();

                    var total = chart.data.datasets[0].data.reduce(function(a, b) { return a + b; }, 0);
                    var correct = chart.data.datasets[0].data[0];
                    var percentage = total > 0 ? ((correct / total) * 100).toFixed(0) : 0;

                    ctx.font = 'bold 24px Inter, sans-serif';
                    ctx.fillStyle = '#e2e8f0';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(percentage + '%', width / 2, height / 2 - 8);

                    ctx.font = '12px Inter, sans-serif';
                    ctx.fillStyle = '#94a3b8';
                    ctx.fillText('正确率', width / 2, height / 2 + 16);

                    ctx.save();
                }
            }]
        });
    },

    update: function(data) {
        if (!this.chart) return;
        this.chart.data.datasets[0].data = [data.correct || 0, data.incorrect || 0];
        this.chart.update();
    },

    destroy: function() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
};

window.AccuracyChart = AccuracyChart;
