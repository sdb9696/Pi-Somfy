import { useState, useEffect } from 'react';
import { Table } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Form } from 'react-bootstrap';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { addSchedule, editSchedule, deleteSchedule } from '../services/api';
import { Schedule } from '../types';
import { X, Save, Pencil, Trash2, Clock, ArrowBigUp, ArrowBigDown, Square, Play, Pause, Sun, Sunrise, Sunset, CalendarSyncIcon, Calendar1, Calendar } from 'lucide-react';
import 'bootstrap/dist/css/bootstrap.min.css'; 

// In ScheduleManager.tsx
interface ScheduleManagerProps {
    schedules: Record<string, Schedule>;
    shutters: Record<string, string>; // Changed from Record<string, Shutter>
    onScheduleChange: () => void;
  }

interface ScheduleRowProps {
  schedule: Schedule;
  isNew?: boolean;
  onEdit?: (scheduleId: string) => void;
  onSave?: () => void;
  onCancel?: (scheduleId: string) => void;
  onDelete?: (scheduleId: string) => void;
  onFormChange?: (updatedSchedule: Schedule) => void;
  renderScheduleForm: (schedule: Schedule, isNew?: boolean) => React.ReactNode;
  formatScheduleDescription: (schedule: Schedule) => string;
}

const ScheduleRow = ({
  schedule,
  isNew = false,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  renderScheduleForm,
  formatScheduleDescription,
}: ScheduleRowProps) => {
  return (
    <tr className="border-t">
      <td className="p-0 border">
        {schedule.isEditing || isNew ? (
          renderScheduleForm(schedule, isNew)
        ) : (
          <div className="p-3">
            {formatScheduleDescription(schedule)}
          </div>
        )}
      </td>
      <td className="border text-center align-middle" style={{ width: '100px', verticalAlign: 'middle' }}>
        {schedule.isEditing || isNew ? (
          <div className="d-flex gap-2 justify-content-center">
            <Button variant="ghost" size="icon" onClick={onSave} className="h-8 w-8" title={isNew ? "Add" : "Save"}>
              <Save className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onCancel && onCancel(schedule.id || '')}
              className="h-8 w-8"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="d-flex gap-2 justify-content-center">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onEdit && onEdit(schedule.id)}
              className="h-8 w-8"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onDelete && onDelete(schedule.id)}
              className="h-8 w-8"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
};

const ScheduleManager = ({ schedules, shutters, onScheduleChange }: ScheduleManagerProps) => {
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string, type: string } | null>(null);
  const [showNewScheduleForm, setShowNewScheduleForm] = useState(false);
  
  // Create a local state for tracking schedules with their edit state
  const [localSchedules, setLocalSchedules] = useState<Record<string, Schedule>>({});
  
  // Update localSchedules when props schedules change
  useEffect(() => {
    setLocalSchedules(Object.entries(schedules).reduce((acc, [id, schedule]) => {
      return {
        ...acc,
        [id]: {
          ...schedule,
          id,
          isEditing: localSchedules[id]?.isEditing || false
        }
      };
    }, {}));
  }, [schedules]);
  
  // New schedule form
  const [newSchedule, setNewSchedule] = useState<Omit<Schedule, 'id'>>({
    active: 'active',
    timeType: 'clock',
    timeValue: '09:00',
    repeatType: 'weekday',
    repeatValue: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    shutterAction: 'up',
    shutterIds: []
  });
  
  const formatScheduleDescription = (schedule: Schedule): string => {
    let output = '';
    
    if (schedule.active === 'paused') {
      output += 'This schedule is currently paused. ';
    }
    
    if (schedule.repeatType === 'weekday') {
      const repeatValue = schedule.repeatValue as string[];
      const fullWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const weekend = ['Sat', 'Sun'];
      const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      
      const sortedRepeatValue = [...repeatValue].sort();
      const sortedFullWeek = [...fullWeek].sort();
      const sortedWeekend = [...weekend].sort();
      const sortedWeekday = [...weekday].sort();
      
      const isFullWeek = sortedRepeatValue.length === sortedFullWeek.length && 
        sortedRepeatValue.every((value, index) => value === sortedFullWeek[index]);
      const isWeekend = sortedRepeatValue.length === sortedWeekend.length && 
        sortedRepeatValue.every((value, index) => value === sortedWeekend[index]);
      const isWeekday = sortedRepeatValue.length === sortedWeekday.length && 
        sortedRepeatValue.every((value, index) => value === sortedWeekday[index]);
      
      if (isFullWeek) {
        output += 'Everyday, ';
      } else if (isWeekend) {
        output += 'On weekends, ';
      } else if (isWeekday) {
        output += 'During the week, ';
      } else {
        output += `Every ${repeatValue.join(', ')}, `;
      }
    } else if (schedule.repeatType === 'once') {
      output += `On ${schedule.repeatValue as string}, `;
    }
    
    if (schedule.timeType === 'clock') {
      output += `at ${schedule.timeValue}, `;
    } else if (schedule.timeType === 'astro') {
      if (schedule.timeValue.startsWith('sunset')) {
        const offset = schedule.timeValue.substring(6);
        if (offset.startsWith('+')) {
          output += `${offset.substring(1)} minutes after sunset, `;
        } else if (offset.startsWith('-')) {
          output += `${offset.substring(1)} minutes before sunset, `;
        } else {
          output += 'at sunset, ';
        }
      } else if (schedule.timeValue.startsWith('sunrise')) {
        const offset = schedule.timeValue.substring(7);
        if (offset.startsWith('+')) {
          output += `${offset.substring(1)} minutes after sunrise, `;
        } else if (offset.startsWith('-')) {
          output += `${offset.substring(1)} minutes before sunrise, `;
        } else {
          output += 'at sunrise, ';
        }
      }
    }
    
    if (schedule.shutterAction.startsWith('up')) {
      output += 'rise ';
      const percentage = parseInt(schedule.shutterAction.substring(2));
      if (percentage > 0) {
        output += `for ${percentage}% `;
      }
    } else if (schedule.shutterAction.startsWith('down')) {
      output += 'lower ';
      const percentage = parseInt(schedule.shutterAction.substring(4));
      if (percentage > 0) {
        output += `for ${percentage}% `;
      }
    } else if (schedule.shutterAction.startsWith('stop')) {
      output += 'stop (my) ';
    }
    
    if (schedule.shutterIds.length === 1) {
        output += `the shutter "${shutters[schedule.shutterIds[0]]}".`;
      } else {
        output += `these shutters "${schedule.shutterIds.map(id => shutters[id]).join('", "')}".`;
      }
    
    return output;
  };
  
  const handleAddSchedule = async () => {
    if (newSchedule.shutterIds.length === 0) {
      setMessage({ text: 'Please select at least one shutter', type: 'danger' });
      return;
    }
    
    try {
      const result = await addSchedule(newSchedule);
      
      if (result.status === 'OK') {
        setMessage({ text: 'Schedule added successfully!', type: 'success' });
        onScheduleChange();
        resetNewScheduleForm();
        setShowNewScheduleForm(false);
      } else {
        setMessage({ text: 'Error adding schedule', type: 'danger' });
      }
    } catch (error) {
      setMessage({ text: 'Error adding schedule', type: 'danger' });
      console.error('Error adding schedule:', error);
    }
  };
  
  const resetNewScheduleForm = () => {
    setNewSchedule({
      active: 'active',
      timeType: 'clock',
      timeValue: '09:00',
      repeatType: 'weekday',
      repeatValue: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      shutterAction: 'up',
      shutterIds: []
    });
    setShowNewScheduleForm(true);
  };
  
  const startEditing = (scheduleId: string) => {
    setLocalSchedules({
      ...localSchedules,
      [scheduleId]: {
        ...localSchedules[scheduleId],
        isEditing: true
      }
    });
    setEditingSchedule({...localSchedules[scheduleId], isEditing: true});
  };
  
  const handleSaveEdit = async () => {
    if (!editingSchedule) return;
    
    if (editingSchedule.shutterIds.length === 0) {
      setMessage({ text: 'Please select at least one shutter', type: 'danger' });
      return;
    }
    
    try {
      // Don't send isEditing to the backend
      const { isEditing, ...scheduleToSave } = editingSchedule;
      await editSchedule(editingSchedule.id, scheduleToSave);
      
      // Update local state
      setLocalSchedules({
        ...localSchedules,
        [editingSchedule.id]: {
          ...localSchedules[editingSchedule.id],
          isEditing: false
        }
      });
      
      setEditingSchedule(null);
      setMessage({ text: 'Schedule updated successfully!', type: 'success' });
      onScheduleChange();
    } catch (error) {
      setMessage({ text: 'Error updating schedule', type: 'danger' });
      console.error('Error editing schedule:', error);
    }
  };
  
  const cancelEditing = (scheduleId: string) => {
    setLocalSchedules({
      ...localSchedules,
      [scheduleId]: {
        ...localSchedules[scheduleId],
        isEditing: false
      }
    });
    setEditingSchedule(null);
  };
  
  const confirmDelete = (id: string) => {
    setScheduleToDelete(id);
    setShowDeleteConfirm(true);
  };
  
  const handleDelete = async () => {
    if (!scheduleToDelete) return;
    
    try {
      await deleteSchedule(scheduleToDelete);
      setShowDeleteConfirm(false);
      setScheduleToDelete(null);
      setMessage({ text: 'Schedule deleted successfully!', type: 'success' });
      onScheduleChange();
    } catch (error) {
      setMessage({ text: 'Error deleting schedule', type: 'danger' });
      console.error('Error deleting schedule:', error);
    }
  };
  
  // Handle UI updates for schedule form
  const handleTimeTypeChange = (schedule: any, type: string) => {
    let timeValue = '';
    
    if (type === 'clock') {
      timeValue = '09:00';
    } else if (type === 'sunrise') {
      timeValue = 'sunrise';
    } else if (type === 'sunset') {
      timeValue = 'sunset';
    }
    
    return {
      ...schedule,
      timeType: type === 'clock' ? 'clock' : 'astro',
      timeValue
    };
  };
  
  const handleRepeatTypeChange = (schedule: any, type: string) => {
    let repeatValue: string | string[] = '';
    
    if (type === 'weekday') {
      repeatValue = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    } else if (type === 'once') {
      // Format today's date as YYYY/MM/DD
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      repeatValue = `${year}/${month}/${day}`;
    }
    
    return {
      ...schedule,
      repeatType: type,
      repeatValue
    };
  };
  
  const handleAstroOffsetChange = (schedule: any, value: number) => {
    const timeTypePrefix = schedule.timeValue.startsWith('sunrise') ? 'sunrise' : 'sunset';
    let timeValue = timeTypePrefix;
    
    if (value > 0) {
      timeValue += `+${value}`;
    } else if (value < 0) {
      timeValue += value;
    }
    
    return {
      ...schedule,
      timeValue
    };
  };
  
  const getAstroOffsetValue = (timeValue: string) => {
    if (timeValue.startsWith('sunrise')) {
      const offset = timeValue.substring(7);
      return offset ? parseInt(offset) : 0;
    } else if (timeValue.startsWith('sunset')) {
      const offset = timeValue.substring(6);
      return offset ? parseInt(offset) : 0;
    }
    return 0;
  };
  
  const handleShutterActionChange = (schedule: any, action: string, percentage: number = 0) => {
    let shutterAction = action;
    if (percentage > 0) {
      shutterAction += percentage;
    }
    
    return {
      ...schedule,
      shutterAction
    };
  };
  
  const getPercentageFromAction = (action: string) => {
    if (action.startsWith('up')) {
      return parseInt(action.substring(2) || '0');
    } else if (action.startsWith('down')) {
      return parseInt(action.substring(4) || '0');
    }
    return 0;
  };
  
  const renderScheduleForm = (schedule: any, isNew: boolean = false) => {
    const currentAction = schedule.shutterAction.startsWith('up') ? 'up' :
                          schedule.shutterAction.startsWith('down') ? 'down' : 'stop';
    const percentage = getPercentageFromAction(schedule.shutterAction);
    const astroOffset = getAstroOffsetValue(schedule.timeValue);
    
    return (
      <div className="p-3 border rounded mb-2">
        <Form>
          <div className="row">
            {/* Active/Pause Toggle */}
            <div className="col-sm-2">
              <Form.Check 
                type="switch"
                id={`active-${isNew ? 'new' : schedule.id}`}
                label={
                  <span>
                    {schedule.active === 'active' ? 
                      <><Play className="h-4 w-4 inline-block mr-1" /> Active</> : 
                      <><Pause className="h-4 w-4 inline-block mr-1" /> Paused</>
                    }
                  </span>
                }
                checked={schedule.active === 'active'}
                onChange={(e) => {
                  if (isNew) {
                    setNewSchedule({...newSchedule, active: e.target.checked ? 'active' : 'paused'});
                  } else {
                    setEditingSchedule({...schedule, active: e.target.checked ? 'active' : 'paused'});
                  }
                }}
                className="mb-3 mt-2"
              />
            </div>
            
            {/* Time Type & Value */}
            <div className="col-sm-3">
              <div className="d-flex align-items-start">
                {/* Time Type Icons */}
                <div className="time-type-icons mr-2" style={{width: '40px', textAlign: 'center'}}>
                  <div className="text-center mb-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 p-1"
                      onClick={() => {
                        const nextType = schedule.timeType === 'clock' ? 'sunrise' : 
                                        schedule.timeValue.startsWith('sunrise') ? 'sunset' : 'clock';
                        if (isNew) {
                          setNewSchedule(handleTimeTypeChange(newSchedule, nextType));
                        } else {
                          setEditingSchedule(handleTimeTypeChange(schedule, nextType));
                        }
                      }}
                    >
                      {schedule.timeType === 'clock' ? (
                        <Clock className="h-6 w-6" />
                      ) : schedule.timeValue.startsWith('sunrise') ? (
                        <Sunrise className="h-6 w-6" />
                      ) : (
                        <Sunset className="h-6 w-6" />
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* Time Value Controls */}
                <div className="time-value-controls">
                  {schedule.timeType === 'clock' && (
                    <Form.Group>
                      <Form.Label className="mb-1" style={{fontSize: '0.8rem'}}>Time</Form.Label>
                      <div className="input-group clockpicker" style={{width: '120px'}}>
                        <Form.Control 
                          type="time" 
                          value={schedule.timeValue} 
                          onChange={(e) => {
                            if (isNew) {
                              setNewSchedule({...newSchedule, timeValue: e.target.value});
                            } else {
                              setEditingSchedule({...schedule, timeValue: e.target.value});
                            }
                          }}
                          size="sm"
                        />
                        <span className="input-group-text">
                          <Clock className="h-4 w-4" />
                        </span>
                      </div>
                    </Form.Group>
                  )}
                  
                  {schedule.timeType === 'astro' && (
                    <Form.Group>
                      <Form.Label className="mb-1" style={{fontSize: '0.8rem'}}>
                        {schedule.timeValue.startsWith('sunrise') ? 'Sunrise Offset' : 'Sunset Offset'}
                      </Form.Label>
                      <Form.Range 
                        min={-300}
                        max={300}
                        step={5}
                        value={astroOffset}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          if (isNew) {
                            setNewSchedule(handleAstroOffsetChange(newSchedule, value));
                          } else {
                            setEditingSchedule(handleAstroOffsetChange(schedule, value));
                          }
                        }}
                        style={{width: '140px'}}
                      />
                      <div className="d-flex justify-content-between" style={{width: '140px', fontSize: '0.7rem'}}>
                        <span>-300</span>
                        <span className="text-center">{astroOffset} min</span>
                        <span>+300</span>
                      </div>
                    </Form.Group>
                  )}
                </div>
              </div>
            </div>
            
            {/* Repeat Type & Value */}
            <div className="col-sm-3">
              <div className="d-flex align-items-start">
                {/* Repeat Type Icons */}
                <div className="repeat-type-icons mr-2" style={{width: '40px', textAlign: 'left'}}>
                  <div className="text-center mb-1">
                    <Button
                      type="button"                    
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 p-1"
                      onClick={() => {
                        const nextType = schedule.repeatType === 'weekday' ? 'once' : 'weekday';
                        if (isNew) {
                          setNewSchedule(handleRepeatTypeChange(newSchedule, nextType));
                        } else {
                          setEditingSchedule(handleRepeatTypeChange(schedule, nextType));
                        }
                      }}
                    >
                      {schedule.repeatType === 'weekday' ? (
                        <Calendar1 className="h-4 w-4"/>
                      ) : (
                        <CalendarSyncIcon className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* Repeat Value Controls */}
                <div className="repeat-value-controls">
                  {schedule.repeatType === 'weekday' && (
                    <Form.Group>
                      <Form.Label className="mb-1" style={{fontSize: '0.8rem'}}>Days</Form.Label>
                      <div className="d-flex flex-wrap" style={{maxWidth: '150px'}}>
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                          <div 
                            key={day} 
                            className={`day-btn me-1 mb-1 px-1 py-0 border rounded text-center ${
                              Array.isArray(schedule.repeatValue) && schedule.repeatValue.includes(day) 
                                ? 'bg-primary text-white' 
                                : 'bg-white'
                            }`}
                            style={{fontSize: '0.7rem', width: '28px', cursor: 'pointer'}}
                            onClick={() => {
                              const currentDays = Array.isArray(schedule.repeatValue) ? [...schedule.repeatValue] : [];
                              let newDays;
                              
                              if (currentDays.includes(day)) {
                                newDays = currentDays.filter(d => d !== day);
                              } else {
                                newDays = [...currentDays, day];
                              }
                              
                              if (isNew) {
                                setNewSchedule({...newSchedule, repeatValue: newDays});
                              } else {
                                setEditingSchedule({...schedule, repeatValue: newDays});
                              }
                            }}
                          >
                            {day.substring(0, 2)}
                          </div>
                        ))}
                      </div>
                    </Form.Group>
                  )}
                  
                  {schedule.repeatType === 'once' && (
                    <Form.Group>
                      <Form.Label className="mb-1" style={{fontSize: '0.8rem'}}>Date</Form.Label>
                      <div className="input-group" style={{width: '140px'}}>
                        <Form.Control 
                          type="date" 
                          value={schedule.repeatValue as string} 
                          onChange={(e) => {
                            if (isNew) {
                              setNewSchedule({...newSchedule, repeatValue: e.target.value});
                            } else {
                              setEditingSchedule({...schedule, repeatValue: e.target.value});
                            }
                          }}
                          size="sm"
                        />
                        <span className="input-group-text">
                          <Calendar className="h-4 w-4" />
                        </span>
                      </div>
                    </Form.Group>
                  )}
                </div>
              </div>
            </div>
            
            {/* Shutter Action & Selection */}
            <div className="col-sm-4">
              <div className="d-flex align-items-start">
                {/* Action Icons */}
                <div className="shutter-action-icons mr-3" style={{width: '40px', textAlign: 'center'}}>
                  <div className="text-center mb-1">
                    <Button
                      type="button"
                      variant='ghost'
                      size="icon"
                      className="h-8 w-8 mb-1"
                      onClick={() => {
                        if (isNew) {
                          setNewSchedule(handleShutterActionChange(newSchedule, 'up', percentage));
                        } else {
                          setEditingSchedule(handleShutterActionChange(schedule, 'up', percentage));
                        }
                      }}
                    >
                      <ArrowBigUp className={`h-4 w-4 ${currentAction === 'up' ? 'text-primary' : 'text-gray-400'} fill-current`} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 mb-1"
                      onClick={() => {
                        if (isNew) {
                          setNewSchedule(handleShutterActionChange(newSchedule, 'stop'));
                        } else {
                          setEditingSchedule(handleShutterActionChange(schedule, 'stop'));
                        }
                      }}
                    >
                      <Square className={`h-4 w-4 ${currentAction === 'stop' ? 'text-primary' : 'text-gray-400'} fill-current`} />
                    </Button>
                    <Button
                      type="button"
                      variant='ghost'
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        if (isNew) {
                          setNewSchedule(handleShutterActionChange(newSchedule, 'down', percentage));
                        } else {
                          setEditingSchedule(handleShutterActionChange(schedule, 'down', percentage));
                        }
                      }}
                    >
                      <ArrowBigDown className={`h-4 w-4 ${currentAction === 'down' ? 'text-primary' : 'text-gray-400'} fill-current`} />
                    </Button>
                  </div>
                </div>
                
                {/* Percentage & Shutter Selection */}
                <div>
                  {currentAction !== 'stop' && (
                    <Form.Group className="mb-2">
                      <Form.Label className="mb-1" style={{fontSize: '0.8rem'}}>Percentage</Form.Label>
                      <Form.Select 
                        value={percentage}
                        onChange={(e) => {
                          const newPercentage = parseInt(e.target.value);
                          if (isNew) {
                            setNewSchedule(handleShutterActionChange(newSchedule, currentAction, newPercentage));
                          } else {
                            setEditingSchedule(handleShutterActionChange(schedule, currentAction, newPercentage));
                          }
                        }}
                        size="sm"
                        style={{width: '100px'}}
                      >
                        <option value="0">Full</option>
                        <option value="10">10%</option>
                        <option value="20">20%</option>
                        <option value="25">25%</option>
                        <option value="30">30%</option>
                        <option value="40">40%</option>
                        <option value="50">50%</option>
                        <option value="60">60%</option>
                        <option value="70">70%</option>
                        <option value="75">75%</option>
                        <option value="80">80%</option>
                        <option value="90">90%</option>
                      </Form.Select>
                    </Form.Group>
                  )}
                  
                  <Form.Group>
                    <Form.Label className="mb-1" style={{fontSize: '0.8rem'}}>Shutters</Form.Label>
                    <Form.Select 
                      multiple
                      value={schedule.shutterIds}
                      onChange={(e) => {
                        const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                        if (isNew) {
                          setNewSchedule({...newSchedule, shutterIds: selectedOptions});
                        } else {
                          setEditingSchedule({...schedule, shutterIds: selectedOptions});
                        }
                      }}
                      size="sm"
                      style={{ height: '80px', width: '160px' }}
                    >
                      {Object.entries(shutters).map(([id, shutter]) => (
                        <option key={id} value={id}>{shutter}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </div>
              </div>
            </div>
          </div>
        </Form>
      </div>
    );
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
          onClick={() => resetNewScheduleForm()}
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
          {Object.entries(localSchedules).map(([id, schedule]) => (
            <ScheduleRow
              key={id}
              schedule={schedule.isEditing && editingSchedule ? editingSchedule : schedule}
              onEdit={startEditing}
              onSave={handleSaveEdit}
              onCancel={cancelEditing}
              onDelete={confirmDelete}
              renderScheduleForm={renderScheduleForm}
              formatScheduleDescription={formatScheduleDescription}
            />
          ))}
          {/* New schedule form row */}
          {showNewScheduleForm && (
            <ScheduleRow
              schedule={{...newSchedule, id: 'new', isEditing: true}}
              isNew={true}
              onSave={handleAddSchedule}
              onCancel={() => setShowNewScheduleForm(false)}
              renderScheduleForm={renderScheduleForm}
              formatScheduleDescription={formatScheduleDescription}
            />
          )}          
        </tbody>
      </Table>
      
      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(false)}>
        <DialogHeader>
          <DialogTitle>Confirm Delete</DialogTitle>
        </DialogHeader>
        <DialogContent>
          Are you sure you want to delete this schedule?
        </DialogContent>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
};

export default ScheduleManager;