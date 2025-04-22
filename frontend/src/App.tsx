import { useState, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge";
import { Settings, CalendarClock, Blinds, ArrowUpDown } from 'lucide-react';
import { ThemeProvider } from "@/components/theme-provider";
import ThemeToggle from "@/components/ThemeToggle";
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


  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await getConfig();
        setConfig(data);
        
        if (!activeKey) {
          // Determine which panel to open by default
          if (Object.keys(data.Shutters).length === 0) {
            setActiveKey('shutters');
          } else {
            setActiveKey('manual');
          }
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


  return (
    <ThemeProvider>
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="relative flex justify-between items-center my-4">
        <h1>Operate Somfy Shutters</h1>
        <div className="absolute top-0 right-0">
          <ThemeToggle />
        </div>
      </div>
      
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
      { loading && (
      <div className="fixed inset-0 flex items-center justify-center bg-white/50 z-50">
        <div className="w-12 h-12 border-4 border-t-transparent border-blue-500 rounded-full animate-spin" />
      </div>
    )}
    </div>
    </ThemeProvider>
  );
}

export default App;