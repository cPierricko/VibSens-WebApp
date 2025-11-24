import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import type { ChartOptions, ChartData } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface ChartProps {
    title: string;
    data: ChartData<'line'>;
    yAxisLabel?: string;
}

export const ChartComponent: React.FC<ChartProps> = ({ title, data, yAxisLabel }) => {
    const options: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    color: '#94a3b8' // slate-400
                }
            },
            title: {
                display: true,
                text: title,
                color: '#e2e8f0' // slate-200
            },
        },
        scales: {
            x: {
                grid: {
                    color: '#334155' // slate-700
                },
                ticks: {
                    color: '#94a3b8'
                }
            },
            y: {
                grid: {
                    color: '#334155'
                },
                ticks: {
                    color: '#94a3b8'
                },
                title: {
                    display: !!yAxisLabel,
                    text: yAxisLabel,
                    color: '#94a3b8'
                }
            }
        }
    };

    return <Line options={options} data={data} />;
};
