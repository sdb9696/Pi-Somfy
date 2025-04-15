import { useRef, useState } from 'react';
import { Button, Alert } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { Icon } from 'leaflet';
import { setLocation } from '../services/api';
import 'leaflet/dist/leaflet.css';

// Fix the marker icon issue with React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = new Icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

interface MapSettingsProps {
  initialLatitude: number;
  initialLongitude: number;
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

const MapSettings = ({ initialLatitude, initialLongitude, onLocationSaved }: MapSettingsProps) => {
  const [position, setPosition] = useState<[number, number]>([
    initialLatitude || 51.505, 
    initialLongitude || -0.09
  ]);
  const [message, setMessage] = useState<{ text: string, type: string } | null>(null);
  const mapRef = useRef<any>(null);
  
  const handleLocationUpdate = (lat: number, lng: number) => {
    setPosition([lat, lng]);
  };
  
  const handleSaveLocation = async () => {
    try {
      const result = await setLocation(position[0], position[1]);
      if (result.status === 'OK') {
        setMessage({ text: 'Location saved successfully!', type: 'success' });
        onLocationSaved();
      } else {
        setMessage({ text: 'Error saving location', type: 'danger' });
      }
    } catch (error) {
      setMessage({ text: 'Error saving location', type: 'danger' });
      console.error('Error saving location:', error);
    }
  };
  
  return (
    <div>
      <p>Select your home location by clicking on the map:</p>
      
      {message && (
        <Alert variant={message.type as any} onClose={() => setMessage(null)} dismissible>
          {message.text}
        </Alert>
      )}
      
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
          <Marker position={position} icon={DefaultIcon} />
          <MapEvents onLocationUpdate={handleLocationUpdate} />
        </MapContainer>
      </div>
      
      <Button variant="primary" onClick={handleSaveLocation}>
        Save Location
      </Button>
    </div>
  );
};

export default MapSettings;