import { useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { setLocation } from '../services/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui';
import { LocationSettings } from '../types';
import 'leaflet/dist/leaflet.css'


interface MapSettingsProps {
  settings: LocationSettings;
  onLocationSaved: () => void;
}

function MapEvents({ onLocationUpdate }: { onLocationUpdate: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationUpdate(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

const MapSettings = ({ settings: locationSettings, onLocationSaved }: MapSettingsProps) => {
  const [position, setPosition] = useState<[number, number]>([
    locationSettings.Latitude || 51.505,
    locationSettings.Longitude || -0.09
  ]);

  const mapRef = useRef<any>(null);

  const handleLocationUpdate = (lat: number, lng: number) => {
    setPosition([lat, lng]);
  };

  const handleSaveLocation = async () => {
    try {
      const result = await setLocation(position[0], position[1]);
      if (result.status === 'OK') {
        toast.success('Location saved successfully!');
        onLocationSaved();
      } else {
        toast.error('Error saving location', {description: result.message});
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Error saving location', {description: errorMessage});
    }
  };

  return (
    <div>
      <p>Select your home location by clicking on the map:</p>

      <div style={{ height: '400px', marginBottom: '20px' }}>
        <MapContainer
          center={position}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={position}/>
          <MapEvents onLocationUpdate={handleLocationUpdate} />
        </MapContainer>
      </div>

      <Button onClick={handleSaveLocation}>
        Save Location
      </Button>
    </div>
  );
};

export default MapSettings;
