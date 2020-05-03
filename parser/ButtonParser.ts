// @ts-ignore
import DeviceParser from './DeviceParser';
import AccessoryParser from './AccessoryParser';
import { HAP } from 'homebridge';

class ButtonParser extends DeviceParser {
    static modelName = ['switch', 'sensor_switch']

    getAccessoriesParserInfo() {
        return {
          Button_StatelessProgrammableSwitch: ButtonStatelessProgrammableSwitchParser,
          // 'Button_Switch_VirtualSinglePress': ButtonSwitchVirtualSinglePressParser,
          // 'Button_Switch_VirtualDoublePress': ButtonSwitchVirtualDoublePressParser
        };
    }
}

module.exports = ButtonParser;

class ButtonStatelessProgrammableSwitchParser extends AccessoryParser {
    getAccessoryCategory() {
        return this.Accessory.Categories.PROGRAMMABLE_SWITCH;
    }
    
    getAccessoryInformation(deviceSid: string) {
        return {
            'Manufacturer': 'Aqara',
            'Model': 'Button',
            'SerialNumber': deviceSid
        };
    }

    getServices(_: any, accessoryName: string) {
        
        const service = new this.Service.StatelessProgrammableSwitch(accessoryName);
        service.getCharacteristic(this.Characteristic.ProgrammableSwitchEvent);
        
        const batteryService = new this.Service.BatteryService(accessoryName);
        batteryService.getCharacteristic(this.Characteristic.StatusLowBattery);
        batteryService.getCharacteristic(this.Characteristic.BatteryLevel);
        batteryService.getCharacteristic(this.Characteristic.ChargingState);
        
        return [service, batteryService];
    }
    
    parserAccessories(jsonObj: any) {
        var that = this;
        var deviceSid = jsonObj['sid'];
        var uuid = that.getAccessoryUUID(deviceSid);
        // @ts-ignore
        var accessory = that.platform.AccessoryUtil.getByUUID(uuid) as Accessory | null;
        if(accessory) {
            var service = accessory.getService(that.Service.StatelessProgrammableSwitch);
            var programmableSwitchEventCharacteristic = service.getCharacteristic(that.Characteristic.ProgrammableSwitchEvent);
            var value = that.getProgrammableSwitchEventCharacteristicValue(jsonObj);
            if(null != value) {
                programmableSwitchEventCharacteristic.updateValue(value);
            }
            
            that.parserBatteryService(accessory, jsonObj);
        }
    }
    
    getProgrammableSwitchEventCharacteristicValue(jsonObj: any, defaultValue?: number) {
        var value = null;
        // @ts-ignore
        var proto_version_prefix = this.platform.getProtoVersionPrefixByProtoVersion(this.platform.getDeviceProtoVersionBySid(jsonObj['sid']));
        if(1 == proto_version_prefix) {
            value = this.getValueFrJsonObjData1(jsonObj, 'status');
        } else if(2 == proto_version_prefix) {
            value = this.getValueFrJsonObjData2(jsonObj, 'button_0');
        } else {
        }
        
        if(value === 'click') {
            return this.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS;
        } else if(value === 'double_click') {
            return this.Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS;
        } else if(value === 'long_click_release') {
            /* 'long_click_press' */
            return this.Characteristic.ProgrammableSwitchEvent.LONG_PRESS;
        } else {
            return defaultValue;
        }
    }
}

// class ButtonSwitchVirtualBasePressParser extends SwitchVirtualBasePressParser {
//     getAccessoryInformation(deviceSid) {
//         return {
//             'Manufacturer': 'Aqara',
//             'Model': 'Button',
//             'SerialNumber': deviceSid
//         };
//     }
// }

// class ButtonSwitchVirtualSinglePressParser extends ButtonSwitchVirtualBasePressParser {
//     getWriteCommand(deviceSid, value) {
//         var model = this.platform.getDeviceModelBySid(deviceSid);
//         var command = null;
//         var proto_version_prefix = this.platform.getProtoVersionPrefixByProtoVersion(this.platform.getDeviceProtoVersionBySid(deviceSid));
//         if(1 == proto_version_prefix) {
//             command = '{"cmd":"write","model":"' + model + '","sid":"' + deviceSid + '","data":{"status":"click", "key": "${key}"}}';
//         } else if(2 == proto_version_prefix) {
//             command = '{"cmd":"write","model":"' + model + '","sid":"' + deviceSid + '","params":[{"button_0":"click"}], "key": "${key}"}';
//         } else {
//         }
        
//         return command;
//     }
    
//     doSomething(jsonObj) {
//         var deviceSid = jsonObj['sid'];
//         var model = this.platform.getDeviceModelBySid(deviceSid);
//         var command = null;
//         var proto_version_prefix = this.platform.getProtoVersionPrefixByProtoVersion(this.platform.getDeviceProtoVersionBySid(deviceSid));
//         if(1 == proto_version_prefix) {
//             command = '{"cmd":"report","model":"' + model + '","sid":"' + deviceSid + '", "data":{"status":"click"}}';
//         } else if(2 == proto_version_prefix) {
//             command = '{"cmd":"report","model":"' + model + '","sid":"' + deviceSid + '", "params":[{"button_0":"click"}]}';
//         } else {
//         }
//         var newObj = JSON.parse(command);
//         this.platform.ParseUtil.parserAccessories(newObj);
//     }
// }

// class ButtonSwitchVirtualDoublePressParser extends ButtonSwitchVirtualBasePressParser {
//     getWriteCommand(deviceSid, value) {
//         var model = this.platform.getDeviceModelBySid(deviceSid);
//         var command = null;
//         var proto_version_prefix = this.platform.getProtoVersionPrefixByProtoVersion(this.platform.getDeviceProtoVersionBySid(deviceSid));
//         if(1 == proto_version_prefix) {
//             command = '{"cmd":"write","model":"' + model + '","sid":"' + deviceSid + '","data":{"status":"double_click", "key": "${key}"}}';
//         } else if(2 == proto_version_prefix) {
//             command = '{"cmd":"write","model":"' + model + '","sid":"' + deviceSid + '","params":[{"button_0":"double_click"}], "key": "${key}"}';
//         } else {
//         }
        
//         return command;
//     }
    
//     doSomething(jsonObj) {
//         var deviceSid = jsonObj['sid'];
//         var model = this.platform.getDeviceModelBySid(deviceSid);
//         var command = null;
//         var proto_version_prefix = this.platform.getProtoVersionPrefixByProtoVersion(this.platform.getDeviceProtoVersionBySid(deviceSid));
//         if(1 == proto_version_prefix) {
//             command = '{"cmd":"report","model":"' + model + '","sid":"' + deviceSid + '", "data":{"status":"double_click"}}';
//         } else if(2 == proto_version_prefix) {
//             command = '{"cmd":"report","model":"' + model + '","sid":"' + deviceSid + '", "params":[{"button_0":"double_click"}]}';
//         } else {
//         }
//         var newObj = JSON.parse(command);
//         this.platform.ParseUtil.parserAccessories(newObj);
//     }
// }

// class ButtonSwitchVirtualLongPressParser extends ButtonSwitchVirtualBasePressParser {
//     getWriteCommand(deviceSid, value) {
//         var model = this.platform.getDeviceModelBySid(deviceSid);
//         var command = null;
//         var proto_version_prefix = this.platform.getProtoVersionPrefixByProtoVersion(this.platform.getDeviceProtoVersionBySid(deviceSid));
//         if(1 == proto_version_prefix) {
//             command = '{"cmd":"write","model":"' + model + '","sid":"' + deviceSid + '","data":{"status":"long_click_press", "key": "${key}"}}';
//         } else if(2 == proto_version_prefix) {
//             command = '{"cmd":"write","model":"' + model + '","sid":"' + deviceSid + '","params":[{"button_0":"long_click_press"}], "key": "${key}"}';
//         } else {
//         }

//         return command;
//     }
    
//     doSomething(jsonObj) {
//         var deviceSid = jsonObj['sid'];
//         var model = this.platform.getDeviceModelBySid(deviceSid);
//         var command = null;
//         var proto_version_prefix = this.platform.getProtoVersionPrefixByProtoVersion(this.platform.getDeviceProtoVersionBySid(deviceSid));
//         if(1 == proto_version_prefix) {
//             command = '{"cmd":"report","model":"' + model + '","sid":"' + deviceSid + '", "data":{"status":"long_click_press"}}';
//         } else if(2 == proto_version_prefix) {
//             command = '{"cmd":"report","model":"' + model + '","sid":"' + deviceSid + '", "params":[{"button_0":"long_click_press"}]}';
//         } else {
//         }
//         var newObj = JSON.parse(command);
//         this.platform.ParseUtil.parserAccessories(newObj);
//     }
// }
