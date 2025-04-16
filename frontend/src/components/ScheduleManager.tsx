import { useState } from 'react';
import { Table } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ScheduleItem from './ScheduleItem';
import { Schedule } from '../types';
import { X } from 'lucide-react';
import 'bootstrap/dist/css/bootstrap.min.css'; 

// In ScheduleManager.tsx
interface ScheduleManagerProps {
    schedules: Record<string, Schedule>;
    shutters: Record<string, string>; // Changed from Record<string, Shutter>
    onScheduleChange: () => void;
  }

const ScheduleManager = ({ schedules, shutters, onScheduleChange }: ScheduleManagerProps) => {
  const [message, setMessage] = useState<{ text: string, type: string } | null>(null);
  const [showNewScheduleForm, setShowNewScheduleForm] = useState(false);
  
 
  
  // New schedule form
  const newSchedule: Schedule = {
    id: 'new',
    active: 'active',
    timeType: 'clock',
    timeValue: '09:00',
    repeatType: 'weekday',
    repeatValue: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    shutterAction: 'up',
    shutterIds: []
  };
  
  const onScheduleUpdate = (message: string) => {
    setMessage({ text: message, type: 'success' });
    onScheduleChange();
  };

  
  
  return (
    <div>
      <h2>Scheduled Operations</h2>
      
      {message && (
        <Alert variant={message.type as any}>
          <AlertDescription>
          {message.text}
          </AlertDescription>
          <Button
            onClick={() => setMessage(null) }
            className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
          >
          <X className="h-4 w-4" />
          </Button>
        </Alert>
      )}
      
      {/* Add new schedule button */}
      <div className="mb-4">
        <Button 
          variant="default" 
          className="mb-3"
          onClick={() => setShowNewScheduleForm(true)}
          disabled={showNewScheduleForm}
        >
          <i className="bi bi-plus"></i> Add New Schedule
        </Button>
      </div>
      
      {/* Existing schedules */}
      <Table className="border border-collapse">
        <thead>
          <tr>
            <th className="border px-4 py-2">Description</th>
            <th className="border text-center px-2 py-2" style={{ width: '100px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>         
          {/* Existing schedule rows */}
          {Object.entries(schedules).map(([id, schedule]) => (
            <ScheduleItem
              key={id}
              id={id}
              schedule={schedule}
              shutters={shutters}
              isNew={false}
              onScheduleUpdate={onScheduleUpdate}
              onError={(error: string) => setMessage({ text: error, type: 'error' })}
            />
          ))}
          {/* New schedule form row */}
          {showNewScheduleForm && (
            <ScheduleItem
              id={"new"}
              schedule={newSchedule}
              isNew={true}
              shutters={shutters}
              onScheduleUpdate={onScheduleUpdate}
              onAddComplete={() => setShowNewScheduleForm(false)}
              onError={(error: string) => setMessage({ text: error, type: 'error' })}
            />
          )}          
        </tbody>
      </Table>
      
      
    </div>
  );
};

export default ScheduleManager;