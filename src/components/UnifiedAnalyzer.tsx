import React, { useState, useEffect, useRef } from 'react';
import { useBLE } from '../context/BLEContext';
import { ChartComponent } from './ChartComponent';
import { SensorCard } from './SensorCard';
import { Download } from 'lucide-react';
import type { ChartData } from 'chart.js';

// Simple FFT implementation
const fft = (data: number[]): number[] => {
    if (!data || !Array.isArray(data) || data.length === 0) return [];
    const n = data.length;
    if (n <= 1) return data.map(x => Math.abs(x));
    if (n < 2 || n > 100000) return [];

    const spectrum = new Array(Math.floor(n / 2)).fill(0);
    for (let k = 0; k < Math.floor(n / 2); k++) {
        let real = 0;
        let imag = 0;
        for (let t = 0; t < n; t++) {
            const angle = (2 * Math.PI * k * t) / n;
            real += data[t] * Math.cos(angle);
            imag -= data[t] * Math.sin(angle);
        }
        spectrum[k] = Math.sqrt(real * real + imag * imag);
    }
    return spectrum;
};

interface SensorAnalyzerData {
    temporalData: ChartData<'line'>;
    fftData: ChartData<'line'>;
    mode: 'continuous' | 'shock';
    view: 'time' | 'frequency';
    shockCount: number;
}

interface ContinuousBuffer {
    x: number[];
    y: number[];
    z: number[];
    labels: number[];
    startTime: number;
}

interface ShockBuffer {
    chunks: number[][];
    timeout: number | null;
}

export const UnifiedAnalyzer: React.FC = () => {
    const { sensors, setMode, setLastShockData } = useBLE();
    const [sensorData, setSensorData] = useState<Map<string, SensorAnalyzerData>>(new Map());
    const continuousBuffersRef = useRef<Map<string, ContinuousBuffer>>(new Map());
    const shockBuffersRef = useRef<Map<string, ShockBuffer>>(new Map());
    const lastProcessedDataRef = useRef<Map<string, DataView | null>>(new Map());
    const modeRef = useRef<Map<string, 'continuous' | 'shock'>>(new Map());
    const lastDisplayedShockDataRef = useRef<Map<string, any>>(new Map());

    // Initialize data for new sensors
    useEffect(() => {
        setSensorData(prev => {
            const newMap = new Map(prev);
            sensors.forEach(sensor => {
                if (!newMap.has(sensor.id)) {
                    const lastShockData = sensor.lastShockData;
                    const hasShockData = lastShockData?.x && lastShockData.x.length > 0;
                    // Determine initial mode based on sensor state
                    const initialMode = sensor.sensorState === 'Continue Mode' ? 'continuous' : 'shock';

                    continuousBuffersRef.current.set(sensor.id, {
                        x: [], y: [], z: [], labels: [], startTime: 0
                    });
                    shockBuffersRef.current.set(sensor.id, {
                        chunks: [], timeout: null
                    });
                    lastProcessedDataRef.current.set(sensor.id, null);
                    modeRef.current.set(sensor.id, initialMode);

                    let initialTemporalData: ChartData<'line'> = { labels: [], datasets: [] };
                    let initialFFTData: ChartData<'line'> = { labels: [], datasets: [] };

                    if (hasShockData && lastShockData) {
                        const labels = Array.from({ length: lastShockData.x.length }, (_, i) => (i * 0.02).toFixed(3));
                        initialTemporalData = {
                            labels,
                            datasets: [
                                { label: 'X', data: lastShockData.x, borderColor: 'rgb(239, 68, 68)', tension: 0.4, pointRadius: 0 },
                                { label: 'Y', data: lastShockData.y, borderColor: 'rgb(59, 130, 246)', tension: 0.4, pointRadius: 0 },
                                { label: 'Z', data: lastShockData.z, borderColor: 'rgb(34, 197, 94)', tension: 0.4, pointRadius: 0 }
                            ]
                        };

                        // Calculate initial FFT
                        const spectrumX = fft(lastShockData.x);
                        const spectrumY = fft(lastShockData.y);
                        const spectrumZ = fft(lastShockData.z);
                        const sampleRate = 50;
                        const freqLabels = Array.from({ length: spectrumX.length }, (_, i) =>
                            ((i * sampleRate) / ((lastShockData.x?.length || 0) * 2)).toFixed(2)
                        );

                        initialFFTData = {
                            labels: freqLabels,
                            datasets: [
                                { label: 'X', data: spectrumX, borderColor: 'rgb(239, 68, 68)', tension: 0.4, pointRadius: 0 },
                                { label: 'Y', data: spectrumY, borderColor: 'rgb(59, 130, 246)', tension: 0.4, pointRadius: 0 },
                                { label: 'Z', data: spectrumZ, borderColor: 'rgb(34, 197, 94)', tension: 0.4, pointRadius: 0 }
                            ]
                        };
                    }

                    newMap.set(sensor.id, {
                        mode: initialMode,
                        view: 'time',
                        shockCount: 0,
                        temporalData: initialTemporalData,
                        fftData: initialFFTData
                    });
                } else {
                    // Update mode if sensor state changed
                    const currentMode = sensor.sensorState === 'Continue Mode' ? 'continuous' : 'shock';
                    const storedMode = modeRef.current.get(sensor.id);
                    const current = newMap.get(sensor.id);

                    if (storedMode !== currentMode) {
                        modeRef.current.set(sensor.id, currentMode);
                        if (current) {
                            newMap.set(sensor.id, { ...current, mode: currentMode });
                        }
                    }

                    // If in shock mode and shock data exists, make sure it's displayed
                    if (currentMode === 'shock' && sensor.lastShockData?.x && sensor.lastShockData.x.length > 0 && current) {
                        const currentDataEmpty = !current.temporalData.labels || current.temporalData.labels.length === 0;
                        const shockDataChanged = lastDisplayedShockDataRef.current.get(sensor.id) !== sensor.lastShockData;

                        if (currentDataEmpty || shockDataChanged) {
                            const labels = Array.from({ length: sensor.lastShockData.x.length }, (_, i) => (i * 0.02).toFixed(3));

                            // Calculate FFT
                            const spectrumX = fft(sensor.lastShockData.x);
                            const spectrumY = fft(sensor.lastShockData.y);
                            const spectrumZ = fft(sensor.lastShockData.z);
                            const sampleRate = 50;
                            const freqLabels = Array.from({ length: spectrumX.length }, (_, i) =>
                                ((i * sampleRate) / ((sensor.lastShockData?.x?.length || 0) * 2)).toFixed(2)
                            );

                            newMap.set(sensor.id, {
                                ...current,
                                mode: currentMode,
                                temporalData: {
                                    labels,
                                    datasets: [
                                        { label: 'X', data: sensor.lastShockData.x, borderColor: 'rgb(239, 68, 68)', tension: 0.4, pointRadius: 0 },
                                        { label: 'Y', data: sensor.lastShockData.y, borderColor: 'rgb(59, 130, 246)', tension: 0.4, pointRadius: 0 },
                                        { label: 'Z', data: sensor.lastShockData.z, borderColor: 'rgb(34, 197, 94)', tension: 0.4, pointRadius: 0 }
                                    ]
                                },
                                fftData: {
                                    labels: freqLabels,
                                    datasets: [
                                        { label: 'X', data: spectrumX, borderColor: 'rgb(239, 68, 68)', tension: 0.4, pointRadius: 0 },
                                        { label: 'Y', data: spectrumY, borderColor: 'rgb(59, 130, 246)', tension: 0.4, pointRadius: 0 },
                                        { label: 'Z', data: spectrumZ, borderColor: 'rgb(34, 197, 94)', tension: 0.4, pointRadius: 0 }
                                    ]
                                }
                            });
                            lastDisplayedShockDataRef.current.set(sensor.id, sensor.lastShockData);
                            lastProcessedDataRef.current.set(sensor.id, sensor.lastData);
                        }
                    }
                }
            });

            // Remove disconnected sensors
            Array.from(newMap.keys()).forEach(id => {
                if (!sensors.find(s => s.id === id)) {
                    newMap.delete(id);
                    continuousBuffersRef.current.delete(id);
                    const shockBuffer = shockBuffersRef.current.get(id);
                    if (shockBuffer?.timeout) clearTimeout(shockBuffer.timeout);
                    shockBuffersRef.current.delete(id);
                    lastProcessedDataRef.current.delete(id);
                    modeRef.current.delete(id);
                }
            });
            return newMap;
        });
    }, [sensors.length]);

    // Process data - runs on every render
    useEffect(() => {
        sensors.forEach(sensor => {
            const mode = modeRef.current.get(sensor.id);
            if (!mode) return;

            // Process continuous mode
            if (mode === 'continuous' && sensor.lastData?.byteLength === 6) {
                if (sensor.lastData === lastProcessedDataRef.current.get(sensor.id)) return;
                lastProcessedDataRef.current.set(sensor.id, sensor.lastData);

                const buffer = continuousBuffersRef.current.get(sensor.id);
                if (!buffer) return;

                const x = sensor.lastData.getInt16(0, true) / 2048;
                const y = sensor.lastData.getInt16(2, true) / 2048;
                const z = sensor.lastData.getInt16(4, true) / 2048;

                const now = Date.now();
                if (buffer.startTime === 0) buffer.startTime = now;
                const time = (now - buffer.startTime) / 1000;

                buffer.x.push(x);
                buffer.y.push(y);
                buffer.z.push(z);
                buffer.labels.push(time);

                // Keep only last 3 seconds
                const windowSize = 3;
                while (buffer.labels.length > 0 &&
                    buffer.labels[buffer.labels.length - 1] - buffer.labels[0] > windowSize) {
                    buffer.x.shift();
                    buffer.y.shift();
                    buffer.z.shift();
                    buffer.labels.shift();
                }

                // Calculate FFT for continuous data (using last 64 samples or so)
                let spectrumX: number[] = [], spectrumY: number[] = [], spectrumZ: number[] = [], fftLabels: string[] = [];
                if (buffer.x.length >= 64) {
                    const sliceX = buffer.x.slice(-64);
                    const sliceY = buffer.y.slice(-64);
                    const sliceZ = buffer.z.slice(-64);
                    spectrumX = fft(sliceX);
                    spectrumY = fft(sliceY);
                    spectrumZ = fft(sliceZ);
                    fftLabels = Array.from({ length: spectrumX.length }, (_, i) => (i * (50 / 64)).toFixed(1));
                }

                setSensorData(prev => {
                    const newMap = new Map(prev);
                    const current = newMap.get(sensor.id);
                    if (current) {
                        const newFFTData = buffer.x.length >= 64 ? {
                            labels: fftLabels,
                            datasets: [
                                { label: 'X', data: spectrumX, borderColor: 'rgb(239, 68, 68)', tension: 0.1, pointRadius: 0 },
                                { label: 'Y', data: spectrumY, borderColor: 'rgb(59, 130, 246)', tension: 0.1, pointRadius: 0 },
                                { label: 'Z', data: spectrumZ, borderColor: 'rgb(34, 197, 94)', tension: 0.1, pointRadius: 0 }
                            ]
                        } : current.fftData;

                        newMap.set(sensor.id, {
                            ...current,
                            temporalData: {
                                labels: buffer.labels.map(t => t.toFixed(1)),
                                datasets: [
                                    { label: 'X', data: [...buffer.x], borderColor: 'rgb(239, 68, 68)', tension: 0.1, pointRadius: 0 },
                                    { label: 'Y', data: [...buffer.y], borderColor: 'rgb(59, 130, 246)', tension: 0.1, pointRadius: 0 },
                                    { label: 'Z', data: [...buffer.z], borderColor: 'rgb(34, 197, 94)', tension: 0.1, pointRadius: 0 }
                                ]
                            },
                            fftData: newFFTData
                        });
                    }
                    return newMap;
                });
            }

            // Process shock mode
            if (mode === 'shock' && sensor.sensorState === 'Data Ready' && sensor.lastData && sensor.lastData.byteLength > 6 && sensor.lastData.byteLength % 6 === 0) {
                if (sensor.lastData === lastProcessedDataRef.current.get(sensor.id)) return;
                lastProcessedDataRef.current.set(sensor.id, sensor.lastData);

                const shockBuffer = shockBuffersRef.current.get(sensor.id);
                if (!shockBuffer) return;

                const numSamples = sensor.lastData.byteLength / 6;
                const chunkData: number[] = [];

                for (let i = 0; i < numSamples; i++) {
                    const x = sensor.lastData.getInt16(i * 6, true);
                    const y = sensor.lastData.getInt16(i * 6 + 2, true);
                    const z = sensor.lastData.getInt16(i * 6 + 4, true);
                    chunkData.push(x, y, z);
                }

                shockBuffer.chunks.push(chunkData);

                if (shockBuffer.timeout) clearTimeout(shockBuffer.timeout);

                shockBuffer.timeout = window.setTimeout(() => {
                    const allData: number[] = [];
                    shockBuffer.chunks.forEach(chunk => allData.push(...chunk));

                    const totalSamples = allData.length / 3;
                    const xData: number[] = [];
                    const yData: number[] = [];
                    const zData: number[] = [];

                    for (let i = 0; i < totalSamples; i++) {
                        xData.push(allData[i * 3] / 2048);
                        yData.push(allData[i * 3 + 1] / 2048);
                        zData.push(allData[i * 3 + 2] / 2048);
                    }

                    setLastShockData(sensor.id, { x: xData, y: yData, z: zData });
                    lastDisplayedShockDataRef.current.set(sensor.id, { x: xData, y: yData, z: zData });

                    const labels = Array.from({ length: totalSamples }, (_, i) => (i * 0.02).toFixed(3));

                    // Calculate FFT
                    const spectrumX = fft(xData);
                    const spectrumY = fft(yData);
                    const spectrumZ = fft(zData);
                    const sampleRate = 50;
                    const freqLabels = Array.from({ length: spectrumX.length }, (_, i) =>
                        ((i * sampleRate) / (xData.length * 2)).toFixed(2)
                    );

                    setSensorData(prev => {
                        const newMap = new Map(prev);
                        const current = newMap.get(sensor.id);
                        if (current) {
                            newMap.set(sensor.id, {
                                ...current,
                                mode: 'shock',
                                shockCount: current.shockCount + 1,
                                temporalData: {
                                    labels,
                                    datasets: [
                                        { label: 'X', data: xData, borderColor: 'rgb(239, 68, 68)', tension: 0.4, pointRadius: 0 },
                                        { label: 'Y', data: yData, borderColor: 'rgb(59, 130, 246)', tension: 0.4, pointRadius: 0 },
                                        { label: 'Z', data: zData, borderColor: 'rgb(34, 197, 94)', tension: 0.4, pointRadius: 0 }
                                    ]
                                },
                                fftData: {
                                    labels: freqLabels,
                                    datasets: [
                                        { label: 'X', data: spectrumX, borderColor: 'rgb(239, 68, 68)', tension: 0.4, pointRadius: 0 },
                                        { label: 'Y', data: spectrumY, borderColor: 'rgb(59, 130, 246)', tension: 0.4, pointRadius: 0 },
                                        { label: 'Z', data: spectrumZ, borderColor: 'rgb(34, 197, 94)', tension: 0.4, pointRadius: 0 }
                                    ]
                                }
                            });
                        }
                        return newMap;
                    });

                    shockBuffer.chunks = [];
                    shockBuffer.timeout = null;
                }, 500);
            }
        });
    });

    const handleModeChange = (sensorId: string, mode: 'shock' | 'continuous') => {
        modeRef.current.set(sensorId, mode);
        setSensorData(prev => {
            const newMap = new Map(prev);
            const currentData = newMap.get(sensorId);
            if (currentData) {
                newMap.set(sensorId, {
                    ...currentData,
                    mode,
                    temporalData: { labels: [], datasets: [] },
                    fftData: { labels: [], datasets: [] }
                });
            }
            return newMap;
        });

        // Clear buffers
        const contBuffer = continuousBuffersRef.current.get(sensorId);
        if (contBuffer) {
            contBuffer.x = []; contBuffer.y = []; contBuffer.z = []; contBuffer.labels = []; contBuffer.startTime = 0;
        }
        const shockBuffer = shockBuffersRef.current.get(sensorId);
        if (shockBuffer) {
            if (shockBuffer.timeout) clearTimeout(shockBuffer.timeout);
            shockBuffer.chunks = []; shockBuffer.timeout = null;
        }
        lastProcessedDataRef.current.set(sensorId, null);

        if (mode === 'continuous') setMode(sensorId, 1);
        else setMode(sensorId, 0);
    };

    const handleViewChange = (sensorId: string, view: 'time' | 'frequency') => {
        setSensorData(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(sensorId);
            if (current) {
                newMap.set(sensorId, { ...current, view });
            }
            return newMap;
        });
    };

    const handleExport = (sensorId: string, sensorName: string) => {
        const data = sensorData.get(sensorId);
        if (!data || !data.temporalData.labels || data.temporalData.labels.length === 0) {
            alert('No data to export');
            return;
        }

        // Generate CSV content
        const headers = 'Time (s),X (G),Y (G),Z (G)\n';
        const rows = data.temporalData.labels.map((time, index) => {
            const x = data.temporalData.datasets[0]?.data[index] || 0;
            const y = data.temporalData.datasets[1]?.data[index] || 0;
            const z = data.temporalData.datasets[2]?.data[index] || 0;
            return `${time},${x},${y},${z}`;
        }).join('\n');

        const csvContent = headers + rows;

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        link.href = url;
        link.download = `${sensorName}_data_${timestamp}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="space-y-6">
                {sensors.length === 0 ? (
                    <div className="flex items-center justify-center h-96 text-text-secondary">
                        <div className="text-center">
                            <p className="text-xl font-semibold mb-2">No Sensors Connected</p>
                            <p>Connect a sensor to view analysis data</p>
                        </div>
                    </div>
                ) : (
                    sensors.map(sensor => {
                        const data = sensorData.get(sensor.id);
                        const currentMode = data?.mode || 'shock';
                        const currentView = data?.view || 'time';

                        return (
                            <SensorCard key={sensor.id} sensor={sensor}>
                                <div className="space-y-4">
                                    {/* Controls */}
                                    <div className="flex justify-between items-center">
                                        {/* View Toggle */}
                                        <div className="bg-surface/50 p-1 rounded-lg border border-white/10 inline-flex">
                                            <button
                                                onClick={() => handleViewChange(sensor.id, 'time')}
                                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${currentView === 'time'
                                                    ? 'bg-secondary text-white shadow-lg'
                                                    : 'text-text-secondary hover:text-white hover:bg-white/5'
                                                    }`}
                                            >
                                                Time Domain
                                            </button>
                                            <button
                                                onClick={() => handleViewChange(sensor.id, 'frequency')}
                                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${currentView === 'frequency'
                                                    ? 'bg-secondary text-white shadow-lg'
                                                    : 'text-text-secondary hover:text-white hover:bg-white/5'
                                                    }`}
                                            >
                                                Frequency (FFT)
                                            </button>
                                        </div>

                                        {/* Mode Toggle */}
                                        <div className="bg-surface/50 p-1 rounded-lg border border-white/10 inline-flex">
                                            <button
                                                onClick={() => handleModeChange(sensor.id, 'continuous')}
                                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${currentMode === 'continuous'
                                                    ? 'bg-primary text-white shadow-lg'
                                                    : 'text-text-secondary hover:text-white hover:bg-white/5'
                                                    }`}
                                            >
                                                Continuous
                                            </button>
                                            <button
                                                onClick={() => handleModeChange(sensor.id, 'shock')}
                                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${currentMode === 'shock'
                                                    ? 'bg-primary text-white shadow-lg'
                                                    : 'text-text-secondary hover:text-white hover:bg-white/5'
                                                    }`}
                                            >
                                                Shock
                                            </button>
                                        </div>
                                    </div>

                                    <div className="w-full h-[500px]">
                                        <ChartComponent
                                            title={currentView === 'time' ? "Temporal Waveform" : "FFT Spectrum"}
                                            data={currentView === 'time'
                                                ? (data?.temporalData || { labels: [], datasets: [] })
                                                : (data?.fftData || { labels: [], datasets: [] })
                                            }
                                            yAxisLabel={currentView === 'time' ? "Acceleration (G)" : "Amplitude"}
                                        />
                                    </div>

                                    {/* Export Button - Bottom Right */}
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => handleExport(sensor.id, sensor.name)}
                                            className="px-4 py-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 text-sm font-medium transition-colors border border-success/20 inline-flex items-center gap-2"
                                        >
                                            <Download size={16} />
                                            Export CSV
                                        </button>
                                    </div>
                                </div>
                            </SensorCard>
                        );
                    })
                )}
            </div>
        </div>
    );
};
