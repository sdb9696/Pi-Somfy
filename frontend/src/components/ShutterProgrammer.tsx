import { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { pressButtons } from '../services/api';
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
import { Save, Link, Pencil, Trash2, Clock, ArrowBigUp, ArrowBigDown, Square, Plus, Play, Pause, Sunrise, Sunset, CalendarSyncIcon, Calendar1, Wrench, XCircle, ArrowUp, ArrowDown, ArrowUpDown, CircleArrowDown, CircleArrowUp, Target } from 'lucide-react';
import { Button, Switch, Checkbox, Input, Label, Select, Slider, SelectItem, SelectContent, SelectTrigger, SelectValue } from '@/components/ui';

const ShutterProgrammer = ({shutterId}: {shutterId: string}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleButtonPress = async (buttons: number, longPress: boolean, confirmMessage?: string) => {
    try {
      console.log("Pressing buttons:", shutterId, buttons, longPress);
      const data = await pressButtons(shutterId, buttons.toString(), longPress);

      if (data.status === "OK" && confirmMessage) {
        setSuccessMessage(confirmMessage);
      } else if (data.status !== "OK") {
        setErrorMessage(`Received Error from Server: ${data.message}`);
      }
    } catch (error) {
      console.error("Error pressing button:", error);
      setErrorMessage("Failed to send command");
    }
  };

  // Button constants
  const buttonStop = 0x1;
  const buttonUp = 0x2;
  const buttonDown = 0x4;
  const buttonProg = 0x8;


  return (
    <>
      <Accordion type="multiple">
        <AccordionItem value="initial-setup">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Initial Setup
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="text-sm">
              <p className="mb-2">Note: This process only works for unconfigured shutters in factory reset state. To perform a full factory reset (de-registers all remotes and reset all limits), hold down the reset button on the shutter until it jogs 3 times.</p>
              <ol className="list-decimal list-outside pl-5">
                <li className="mb-2">
                  Press
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonUp | buttonDown, true, "The blind should have jogged. If not, try again.")}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  to bind the shutter to this virtual remote.
                </li>
                <li className="mb-2">
                  Use the
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonUp, false)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  and
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonDown, false)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  to confirm the shutter moves in the correct direction. If the shutter moves in the wrong direction, click
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonStop, true, "The blind should have jogged. If not, try again.")}>
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                  and try again.
                </li>
                <li className="mb-2">
                  Use
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonUp, false)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  and
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonDown, false)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  to choose the upper limit position of the shutter.
                </li>
                <li className="mb-2">
                  When you are happy with the upper limit, click
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonDown | buttonStop, false, "The blind should have started moving down. If not, try again.")}>
                    <CircleArrowDown className="h-4 w-4" />
                  </Button>
                  The shutter will begin to move down towards the lower limit.
                </li>
                <li className="mb-2">
                  When the shutter reaches your desired lower limit press
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonStop, false)}>
                    <Square className="h-4 w-4" />
                  </Button>
                </li>
                <li className="mb-2">
                  Use
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonUp, false)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  and
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonDown, false)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  to adjust the lower limit of the shutter to the desired position.
                </li>
                <li className="mb-2">
                  When you are happy with the lower limit, click
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonUp | buttonStop, false, "The blind should have started moving up. If not, try again.")}>
                    <CircleArrowUp className="h-4 w-4" />
                  </Button>
                  The shutter will now return to the upper limit and stop.
                </li>
                <li className="mb-2">
                  If you are unhappy with the limits, go back to step 3. Now, confirm your limit selection to save the limits:
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonStop, true, "The blind should have jogged. If not, try again.")}>
                    <Save className="h-4 w-4" />
                  </Button>
                </li>
                <li className="mb-2">
                  Exit programming mode by clicking
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonProg, true)}>
                    <Save className="h-4 w-4" />
                  </Button>
                  Note: Some Somfy models will not respond to this command, but should now operate normally.
                </li>
              </ol>
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="adjust-limits">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4" />
              Adjust Shutter Limits
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="text-sm">
              <ol className="space-y-2 list-decimal pl-5">
                <li className="mb-2">
                  First, move the shutter to the limit you want to adjust:
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonUp, false)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonDown, false)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </li>
                <li className="mb-2">
                  Once stopped at the limit, press
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonUp | buttonDown, true, "The blind should have jogged. If not, try again.")}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  to enter edit mode.
                </li>
                <li className="mb-2">
                  Use
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonUp, false)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  and
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonDown, false)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  to adjust the limit position of the shutter.
                </li>
                <li className="mb-2">
                  Save the new limit position by clicking
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonStop, true, "The blind should have jogged. If not, try again.")}>
                    <Save className="h-4 w-4" />
                  </Button>
                </li>
                <li className="mb-2">
                  To abort the procedure, wait two minutes. The shutter will jog, and the limits will be unchanged.
                </li>
              </ol>
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="my-position">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Setting the "My" Position
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="text-sm">
              <ol className="space-y-2 list-decimal pl-5">
                <li className="mb-2">
                  Move the shutter to the position you want to save:
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonUp, false)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonDown, false)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonStop, false)}>
                    <Square className="h-4 w-4" />
                  </Button>
                </li>
                <li className="mb-2">
                  Press
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonStop, true, "The blind should have jogged. If not, try again.")}>
                    <Save className="h-4 w-4" />
                  </Button>
                  to save the My position.
                </li>
                <li className="mb-2">
                  Hint: You can return to the My position by pressing the Stop button when the shutter is not in motion.
                </li>
              </ol>
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="clear-my">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Clearing the "My" Position
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="text-sm">
              <ol className="space-y-2 list-decimal pl-5">
                <li className="mb-2">
                  Move the shutter to the My position:
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonStop, false)}>
                    <Target className="h-4 w-4" />
                  </Button>
                </li>
                <li className="mb-2">
                  Press
                  <Button className="p-1 h-6 w-6" variant="outline" onClick={() => handleButtonPress(buttonStop, true, "The blind should have jogged. If not, try again.")}>
                    <Save className="h-4 w-4" />
                  </Button>
                  to clear the My position.
                </li>
              </ol>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      {errorMessage && (
          <Dialog open={!!errorMessage} onOpenChange={() => setErrorMessage(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Error</DialogTitle>
                  <DialogDescription className="sr-only">
                    This is an error message from the shutter programmer.
                  </DialogDescription>
              </DialogHeader>
              <p>{errorMessage}</p>
              <DialogFooter>
                <Button onClick={() => setErrorMessage(null)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      {successMessage && (
        <Dialog open={!!successMessage} onOpenChange={() => setSuccessMessage(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Success</DialogTitle>
                <DialogDescription className="sr-only">
                  This is a success message from the shutter programmer.
                </DialogDescription>
            </DialogHeader>
            <p>{successMessage}</p>
            <DialogFooter>
              <Button onClick={() => setSuccessMessage(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default ShutterProgrammer;
