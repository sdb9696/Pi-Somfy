import { useState } from 'react';
import { Table, Button, Form, Modal } from 'react-bootstrap';
import { addShutter, editShutter, deleteShutter, sendCommand } from '../services/api';

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
  
  const handleAddShutter = async () => {
    try {
      await addShutter(newShutter.name, newShutter.duration);
      setNewShutter({ name: '', duration: '10' });
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
  
  const handleProgram = async (id: string) => {
    try {
      await sendCommand(id, 'program');
      setShowProgramModal(true);
    } catch (error) {
      console.error('Error programming shutter:', error);
    }
  };
  
  const handleShutterAction = async (id: string, action: 'up' | 'down' | 'stop') => {
    try {
      await sendCommand(id, action);
    } catch (error) {
      console.error(`Error with shutter action ${action}:`, error);
    }
  };
  
  return (
    <div>
      <div className="mb-3">
        <Button variant="primary" onClick={() => setNewShutter({ name: '', duration: '10' })}>
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
                    <Button variant="success" size="sm" onClick={handleSaveEdit}>
                      Save
                    </Button>
                  ) : (
                    <>
                      <Button variant="primary" size="sm" onClick={() => handleShutterAction(id, 'up')}>
                        Up
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleShutterAction(id, 'stop')}>
                        Stop
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => handleShutterAction(id, 'down')}>
                        Down
                      </Button>
                      <Button variant="warning" size="sm" onClick={() => startEditing(id)}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => confirmDelete(id)}>
                        Delete
                      </Button>
                      <Button variant="info" size="sm" onClick={() => handleProgram(id)}>
                        Program
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
          
          {/* Add new shutter row */}
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
              <Button variant="success" onClick={handleAddShutter}>
                Add
              </Button>
            </td>
          </tr>
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
          <Button variant="danger" onClick={handleDelete}>
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
          <Button variant="primary" onClick={() => setShowProgramModal(false)}>
            Finished
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ShutterManager;