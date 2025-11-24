import { useState, useEffect } from 'react';
import { useBLE } from '../context/BLEContext';
import { Save, Smartphone, Cpu, Hash } from 'lucide-react';

// Individual Sensor Settings Component
function SensorSettingsCard({ sensor }: { sensor: any }) {
    const { setSensorName, setSensorColor, setSensorThresholds, setShockDuration, setPreShockTime, updateFirmware, isOtaInProgress, disconnectSensor } = useBLE();

    // Original conversion: 1G = 2048 counts
    const countsToG = (counts: number) => (counts / 2048).toFixed(2);

    const [name, setName] = useState(sensor.name || '');
    const [color, setColor] = useState(sensor.color || '#06b6d4');
    // Initialize with raw values directly (Defaults: ~0.85G = 1741, 3G = 6144)
    const [armingThreshold, setArmingThreshold] = useState(sensor.armingThreshold || 1741);
    const [shockThreshold, setShockThreshold] = useState(sensor.shockThreshold || 6144);
    // Acquisition time settings (in milliseconds)
    const [shockDuration, setLocalShockDuration] = useState(sensor.shockDuration || 3000); // 1-5s
    const [preShockTime, setLocalPreShockTime] = useState(sensor.preShockTime || 500); // 0-1s

    // OTA State
    const [otaFile, setOtaFile] = useState<File | null>(null);
    const [otaProgress, setOtaProgress] = useState(0);
    const [otaError, setOtaError] = useState<string | null>(null);

    // Update local state when sensor prop changes
    useEffect(() => {
        setName(sensor.name || '');
        setColor(sensor.color || '#06b6d4');
        // Update state with raw values directly
        if (sensor.armingThreshold) setArmingThreshold(sensor.armingThreshold);
        if (sensor.shockThreshold) setShockThreshold(sensor.shockThreshold);
        if (sensor.shockDuration) setLocalShockDuration(sensor.shockDuration);
        if (sensor.preShockTime) setLocalPreShockTime(sensor.preShockTime);
    }, [sensor.name, sensor.color, sensor.armingThreshold, sensor.shockThreshold, sensor.shockDuration, sensor.preShockTime]);

    const handleSave = () => {
        setSensorName(sensor.id, name);
        setSensorColor(sensor.id, color);
        // Save raw values directly
        setSensorThresholds(sensor.id, armingThreshold, shockThreshold);
        setShockDuration(sensor.id, shockDuration);
        setPreShockTime(sensor.id, preShockTime);
    };

    const handleOTA = async () => {
        if (!otaFile) return;
        setOtaError(null);
        setOtaProgress(0);
        try {
            await updateFirmware(sensor.id, otaFile, (percent) => setOtaProgress(percent));
            setOtaFile(null);
            alert('Firmware updated successfully!');
        } catch (err: any) {
            setOtaError(err.message || 'Update failed');
        }
    };

    const sensorColor = sensor.color || '#06b6d4';

    return (
        <div
            className="glass-panel p-6 rounded-2xl space-y-6 border-white/5 transition-all duration-300"
            style={{ borderColor: sensorColor, borderWidth: '2px' }}
        >
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Smartphone size={20} className="text-primary" />
                    {sensor.name || 'Unknown Device'}
                </h3>
                <button
                    onClick={() => disconnectSensor(sensor.id)}
                    className="px-3 py-1.5 rounded-lg bg-error/10 text-error hover:bg-error/20 text-xs font-medium transition-colors border border-error/20"
                >
                    Disconnect
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Device Info & Appearance */}
                <div className="space-y-4">
                    <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider">Device Information</h4>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-text-secondary block mb-1">Device Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-surface/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                                placeholder="Enter device name"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-text-secondary block mb-1">LED Color</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="h-10 w-20 bg-transparent border-none cursor-pointer rounded overflow-hidden"
                                />
                                <span className="text-sm font-mono text-text-secondary">{color}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-surface/30 p-3 rounded-lg border border-white/5">
                                <span className="text-xs text-text-secondary block">Hardware</span>
                                <span className="text-sm font-mono text-white">{sensor.hardwareRevision || 'N/A'}</span>
                            </div>
                            <div className="bg-surface/30 p-3 rounded-lg border border-white/5">
                                <span className="text-xs text-text-secondary block">Software</span>
                                <span className="text-sm font-mono text-white">{sensor.softwareRevision || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Configuration & OTA */}
                <div className="space-y-6">
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider flex items-center gap-2">
                            <Cpu size={16} /> Configuration
                        </h4>
                        <div className="space-y-5">
                            <div>
                                <label className="flex justify-between text-sm font-medium text-text-secondary mb-2">
                                    Arming Threshold <span className="text-white">{countsToG(armingThreshold)}G ({armingThreshold})</span>
                                </label>
                                <input
                                    type="range"
                                    min="1024"
                                    max="2048"
                                    step="10"
                                    value={armingThreshold}
                                    onChange={(e) => setArmingThreshold(Number(e.target.value))}
                                    className="w-full h-2 bg-surface-light rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                                <div className="flex justify-between text-xs text-text-secondary mt-1">
                                    <span>0.5G</span>
                                    <span>1G</span>
                                </div>
                            </div>
                            <div>
                                <label className="flex justify-between text-sm font-medium text-text-secondary mb-2">
                                    Shock Threshold <span className="text-white">{countsToG(shockThreshold)}G ({shockThreshold})</span>
                                </label>
                                <input
                                    type="range"
                                    min="2560"
                                    max="30720"
                                    step="100"
                                    value={shockThreshold}
                                    onChange={(e) => setShockThreshold(Number(e.target.value))}
                                    className="w-full h-2 bg-surface-light rounded-lg appearance-none cursor-pointer accent-secondary"
                                />
                                <div className="flex justify-between text-xs text-text-secondary mt-1">
                                    <span>1.25G</span>
                                    <span>15G</span>
                                </div>
                            </div>
                            <div>
                                <label className="flex justify-between text-sm font-medium text-text-secondary mb-2">
                                    Shock Duration <span className="text-white">{(shockDuration / 1000).toFixed(1)}s</span>
                                </label>
                                <input
                                    type="range"
                                    min="1000"
                                    max="5000"
                                    step="100"
                                    value={shockDuration}
                                    onChange={(e) => setLocalShockDuration(Number(e.target.value))}
                                    className="w-full h-2 bg-surface-light rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                                <div className="flex justify-between text-xs text-text-secondary mt-1">
                                    <span>1.0s</span>
                                    <span>5.0s</span>
                                </div>
                            </div>
                            <div>
                                <label className="flex justify-between text-sm font-medium text-text-secondary mb-2">
                                    Pre-Shock Time <span className="text-white">{(preShockTime / 1000).toFixed(1)}s</span>
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1000"
                                    step="100"
                                    value={preShockTime}
                                    onChange={(e) => setLocalPreShockTime(Number(e.target.value))}
                                    className="w-full h-2 bg-surface-light rounded-lg appearance-none cursor-pointer accent-secondary"
                                />
                                <div className="flex justify-between text-xs text-text-secondary mt-1">
                                    <span>0.0s</span>
                                    <span>1.0s</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Firmware Update */}
                    <div className="pt-4 border-t border-white/5">
                        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-3">Firmware Update</h4>
                        <div className="bg-surface/30 p-4 rounded-xl border border-white/5">
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="file"
                                    accept=".bin"
                                    onChange={(e) => setOtaFile(e.target.files?.[0] || null)}
                                    className="text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                />
                            </div>
                            {otaFile && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-text-secondary">
                                        <span>{otaFile.name}</span>
                                        <span>{(otaFile.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                    <button
                                        onClick={handleOTA}
                                        disabled={isOtaInProgress}
                                        className="w-full py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                        {isOtaInProgress ? 'Updating...' : 'Start Update'}
                                    </button>
                                </div>
                            )}
                            {isOtaInProgress && (
                                <div className="mt-3">
                                    <div className="w-full h-1.5 bg-surface-light rounded-full overflow-hidden">
                                        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${otaProgress}%` }}></div>
                                    </div>
                                    <p className="text-center text-xs text-text-secondary mt-1">{otaProgress}%</p>
                                </div>
                            )}
                            {otaError && (
                                <p className="text-xs text-error mt-2">{otaError}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-2">
                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all transform hover:-translate-y-0.5"
                >
                    <Save size={18} />
                    Save Settings
                </button>
            </div>
        </div>
    );
}

export function Settings() {
    const { sensors } = useBLE();

    if (sensors.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-text-secondary">
                <p>Connect a sensor to configure settings.</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-10">
            <div className="space-y-6">
                {sensors.map(sensor => (
                    <SensorSettingsCard key={sensor.id} sensor={sensor} />
                ))}
            </div>
        </div>
    );
}
