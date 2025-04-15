import { useState, useEffect } from 'react';
import { Accordion, Container, Spinner } from 'react-bootstrap';
import { getConfig } from './services/api';
import MapSettings from './components/MapSettings';
import ShutterManager from './components/ShutterManager';
import ScheduleManager from './components/ScheduleManager';
import ManualOperation from './components/ManualOperation';
import { Config } from './types';
import './App.css'

import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<string>('');

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await getConfig();
        setConfig(data);
        
        // Determine which panel to open by default
        if (data.Longitude === 0) {
          setActiveKey('settings');
        } else if (Object.keys(data.Shutters).length === 0) {
          setActiveKey('shutters');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching config:', error);
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const refreshConfig = async () => {
    setLoading(true);
    try {
      const data = await getConfig();
      setConfig(data);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loader-container">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <Container>
      <h1 className="my-4">Operate Somfy Shutters</h1>
      
      <Accordion activeKey={activeKey} onSelect={(k) => setActiveKey(k as string)}>
        <Accordion.Item eventKey="settings">
          <Accordion.Header>
            <span className="me-2">⚙️</span> Settings
          </Accordion.Header>
          <Accordion.Body>
            {config && (
              <MapSettings 
                initialLatitude={config.Latitude} 
                initialLongitude={config.Longitude} 
                onLocationSaved={refreshConfig}
              />
            )}
          </Accordion.Body>
        </Accordion.Item>
        
        <Accordion.Item eventKey="shutters">
          <Accordion.Header>
            <span className="me-2">📋</span> Add/Remove Shutter
            {config && (
              <span className="ms-2 badge bg-secondary">
                {Object.keys(config.Shutters).length}
              </span>
            )}
          </Accordion.Header>
          <Accordion.Body>
            {config && (
              <ShutterManager 
                shutters={config.Shutters}
                shutterDurations={config.ShutterDurations} 
                onShutterChange={refreshConfig}
              />
            )}
          </Accordion.Body>
        </Accordion.Item>
        
        <Accordion.Item eventKey="schedules">
          <Accordion.Header>
            <span className="me-2">⏰</span> Scheduled Operation
            {config && (
              <span className="ms-2 badge bg-secondary">
                {Object.keys(config.Schedule).length}
              </span>
            )}
          </Accordion.Header>
          <Accordion.Body>
            {config && (
              <ScheduleManager 
                schedules={config.Schedule}
                shutters={config.Shutters}
                onScheduleChange={refreshConfig}
              />
            )}
          </Accordion.Body>
        </Accordion.Item>
        <Accordion.Item eventKey="manual">
          <Accordion.Header>
            <span className="me-2">🔄</span> Manual Operation
          </Accordion.Header>
          <Accordion.Body>
            {config && (
              <ManualOperation 
                shutters={config.Shutters}
              />
            )}
          </Accordion.Body>
        </Accordion.Item>        
      </Accordion>
    </Container>
  );
}

export default App;