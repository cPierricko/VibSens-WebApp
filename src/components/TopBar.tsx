import { Bluetooth, BluetoothConnected, Wifi, Bell } from 'lucide-react';
import { useBLE } from '../context/BLEContext';

export function TopBar() {
    const { sensors, connectSensor, disconnectSensor } = useBLE();
    const isConnected = sensors.length > 0;
    const activeSensor = sensors[0];

    const handleConnectToggle = () => {
        if (isConnected && activeSensor) {
            disconnectSensor(activeSensor.id);
        } else {
            connectSensor();
        }
    };

    return (
        <header className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-surface/30 backdrop-blur-md z-10 sticky top-0">
            <div className="flex items-center gap-4">
                {/* Left side empty for now or could hold breadcrumbs if needed later */}
            </div>

            <div className="flex items-center gap-4">
                {/* Connection Button */}
                <button
                    onClick={connectSensor}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 border bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                >
                    <Bluetooth size={16} />
                    <span>{isConnected ? 'Add Sensor' : 'Connect Sensor'}</span>
                </button>

                {/* Connected Sensors List (Optional - for visibility) */}
                {isConnected && (
                    <div className="flex -space-x-2 ml-2">
                        {sensors.map((s, i) => (
                            <div
                                key={s.id}
                                className="w-8 h-8 rounded-full border-2 border-surface bg-surface-light flex items-center justify-center text-xs font-bold text-white relative group cursor-help"
                                style={{ backgroundColor: s.color || '#06b6d4' }}
                                title={s.name}
                            >
                                {i + 1}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </header>
    );
}
