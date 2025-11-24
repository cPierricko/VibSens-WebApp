import React, { createContext, useState, useContext, useCallback, useRef, useEffect } from 'react';
import { SERVICE_UUID, BATTERY_SERVICE_UUID, AUTO_IO_SERVICE_UUID, CHAR_UUIDS, DEVICE_INFO_SERVICE_UUID } from '../constants/uuids';

interface SensorData {
    id: string;
    device: BluetoothDevice;
    name: string;
    color: string | null;
    batteryLevel: number | null;
    chargingStatus: number | null;
    sensorState: string;
    lastData: DataView | null;
    lastShockData: { x: number[], y: number[], z: number[] } | null;
    hardwareRevision: string;
    softwareRevision: string;
    statusCharRef: BluetoothRemoteGATTCharacteristic | null;
    armingThreshold: number | null;
    shockThreshold: number | null;
    shockDuration: number | null; // in milliseconds (1000-5000)
    preShockTime: number | null; // in milliseconds (0-1000)
}

interface BLEContextType {
    sensors: SensorData[];
    connectSensor: () => Promise<void>;
    disconnectSensor: (id: string) => void;
    getSensor: (id: string) => SensorData | undefined;
    setMode: (sensorId: string, mode: number) => Promise<void>;
    setSensorName: (sensorId: string, name: string) => void;
    setSensorColor: (sensorId: string, color: string) => void;
    setSensorThresholds: (sensorId: string, arming: number, shock: number) => void;
    setShockDuration: (sensorId: string, duration: number) => Promise<void>;
    setPreShockTime: (sensorId: string, time: number) => Promise<void>;
    setLastShockData: (sensorId: string, data: { x: number[], y: number[], z: number[] } | null) => void;
    isOtaInProgress: boolean;
    setOtaInProgress: (inProgress: boolean) => void;
    updateFirmware: (sensorId: string, file: File, onProgress: (percent: number) => void) => Promise<void>;
}

const BLEContext = createContext<BLEContextType | undefined>(undefined);

export const BLEProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [sensors, setSensors] = useState<SensorData[]>([]);
    const [isOtaInProgress, setOtaInProgress] = useState(false);
    const isOtaInProgressRef = useRef(false);

    useEffect(() => {
        isOtaInProgressRef.current = isOtaInProgress;
    }, [isOtaInProgress]);

    const updateSensor = useCallback((id: string, updates: Partial<SensorData>) => {
        setSensors(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    }, []);

    const handleDisconnect = useCallback((sensorId: string) => {
        console.log('Sensor disconnected:', sensorId);
        setSensors(prev => prev.filter(s => s.id !== sensorId));
    }, []);

    const connectSensor = useCallback(async () => {
        try {
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: 'VibSens' }],
                optionalServices: [SERVICE_UUID, BATTERY_SERVICE_UUID, AUTO_IO_SERVICE_UUID, DEVICE_INFO_SERVICE_UUID]
            });

            const sensorId = device.id;

            // Check if already connected
            if (sensors.find(s => s.id === sensorId)) {
                console.log('Sensor already connected');
                return;
            }

            // Create initial sensor data
            const newSensor: SensorData = {
                id: sensorId,
                device,
                name: device.name || 'VibSens',
                color: null,
                batteryLevel: null,
                chargingStatus: null,
                sensorState: 'Connecting...',
                lastData: null,
                lastShockData: null,
                hardwareRevision: '-',
                softwareRevision: '-',
                statusCharRef: null,
                armingThreshold: null,
                shockThreshold: null,
                shockDuration: null,
                preShockTime: null
            };

            setSensors(prev => [...prev, newSensor]);

            device.addEventListener('gattserverdisconnected', () => handleDisconnect(sensorId));

            const server = await device.gatt?.connect();
            if (!server) throw new Error('GATT server not found');

            const service = await server.getPrimaryService(SERVICE_UUID);
            const batteryService = await server.getPrimaryService(BATTERY_SERVICE_UUID);

            // Subscribe to Battery
            const batteryChar = await batteryService.getCharacteristic(CHAR_UUIDS.BATTERY);
            try {
                const initialBattery = await batteryChar.readValue();
                updateSensor(sensorId, { batteryLevel: initialBattery.getUint8(0) });
            } catch (e) {
                console.warn('Failed to read initial battery level:', e);
            }

            await batteryChar.startNotifications();
            batteryChar.addEventListener('characteristicvaluechanged', (event: Event) => {
                const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
                if (value) {
                    const level = value.getUint8(0);
                    console.log(`Battery level updated for ${sensorId}: ${level}%`);
                    updateSensor(sensorId, { batteryLevel: level });
                }
            });

            // Subscribe to State/Data Stream
            const stateChar = await service.getCharacteristic(CHAR_UUIDS.STATE);
            await stateChar.startNotifications();

            stateChar.addEventListener('characteristicvaluechanged', (event: Event) => {
                const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
                if (value) {
                    updateSensor(sensorId, { lastData: value });
                }
            });

            // Read Sensor Name
            try {
                const nameChar = await service.getCharacteristic(CHAR_UUIDS.SENSOR_NAME);
                const nameValue = await nameChar.readValue();
                const name = new TextDecoder('utf-8').decode(nameValue);
                updateSensor(sensorId, { name });
            } catch (e) {
                console.warn('Could not read sensor name:', e);
            }

            // Read Sensor Color
            try {
                const colorChar = await service.getCharacteristic(CHAR_UUIDS.SENSOR_COLOR);
                const colorValue = await colorChar.readValue();
                const color = new TextDecoder('utf-8').decode(colorValue);
                updateSensor(sensorId, { color });
            } catch (e) {
                console.warn('Could not read sensor color:', e);
            }

            // Read Arming Threshold
            try {
                const armingChar = await service.getCharacteristic(CHAR_UUIDS.ARMING_THRESHOLD);
                const value = await armingChar.readValue();
                const armingThreshold = value.getInt16(0, true);
                updateSensor(sensorId, { armingThreshold });
            } catch (e) {
                console.warn('Could not read arming threshold:', e);
            }

            // Read Shock Threshold
            try {
                const shockChar = await service.getCharacteristic(CHAR_UUIDS.SHOCK_THRESHOLD);
                const value = await shockChar.readValue();
                const shockThreshold = value.getInt16(0, true);
                updateSensor(sensorId, { shockThreshold });
            } catch (e) {
                console.warn('Could not read shock threshold:', e);
            }

            // Read Shock Duration
            try {
                const durationChar = await service.getCharacteristic(CHAR_UUIDS.SHOCK_DURATION);
                const value = await durationChar.readValue();
                const shockDuration = value.getUint16(0, true);
                updateSensor(sensorId, { shockDuration });
            } catch (e) {
                console.warn('Could not read shock duration:', e);
            }

            // Read Pre-Shock Time
            try {
                const preShockChar = await service.getCharacteristic(CHAR_UUIDS.PRE_SHOCK_TIME);
                const value = await preShockChar.readValue();
                const preShockTime = value.getUint16(0, true);
                updateSensor(sensorId, { preShockTime });
            } catch (e) {
                console.warn('Could not read pre-shock time:', e);
            }

            // Subscribe to FSM State
            try {
                const fsmStateChar = await service.getCharacteristic(CHAR_UUIDS.FSM_STATE);
                await fsmStateChar.startNotifications();

                fsmStateChar.addEventListener('characteristicvaluechanged', (event: Event) => {
                    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
                    if (value) {
                        const stateCode = value.getUint8(0);
                        const stateMap: { [key: number]: string } = {
                            0: 'Idle', 1: 'Armed', 2: 'Acquisition',
                            3: 'Processing', 4: 'Data Ready', 5: 'Continue Mode'
                        };
                        updateSensor(sensorId, { sensorState: stateMap[stateCode] || 'Unknown' });
                    }
                });

                const initialState = await fsmStateChar.readValue();
                const stateMap: { [key: number]: string } = {
                    0: 'Idle', 1: 'Armed', 2: 'Acquisition',
                    3: 'Processing', 4: 'Data Ready', 5: 'Continue Mode'
                };
                updateSensor(sensorId, { sensorState: stateMap[initialState.getUint8(0)] || 'Connected' });
            } catch (e) {
                console.warn('FSM State characteristic not available:', e);
            }

            // Read Device Info
            try {
                const infoService = await server.getPrimaryService(DEVICE_INFO_SERVICE_UUID);
                const hwChar = await infoService.getCharacteristic(CHAR_UUIDS.HARDWARE_REVISION);
                const swChar = await infoService.getCharacteristic(CHAR_UUIDS.SOFTWARE_REVISION);
                const hwVal = await hwChar.readValue();
                const swVal = await swChar.readValue();
                updateSensor(sensorId, {
                    hardwareRevision: new TextDecoder().decode(hwVal),
                    softwareRevision: new TextDecoder().decode(swVal)
                });
            } catch (e) {
                console.warn('Device Info service not found:', e);
            }

            // Charging Status (IO0 - optional, may not be supported on all firmware)
            const checkChargingStatus = async () => {
                try {
                    const chargeChar = await service.getCharacteristic(CHAR_UUIDS.CHARGING_STATUS);
                    const value = await chargeChar.readValue();
                    const status = value.getUint8(0);
                    console.log(`Charging status updated for ${sensorId}: ${status}`);
                    updateSensor(sensorId, { chargingStatus: status });
                } catch (e) {
                    // Silently ignore if charging status characteristic is not supported
                    // This is expected on older firmware versions
                }
            };
            await checkChargingStatus();

            const chargeInterval = setInterval(async () => {
                if (device.gatt?.connected && !isOtaInProgressRef.current) {
                    await checkChargingStatus();
                } else {
                    clearInterval(chargeInterval);
                }
            }, 5000);

            // Get Status Characteristic
            try {
                const autoIoService = await server.getPrimaryService(AUTO_IO_SERVICE_UUID);
                const statusChar = await autoIoService.getCharacteristic(CHAR_UUIDS.STATUS);
                updateSensor(sensorId, { statusCharRef: statusChar });
            } catch (e) {
                console.warn('Automation IO service not found:', e);
            }

            console.log('Connected to', device.name);

        } catch (error) {
            console.error('Connection failed', error);
        }
    }, [sensors, handleDisconnect, updateSensor]);

    const disconnectSensor = useCallback((id: string) => {
        const sensor = sensors.find(s => s.id === id);
        if (sensor?.device.gatt?.connected) {
            sensor.device.gatt.disconnect();
        }
    }, [sensors]);

    const getSensor = useCallback((id: string) => {
        return sensors.find(s => s.id === id);
    }, [sensors]);

    const setMode = useCallback(async (sensorId: string, mode: number) => {
        const sensor = sensors.find(s => s.id === sensorId);
        if (sensor?.statusCharRef) {
            try {
                await sensor.statusCharRef.writeValue(new Uint8Array([mode]));
                console.log('Set mode to', mode, 'for sensor', sensorId);
            } catch (e) {
                console.error('Failed to set mode', e);
            }
        }
    }, [sensors]);

    const setSensorName = useCallback((sensorId: string, name: string) => {
        updateSensor(sensorId, { name });
    }, [updateSensor]);

    const setSensorColor = useCallback(async (sensorId: string, color: string) => {
        const sensor = sensors.find(s => s.id === sensorId);
        if (sensor?.device.gatt?.connected) {
            try {
                const service = await sensor.device.gatt.getPrimaryService(SERVICE_UUID);
                const colorChar = await service.getCharacteristic(CHAR_UUIDS.SENSOR_COLOR);
                const encoder = new TextEncoder();
                await colorChar.writeValue(encoder.encode(color));
                console.log('Set color to', color, 'for sensor', sensorId);
                updateSensor(sensorId, { color });
            } catch (e) {
                console.error('Failed to set color', e);
            }
        } else {
            // Update local state even if not connected (or failed) to reflect UI change immediately?
            // Better to only update on success or if we want optimistic UI.
            // For now, let's update local state too so UI reflects it.
            updateSensor(sensorId, { color });
        }
    }, [sensors, updateSensor]);

    const setSensorThresholds = useCallback(async (sensorId: string, arming: number, shock: number) => {
        const sensor = sensors.find(s => s.id === sensorId);

        if (sensor?.device.gatt?.connected) {
            try {
                const service = await sensor.device.gatt.getPrimaryService(SERVICE_UUID);

                const armingChar = await service.getCharacteristic(CHAR_UUIDS.ARMING_THRESHOLD);
                const armingBuffer = new ArrayBuffer(2);
                new DataView(armingBuffer).setInt16(0, arming, true);
                await armingChar.writeValue(armingBuffer);

                const shockChar = await service.getCharacteristic(CHAR_UUIDS.SHOCK_THRESHOLD);
                const shockBuffer = new ArrayBuffer(2);
                new DataView(shockBuffer).setInt16(0, shock, true);
                await shockChar.writeValue(shockBuffer);

                console.log(`Set thresholds for ${sensorId}: Arming=${arming}, Shock=${shock}`);
                updateSensor(sensorId, { armingThreshold: arming, shockThreshold: shock });
            } catch (e) {
                console.error('Failed to set thresholds', e);
            }
        } else {
            updateSensor(sensorId, { armingThreshold: arming, shockThreshold: shock });
        }
    }, [sensors, updateSensor]);

    const setShockDuration = useCallback(async (sensorId: string, duration: number) => {
        const sensor = sensors.find(s => s.id === sensorId);
        if (sensor?.device.gatt?.connected) {
            try {
                const service = await sensor.device.gatt.getPrimaryService(SERVICE_UUID);
                const durationChar = await service.getCharacteristic(CHAR_UUIDS.SHOCK_DURATION);
                const buffer = new ArrayBuffer(2);
                new DataView(buffer).setUint16(0, duration, true);
                await durationChar.writeValue(buffer);
                console.log(`Set shock duration for ${sensorId}: ${duration}ms`);
                updateSensor(sensorId, { shockDuration: duration });
            } catch (e) {
                console.error('Failed to set shock duration', e);
            }
        } else {
            updateSensor(sensorId, { shockDuration: duration });
        }
    }, [sensors, updateSensor]);

    const setPreShockTime = useCallback(async (sensorId: string, time: number) => {
        const sensor = sensors.find(s => s.id === sensorId);
        if (sensor?.device.gatt?.connected) {
            try {
                const service = await sensor.device.gatt.getPrimaryService(SERVICE_UUID);
                const preShockChar = await service.getCharacteristic(CHAR_UUIDS.PRE_SHOCK_TIME);
                const buffer = new ArrayBuffer(2);
                new DataView(buffer).setUint16(0, time, true);
                await preShockChar.writeValue(buffer);
                console.log(`Set pre-shock time for ${sensorId}: ${time}ms`);
                updateSensor(sensorId, { preShockTime: time });
            } catch (e) {
                console.error('Failed to set pre-shock time', e);
            }
        } else {
            updateSensor(sensorId, { preShockTime: time });
        }
    }, [sensors, updateSensor]);

    const setLastShockData = useCallback((sensorId: string, data: { x: number[], y: number[], z: number[] } | null) => {
        updateSensor(sensorId, { lastShockData: data });
    }, [updateSensor]);

    const updateFirmware = useCallback(async (sensorId: string, file: File, onProgress: (percent: number) => void) => {
        const sensor = sensors.find(s => s.id === sensorId);
        if (!sensor || !sensor.device.gatt?.connected) {
            throw new Error('Sensor not connected');
        }

        try {
            setOtaInProgress(true);
            const server = sensor.device.gatt;
            const service = await server.getPrimaryService(SERVICE_UUID); // Using main service for OTA as per UUIDs

            // Note: In a real implementation, these UUIDs should match the firmware's OTA service
            // Assuming OTA characteristics are in the main service or a specific OTA service
            // For now, using the UUIDs from constants
            const OTA_CONTROL_UUID = '12345678-1234-5678-1234-56789abcdef1'; // From grep result
            const OTA_DATA_UUID = '12345678-1234-5678-1234-56789abcdef3';    // From grep result

            const controlChar = await service.getCharacteristic(OTA_CONTROL_UUID);
            const dataChar = await service.getCharacteristic(OTA_DATA_UUID);

            const fileBuffer = await file.arrayBuffer();
            const fileBytes = new Uint8Array(fileBuffer);
            const totalBytes = fileBytes.length;
            const chunkSize = 240; // MTU size dependent, safe default
            let offset = 0;

            // Start OTA
            console.log('Starting OTA...');
            await controlChar.writeValue(new Uint8Array([0x01])); // Start command

            while (offset < totalBytes) {
                const chunk = fileBytes.slice(offset, offset + chunkSize);
                await dataChar.writeValue(chunk);
                offset += chunk.length;

                const percent = Math.round((offset / totalBytes) * 100);
                onProgress(percent);

                // Small delay to prevent flooding
                await new Promise(r => setTimeout(r, 10));
            }

            // End OTA
            console.log('OTA Complete, sending end command...');
            await controlChar.writeValue(new Uint8Array([0x02])); // End command

            setOtaInProgress(false);
            console.log('Firmware update finished successfully');

        } catch (error) {
            console.error('OTA Failed:', error);
            setOtaInProgress(false);
            throw error;
        }
    }, [sensors]);

    return (
        <BLEContext.Provider value={{
            sensors,
            connectSensor,
            disconnectSensor,
            getSensor,
            setMode,
            setSensorName,
            setSensorColor,
            setSensorThresholds,
            setShockDuration,
            setPreShockTime,
            setLastShockData,
            isOtaInProgress,
            setOtaInProgress,
            updateFirmware
        }}>
            {children}
        </BLEContext.Provider>
    );
};

export const useBLE = () => {
    const context = useContext(BLEContext);
    if (context === undefined) {
        throw new Error('useBLE must be used within a BLEProvider');
    }
    return context;
};
