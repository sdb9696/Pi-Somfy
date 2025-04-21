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
          <i className="bi bi-plus"></i> Add New
        </Button>
      </div>
      
      <Table bordered>
        <thead>
          <tr>
            <th style={{ width: "55%" }}>Shutter Name</th>
            <th style={{ width: "20%" }}>Operation Time (Seconds)</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(shutters).map(([id, name]) => (
            <tr key={id}>
              <td>
                {isEditing && editingShutter?.id === id ? (
                  <Form.Control
                    type="text"
                    value={editingShutter.name}
                    onChange={(e) => setEditingShutter({...editingShutter, name: e.target.value})}
                  />
                ) : (
                  name
                )}
              </td>
              <td>
                {isEditing && editingShutter?.id === id ? (
                  <Form.Control
                    type="text"
                    value={editingShutter.duration}
                    onChange={(e) => setEditingShutter({...editingShutter, duration: e.target.value})}
                  />
                ) : (
                  shutterDurations[id] || '10'
                )}
              </td>
              <td>
                <div className="d-flex gap-2">
                  {isEditing && editingShutter?.id === id ? (
                    <>
                    <Button variant="default" size="sm" onClick={handleSaveEdit}>
                      Save
                    </Button>
                    <Button variant="default" size="sm" onClick={cancelEditing}>
                      Cancel
                    </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => startEditing(id)}>
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => confirmDelete(id)}>
                        Delete
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleShowProgram(id)}>
                        Program
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
          
          {/* Add new shutter row */
          addingShutter && (
          <tr>
            <td>
              <Form.Control
                type="text"
                placeholder="Shutter Name"
                value={newShutter.name}
                onChange={(e) => setNewShutter({...newShutter, name: e.target.value})}
              />
            </td>
            <td>
              <Form.Control
                type="text"
                placeholder="Duration in seconds"
                value={newShutter.duration}
                onChange={(e) => setNewShutter({...newShutter, duration: e.target.value})}
              />
            </td>
            <td>
              <Button variant="default" onClick={handleAddShutter}>
                Save
              </Button>
              <Button variant="secondary" onClick={() => setAddingShutter(false)}>
                Cancel
              </Button>
            </td>
          </tr>
          )}
        </tbody>
      </Table>
      
      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete this shutter?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Program Modal */}
      <Modal show={showProgramModal} onHide={() => setShowProgramModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Program Shutter</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Press the program button on the back of your remote control until your shutter makes a brief up and down movement.</p>
          <p>Then click on "Finished".</p>
        </Modal.Body>
        <Modal.Footer>
        <Button variant="secondary" onClick={() => setShowProgramModal(false)}>
            Cancel
          </Button>
          <Button variant="default" onClick={() => handleFinishedProgram()}>
            Finished
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ShutterManager;