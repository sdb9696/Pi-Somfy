import { useEffect, useState } from 'react';
import { Table, Form, Modal } from 'react-bootstrap';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { addShutter, editShutter, deleteShutter, sendCommand, pressButtons } from '../services/api';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogClose,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { X, Save, Link, Pencil, Trash2, Clock, ArrowBigUp, ArrowBigDown, Square, Plus, Play, Pause, Sunrise, Sunset, CalendarSyncIcon, Calendar1, Wrench } from 'lucide-react';
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
  
  const [showConfigure, setShowConfigure] = useState<string | null>(null);
  
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (showConfigure == null) {
        return;
      }
      if (event.data === "modal-closed") {
        console.log("Modal in iframe was closed");
        setShowConfigure(null);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [showConfigure]);

  const ConfigureShutter = ({shutterId}: {shutterId: string}) => {

    
    return (
      <>
      <Button variant="ghost" size="icon" onClick={() => setShowConfigure(shutterId)}>
      <Wrench className="h-4 w-4" />
    </Button>
    {showConfigure && (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        width: '80%',
        height: '80%',
        background: '#fff',
        position: 'relative',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        <iframe
          srcDoc={`
            <!DOCTYPE html>
            <head>
              <title>Configure Shutter</title>
              <link rel="stylesheet" href="css/bootstrap.min.css">
              <link rel="stylesheet" href="css/bootstrap-dialog.min.css">
              <link rel="stylesheet" href="css/bootstrap-toggle.min.css">
              <link rel="stylesheet" href="css/bootstrap-clockpicker.min.css">
              <link rel="stylesheet" href="css/bootstrap-datepicker.css">
              <link rel="stylesheet" href="css/bootstrap-slider.min.css">
              <link rel="stylesheet" href="css/bootstrap-multiselect.css">
              <link rel="stylesheet" href="css/leaflet.css">
              <link rel="stylesheet" href="css/Control.Geocoder.css" />
              <link rel="stylesheet" href="css/layout-grid.min.css" />
              <link rel="stylesheet" href="operateShutters.css">
              <script type="text/javascript" src="js/jquery-3.3.1.min.js"></script>
              <script type="text/javascript" src="js/bootstrap.min.js"></script>
              <script type="text/javascript" src="js/bootstrap-dialog.min.js"></script>
              <script type="text/javascript" src="js/bootstrap-toggle.min.js"></script>
              <script type="text/javascript" src="js/bootstrap-clockpicker.min.js"></script>
              <script type="text/javascript" src="js/bootstrap-datepicker.js"></script>
              <script type="text/javascript" src="js/bootstrap-slider.min.js"></script>
              <script type="text/javascript" src="js/bootstrap-multiselect.js"></script>
              <script type="text/javascript" src="js/leaflet.js"></script>
              <script type="text/javascript" src="js/Control.Geocoder.js"></script>
              <script type="text/javascript" src="js/layout-grid.min.js"></script>                            
            </head>
            <html>
              <body>
                <div class="modal fade" id="configure-shutter" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
                  <div class="vertical-alignment-helper">
                  <div class="modal-dialog modal-lg vertical-align-center">
                      <div class="modal-content">
                          <div class="modal-header">
                              <h4 class="panel-title">
                                  Step-by-Step guides for seting up your shutters
                              </h4>
                          </div>
                          <div class="modal-body">
                              <div class="panel-group" id="configAccordion">
                                  <div class="panel panel-default">
                                      <div class="panel-heading">
                                          <h4 class="panel-title">
                                              <a data-toggle="collapse" data-parent="#accordion" href="#configInitialSetup">
                                                  <span class="glyphicon glyphicon-wrench"></span>Initial Setup
                                              </a>
                                          </h4>
                                      </div>
                                      <div id="configInitialSetup" class="panel-collapse collapse">
                                          <div class="panel-body nonscroll">
                                              Note: This process only works for unconfigured shutters in factory reset state. To perform a full factory reset (de-registers all remotes and reset all limits), hold down the reset button on the shutter until it jogs 3 times.
                                              <ol>
                                                  <li>Press <button type="button" class="btn press-button-up-down-long"><i class="glyphicon glyphicon-pencil"></i></button> to bind the shutter to this virtual remote.</li>
                                                  <li>Use the <button type="button" class="btn press-button-up-short"><i class="glyphicon glyphicon-arrow-up"></i></button> and <button type="button" class="btn press-button-down-short"><i class="glyphicon glyphicon-arrow-down"></i></button> to confirm the shutter moves in the correct direction. 
                                                      If the shutter moves in the wrong direction, click 
                                                      <button type="button" class="btn press-button-stop-long"><i class="glyphicon glyphicon-sort"></i></button> and try again.
                                                  </li>
                                                  <li>Use <button type="button" class="btn press-button-up-short"><i class="glyphicon glyphicon-arrow-up"></i></button> and
                                                      <button type="button" class="btn press-button-down-short"><i class="glyphicon glyphicon-arrow-down"></i></button> to choose the upper limit position of the shutter.
                                                  </li>
                                                  <li>
                                                      When you are happy with the upper limit, click <button type="button" class="btn press-button-down-stop-short"><i class="glyphicon glyphicon-circle-arrow-down"></i></button>.
                                                      The shutter will begin to move down towards the lower limit.
                                                  </li>
                                                  <li>When the shutter reaches your desired lower limit press <button type="button" class="btn press-button-stop-short"><i class="glyphicon glyphicon-stop"></i></button>.
                                                  </li>
                                                  <li>Use <button type="button" class="btn press-button-up-short"><i class="glyphicon glyphicon-arrow-up"></i></button> and 
                                                      <button type="button" class="btn press-button-down-short"><i class="glyphicon glyphicon-arrow-down"></i></button> to adjust the lower limit of the shutter to the desired position.
                                                  </li>
                                                  <li>When you are happy with the lower limit, click
                                                      <button type="button" class="btn press-button-up-stop-short"><i class="glyphicon glyphicon-circle-arrow-up"></i></button>.
                                                      The shutter will now return to the upper limit and stop.
                                                  </li>
                                                  <li>If you are unhappy with the limits, go back to step 3. Now, confirm your limit selection to save the limits:
                                                      <button type="button" class="btn press-button-stop-long"><i class="glyphicon glyphicon-saved"></i></button>
                                                  </li>
                                                  <li>Exit programming mode by clicking <button type="button" class="btn press-button-prog-long"><i class="glyphicon glyphicon-saved"></i></button>. Note: Some Somfy models will not respond to this command, but should now operate normally.                                               
                                                  </li>
                                              </ol>
                                          </div>
                                      </div>
                                  </div>
                                  <div class="panel panel-default">
                                      <div class="panel-heading">
                                          <h4 class="panel-title">
                                              <a data-toggle="collapse" data-parent="#accordion" href="#configLimits">
                                                  <span class="glyphicon glyphicon-sort-by-attributes"></span>Adjust Shutter Limits
                                              </a>
                                          </h4>
                                      </div>
                                      <div id="configLimits" class="panel-collapse collapse">
                                          <div class="panel-body nonscroll">
                                              <ol>
                                                  <li>First, move the shutter to the limit you want to adjust:
                                                      <button type="button" class="btn press-button-up-short"><i class="glyphicon glyphicon-arrow-up"></i></button>
                                                      <button type="button" class="btn press-button-down-short"><i class="glyphicon glyphicon-arrow-down"></i></button>. 
                                                  </li>
                                                  <li>Once stopped at the limit, press <button type="button" class="btn press-button-up-down-long"><i class="glyphicon glyphicon-pencil"></i></button> to enter edit mode.
                                                  </li>
                                                  <li>Use <button type="button" class="btn press-button-up-short"><i class="glyphicon glyphicon-arrow-up"></i></button> and
                                                      <button type="button" class="btn press-button-down-short"><i class="glyphicon glyphicon-arrow-down"></i></button> to adjust the limit position of the shutter.
                                                  </li>
                                                  <li>Save the new limit position by clicking <button type="button" class="btn press-button-stop-long"><i class="glyphicon glyphicon-saved"></i></button>.
                                                  </li>
                                                  <li>To abort the procedure, wait two minutes. The shutter will jog, and the limits will be unchanged.</li>
                                              </ol>
                                          </div>
                                      </div>
                                  </div>
                                  <div class="panel panel-default">
                                      <div class="panel-heading">
                                          <h4 class="panel-title">
                                              <a data-toggle="collapse" data-parent="#accordion" href="#configMyPosition">
                                                  <span class="glyphicon glyphicon-screenshot"></span>Setting the "My" Position
                                              </a>
                                          </h4>
                                      </div>
                                      <div id="configMyPosition" class="panel-collapse collapse">
                                          <div class="panel-body nonscroll">
                                              <ol>
                                                  <li>Move the shutter to the position you want to save:
                                                      <button type="button" class="btn press-button-up-short"><i class="glyphicon glyphicon-arrow-up"></i></button>
                                                      <button type="button" class="btn press-button-down-short"><i class="glyphicon glyphicon-arrow-down"></i></button>
                                                      <button type="button" class="btn press-button-stop-short"><i class="glyphicon glyphicon-stop"></i></button>. 
                                                  </li>
                                                  <li>Press <button type="button" class="btn press-button-stop-long"><i class="glyphicon glyphicon-floppy-save"></i></button> to save the My position.
                                                  </li>
                                                  <li>Hint: You can return to the My position by pressing the Stop button when the shutter is not in motion.
                                                  </li>
                                              </ol>
                                          </div>
                                      </div>
                                  </div>
                                  <div class="panel panel-default">
                                      <div class="panel-heading">
                                          <h4 class="panel-title">
                                              <a data-toggle="collapse" data-parent="#accordion" href="#configClearMy">
                                                  <span class="glyphicon glyphicon-remove-circle"></span>Clearing the "My" Position
                                              </a>
                                          </h4>
                                      </div>
                                      <div id="configClearMy" class="panel-collapse collapse">
                                          <div class="panel-body nonscroll">
                                              <ol>
                                                  <li>Move the shutter to the My position: <button type="button" class="btn press-button-stop-short"><i class="glyphicon glyphicon-screenshot"></i></button>. 
                                                  </li>
                                                  <li>Press <button type="button" class="btn press-button-stop-long"><i class="glyphicon glyphicon-floppy-save"></i></button> to clear the My position.
                                                  </li>
                                              </ol>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                          <div style="clear: right;" class="modal-footer">
                              <button type="button" class="btn btn-success" id="configure-shutter-done" data-dismiss="modal">Done</button>
                          </div>
                      </div>
                  </div>
                  </div>
              </div>
              </body>
            </html>
            <script>

            //alert(baseurl);
            const buttonStop = 0x1;
            const buttonUp = 0x2;
            const buttonDown = 0x4;
            const buttonProg = 0x8;

            var configShutter = "${showConfigure}";

            const baseurl = "${window.location.origin}" + '/cmd/';
            console.log(baseurl);

            $('#configure-shutter').modal('show');

            function pressButtons(id, buttons, longPress, confirmMessage) {
              console.log(id, buttons, longPress, confirmMessage);
              var url = baseurl.concat("press");
              $.post(url,
                  {shutter: id, buttons: buttons, longPress: longPress },
                  function(result, status){
                    if ((status=="success") && (result.status == "OK")) {
                        if(confirmMessage != null) {
                          BootstrapDialog.show({type: BootstrapDialog.TYPE_INFO, title: 'Information', message:confirmMessage});
                        }
                    } else {
                        BootstrapDialog.show({type: BootstrapDialog.TYPE_DANGER, title: 'Error', message:'Received Error from Server: '+result.message });
                    }
                }, "json");
            }

          $(document).on("click", '#configure-shutter-done', function(){
              //document.getElementById('modal').style.display = 'none';
              window.parent.postMessage('modal-closed', '*');
          });
                  
      

          $(document).on("click", '.press-button-up-short', function(){
              //  Fine adjustment of blind up
              pressButtons(configShutter, buttonUp, false);
          });
      
          $(document).on("click", '.press-button-down-short', function(){
              //  Fine adjustment of blind down
              pressButtons(configShutter, buttonDown, false);
          });
          
          $(document).on("click", '.press-button-stop-short', function(){
              // Stops blind when it's in motion, or moves to the My position.
              pressButtons(configShutter, buttonStop, false);
          });
      
          $(document).on("click", '.press-button-up-down-long', function(){
              // Used in new installation setup, or when entering blind limit configuration mode
              pressButtons(configShutter, buttonUp | buttonDown, true, "The blind should have jogged. If not, try again.");
          });
      
          $(document).on("click", '.press-button-up-stop-short', function(){
            // Used to set a My position, to reverse the direction of blinds during initial setup, and to confirm limit position settings.
            pressButtons(configShutter, buttonUp | buttonStop, false, "The blind should have started moving up. If not, try again.");
          });
      
          $(document).on("click", '.press-button-down-stop-short', function(){
            // Used to set a My position, to reverse the direction of blinds during initial setup, and to confirm limit position settings.
            pressButtons(configShutter, buttonDown | buttonStop, false, "The blind should have started moving down. If not, try again.");
          });
      
          $(document).on("click", '.press-button-stop-long', function(){
            // Used to set a My position, to reverse the direction of blinds during initial setup, and to confirm limit position settings.
            pressButtons(configShutter, buttonStop, true, "The blind should have jogged. If not, try again.");
        });
      
        $(document).on("click", '.press-button-prog-long', function(){
            // Used to end programming, or to switch a blind into Remote Learning mode
            pressButtons(configShutter, buttonProg, true);
        });
      
            </script>
            `}
          style={{ width: '100%', height: '100%', border: 'none' }}
          sandbox="allow-scripts allow-same-origin allow-modals"
          title="Full HTML Document"
        />
      </div>
    </div>

    )}      
    </>
    )
  }


  return (
    <div>
      <div className="mb-3">
        <Button variant="default" onClick={() => setAddingShutter(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add New
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 bg-secondary p-2 font-semibold gap-x-2">
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