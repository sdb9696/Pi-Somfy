import { sendCommand } from '../services/api';
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import up from '../assets/icons/up.png';
import down from '../assets/icons/down.png';
import stop from '../assets/icons/stop.png';

interface ManualOperationProps {
  // Update type to match actual data structure
  shutters: Record<string, string>;
}

const ManualOperation = ({ shutters }: ManualOperationProps) => {
  const [loading, setLoading] = useState<Record<string, string>>({});

  const handleCommand = async (shutterId: string, command: 'up' | 'down' | 'stop') => {
    // Set loading state for this specific button
    setLoading({...loading, [shutterId+command]: 'loading'});
    
    try {
      await sendCommand(shutterId, command);
    } catch (error) {
      console.error(`Error with shutter action ${command}:`, error);
    } finally {
      // Remove loading state
      const newLoading = {...loading};
      delete newLoading[shutterId+command];
      setLoading(newLoading);
    }
  };

  return (
    <div className="manual-operation">
      <div className="shutter-grid flex flex-wrap justify-center gap-6">
        {Object.entries(shutters).length > 0 ? (
          Object.entries(shutters)
            // Sort by shutter name
            .sort(([, nameA], [, nameB]) => {
              return String(nameA || '').localeCompare(String(nameB || ''));
            })
            .map(([id, name]) => (
              <div key={id} className="shutter-remote flex flex-col bg-white rounded-3xl shadow-lg shadow-gray-400/50 p-4 border border-gray-200 w-[125px] pb-10">
                <div className="shutter-name text-center font-medium mb-3 h-[50px] overflow-hidden">
                  <div className="line-clamp-2 w-full pt-1">{name || 'Unnamed Shutter'}</div>
                </div>
                <div className="control-buttons flex flex-col gap-3 items-center">
                  <Button 
                    variant="ghost"
                    className="p-0 relative rounded-md hover:bg-gray-100"
                    onClick={() => handleCommand(id, 'up')}
                    disabled={loading[id+'up'] === 'loading'}
                  >
                    <img src={up} alt="Up" className="h-12 w-12 object-contain" />
                    {loading[id+'up'] === 'loading' && (
                      <div className="absolute inset-x-0 bottom-0 top-1 flex items-center justify-center bg-background/40 p-0">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    )}
                  </Button>
                  
                  <Button 
                    className="p-0 relative rounded-md hover:bg-gray-100"
                    variant="ghost"
                    onClick={() => handleCommand(id, 'stop')}
                    disabled={loading[id+'stop'] === 'loading'}
                  >
                    <img src={stop} alt="Stop" className="h-12 w-12 object-contain" />
                    {loading[id+'stop'] === 'loading' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    )}
                  </Button>
                  
                  <Button 
                    className="p-0 relative rounded-md hover:bg-gray-100"
                    variant="ghost"
                    onClick={() => handleCommand(id, 'down')}
                    disabled={loading[id+'down'] === 'loading'}
                  >
                    <img src={down} alt="Down" className="h-12 w-12 object-contain" />
                    {loading[id+'down'] === 'loading' && (
                      <div className="absolute inset-x-0 bottom-1 top-0 flex items-center justify-center bg-background/40">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            ))
        ) : (
          <p>No shutters configured yet. Add shutters in the "Add/Remove Shutter" section.</p>
        )}
      </div>
    </div>
  );
};

export default ManualOperation;