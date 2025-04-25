import { useEffect, useState } from 'react';
import { addShutter, editShutter, deleteShutter, sendCommand } from '../services/api';
import ShutterProgrammer from './ShutterProgrammer';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogClose,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { X, Save, Link, Pencil, Trash2, Clock, ArrowBigUp, ArrowBigDown, Square, Plus, Play, Pause, Sunrise, Sunset, CalendarSyncIcon, Calendar1, Wrench, XCircle, ArrowUp, ArrowDown, ArrowUpDown, CircleArrowDown, CircleArrowUp, Target } from 'lucide-react';
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


  // For new shutter form
  const [newShutter, setNewShutter] = useState({ name: '', duration: '10' });
  const [addingShutter, setAddingShutter] = useState(false);
  const [addedShutter, setAddedShutter] = useState<string | null>(null);

  const handleAddShutter = async () => {
    try {
      const data = await addShutter(newShutter.name, newShutter.duration);
      setAddedShutter(data.id);
      setNewShutter({ name: '', duration: '10' });
      onShutterChange();
    } catch (error) {
      console.error('Error adding shutter:', error);
    }
  };

  const handleAbortAdd = async () => {
    if (!addedShutter) return;
    setAddingShutter(false);
    await deleteShutter(addedShutter);
    setAddedShutter(null);
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


  const handleDelete = async (id: string) => {
    try {
      await deleteShutter(id);
      onShutterChange();
    } catch (error) {
      console.error('Error deleting shutter:', error);
    }
  };


  const handleSendProgram = async (id: string) => {
    try {
      await sendCommand(id, 'program');
    } catch (error) {
      console.error('Error programming shutter:', error);
    }
  };

  const ConfigureShutter = ({shutterId}: {shutterId: string}) => {

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Wrench className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-left">Step-by-Step guides for setting up your shutters</DialogTitle>
            <DialogDescription className="sr-only">
              This will guide you through the process of setting up your shutters.
            </DialogDescription>
          </DialogHeader>
          <ShutterProgrammer shutterId={shutterId} />
          <DialogFooter>
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div>
      <div className="mb-3">
        <Button variant="default" onClick={() => setAddingShutter(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add New
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 bg-secondary p-2 font-semibold gap-x-2">
          <div className="col-span-4 sm:col-span-6 text-xs sm:text-sm">Shutter Name</div>
          <div className="col-span-2 text-xs sm:text-sm">
            <span className="hidden sm:inline">Operation Time (Seconds)</span>
            <span className="sm:hidden">Time (s)</span>
          </div>
          <div className="col-span-6 sm:col-span-4 text-xs sm:text-sm">Actions</div>
        </div>
        <div>
          {Object.entries(shutters).map(([id, name]) => (
            <div key={id} className="grid grid-cols-12 p-2 border-t items-center gap-x-2">
              <div className="col-span-4 sm:col-span-6">
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
              <div className="col-span-6 sm:col-span-4 flex justify-evenly gap-1 sm:gap-2 items-center">
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
                    <Button variant="ghost"size="icon" onClick={() => startEditing(id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="destructive"size="icon">
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
                          <Button variant="destructive" onClick={() => handleDelete(id)}>
                            Delete
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost"size="icon">
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
                          <DialogClose asChild>
                            <Button variant="default" onClick={() => handleSendProgram(id)}>
                              Finished
                            </Button>
                          </DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <ConfigureShutter shutterId={id} />
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
                <Dialog onOpenChange={(open) => {
                  if (open) {
                    handleAddShutter()
                  }
                  else
                  {
                    setAddingShutter(false)
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button variant="default" size="icon">
                      <Save className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Time to program your new shutter...</DialogTitle>
                    </DialogHeader>
                      <img width="216px" height="369px" src="pgminstr.png"/>
                      Did your window covering "jog"? If so, you are all set and your window covering has now learned your new remote. Proceed to click the "It worked!!" button below
                      If your window covering did not "jog", let's try to program it again. A previously programmed remote can be used in order to add a new remote or channel to the Motorized Window Covering.
                      If a Telis Transmitter (also known as another Remote) has not been previously programmed, please refer to the installation instructions of the relevant RTS
                      motorized window covering
                      Using the previously programmed Telis remote, press and hold the programming
                      button on back of remote until window covering "jogs". Then proceed to press the "Try Programming Again" button below.
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="default">It worked!!!</Button>
                      </DialogClose>
                      <Button variant="secondary" onClick={() => {
                        if (addedShutter) {
                          handleSendProgram(addedShutter)
                        }
                      }}>Try Programming again</Button>
                      <DialogClose asChild>
                        <Button variant="destructive" onClick={() => handleAbortAdd()}>Abort</Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
