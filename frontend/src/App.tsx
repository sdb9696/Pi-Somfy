import { useState, useEffect } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/sonner"
import { Badge } from "@/components/ui/badge";
import { Settings, CalendarClock, Blinds, ArrowUpDown } from 'lucide-react';
import { ThemeProvider } from "@/components/theme-provider";
import ThemeToggle from "@/components/ThemeToggle";
import { getConfig } from './services/api';
import ShutterManager from './components/ShutterManager';
import ScheduleManager from './components/ScheduleManager';
import ManualOperation from './components/ManualOperation';
import SettingsManager from './components/SettingsManager';
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
      
      <Tabs defaultValue={activeKey || "manual"} onValueChange={(val) => setActiveKey(val)} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4 h-auto">
          <TabsTrigger value="manual" className="flex flex-col sm:flex-row items-center gap-1 h-full py-2">
            <ArrowUpDown className="w-4 h-4" />
            <span>Control</span>
          </TabsTrigger>
          <TabsTrigger value="schedules" className="flex flex-col sm:flex-row items-center gap-1 h-full py-2">
            <CalendarClock className="w-4 h-4" />
            <span>Schedule</span>
            {config && (
              <Badge variant="outline" className="hidden sm:inline-flex mt-1 sm:mt-0 sm:ms-2">
                {Object.keys(config.Schedule).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="shutters" className="flex flex-col sm:flex-row items-center gap-1 h-full py-2">
            <Blinds className="w-4 h-4" />
            <span>Add/Remove</span>
            {config && (
              <Badge variant="outline" className="hidden sm:inline-flex mt-1 sm:mt-0 sm:ms-2">
                {Object.keys(config.Shutters).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex flex-col sm:flex-row items-center gap-1 h-full py-2">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="manual" className="space-y-4">
          {config && (
            <ManualOperation
              shutters={config.Shutters}
            />
          )}
        </TabsContent>
        <TabsContent value="schedules" className="space-y-4">
          {config && (
            <ScheduleManager
              schedules={config.Schedule}
              shutters={config.Shutters}
              onScheduleChange={refreshConfig}
            />
          )}
        </TabsContent>
        <TabsContent value="shutters" className="space-y-4">
          {config && (
            <ShutterManager
              shutters={config.Shutters}
              shutterDurations={config.ShutterDurations}
              onShutterChange={refreshConfig}
            />
          )}
        </TabsContent>
        <TabsContent value="settings" className="space-y-4">
          {config && (
            <SettingsManager
              initialLatitude={config.Latitude}
              initialLongitude={config.Longitude}
              onLocationSaved={refreshConfig}
            />
          )}
        </TabsContent>
      </Tabs>
      { loading && (
      <div className="fixed inset-0 flex items-center justify-center bg-white/50 z-50">
        <div className="w-12 h-12 border-4 border-t-transparent border-blue-500 rounded-full animate-spin" />
      </div>
    )}
    </div>
    <Toaster />
    </ThemeProvider>
  );
}

export default App;