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
    Latitude: number;
    Shutters: Record<string, string>; // key: shutterId, value: shutterName
    ShutterDurations: Record<string, number>; // key: shutterId, value: duration
    Schedule: Record<string, Schedule>;
}
