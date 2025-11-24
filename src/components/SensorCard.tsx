import { Battery, Zap, Activity, Plug } from 'lucide-react';
import type { ReactNode } from 'react';

interface SensorCardProps {
    sensor: any;
    children?: ReactNode;
}

export function SensorCard({ sensor, children }: SensorCardProps) {
    const sensorColor = sensor.color || '#06b6d4';
    const batteryLevel = sensor.batteryLevel || 0;
    // Firmware values: 0 = Charging, 1 = Charged (100% + plugged), 2 = Discharging (on battery)
    const chargingStatus = sensor.chargingStatus;
    const isCharging = chargingStatus === 0;
    const isFullyCharged = chargingStatus === 1;

    const renderBatteryIcon = () => {
        if (isFullyCharged) {
            return (
                <div className="flex items-center gap-1 text-success bg-success/10 px-2 py-1 rounded-full border border-success/20">
                    <Battery size={16} className="fill-current" />
                    <Plug size={14} />
                    <span className="text-xs font-bold">{batteryLevel}%</span>
                </div>
            );
        }
        if (isCharging) {
            return (
                <div className="flex items-center gap-1 text-warning bg-warning/10 px-2 py-1 rounded-full border border-warning/20">
                    <Battery size={16} className="fill-current" />
                    <Zap size={14} className="fill-current" />
                    <span className="text-xs font-bold">{batteryLevel}%</span>
                </div>
            );
        }
        return (
            <div className="flex items-center gap-1 text-gray-400 bg-white/5 px-2 py-1 rounded-full border border-white/10">
                <Battery size={16} />
                <span className="text-xs font-bold">{batteryLevel}%</span>
            </div>
        );
    };

    const getStatusStyle = (state: string) => {
        const s = (state || '').toUpperCase();
        if (s.includes('IDLE')) return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
        if (s.includes('ARMED')) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
        if (s.includes('ACQUISITION')) return 'text-red-400 bg-red-400/10 border-red-400/20';
        if (s.includes('DATA READY')) return 'text-green-400 bg-green-400/10 border-green-400/20';
        if (s.includes('CONTINUE')) return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
        return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    };

    return (
        <div
            className="glass-panel rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 border-white/5 hover:border-opacity-100"
            style={{ borderColor: sensorColor, borderWidth: '2px' }}
        >
            {/* Background Glow */}
            <div
                className="absolute -right-10 -top-10 w-40 h-40 blur-[50px] rounded-full transition-all duration-500 opacity-20 group-hover:opacity-30"
                style={{ backgroundColor: sensorColor }}
            ></div>

            <div className="flex justify-between items-center mb-6 relative z-10">
                <div className="flex items-center gap-4">
                    <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
                        {sensor.name}
                        {renderBatteryIcon()}
                    </h3>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusStyle(sensor.sensorState)}`}>
                    {sensor.sensorState || 'Unknown'}
                </span>
            </div>

            {/* Content (Charts, etc.) */}
            {children && (
                <div className="relative z-10">
                    {children}
                </div>
            )}
        </div>
    );
}
