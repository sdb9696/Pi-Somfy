export interface Shutter {
    id: string;
    name: string;
    duration: string;
  }

export interface Schedule {
    id: string;
    active: string;
    timeType: string;
    timeValue: string;
    repeatType: string;
    repeatValue: string[] | string;
    shutterAction: string;
    shutterIds: string[];
    isEditing?: boolean;
}

    // This matches the actual data structure
export interface Config {
    Longitude: number;
    Shutters: Record<string, string>; // key: shutterId, value: shutterName
    ShutterDurations: Record<string, number>; // key: shutterId, value: duration
    Schedule: Record<string, Schedule>;
    Settings: Settings;
}
export interface Settings {
    LocationSettings: LocationSettings;
    WebSettings: WebSettings;
    MqSettings: MqSettings;
    RadioSettings: RadioSettings;
}

export interface LocationSettings {
    Latitude: number;
    Longitude: number;
}

export interface WebSettings {
    UseHttps: boolean;
    HttpPort: number;
    HttpsPort: number;
    Password: string;
}

export interface MqSettings {
    Server: string;
    Port: number;
    Username: string;
    Password: string;
    ClientId: string;
    EnableDiscovery: boolean;
}

export interface RadioSettings {
    TxGpio: number;
    RtsAddress: string;
    SendRepeat: number;
    Rfm69Enabled: boolean;
    Rfm69ResetGpio: number;
    Rfm69SpiChannel: number;
    PigpioHost: string;
    PigpioPort: number;
}
