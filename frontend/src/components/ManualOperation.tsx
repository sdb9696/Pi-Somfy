import { Button } from 'react-bootstrap';
import { sendCommand } from '../services/api';
import { useState } from 'react';

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
      <div className="shutter-grid">
        {Object.entries(shutters).length > 0 ? (
          Object.entries(shutters)
            // Sort by shutter name
            .sort(([, nameA], [, nameB]) => {
              return String(nameA || '').localeCompare(String(nameB || ''));
            })
            .map(([id, name]) => (
              <div key={id} className="shutter-remote">
                <div className="shutter-name">{name || 'Unnamed Shutter'}</div>
                <div className="control-buttons">
                  <Button 
                    className="up-button" 
                    onClick={() => handleCommand(id, 'up')}
                    disabled={loading[id+'up'] === 'loading'}
                  >
                    {loading[id+'up'] === 'loading' ? 
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> : 
                      <span>▲</span>
                    }
                  </Button>
                  
                  <Button 
                    className="stop-button" 
                    onClick={() => handleCommand(id, 'stop')}
                    disabled={loading[id+'stop'] === 'loading'}
                  >
                    {loading[id+'stop'] === 'loading' ? 
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> : 
                      <span>■</span>
                    }
                  </Button>
                  
                  <Button 
                    className="down-button" 
                    onClick={() => handleCommand(id, 'down')}
                    disabled={loading[id+'down'] === 'loading'}
                  >
                    {loading[id+'down'] === 'loading' ? 
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> : 
                      <span>▼</span>
                    }
                  </Button>
                </div>
              </div>
            ))
        ) : (
          <p>No shutters configured yet. Add shutters in the "Add/Remove Shutter" section.</p>
        )}
      </div>
      
      <style>
        {`
        .shutter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        
        .shutter-remote {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 15px;
          text-align: center;
          background-color: #f8f9fa;
        }
        
        .shutter-name {
          font-weight: bold;
          margin-bottom: 15px;
        }
        
        .control-buttons {
          display: flex;
          justify-content: space-around;
        }
        
        .up-button, .stop-button, .down-button {
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        `}
      </style>
    </div>
  );
};

export default ManualOperation;