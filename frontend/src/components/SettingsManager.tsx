import { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MapPin, Globe, Radio, ArrowRightLeft } from 'lucide-react';
import MapSettings from './MapSettings';

interface SettingsManagerProps {
  initialLatitude: number;
  initialLongitude: number;
  onLocationSaved: () => void;
}

const SettingsManager = ({ initialLatitude, initialLongitude, onLocationSaved }: SettingsManagerProps) => {
  // Web Settings state (placeholders)
  const [webSettings, setWebSettings] = useState({
    useHttps: true,
    httpPort: 8080,
    httpsPort: 443,
    password: ''
  });

  // MQTT Settings state (placeholders)
  const [mqttSettings, setMqttSettings] = useState({
    server: '192.168.1.x',
    port: 1883,
    username: '',
    password: '',
    clientId: 'somfy-mqtt-bridge',
    enableDiscovery: true
  });

  // Radio Settings state (placeholders)
  const [radioSettings, setRadioSettings] = useState({
    txGpio: 25,
    rfm69Enabled: false,
    rfm69ResetGpio: 25,
    rfm69SpiChannel: 0,
    pigpioHost: 'localhost',
    pigpioPort: 8888,
    rtsAddress: '0x279620',
    sendRepeat: 2
  });

  // Placeholder handlers
  const handleWebSettingsChange = (field: string, value: any) => {
    setWebSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleMqttSettingsChange = (field: string, value: any) => {
    setMqttSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleRadioSettingsChange = (field: string, value: any) => {
    setRadioSettings(prev => ({ ...prev, [field]: value }));
  };

  const saveWebSettings = () => {

    alert('TBD: Would save web settings: ' + JSON.stringify(webSettings));
    // TODO: Implement API call
  };

  const saveMqttSettings = () => {

    alert('TBD: Would save MQTT settings: ' + JSON.stringify(mqttSettings));
    // TODO: Implement API call
  };

  const saveRadioSettings = () => {

    alert('TBD: Would save radio settings: ' + JSON.stringify(radioSettings));
    // TODO: Implement API call
  };

  return (
    <Accordion type="single" collapsible className="w-full px-2">
      <AccordionItem value="location">
        <AccordionTrigger>
          <div className="flex items-center">
            <MapPin className="mr-2 h-5 w-5" />
            <span>Location Settings</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 border-t">
          <MapSettings
            initialLatitude={initialLatitude}
            initialLongitude={initialLongitude}
            onLocationSaved={onLocationSaved}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="web">
        <AccordionTrigger>
          <div className="flex items-center">
            <Globe className="mr-2 h-5 w-5" />
            <span>Web Settings</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 border-t">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="useHttps">Use HTTPS</Label>
              <Switch
                id="useHttps"
                checked={webSettings.useHttps}
                onCheckedChange={(checked) => handleWebSettingsChange('useHttps', checked)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="httpPort">HTTP Port</Label>
                <Input
                  id="httpPort"
                  type="number"
                  value={webSettings.httpPort}
                  onChange={(e) => handleWebSettingsChange('httpPort', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="httpsPort">HTTPS Port</Label>
                <Input
                  id="httpsPort"
                  type="number"
                  value={webSettings.httpsPort}
                  onChange={(e) => handleWebSettingsChange('httpsPort', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={webSettings.password}
                onChange={(e) => handleWebSettingsChange('password', e.target.value)}
                placeholder="Enter password for web interface"
              />
            </div>

            <Button onClick={saveWebSettings}>Save Web Settings</Button>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="mqtt">
        <AccordionTrigger>
          <div className="flex items-center">
            <ArrowRightLeft className="mr-2 h-5 w-5" />
            <span>MQ Settings</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 border-t">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mqttServer">MQTT Server</Label>
                <Input
                  id="mqttServer"
                  value={mqttSettings.server}
                  onChange={(e) => handleMqttSettingsChange('server', e.target.value)}
                  placeholder="broker.example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mqttPort">MQTT Port</Label>
                <Input
                  id="mqttPort"
                  type="number"
                  value={mqttSettings.port}
                  onChange={(e) => handleMqttSettingsChange('port', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mqttUsername">Username</Label>
                <Input
                  id="mqttUsername"
                  value={mqttSettings.username}
                  onChange={(e) => handleMqttSettingsChange('username', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mqttPassword">Password</Label>
                <Input
                  id="mqttPassword"
                  type="password"
                  value={mqttSettings.password}
                  onChange={(e) => handleMqttSettingsChange('password', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mqttClientId">Client ID</Label>
              <Input
                id="mqttClientId"
                value={mqttSettings.clientId}
                onChange={(e) => handleMqttSettingsChange('clientId', e.target.value)}
                placeholder="pi-somfy"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="enableDiscovery">Enable Discovery</Label>
              <Switch
                id="enableDiscovery"
                checked={mqttSettings.enableDiscovery}
                onCheckedChange={(checked) => handleMqttSettingsChange('enableDiscovery', checked)}
              />
            </div>

            <Button onClick={saveMqttSettings}>Save MQTT Settings</Button>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="radio">
        <AccordionTrigger>
          <div className="flex items-center">
            <Radio className="mr-2 h-5 w-5" />
            <span>Radio Settings</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 border-t">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="txGpio">TX GPIO Pin</Label>
                <Input
                  id="txGpio"
                  type="number"
                  value={radioSettings.txGpio}
                  onChange={(e) => handleRadioSettingsChange('txGpio', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sendRepeat">Send Repeat</Label>
                <Input
                  id="sendRepeat"
                  type="number"
                  value={radioSettings.sendRepeat}
                  onChange={(e) => handleRadioSettingsChange('sendRepeat', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="rfm69Enabled">RFM69 Enabled</Label>
              <Switch
                id="rfm69Enabled"
                checked={radioSettings.rfm69Enabled}
                onCheckedChange={(checked) => handleRadioSettingsChange('rfm69Enabled', checked)}
              />
            </div>

            {radioSettings.rfm69Enabled && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rfm69ResetGpio">RFM69 Reset GPIO</Label>
                    <Input
                      id="rfm69ResetGpio"
                      type="number"
                      value={radioSettings.rfm69ResetGpio}
                      onChange={(e) => handleRadioSettingsChange('rfm69ResetGpio', parseInt(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rfm69SpiChannel">RFM69 SPI Channel</Label>
                    <Input
                      id="rfm69SpiChannel"
                      type="number"
                      value={radioSettings.rfm69SpiChannel}
                      onChange={(e) => handleRadioSettingsChange('rfm69SpiChannel', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pigpioHost">PIGPIO Host</Label>
                <Input
                  id="pigpioHost"
                  value={radioSettings.pigpioHost}
                  onChange={(e) => handleRadioSettingsChange('pigpioHost', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pigpioPort">PIGPIO Port</Label>
                <Input
                  id="pigpioPort"
                  type="number"
                  value={radioSettings.pigpioPort}
                  onChange={(e) => handleRadioSettingsChange('pigpioPort', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rtsAddress">RTS Address</Label>
              <Input
                id="rtsAddress"
                value={radioSettings.rtsAddress}
                onChange={(e) => handleRadioSettingsChange('rtsAddress', e.target.value)}
                placeholder="0x123ABC"
              />
            </div>

            <Button onClick={saveRadioSettings}>Save Radio Settings</Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default SettingsManager;
