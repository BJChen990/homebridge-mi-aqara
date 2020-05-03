// @ts-ignore
import DeviceParser from "./DeviceParser";
import AccessoryParser from "./AccessoryParser";
import {
  Accessory,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  HAP,
} from "homebridge";

class TemperatureAndHumiditySensorParser extends DeviceParser {
  static readonly modelName = ["sensor_ht"];

  getAccessoriesParserInfo() {
    return {
      TemperatureAndHumiditySensor_Accessory: TemperatureAndHumiditySensorAccessoryParser,
      // TemperatureAndHumiditySensor_TemperatureSensor: TemperatureAndHumiditySensorTemperatureSensorParser,
      // TemperatureAndHumiditySensor_HumiditySensor: TemperatureAndHumiditySensorHumiditySensorParser,
    };
  }
}

module.exports = TemperatureAndHumiditySensorParser;

class TemperatureAndHumiditySensorAccessoryParser extends AccessoryParser {
  getAccessoryCategory(deviceSid: string) {
    return this.Accessory.Categories.SENSOR;
  }

  getAccessoryInformation(deviceSid: string) {
    return {
      Manufacturer: "Aqara",
      Model: "Temperature And Humidity Sensor",
      SerialNumber: deviceSid,
    };
  }

  getServices(_: any, accessoryName: string) {
    const result = [];
    var service = new this.Service.TemperatureSensor(accessoryName);
    service.getCharacteristic(this.Characteristic.CurrentTemperature);
    result.push(service);

    var batteryService = new this.Service.BatteryService(accessoryName);
    batteryService.getCharacteristic(this.Characteristic.StatusLowBattery);
    batteryService.getCharacteristic(this.Characteristic.BatteryLevel);
    batteryService.getCharacteristic(this.Characteristic.ChargingState);
    result.push(batteryService);

    var service = new this.Service.HumiditySensor(accessoryName);
    service.getCharacteristic(this.Characteristic.CurrentRelativeHumidity);
    result.push(service);

    return result;
  }

  parserAccessories(jsonObj: any) {
    var deviceSid = jsonObj["sid"];
    var uuid = this.getAccessoryUUID(deviceSid);
    // @ts-ignore
    var accessory = this.platform.AccessoryUtil.getByUUID(uuid) as
      | Accessory
      | undefined;
    if (accessory) {
      this.parseTemperature(jsonObj, accessory);
      this.parseHumidity(jsonObj, accessory);
      this.parserBatteryService(accessory, jsonObj);
    }
  }

  private parseTemperature(jsonObj: any, accessory: Accessory) {
    var that = this;
    var deviceSid = jsonObj["sid"];
    const temperatureService = accessory.getService(
      that.Service.TemperatureSensor
    )!;
    const currentTemperatureCharacteristic = temperatureService.getCharacteristic(
      that.Characteristic.CurrentTemperature
    );
    currentTemperatureCharacteristic.setProps({ maxValue: 80, minValue: -40 });
    var value = that.getCurrentTemperatureCharacteristicValue(jsonObj, null);
    if (null != value) {
      currentTemperatureCharacteristic.updateValue(value);
    }

    if (
      // @ts-ignore
      that.platform.ConfigUtil.getAccessorySyncValue(
        deviceSid,
        that.accessoryType
      )
    ) {
      if (
        currentTemperatureCharacteristic.listeners(CharacteristicEventTypes.GET)
          .length == 0
      ) {
        currentTemperatureCharacteristic.on(
          CharacteristicEventTypes.GET,
          (callback: CharacteristicGetCallback) => {
            var command = '{"cmd":"read", "sid":"' + deviceSid + '"}';
            that.platform
              // @ts-ignore
              .sendReadCommand(deviceSid, command)
              // @ts-ignore
              .then((result) => {
                var value = that.getCurrentTemperatureCharacteristicValue(
                  result,
                  null
                );
                if (null != value) {
                  callback(null, value);
                } else {
                  callback(new Error("get value fail: " + result));
                }
              })
              .catch((err: Error) => {
                // @ts-ignore
                that.platform.log.error(err);
                callback(err);
              });
          }
        );
      }
    }
  }

  private parseHumidity(jsonObj: any, accessory: Accessory) {
    const deviceSid = jsonObj["sid"];

    var humidityService = accessory.getService(this.Service.HumiditySensor)!;
    var currentRelativeHumidityCharacteristic = humidityService.getCharacteristic(
      this.Characteristic.CurrentRelativeHumidity
    );
    var value = this.getCurrentRelativeHumidityCharacteristicValue(
      jsonObj,
      null
    );
    if (null != value) {
      currentRelativeHumidityCharacteristic.updateValue(value);
    }

    if (
      // @ts-ignore
      this.platform.ConfigUtil.getAccessorySyncValue(
        deviceSid,
        this.accessoryType
      )
    ) {
      if (
        currentRelativeHumidityCharacteristic.listeners(
          CharacteristicEventTypes.GET
        ).length == 0
      ) {
        currentRelativeHumidityCharacteristic.on(
          CharacteristicEventTypes.GET,
          (callback: CharacteristicGetCallback) => {
            var command = '{"cmd":"read", "sid":"' + deviceSid + '"}';
            this.platform
              // @ts-ignore
              .sendReadCommand(deviceSid, command)
              // @ts-ignore
              .then((result) => {
                var value = this.getCurrentRelativeHumidityCharacteristicValue(
                  result,
                  null
                );
                if (null != value) {
                  callback(null, value);
                } else {
                  callback(new Error("get value fail: " + result));
                }
              })
              .catch((err: Error) => {
                // @ts-ignore
                this.platform.log.error(err);
                callback(err);
              });
          }
        );
      }
    }
  }

  getCurrentTemperatureCharacteristicValue(
    jsonObj: any,
    defaultValue: number | null
  ) {
    var value = this.getValueFrJsonObjData(jsonObj, "temperature");
    return null != value ? value / 100.0 : defaultValue;
  }

  getCurrentRelativeHumidityCharacteristicValue(
    jsonObj: any,
    defaultValue: number | null
  ) {
    var value = this.getValueFrJsonObjData(jsonObj, "humidity");
    return null != value ? value / 100.0 : defaultValue;
  }
}

// class TemperatureAndHumiditySensorTemperatureSensorParser extends AccessoryParser {
//   constructor(platform, accessoryType) {
//     super(platform, accessoryType);
//   }

//   getAccessoryCategory(deviceSid) {
//     return this.Accessory.Categories.SENSOR;
//   }

//   getAccessoryInformation(deviceSid) {
//     return {
//       Manufacturer: "Aqara",
//       Model: "Temperature And Humidity Sensor",
//       SerialNumber: deviceSid,
//     };
//   }

//   getServices(jsonObj, accessoryName) {
//     var that = this;
//     var result = [];

//     var service = new that.Service.TemperatureSensor(accessoryName);
//     service.getCharacteristic(that.Characteristic.CurrentTemperature);
//     result.push(service);

//     var batteryService = new that.Service.BatteryService(accessoryName);
//     batteryService.getCharacteristic(that.Characteristic.StatusLowBattery);
//     batteryService.getCharacteristic(that.Characteristic.BatteryLevel);
//     batteryService.getCharacteristic(that.Characteristic.ChargingState);
//     result.push(batteryService);

//     return result;
//   }

//   parserAccessories(jsonObj) {
//     var that = this;
//     var deviceSid = jsonObj["sid"];
//     var uuid = that.getAccessoryUUID(deviceSid);
//     var accessory = that.platform.AccessoryUtil.getByUUID(uuid);
//     if (accessory) {
//       var service = accessory.getService(that.Service.TemperatureSensor);
//       var currentTemperatureCharacteristic = service.getCharacteristic(
//         that.Characteristic.CurrentTemperature
//       );
//       currentTemperatureCharacteristic.setProps({
//         maxValue: 80,
//         minValue: -40,
//       });
//       var value = that.getCurrentTemperatureCharacteristicValue(jsonObj, null);
//       if (null != value) {
//         currentTemperatureCharacteristic.updateValue(value);
//       }

//       if (
//         that.platform.ConfigUtil.getAccessorySyncValue(
//           deviceSid,
//           that.accessoryType
//         )
//       ) {
//         if (currentTemperatureCharacteristic.listeners("get").length == 0) {
//           currentTemperatureCharacteristic.on("get", function (callback) {
//             var command = '{"cmd":"read", "sid":"' + deviceSid + '"}';
//             that.platform
//               .sendReadCommand(deviceSid, command)
//               .then((result) => {
//                 var value = that.getCurrentTemperatureCharacteristicValue(
//                   result,
//                   null
//                 );
//                 if (null != value) {
//                   callback(null, value);
//                 } else {
//                   callback(new Error("get value fail: " + result));
//                 }
//               })
//               .catch(function (err) {
//                 that.platform.log.error(err);
//                 callback(err);
//               });
//           });
//         }
//       }

//       that.parserBatteryService(accessory, jsonObj);
//     }
//   }

//   getCurrentTemperatureCharacteristicValue(jsonObj, defaultValue) {
//     var value = this.getValueFrJsonObjData(jsonObj, "temperature");
//     return null != value ? value / 100.0 : defaultValue;
//   }
// }

// class TemperatureAndHumiditySensorHumiditySensorParser extends AccessoryParser {
//   constructor(platform, accessoryType) {
//     super(platform, accessoryType);
//   }

//   getAccessoryCategory(deviceSid) {
//     return this.Accessory.Categories.SENSOR;
//   }

//   getAccessoryInformation(deviceSid) {
//     return {
//       Manufacturer: "Aqara",
//       Model: "Temperature And Humidity Sensor",
//       SerialNumber: deviceSid,
//     };
//   }

//   getServices(jsonObj, accessoryName) {
//     var that = this;
//     var result = [];

//     var service = new that.Service.HumiditySensor(accessoryName);
//     service.getCharacteristic(that.Characteristic.CurrentRelativeHumidity);
//     result.push(service);

//     var batteryService = new that.Service.BatteryService(accessoryName);
//     batteryService.getCharacteristic(that.Characteristic.StatusLowBattery);
//     batteryService.getCharacteristic(that.Characteristic.BatteryLevel);
//     batteryService.getCharacteristic(that.Characteristic.ChargingState);
//     result.push(batteryService);

//     return result;
//   }

//   parserAccessories(jsonObj) {
//     var that = this;
//     var deviceSid = jsonObj["sid"];
//     var uuid = that.getAccessoryUUID(deviceSid);
//     var accessory = that.platform.AccessoryUtil.getByUUID(uuid);
//     if (accessory) {
//       var service = accessory.getService(that.Service.HumiditySensor);
//       var currentRelativeHumidityCharacteristic = service.getCharacteristic(
//         that.Characteristic.CurrentRelativeHumidity
//       );
//       var value = that.getCurrentRelativeHumidityCharacteristicValue(
//         jsonObj,
//         null
//       );
//       if (null != value) {
//         currentRelativeHumidityCharacteristic.updateValue(value);
//       }

//       if (
//         that.platform.ConfigUtil.getAccessorySyncValue(
//           deviceSid,
//           that.accessoryType
//         )
//       ) {
//         if (
//           currentRelativeHumidityCharacteristic.listeners("get").length == 0
//         ) {
//           currentRelativeHumidityCharacteristic.on("get", function (callback) {
//             var command = '{"cmd":"read", "sid":"' + deviceSid + '"}';
//             that.platform
//               .sendReadCommand(deviceSid, command)
//               .then((result) => {
//                 var value = that.getCurrentRelativeHumidityCharacteristicValue(
//                   result,
//                   null
//                 );
//                 if (null != value) {
//                   callback(null, value);
//                 } else {
//                   callback(new Error("get value fail: " + result));
//                 }
//               })
//               .catch(function (err) {
//                 that.platform.log.error(err);
//                 callback(err);
//               });
//           });
//         }
//       }

//       that.parserBatteryService(accessory, jsonObj);
//     }
//   }

//   getCurrentRelativeHumidityCharacteristicValue(jsonObj, defaultValue) {
//     var value = this.getValueFrJsonObjData(jsonObj, "humidity");
//     return null != value ? value / 100.0 : defaultValue;
//   }
// }