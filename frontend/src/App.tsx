import { useState, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { getConfig } from './services/api';
import MapSettings from './components/MapSettings';
import ShutterManager from './components/ShutterManager';
import ScheduleManager from './components/ScheduleManager';
import ManualOperation from './components/ManualOperation';
import { Config } from './types';
import './App.css'


function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<string>('');
  console.log('Current activeKey:', activeKey);

  useEffect(() => {
    console.log('activeKey changed to:', activeKey);
    // Breakpoint can be set on this line
  }, [activeKey]);
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
        <div className="w-5 h-5 border-2 border-t-transparent border-gray-300 rounded-full animate-spin">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <h1 className="my-4">Operate Somfy Shutters</h1>
      
      <Accordion
        type="single"
        collapsible
        value={activeKey}
        onValueChange={(val) => setActiveKey(val || "")}
      >        
        <AccordionItem value="settings">
          <AccordionTrigger>
            <span className="me-2">⚙️</span> Settings
          </AccordionTrigger>
          <AccordionContent>
            {config && (
              <MapSettings 
                initialLatitude={config.Latitude} 
                initialLongitude={config.Longitude} 
                onLocationSaved={refreshConfig}
              />
            )}
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="shutters">
          <AccordionTrigger>
            <span className="me-2">📋</span> Add/Remove Shutter
            {config && (
              <span className="ms-2 badge bg-secondary">
                {Object.keys(config.Shutters).length}
              </span>
            )}
          </AccordionTrigger>
          <AccordionContent>
            {config && (
              <ShutterManager 
                shutters={config.Shutters}
                shutterDurations={config.ShutterDurations} 
                onShutterChange={refreshConfig}
              />
            )}
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="schedules">
          <AccordionTrigger>
            <span className="me-2">⏰</span> Scheduled Operation
            {config && (
              <span className="ms-2 badge bg-secondary">
                {Object.keys(config.Schedule).length}
              </span>
            )}
          </AccordionTrigger>
          <AccordionContent>
            {config && (
              <ScheduleManager 
                schedules={config.Schedule}
                shutters={config.Shutters}
                onScheduleChange={refreshConfig}
              />
            )}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="manual">
          <AccordionTrigger>
            <span className="me-2">🔄</span> Manual Operation
          </AccordionTrigger>
          <AccordionContent>
            {config && (
              <ManualOperation 
                shutters={config.Shutters}
              />
            )}
          </AccordionContent>
        </AccordionItem>        
      </Accordion>
    </div>
  );
}

export default App;