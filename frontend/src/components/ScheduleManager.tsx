import { useState } from 'react';
import { Table, Button, Form, Modal, Alert } from 'react-bootstrap';
import { addSchedule, editSchedule, deleteSchedule } from '../services/api';
import { Schedule } from '../types';

// In ScheduleManager.tsx
interface ScheduleManagerProps {
    schedules: Record<string, Schedule>;
    shutters: Record<string, string>; // Changed from Record<string, Shutter>
    onScheduleChange: () => void;
  }

const ScheduleManager = ({ schedules, shutters, onScheduleChange }: ScheduleManagerProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string, type: string } | null>(null);
  
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
  };
  
  const startEditing = (schedule: Schedule) => {
    setEditingSchedule({...schedule});
    setIsEditing(true);
  };
  
  const handleSaveEdit = async () => {
    if (!editingSchedule) return;
    
    if (editingSchedule.shutterIds.length === 0) {
      setMessage({ text: 'Please select at least one shutter', type: 'danger' });
      return;
    }
    
    try {
      await editSchedule(editingSchedule.id, editingSchedule);
      setIsEditing(false);
      setEditingSchedule(null);
      setMessage({ text: 'Schedule updated successfully!', type: 'success' });
      onScheduleChange();
    } catch (error) {
      setMessage({ text: 'Error updating schedule', type: 'danger' });
      console.error('Error editing schedule:', error);
    }
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
      <div className="p-3 border rounded mb-3">
        <Form>
          <Form.Group className="mb-3">
            <Form.Check 
              type="switch"
              id={`active-${isNew ? 'new' : schedule.id}`}
              label={schedule.active === 'active' ? 'Active' : 'Paused'}
              checked={schedule.active === 'active'}
              onChange={(e) => {
                if (isNew) {
                  setNewSchedule({...newSchedule, active: e.target.checked ? 'active' : 'paused'});
                } else {
                  setEditingSchedule({...schedule, active: e.target.checked ? 'active' : 'paused'});
                }
              }}
            />
          </Form.Group>
          
          <div className="row mb-3">
            <div className="col-md-4">
              <Form.Group>
                <Form.Label>Time Type</Form.Label>
                <div className="d-flex gap-2">
                  <Button 
                    variant={schedule.timeType === 'clock' ? 'primary' : 'outline-primary'}
                    onClick={() => {
                      if (isNew) {
                        setNewSchedule(handleTimeTypeChange(newSchedule, 'clock'));
                      } else {
                        setEditingSchedule(handleTimeTypeChange(schedule, 'clock'));
                      }
                    }}
                  >
                    Clock
                  </Button>
                  <Button 
                    variant={schedule.timeType === 'astro' && schedule.timeValue.startsWith('sunrise') ? 'primary' : 'outline-primary'}
                    onClick={() => {
                      if (isNew) {
                        setNewSchedule(handleTimeTypeChange(newSchedule, 'sunrise'));
                      } else {
                        setEditingSchedule(handleTimeTypeChange(schedule, 'sunrise'));
                      }
                    }}
                  >
                    Sunrise
                  </Button>
                  <Button 
                    variant={schedule.timeType === 'astro' && schedule.timeValue.startsWith('sunset') ? 'primary' : 'outline-primary'}
                    onClick={() => {
                      if (isNew) {
                        setNewSchedule(handleTimeTypeChange(newSchedule, 'sunset'));
                      } else {
                        setEditingSchedule(handleTimeTypeChange(schedule, 'sunset'));
                      }
                    }}
                  >
                    Sunset
                  </Button>
                </div>
              </Form.Group>
              
              {schedule.timeType === 'clock' && (
                <Form.Group className="mt-2">
                  <Form.Label>Time</Form.Label>
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
                  />
                </Form.Group>
              )}
              
              {schedule.timeType === 'astro' && (
                <Form.Group className="mt-2">
                  <Form.Label>Offset (minutes)</Form.Label>
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
                  />
                  <div className="d-flex justify-content-between">
                    <span>-300</span>
                    <span>{astroOffset} min</span>
                    <span>+300</span>
                  </div>
                </Form.Group>
              )}
            </div>
            
            <div className="col-md-4">
              <Form.Group>
                <Form.Label>Repeat</Form.Label>
                <div className="d-flex gap-2">
                  <Button 
                    variant={schedule.repeatType === 'weekday' ? 'primary' : 'outline-primary'}
                    onClick={() => {
                      if (isNew) {
                        setNewSchedule(handleRepeatTypeChange(newSchedule, 'weekday'));
                      } else {
                        setEditingSchedule(handleRepeatTypeChange(schedule, 'weekday'));
                      }
                    }}
                  >
                    Weekly
                  </Button>
                  <Button 
                    variant={schedule.repeatType === 'once' ? 'primary' : 'outline-primary'}
                    onClick={() => {
                      if (isNew) {
                        setNewSchedule(handleRepeatTypeChange(newSchedule, 'once'));
                      } else {
                        setEditingSchedule(handleRepeatTypeChange(schedule, 'once'));
                      }
                    }}
                  >
                    Once
                  </Button>
                </div>
              </Form.Group>
              
              {schedule.repeatType === 'weekday' && (
                <Form.Group className="mt-2">
                  <Form.Label>Days</Form.Label>
                  <div className="d-flex flex-wrap gap-1">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                      <Form.Check 
                        key={day}
                        type="checkbox"
                        id={`${day}-${isNew ? 'new' : schedule.id}`}
                        label={day.substring(0, 2)}
                        checked={Array.isArray(schedule.repeatValue) && schedule.repeatValue.includes(day)}
                        onChange={(e) => {
                          const currentDays = Array.isArray(schedule.repeatValue) ? [...schedule.repeatValue] : [];
                          let newDays;
                          
                          if (e.target.checked) {
                            newDays = [...currentDays, day];
                          } else {
                            newDays = currentDays.filter(d => d !== day);
                          }
                          
                          if (isNew) {
                            setNewSchedule({...newSchedule, repeatValue: newDays});
                          } else {
                            setEditingSchedule({...schedule, repeatValue: newDays});
                          }
                        }}
                      />
                    ))}
                  </div>
                </Form.Group>
              )}
              
              {schedule.repeatType === 'once' && (
                <Form.Group className="mt-2">
                  <Form.Label>Date</Form.Label>
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
                  />
                </Form.Group>
              )}
            </div>
            
            <div className="col-md-4">
              <Form.Group>
                <Form.Label>Action</Form.Label>
                <div className="d-flex gap-2">
                  <Button 
                    variant={currentAction === 'up' ? 'primary' : 'outline-primary'}
                    onClick={() => {
                      if (isNew) {
                        setNewSchedule(handleShutterActionChange(newSchedule, 'up', percentage));
                      } else {
                        setEditingSchedule(handleShutterActionChange(schedule, 'up', percentage));
                      }
                    }}
                  >
                    Up
                  </Button>
                  <Button 
                    variant={currentAction === 'stop' ? 'primary' : 'outline-primary'}
                    onClick={() => {
                      if (isNew) {
                        setNewSchedule(handleShutterActionChange(newSchedule, 'stop'));
                      } else {
                        setEditingSchedule(handleShutterActionChange(schedule, 'stop'));
                      }
                    }}
                  >
                    Stop
                  </Button>
                  <Button 
                    variant={currentAction === 'down' ? 'primary' : 'outline-primary'}
                    onClick={() => {
                      if (isNew) {
                        setNewSchedule(handleShutterActionChange(newSchedule, 'down', percentage));
                      } else {
                        setEditingSchedule(handleShutterActionChange(schedule, 'down', percentage));
                      }
                    }}
                  >
                    Down
                  </Button>
                </div>
              </Form.Group>
              
              {currentAction !== 'stop' && (
                <Form.Group className="mt-2">
                  <Form.Label>Percentage</Form.Label>
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
              
              <Form.Group className="mt-2">
                <Form.Label>Shutters</Form.Label>
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
                  style={{ height: '150px' }}
                >
                  {Object.entries(shutters).map(([id, shutter]) => (
                    <option key={id} value={id}>{shutter}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </div>
          </div>
          
          <div className="d-flex justify-content-end gap-2">
            {isNew ? (
              <Button variant="primary" onClick={handleAddSchedule}>
                Add Schedule
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => {
                  setIsEditing(false);
                  setEditingSchedule(null);
                }}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSaveEdit}>
                  Save Changes
                </Button>
              </>
            )}
          </div>
        </Form>
      </div>
    );
  };
  
  return (
    <div>
      <h2>Scheduled Operations</h2>
      
      {message && (
        <Alert variant={message.type as any} onClose={() => setMessage(null)} dismissible>
          {message.text}
        </Alert>
      )}
      
      {/* Add new schedule form */}
      <div className="mb-4">
        <Button 
          variant="primary" 
          className="mb-3"
          onClick={() => resetNewScheduleForm()}
        >
          <i className="bi bi-plus"></i> Add New Schedule
        </Button>
        
        {renderScheduleForm(newSchedule, true)}
      </div>
      
      {/* Existing schedules */}
      <Table bordered>
        <thead>
          <tr>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(schedules).map(([id, schedule]) => (
            <tr key={id}>
              <td>
                {isEditing && editingSchedule?.id === id ? (
                  renderScheduleForm(editingSchedule)
                ) : (
                  formatScheduleDescription({...schedule, id})
                )}
              </td>
              <td style={{ width: '200px' }}>
                {isEditing && editingSchedule?.id === id ? (
                  null // Buttons are inside the form when editing
                ) : (
                  <div className="d-flex gap-2">
                    <Button variant="warning" size="sm" onClick={() => startEditing({...schedule, id})}>
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => confirmDelete(id)}>
                      Delete
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      
      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete this schedule?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ScheduleManager;