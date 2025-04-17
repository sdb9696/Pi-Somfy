import { useState, useEffect } from 'react';
//import { Form } from 'react-bootstrap';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogClose,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { addSchedule, editSchedule, deleteSchedule } from '../services/api';
import { Schedule } from '../types';
import { X, Save, Pencil, Trash2, Clock, ArrowBigUp, ArrowBigDown, Square, Play, Pause, Sunrise, Sunset, CalendarSyncIcon, Calendar1 } from 'lucide-react';
import { Button, Switch, Checkbox, Input, Label, Select, Slider, SelectItem, SelectContent, SelectTrigger, SelectValue } from '@/components/ui';


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
      <div className="p-3 border rounded-md mb-2">
        <div className="flex flex-wrap gap-4">
          {/* Active/Pause Toggle */}
          <div className="flex-1 min-w-[120px]">
            <div className="flex items-center gap-2 mt-2">
              <Switch
                id={`active-${isNew ? 'new' : id}`}
                checked={localSchedule.active === 'active'}
                onCheckedChange={(checked) => {
                  setLocalSchedule({...localSchedule, active: checked ? 'active' : 'paused'});
                }}
              />
              <Label htmlFor={`active-${isNew ? 'new' : id}`} className="relative inline-flex items-center cursor-pointer">
                  {localSchedule.active === 'active' ? 
                    <><Play className="w-5 h-5 mr-1" /> Active</> : 
                    <><Pause className="w-5 h-5 mr-1" /> Paused</>
                  }
              </Label>
            </div>
          </div>
          
          {/* Time Type & Value */}
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-start gap-2">
              {/* Time Type Icons */}
              <div className="w-10 text-center">
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
              
              {/* Time Value Controls */}
              <div className="flex-1">
                {localSchedule.timeType === 'clock' && (
                  <div className="mb-2">
                    <Label className="text-xs font-medium mb-1 text-muted-foreground">Time</Label>
                    <Input
                      type="time"
                      className="w-fit p-1 border rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm"
                      value={localSchedule.timeValue}
                      onChange={(e) => {
                        setLocalSchedule({...localSchedule, timeValue: e.target.value});
                      }}
                    />
                  </div>
                )}
                
                {localSchedule.timeType === 'astro' && (
                  <div className="mb-2">
                    <Label className="text-xs font-medium mb-1">
                      {(() => {
                        const astroAt = localSchedule.timeValue.startsWith('sunrise') ? 'sunrise' : 'sunset';
                        const beforeAfter = astroOffset === 0 ? "At " : `${Math.abs(astroOffset)}${astroOffset < 0 ? " mins before " : " mins after "}`;
                        return `${beforeAfter}${astroAt}`;
                      })()}
                    </Label>
                    <Slider
                      min={-300}
                      max={300}
                      step={5}
                      value={[astroOffset]}
                      onValueChange={(val) => {
                        const value = val[0];
                        handleAstroOffsetChange(value);
                      }}
                      className="w-36"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Repeat Type & Value */}
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-start gap-2">
              {/* Repeat Type Icons */}
              <div className="w-10 text-center">
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
              
              {/* Repeat Value Controls */}
              <div className="flex-1">
                {localSchedule.repeatType === 'weekday' && (
                  <div className="mb-2">
                    <Label className="text-xs font-medium mb-1 text-muted-foreground">Days</Label>
                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                        <Button
                          type="button"
                          key={day}
                          className={`h-fit px-1 py-0 border rounded text-center text-xs w-7 cursor-pointer ${
                            Array.isArray(localSchedule.repeatValue) && localSchedule.repeatValue.includes(day)
                              ? 'bg-primary text-white'
                              : 'bg-white text-gray-800 border-gray-300'
                          }`}
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
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                
                {localSchedule.repeatType === 'once' && (
                  <div className="mb-2">
                    <Label className="text-xs font-medium mb-1 text-muted-foreground">Date</Label>
                    <Input
                      type="date"
                      className="w-36 p-1 border rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm"
                      value={(localSchedule.repeatValue as string).replace("/", "-")}
                      onChange={(e) => {
                        setLocalSchedule({...localSchedule, repeatValue: e.target.value.replace("-", "/")});
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Shutter Action & Selection */}
          <div className="flex-1 min-w-[250px]">
            <div className="flex items-start gap-3">
              {/* Action Icons */}
              <div className="w-10 text-center">
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-8"
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
                    className="h-6 w-8"
                    onClick={() => {
                      handleShutterActionChange('stop');
                    }}
                  >
                    <Square className={`h-4 w-4 ${currentAction === 'stop' ? 'text-primary' : 'text-gray-400'} fill-current`} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-8"
                    onClick={() => {
                      handleShutterActionChange('down', percentage);
                    }}
                  >
                    <ArrowBigDown className={`h-4 w-4 ${currentAction === 'down' ? 'text-primary' : 'text-gray-400'} fill-current`} />
                  </Button>
                </div>
              </div>
              
              {/* Percentage & Shutter Selection */}
              <div className="flex-1">
                {currentAction !== 'stop' && (
                  <div className="mb-2">
                    <Label className="text-xs font-medium mb-1 text-muted-foreground">Percentage</Label>
                    <Select
                      value={percentage.toString()}
                      onValueChange={(val) => {
                        const newPercentage = parseInt(val);
                        handleShutterActionChange(currentAction, newPercentage);
                      }}
                    >
                      <SelectTrigger className="w-24 p-1 border rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm">
                        <SelectValue/>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Full</SelectItem>
                        <SelectItem value="10">10%</SelectItem>
                        <SelectItem value="20">20%</SelectItem>
                        <SelectItem value="25">25%</SelectItem>
                        <SelectItem value="30">30%</SelectItem>
                        <SelectItem value="40">40%</SelectItem>
                        <SelectItem value="50">50%</SelectItem>
                        <SelectItem value="60">60%</SelectItem>
                        <SelectItem value="70">70%</SelectItem>
                        <SelectItem value="75">75%</SelectItem>
                        <SelectItem value="80">80%</SelectItem>
                        <SelectItem value="90">90%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="mb-2">
                  <Label className="text-xs font-medium mb-1 text-muted-foreground">Shutters</Label>
                  <div>
                      {Object.entries(shutters).map(([shutter_id, shutter]) => (
                        <div className="flex items-left space-x-2 space-y-1">
                          <Checkbox
                            id={`shutters-${isNew ? 'new' : id}-${shutter_id}`}
                            key={`shutters-${isNew ? 'new' : id}-${shutter_id}`}
                            value={shutter_id}
                            name={shutter}
                            checked={localSchedule.shutterIds.includes(shutter_id)}
                            onCheckedChange={(checked) => {
                            const currentIds = [...localSchedule.shutterIds];
                            if (checked) {
                              currentIds.push(shutter_id);
                            } else {
                              currentIds.splice(currentIds.indexOf(shutter_id), 1);
                            }
                            setLocalSchedule({...localSchedule, shutterIds: currentIds});
                        }}
                        />
                        <Label htmlFor={`shutters-${isNew ? 'new' : id}-${shutter_id}`}>{shutter}</Label>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm Delete</DialogTitle>
                </DialogHeader>                
                  Are you sure you want to delete this schedule?
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button variant="destructive" onClick={ handleDelete }>
                    Delete
                  </Button>
                </DialogFooter>                
              </DialogContent>
            </Dialog>
          </div>
        )}
      </td>
    </tr>
  );
};

export default ScheduleItem;