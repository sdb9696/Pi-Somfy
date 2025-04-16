import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Form } from 'react-bootstrap';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { addSchedule, editSchedule, deleteSchedule } from '../services/api';
import { Schedule } from '../types';
import { X, Save, Pencil, Trash2, Clock, ArrowBigUp, ArrowBigDown, Square, Play, Pause, Sunrise, Sunset, CalendarSyncIcon, Calendar1, Calendar } from 'lucide-react';


interface ScheduleRowProps {
    id: string;
    schedule: Schedule;
    shutters: Record<string, string>;
    isNew: boolean;
    onScheduleUpdate?: (message:string) => void;
    onError?: (error: string) => void;
    onAddComplete?: () => void;
  }
  
const ScheduleItem = ({
    id,
    schedule,
    shutters,
    isNew,
    onScheduleUpdate,
    onError,
    onAddComplete,
  }: ScheduleRowProps) => {

  const [isEditing, setIsEditing] = useState(false || isNew);

  const [localSchedule, setLocalSchedule] = useState<Schedule>({...schedule});

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  useEffect(() => {
    setLocalSchedule({...schedule});
  }, [schedule]);
  
  

  const formatScheduleDescription = (): string => {
    let output = '';
    
    if (localSchedule.active === 'paused') {
      output += 'This schedule is currently paused. ';
    }
    
    if (localSchedule.repeatType === 'weekday') {
      const repeatValue = localSchedule.repeatValue as string[];
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
    } else if (localSchedule.repeatType === 'once') {
      output += `On ${localSchedule.repeatValue as string}, `;
    }
    
    if (localSchedule.timeType === 'clock') {
      output += `at ${localSchedule.timeValue}, `;
    } else if (localSchedule.timeType === 'astro') {
      if (localSchedule.timeValue.startsWith('sunset')) {
        const offset = localSchedule.timeValue.substring(6);
        if (offset.startsWith('+')) {
          output += `${offset.substring(1)} minutes after sunset, `;
        } else if (offset.startsWith('-')) {
          output += `${offset.substring(1)} minutes before sunset, `;
        } else {
          output += 'at sunset, ';
        }
      } else if (localSchedule.timeValue.startsWith('sunrise')) {
        const offset = localSchedule.timeValue.substring(7);
        if (offset.startsWith('+')) {
          output += `${offset.substring(1)} minutes after sunrise, `;
        } else if (offset.startsWith('-')) {
          output += `${offset.substring(1)} minutes before sunrise, `;
        } else {
          output += 'at sunrise, ';
        }
      }
    }
    
    if (localSchedule.shutterAction.startsWith('up')) {
      output += 'rise ';
      const percentage = parseInt(localSchedule.shutterAction.substring(2));
      if (percentage > 0) {
        output += `for ${percentage}% `;
      }
    } else if (localSchedule.shutterAction.startsWith('down')) {
      output += 'lower ';
      const percentage = parseInt(localSchedule.shutterAction.substring(4));
      if (percentage > 0) {
        output += `for ${percentage}% `;
      }
    } else if (localSchedule.shutterAction.startsWith('stop')) {
      output += 'stop (my) ';
    }
    
    if (localSchedule.shutterIds.length === 1) {
        output += `the shutter "${shutters[localSchedule.shutterIds[0]]}".`;
      } else {
        output += `these shutters "${localSchedule.shutterIds.map(id => shutters[id]).join('", "')}".`;
      }
    
    return output;
  };
  
  
  const startEditing = () => {
    setIsEditing(true);
  };
  
  
  const cancelEditing = () => {
    setIsEditing(false);
    if (isNew) {
      onAddComplete && onAddComplete();
    }
  };

  const handleSave = async () => {
    if (!isEditing) return;
    if (localSchedule.shutterIds.length === 0) {
      onError && onError('Please select at least one shutter');
      return;
    }    
    if (isNew) {
      await handleAddSchedule();
    } else {
      await handleEdit();
    }
  };
  
  const handleEdit = async () => {
    try {
      const result = await editSchedule(id, localSchedule);
      
      setIsEditing(false);

      if (result.status === 'OK') {
        onScheduleUpdate && onScheduleUpdate('Schedule updated successfully!');
      } else {
        onError && onError('Error updating schedule: ' + result.message);
      }
    } catch (error) {
      if (onError) {
        onError('Error updating schedule: ' + (error instanceof Error ? error.message : String(error)));
      }
      console.error('Error editing schedule:', error);
    }
  };

  const handleAddSchedule = async () => {
    try {
      const result = await addSchedule(localSchedule);
      
      setIsEditing(false);

      if (isNew) {
        onAddComplete && onAddComplete();
      }

      if (result.status === 'OK') {
        onScheduleUpdate && onScheduleUpdate('Schedule added successfully!');
      } else {
        onError && onError('Error adding schedule' + result.message);
      }
    } catch (error) {
      onError && onError('Error adding schedule');
      console.error('Error adding schedule:', error);
    }
  };
  
  const handleDelete = async () => {
    if (isNew) return;
    
    try {
      await deleteSchedule(id);

      onScheduleUpdate && onScheduleUpdate('Schedule deleted successfully!');
    } catch (error) {
      if (onError) {
        onError('Error deleting schedule: ' + (error instanceof Error ? error.message : String(error)));
      }
      console.error('Error editing schedule:', error);
    }
  };

   
  // Handle UI updates for schedule form
  const handleTimeTypeChange = (type: string) => {
    let timeValue = '';
    
    if (type === 'clock') {
      timeValue = '09:00';
    } else if (type === 'sunrise') {
      timeValue = 'sunrise';
    } else if (type === 'sunset') {
      timeValue = 'sunset';
    }
    setLocalSchedule({...localSchedule, timeType: type === 'clock' ? 'clock' : 'astro', timeValue: timeValue});
  };
  
  const handleRepeatTypeChange = (type: string) => {
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
    
    setLocalSchedule({...localSchedule, repeatType: type, repeatValue: repeatValue});
  };
  
  const handleAstroOffsetChange = (value: number) => {
    const timeTypePrefix = localSchedule.timeValue.startsWith('sunrise') ? 'sunrise' : 'sunset';
    let timeValue = timeTypePrefix;
    
    if (value > 0) {
      timeValue += `+${value}`;
    } else if (value < 0) {
      timeValue += value;
    }
    setLocalSchedule({...localSchedule, timeValue: timeValue});
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
  
  const handleShutterActionChange = (action: string, percentage: number = 0) => {
    let shutterAction = action;
    if (percentage > 0) {
      shutterAction += percentage;
    }
    setLocalSchedule({...localSchedule, shutterAction: shutterAction});
  };
  
  const getPercentageFromAction = (action: string) => {
    if (action.startsWith('up')) {
      return parseInt(action.substring(2) || '0');
    } else if (action.startsWith('down')) {
      return parseInt(action.substring(4) || '0');
    }
    return 0;
  };
  
  const renderScheduleForm = (isNew: boolean = false) => {
    const currentAction = localSchedule.shutterAction.startsWith('up') ? 'up' :
                          localSchedule.shutterAction.startsWith('down') ? 'down' : 'stop';
    const percentage = getPercentageFromAction(localSchedule.shutterAction);
    const astroOffset = getAstroOffsetValue(localSchedule.timeValue);
    
    return (
      <div className="p-3 border rounded mb-2">
        <Form>
          <div className="row">
            {/* Active/Pause Toggle */}
            <div className="col-sm-2">
              <Form.Check 
                type="switch"
                id={`active-${isNew ? 'new' : id}`}
                label={
                  <span>
                    {localSchedule.active === 'active' ? 
                      <><Play className="size-6 inline-block mr-1" /> Active</> : 
                      <><Pause className="size-6 inline-block mr-1" /> Paused</>
                    }
                  </span>
                }
                checked={localSchedule.active === 'active'}
                onChange={(e) => {
                  setLocalSchedule({...localSchedule, active: e.target.checked ? 'active' : 'paused'});
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
                        const nextType = localSchedule.timeType === 'clock' ? 'sunrise' : 
                        localSchedule.timeValue.startsWith('sunrise') ? 'sunset' : 'clock';
                        handleTimeTypeChange(nextType);
                      }}
                    >
                      {localSchedule.timeType === 'clock' ? (
                        <Clock className="size-6" />
                      ) : localSchedule.timeValue.startsWith('sunrise') ? (
                        <Sunrise className="size-6" />
                      ) : (
                        <Sunset className="size-6" />
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* Time Value Controls */}
                <div className="time-value-controls">
                  {localSchedule.timeType === 'clock' && (
                    <Form.Group>
                      <Form.Label className="mb-1" style={{fontSize: '0.8rem'}}>Time</Form.Label>
                      <div className="input-group clockpicker" style={{width: '120px'}}>
                        <Form.Control 
                          type="time" 
                          value={localSchedule.timeValue} 
                          onChange={(e) => {
                            setLocalSchedule({...localSchedule, timeValue: e.target.value});
                          }}
                          size="sm"
                        />
                      </div>
                    </Form.Group>
                  )}
                  
                  {localSchedule.timeType === 'astro' && (
                    <Form.Group>
                      <Form.Label className="mb-1" style={{fontSize: '0.8rem'}}>
                        { (() => {
                          const astro_at = localSchedule.timeValue.startsWith('sunrise') ? 'sunrise' : 'sunset';
                          const before_after = astroOffset == 0 ? "At " : Math.abs(astroOffset) + (astroOffset < 0 ? " mins before " : " mins after ");
                          return `${before_after}${astro_at}`;
                        })()}
                      </Form.Label>
                      <Form.Range 
                        min={-300}
                        max={300}
                        step={5}
                        value={astroOffset}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                            handleAstroOffsetChange(value);
                        }}
                        style={{width: '140px'}}
                      />
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
                        const nextType = localSchedule.repeatType === 'weekday' ? 'once' : 'weekday';
                        handleRepeatTypeChange(nextType);
                      }}
                    >
                      {localSchedule.repeatType === 'weekday' ? (
                        <Calendar1 className="size-6"/>
                      ) : (
                        <CalendarSyncIcon className="size-6" />
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* Repeat Value Controls */}
                <div className="repeat-value-controls">
                  {localSchedule.repeatType === 'weekday' && (
                    <Form.Group>
                      <Form.Label className="mb-1" style={{fontSize: '0.8rem'}}>Days</Form.Label>
                      <div className="d-flex flex-wrap" style={{maxWidth: '150px'}}>
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                          <div 
                            key={day} 
                            className={`day-btn me-1 mb-1 px-1 py-0 border rounded text-center ${
                              Array.isArray(localSchedule.repeatValue) && localSchedule.repeatValue.includes(day) 
                                ? 'bg-primary text-white' 
                                : 'bg-white'
                            }`}
                            style={{fontSize: '0.7rem', width: '28px', cursor: 'pointer'}}
                            onClick={() => {
                              const currentDays = Array.isArray(localSchedule.repeatValue) ? [...localSchedule.repeatValue] : [];
                              let newDays;
                              
                              if (currentDays.includes(day)) {
                                newDays = currentDays.filter(d => d !== day);
                              } else {
                                newDays = [...currentDays, day];
                              }
                              
                              setLocalSchedule({...localSchedule, repeatValue: newDays});
                            }}
                          >
                            {day.substring(0, 2)}
                          </div>
                        ))}
                      </div>
                    </Form.Group>
                  )}
                  
                  {localSchedule.repeatType === 'once' && (
                    <Form.Group>
                      <Form.Label className="mb-1" style={{fontSize: '0.8rem'}}>Date</Form.Label>
                      <div className="input-group" style={{width: '140px'}}>
                        <Form.Control 
                          type="date" 
                          value={localSchedule.repeatValue as string} 
                          onChange={(e) => {
                            setLocalSchedule({...localSchedule, repeatValue: e.target.value});
                          }}
                          size="sm"
                        />
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
                        handleShutterActionChange('up', percentage);
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
                        handleShutterActionChange('stop');
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
                        handleShutterActionChange('down', percentage);
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
                          handleShutterActionChange(currentAction, newPercentage);
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
                      value={localSchedule.shutterIds}
                      onChange={(e) => {
                        const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                        setLocalSchedule({...localSchedule, shutterIds: selectedOptions});
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
    <tr className="border-t">
      <td className="p-0 border">
        {isEditing || isNew ? (
          renderScheduleForm(isNew)
        ) : (
          <div className="p-3">
            {formatScheduleDescription()}
          </div>
        )}
      </td>
      <td className="border text-center align-middle" style={{ width: '100px', verticalAlign: 'middle' }}>
        {isEditing || isNew ? (
          <div className="d-flex gap-2 justify-content-center">
            <Button variant="ghost" size="icon" onClick={handleSave} className="h-8 w-8" title={isNew ? "Add" : "Save"}>
              <Save className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={cancelEditing}
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
              onClick={startEditing}
              className="h-8 w-8"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={ () => setShowDeleteConfirm(true) }
              className="h-8 w-8"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {showDeleteConfirm && (
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
                <Button variant="destructive" onClick={() => {
                  handleDelete();
                  setShowDeleteConfirm(false);
                }}>
                  Delete
                </Button>
              </DialogFooter>
            </Dialog>
            )}         
          </div>
        )}
      </td>
    </tr>
  );
};

export default ScheduleItem;