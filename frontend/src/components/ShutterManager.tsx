import { useState } from 'react';
import { Table, Form, Modal } from 'react-bootstrap';
import { addShutter, editShutter, deleteShutter, sendCommand } from '../services/api';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogClose,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { X, Save, Link, Pencil, Trash2, Clock, ArrowBigUp, ArrowBigDown, Square, Plus, Play, Pause, Sunrise, Sunset, CalendarSyncIcon, Calendar1 } from 'lucide-react';
import { Button, Switch, Checkbox, Input, Label, Select, Slider, SelectItem, SelectContent, SelectTrigger, SelectValue } from '@/components/ui';

interface ShutterManagerProps {
  // Update types to match actual data structure
  shutters: Record<string, string>;
  shutterDurations: Record<string, number>;
  onShutterChange: () => void;
}

const ShutterManager = ({ shutters, shutterDurations, onShutterChange }: ShutterManagerProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingShutter, setEditingShutter] = useState<null | { id: string, name: string, duration: string }>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [shutterToDelete, setShutterToDelete] = useState<string | null>(null);
  const [showProgramModal, setShowProgramModal] = useState(false);
  
  // For new shutter form
  const [newShutter, setNewShutter] = useState({ name: '', duration: '10' });
  const [addingShutter, setAddingShutter] = useState(false);
  const [programShutterId, setProgramShutterId] = useState<string | null>(null);
  
  const handleAddShutter = async () => {
    try {
      await addShutter(newShutter.name, newShutter.duration);
      setNewShutter({ name: '', duration: '10' });
      setAddingShutter(false);
      onShutterChange();
    } catch (error) {
      console.error('Error adding shutter:', error);
    }
  };
  
  const startEditing = (id: string) => {
    const name = shutters[id];
    const duration = String(shutterDurations[id] || '10');
    setEditingShutter({ id, name, duration });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditingShutter(null);
  };
  
  const handleSaveEdit = async () => {
    if (!editingShutter) return;
    
    try {
      await editShutter(editingShutter.id, editingShutter.name, editingShutter.duration);
      setIsEditing(false);
      setEditingShutter(null);
      onShutterChange();
    } catch (error) {
      console.error('Error editing shutter:', error);
    }
  };
  
  const confirmDelete = (id: string) => {
    setShutterToDelete(id);
    setShowDeleteConfirm(true);
  };
  
  const handleDelete = async () => {
    if (!shutterToDelete) return;
    
    try {
      await deleteShutter(shutterToDelete);
      setShowDeleteConfirm(false);
      setShutterToDelete(null);
      onShutterChange();
    } catch (error) {
      console.error('Error deleting shutter:', error);
    }
  };
  
  const handleShowProgram = async (id: string) => {
    try {
      setShowProgramModal(true);
      setProgramShutterId(id);
    } catch (error) {
      console.error('Error programming shutter:', error);
    }
  };

  const handleFinishedProgram = async () => {
    if (!programShutterId) return;
    try {
      await sendCommand(programShutterId, 'program');
    } catch (error) {
      console.error('Error programming shutter:', error);
    }
    setShowProgramModal(false);
    setProgramShutterId(null);
  };
  
  return (
    <div>
      <div className="mb-3">
        <Button variant="default" onClick={() => setAddingShutter(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add New
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 bg-gray-100 p-2 font-semibold gap-x-2">
          <div className="col-span-6 md:col-span-7 text-xs sm:text-sm">Shutter Name</div>
          <div className="col-span-2 text-xs sm:text-sm">
            <span className="hidden sm:inline">Operation Time (Seconds)</span>
            <span className="sm:hidden">Time (s)</span>
          </div>
          <div className="col-span-4 md:col-span-3 text-xs sm:text-sm">Actions</div>
        </div>
        <div>
          {Object.entries(shutters).map(([id, name]) => (
            <div key={id} className="grid grid-cols-12 p-2 border-t items-center gap-x-2">
              <div className="col-span-6 md:col-span-7">
                {isEditing && editingShutter?.id === id ? (
                  <Input
                    type="text"
                    value={editingShutter.name}
                    onChange={(e) => setEditingShutter({ ...editingShutter, name: e.target.value })}
                    className="w-full text-xs sm:text-sm h-8 sm:h-10"
                  />
                ) : (
                  <span className="text-xs sm:text-base gap-x-2">{name}</span>
                )}
              </div>
              <div className="col-span-2">
                {isEditing && editingShutter?.id === id ? (
                  <Input
                    type="text"
                    value={editingShutter.duration}
                    onChange={(e) => setEditingShutter({ ...editingShutter, duration: e.target.value })}
                    className="w-full text-xs sm:text-sm h-8 sm:h-10"
                  />
                ) : (
                  <span className="text-xs sm:text-base">{shutterDurations[id] || '10'}</span>
                )}
              </div>
              <div className="col-span-4 md:col-span-3 flex justify-start gap-1 sm:gap-2 items-center">
                {isEditing && editingShutter?.id === id ? (
                  <>
                    <Button variant="default" size="icon" onClick={handleSaveEdit}>
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button variant="default" size="icon" onClick={cancelEditing}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => startEditing(id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="destructive" size="icon" onClick={() => confirmDelete(id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Confirm Delete</DialogTitle>
                        </DialogHeader>
                          Are you sure you want to delete this shutter?
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="secondary">
                              Cancel
                            </Button>
                          </DialogClose>
                          <Button variant="destructive" onClick={handleDelete}>
                            Delete
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => handleShowProgram(id)}>
                          <Link className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Program Shutter</DialogTitle>
                        </DialogHeader>
                          Press the program button on the back of your remote control until your shutter makes a brief up and down movement.<br />
                          Then click on "Finished".
                        <DialogFooter>
                          <DialogClose asChild>
                          <Button variant="secondary">
                            Cancel
                          </Button>
                          </DialogClose>
                          <Button variant="default" onClick={() => handleFinishedProgram()}>
                            Finished
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </div>
            </div>
          ))}

          {addingShutter && (
            <div className="grid grid-cols-12 p-2 border-t items-center gap-x-2">
              <div className="col-span-6 md:col-span-7">
                <Input
                  type="text"
                  placeholder="Shutter Name"
                  value={newShutter.name}
                  onChange={(e) => setNewShutter({ ...newShutter, name: e.target.value })}
                  className="w-full text-xs sm:text-sm h-8 sm:h-10"
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="text"
                  placeholder="Duration"
                  value={newShutter.duration}
                  onChange={(e) => setNewShutter({ ...newShutter, duration: e.target.value })}
                  className="w-full text-xs sm:text-sm h-8 sm:h-10"
                />
              </div>
              <div className="col-span-3 flex gap-2">
                <Button variant="default" size="icon" onClick={handleAddShutter}>
                  <Save className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="icon" onClick={() => setAddingShutter(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShutterManager;