import DeviceParser from "./DeviceParser";
import AccessoryParser from "./AccessoryParser";
import { Platform } from "./types";
import {
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicValue,
  CharacteristicSetCallback,
  Characteristic,
} from "homebridge";
import { rgb, hsl } from "color-convert";

import { MiIOClient } from "../miio/client";
import { MiIODevice } from "../miio/device";

const client = new MiIOClient();

class GatewayParser extends DeviceParser {
  static readonly modelName = ["gateway", "gateway.v3"];
  static readonly isGateway = true;

  constructor(platform: Platform) {
    super(platform);
  }

  getAccessoriesParserInfo() {
    return {
      //   Gateway_Lightbulb: GatewayLightbulbParser,
      Gateway_LightSensor: GatewayLightSensorParser,
      //   Gateway_Switch_JoinPermission: GatewaySwitchJoinPermissionParser,
    };
  }
}
module.exports = GatewayParser;

class GatewayLightSensorParser extends AccessoryParser {
  private device: MiIODevice | null = null;

  getAccessoryCategory() {
    return this.Accessory.Categories.SENSOR;
  }

  getAccessoryInformation(deviceSid: string) {
    return {
      Manufacturer: "Aqara",
      Model: "Gateway",
      SerialNumber: deviceSid,
    };
  }

  getServices(_: any, accessoryName: string) {
    const { Service, platform } = this;
    // @ts-ignore
    const lightSensor = new Service.LightSensor(accessoryName);
    const lightService = new Service.Lightbulb(accessoryName);
    const securityService = new Service.SecuritySystem(accessoryName);
    const smartSpeaker = new Service.SmartSpeaker(accessoryName);

    return [lightSensor, lightService, securityService];
  }

  parserAccessories(jsonObj: any) {
    const deviceSid = jsonObj["sid"];
    const uuid = this.getAccessoryUUID(deviceSid);
    const accessory = this.platform.AccessoryUtil.getByUUID(uuid);
    // @ts-ignore
    const { ip, miioToken } = this.platform.GatewayUtil.getBySid(deviceSid);
    this.device = new MiIODevice(client, miioToken, ip, 54321);

    if (accessory) {
      this.parseLightSensor(jsonObj);
      this.parserLightService(jsonObj);
      this.parserSecurity(jsonObj);
    }
  }

  private parseLightSensor(jsonObj: any) {
    const deviceSid = jsonObj["sid"];
    const uuid = this.getAccessoryUUID(deviceSid);
    const accessory = this.platform.AccessoryUtil.getByUUID(uuid);
    if (accessory) {
      const service = accessory.getService(this.Service.LightSensor);

      var currentAmbientLightLevelCharacteristic = service!.getCharacteristic(
        this.Characteristic.CurrentAmbientLightLevel
      );
      var value = this.getCurrentAmbientLightLevelCharacteristicValue(jsonObj);
      if (null != value) {
        currentAmbientLightLevelCharacteristic.updateValue(value);
      }

      // @ts-ignore
      if (
        this.platform.ConfigUtil.getAccessorySyncValue(
          deviceSid,
          this.accessoryType
        )
      ) {
        if (
          currentAmbientLightLevelCharacteristic.listeners(
            CharacteristicEventTypes.GET
          ).length == 0
        ) {
          currentAmbientLightLevelCharacteristic.on(
            CharacteristicEventTypes.GET,
            (callback: CharacteristicGetCallback) => {
              var command = '{"cmd":"read", "sid":"' + deviceSid + '"}';
              this.platform
                // @ts-ignore
                .sendReadCommand(deviceSid, command)
                .then((result: any) => {
                  var value = this.getCurrentAmbientLightLevelCharacteristicValue(
                    result
                  );
                  if (null != value) {
                    callback(null, value);
                  } else {
                    callback(new Error("get value fail: " + result));
                  }
                })
                .catch((err: Error) => {
                  this.platform.log.error(err);
                  callback(err);
                });
            }
          );
        }
      }
    }
  }

  private parserSecurity(jsonObj: any) {
    const deviceSid = jsonObj["sid"];
    const { Service, platform } = this;
    const uuid = this.getAccessoryUUID(deviceSid);
    const accessory = platform.AccessoryUtil.getByUUID(uuid);

    if (accessory) {
      const securityService = accessory.getService(Service.SecuritySystem)!;
      const securitySystemCurrentState = securityService
        .getCharacteristic(Characteristic.SecuritySystemCurrentState)
        .setProps({ validValues: [1, 3] });

      if (
        securitySystemCurrentState.listenerCount(
          CharacteristicEventTypes.GET
        ) === 0
      ) {
        securityService
          .getCharacteristic(Characteristic.SecuritySystemCurrentState)
          .on(
            CharacteristicEventTypes.GET,
            (callback: CharacteristicGetCallback) => {
              this.device!.send<[], ["on" | "off"]>("get_arming", [])
                .then(({ result }) => {
                  if (result[0] === "on") {
                    callback(
                      null,
                      Characteristic.SecuritySystemCurrentState.AWAY_ARM
                    );
                  } else if (result[0] === "off") {
                    callback(
                      null,
                      Characteristic.SecuritySystemCurrentState.DISARMED
                    );
                  } else {
                    callback(new Error(result[0]));
                  }
                })
                .catch((err: Error) => {
                  this.platform.log.error(
                    "[MiGateway][ERROR]get Current Security Error: " + err
                  );
                  callback(err);
                });
            }
          ).value = Characteristic.SecuritySystemCurrentState.DISARMED;
      }

      const securitySystemTargetStateChar = securityService
        .getCharacteristic(Characteristic.SecuritySystemTargetState)
        .setProps({ validValues: [1, 3] });
      if (
        securitySystemTargetStateChar.listenerCount(
          CharacteristicEventTypes.GET
        ) === 0
      ) {
        securitySystemTargetStateChar.on(
          CharacteristicEventTypes.GET,
          (callback: CharacteristicGetCallback) => {
            this.device!.send<[], ["on" | "off"]>("get_arming", [])
              .then(({ result }) => {
                if (result[0] === "on") {
                  callback(
                    null,
                    Characteristic.SecuritySystemTargetState.AWAY_ARM
                  );
                } else if (result[0] === "off") {
                  callback(
                    null,
                    Characteristic.SecuritySystemTargetState.DISARM
                  );
                } else {
                  callback(new Error(result[0]));
                }
              })
              .catch((err: Error) => {
                this.platform.log.error(
                  "[MiGateway][ERROR]get target Security Error: " + err
                );
                callback(err);
              });
          }
        );
      }

      if (
        securitySystemTargetStateChar.listenerCount(
          CharacteristicEventTypes.SET
        ) === 0
      ) {
        securitySystemTargetStateChar.on(
          CharacteristicEventTypes.SET,
          (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
            let val = "off";
            if (Characteristic.SecuritySystemCurrentState.AWAY_ARM == value) {
              val = "on";
            } else if (
              Characteristic.SecuritySystemCurrentState.DISARMED == value
            ) {
              val = "off";
            } else {
              val = "off";
            }
            this.device?.simpleSend("set_arming", [val])
              .then(() => callback())
              .catch((err: Error) => {
              this.platform.log.error(
                "[MiGateway][ERROR] set Target Security Error: " + err
              );
              callback(err);
            });
          }
        ).value = Characteristic.SecuritySystemTargetState.DISARM;
      }
    }
  }

  getCurrentAmbientLightLevelCharacteristicValue(
    jsonObj: any,
    defaultValue: number = 0
  ): number {
    var value = this.getValueFrJsonObjData(jsonObj, "illumination");
    if (null != value) {
      var illumination = value / 1.0 - 279;
      if (!isNaN(illumination)) {
        return illumination > 0 ? illumination : 0.0001;
      } else {
        return 0.0001;
      }
    } else {
      return defaultValue;
    }
  }

  private parserLightService(jsonObj: any) {
    const deviceSid = jsonObj["sid"];
    const uuid = this.getAccessoryUUID(deviceSid);
    const accessory = this.platform.AccessoryUtil.getByUUID(uuid);
    const lightService = accessory
      ? accessory.getService(this.Service.Lightbulb)
      : undefined;
    if (lightService) {
      const onChar = lightService.getCharacteristic(Characteristic.On);
      const switchValue = this.getSwitchCharacteristicValue(jsonObj, false);
      if (null != onChar) {
        onChar.updateValue(switchValue);
      }

      const brightnessChar = lightService.getCharacteristic(
        Characteristic.Brightness
      );
      const brightnessValue = this.getBrightnessCharacteristicValue(jsonObj, 0);
      if (null != brightnessValue && brightnessValue > 0) {
        brightnessChar.updateValue(brightnessValue);
      }

      const hueChar = lightService.getCharacteristic(Characteristic.Hue);
      const hueValue = this.getHueCharacteristicValue(jsonObj, null);
      if (null != hueValue && hueValue > 0) {
        hueChar.updateValue(hueValue);
      }

      const saturationChar = lightService.getCharacteristic(
        Characteristic.Saturation
      );
      const saturationValue = this.getSaturationCharacteristicValue(
        jsonObj,
        null
      );
      if (null != saturationValue && saturationValue > 0) {
        saturationChar.updateValue(saturationValue);
      }

      if (
        this.platform.ConfigUtil.getAccessorySyncValue(
          deviceSid,
          this.accessoryType
        )
      ) {
        if (onChar.listeners(CharacteristicEventTypes.GET).length == 0) {
          onChar.on(
            CharacteristicEventTypes.GET,
            (callback: CharacteristicGetCallback) => {
              var command = '{"cmd":"read", "sid":"' + deviceSid + '"}';
              this.platform
                // @ts-ignore
                .sendReadCommand(deviceSid, command)
                // @ts-ignore
                .then((result) => {
                  var value = this.getSwitchCharacteristicValue(result, false);
                  if (null != value) {
                    callback(null, value);
                  } else {
                    callback(new Error("get value fail: " + result));
                  }
                })
                .catch((err: Error) => {
                  this.platform.log.error(err);
                  callback(err);
                });
            }
          );
        }

        if (
          brightnessChar.listeners(CharacteristicEventTypes.GET).length == 0
        ) {
          brightnessChar.on(
            CharacteristicEventTypes.GET,
            (callback: CharacteristicGetCallback) => {
              var command = '{"cmd":"read", "sid":"' + deviceSid + '"}';
              this.platform
                // @ts-ignore
                .sendReadCommand(deviceSid, command)
                // @ts-ignore
                .then((result) => {
                  var value = this.getBrightnessCharacteristicValue(result, 0);
                  if (null != value) {
                    if (value > 0) {
                      callback(null, value);
                    } else {
                      callback(null, brightnessChar.value);
                    }
                  } else {
                    callback(new Error("get value fail: " + result));
                  }
                })
                .catch((err: Error) => {
                  this.platform.log.error(err);
                  callback(err);
                });
            }
          );
        }

        if (hueChar.listeners(CharacteristicEventTypes.GET).length == 0) {
          hueChar.on(
            CharacteristicEventTypes.GET,
            (callback: CharacteristicGetCallback) => {
              var command = '{"cmd":"read", "sid":"' + deviceSid + '"}';
              this.platform
                // @ts-ignore
                .sendReadCommand(deviceSid, command)
                // @ts-ignore
                .then((result) => {
                  var value = this.getHueCharacteristicValue(result, null);
                  if (null != value) {
                    if (value > 0) {
                      callback(null, value);
                    } else {
                      callback(null, hueChar.value);
                    }
                  } else {
                    callback(new Error("get value fail: " + result));
                  }
                })
                .catch((err: Error) => {
                  this.platform.log.error(err);
                  callback(err);
                });
            }
          );
        }

        if (
          saturationChar.listeners(CharacteristicEventTypes.GET).length == 0
        ) {
          saturationChar.on(
            CharacteristicEventTypes.GET,
            (callback: CharacteristicGetCallback) => {
              var command = '{"cmd":"read", "sid":"' + deviceSid + '"}';
              this.platform
                // @ts-ignore

                .sendReadCommand(deviceSid, command)
                // @ts-ignore
                .then((result) => {
                  var value = this.getSaturationCharacteristicValue(
                    result,
                    null
                  );
                  if (null != value) {
                    if (value > 0) {
                      callback(null, value);
                    } else {
                      callback(null, saturationChar.value);
                    }
                  } else {
                    callback(new Error("get value fail: " + result));
                  }
                })
                .catch((err: Error) => {
                  this.platform.log.error(err);
                  callback(err);
                });
            }
          );
        }
      }

      if (onChar.listeners(CharacteristicEventTypes.SET).length == 0) {
        onChar.on(
          CharacteristicEventTypes.SET,
          (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
            //          that.platform.log.debug("[MiAqaraPlatform][DEBUG]switch: " + value);
            if (value == 1 || value == true) {
              // set by home is 0/1, set by siri is true/false
              this.controlLight(
                deviceSid,
                true,
                hueChar.value,
                saturationChar.value,
                brightnessChar.value
              )
                .then((result) => {
                  this.callback2HB(deviceSid, onChar, callback);
                })
                .catch((err: Error) => {
                  this.platform.log.error(err);
                  this.callback2HB(deviceSid, onChar, callback, err);
                });
            } else {
              this.controlLight(deviceSid, false, null, null, null)
                .then((result) => {
                  this.callback2HB(deviceSid, onChar, callback);
                })
                .catch((err: Error) => {
                  this.platform.log.error(err);
                  this.callback2HB(deviceSid, onChar, callback, err);
                });
            }
          }
        );
      }

      if (brightnessChar.listeners(CharacteristicEventTypes.SET).length == 0) {
        brightnessChar.on(
          CharacteristicEventTypes.SET,
          (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
            //          that.platform.log.debug("[MiAqaraPlatform][DEBUG]brightness: " + value);
            if (value > 0) {
              var tmp = brightnessChar.value;
              brightnessChar.value = value;
              this.controlLight(
                deviceSid,
                true,
                hueChar.value,
                saturationChar.value,
                value
              )
                .then((result) => {
                  this.callback2HB(deviceSid, brightnessChar, callback);
                })
                .catch((err: Error) => {
                  brightnessChar.value = tmp;
                  this.platform.log.error(err);
                  this.callback2HB(deviceSid, brightnessChar, callback, err);
                });
            } else {
              this.callback2HB(deviceSid, brightnessChar, callback);
            }
          }
        );
      }

      if (hueChar.listeners(CharacteristicEventTypes.SET).length == 0) {
        hueChar.on(
          CharacteristicEventTypes.SET,
          (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
            //          that.platform.log.debug("[MiAqaraPlatform][DEBUG]hue: " + value);
            var tmp = hueChar.value;
            hueChar.value = value;
            this.controlLight(
              deviceSid,
              true,
              value,
              saturationChar.value,
              brightnessChar.value
            )
              .then((result) => {
                this.callback2HB(deviceSid, hueChar, callback);
              })
              .catch((err: Error) => {
                hueChar.value = tmp;
                this.platform.log.error(err);
                this.callback2HB(deviceSid, hueChar, callback, err);
              });
          }
        );
      }

      if (saturationChar.listeners(CharacteristicEventTypes.SET).length == 0) {
        saturationChar.on(
          CharacteristicEventTypes.SET,
          (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
            //          that.platform.log.debug("[MiAqaraPlatform][DEBUG]saturation: " + value);
            var tmp = saturationChar.value;
            saturationChar.value = value;
            this.controlLight(
              deviceSid,
              true,
              hueChar.value,
              value,
              brightnessChar.value
            )
              .then((result) => {
                this.callback2HB(deviceSid, saturationChar, callback);
              })
              .catch((err: Error) => {
                saturationChar.value = tmp;
                this.platform.log.error(err);
                this.callback2HB(deviceSid, saturationChar, callback, err);
              });
          }
        );
      }
    }
  }

  getSwitchCharacteristicValue(jsonObj: any, defaultValue: boolean) {
    var rawRgb = this.getValueFrJsonObjData(jsonObj, "rgb");
    if (null != rawRgb) {
      if (0 != rawRgb) {
        return true;
      } else {
        return false;
      }
    } else {
      return defaultValue;
    }
  }

  getBrightnessCharacteristicValue(jsonObj: any, defaultValue: number) {
    var rawRgb = this.getValueFrJsonObjData(jsonObj, "rgb");
    if (null != rawRgb) {
      if (0 != rawRgb) {
        return parseMiRgb(rawRgb).brightness;
      } else {
        return 0;
      }
    } else {
      return defaultValue;
    }
  }

  getHueCharacteristicValue(
    jsonObj: any,
    defaultValue: number | null
  ): null | number {
    var rawRgb = this.getValueFrJsonObjData(jsonObj, "rgb");
    if (null != rawRgb) {
      if (0 != rawRgb) {
        const {r, g, b} = parseMiRgb(rawRgb);
        return rgb.hsl([r, g, b])[0];
      } else {
        return 0;
      }
    } else {
      return defaultValue;
    }
  }

  getSaturationCharacteristicValue(
    jsonObj: any,
    defaultValue: number | null
  ): null | number {
    var rawRgb = this.getValueFrJsonObjData(jsonObj, "rgb");
    if (null != rawRgb) {
      if (0 != rawRgb) {
        const { r, g, b } = parseMiRgb(rawRgb);
        return rgb.hsl([r, g, b])[1];
      } else {
        return 0;
      }
    } else {
      return defaultValue;
    }
  }

  controlLight(
    deviceSid: string,
    power: boolean,
    hue: CharacteristicValue | null,
    saturation: CharacteristicValue | null,
    brightness: CharacteristicValue | null
  ) {
    var that = this;
    return new Promise((resolve, reject) => {
      var prepValue = 0;
      if (power) {
        if (!hue) {
          hue = 0;
        }
        if (!saturation) {
          saturation = 0 * 100;
        }
        if (!brightness) {
          brightness = 50;
        }

        const [red, green, blue] = hsl.rgb([
          hue as number,
          saturation as number,
          50,
        ]);
        prepValue =
          ((brightness as number) << 24) | (red << 16) | (green << 8) | blue;
      }

      var command =
        '{"cmd":"write","model":"gateway","sid":"' +
        deviceSid +
        '","data":"{\\"rgb\\":' +
        prepValue +
        ', \\"key\\": \\"${key}\\"}"}';
      if (
        that.platform.ConfigUtil.getAccessoryIgnoreWriteResult(
          deviceSid,
          that.accessoryType
        )
      ) {
        // @ts-ignore
        that.platform.sendWriteCommandWithoutFeedback(deviceSid, command);
        resolve(null);
      } else {
        that.platform
          // @ts-ignore
          .sendWriteCommand(deviceSid, command)
          // @ts-ignore
          .then((result) => {
            resolve(result);
          })
          .catch((err: Error) => {
            that.platform.log.error(err);
            reject(err);
          });
      }
    });
  }
}

function parseMiRgb(rawValue: number) {
  return {
    brightness: (rawValue & 0xff000000) >> 24,
    r:  (rawValue & 0xff0000) >> 16,
    g:  (rawValue & 0x00ff00) >> 8,
    b:  rawValue & 0x0000ff
  }
}

// class GatewayLightbulbParser extends AccessoryParser {
//   getAccessoryCategory() {
//     return this.Accessory.Categories.LIGHTBULB;
//   }
// }

// class GatewaySwitchJoinPermissionParser extends AccessoryParser {
//   joinPermissionTimeout: { [key: string]: NodeJS.Timeout } = {};

//   getAccessoryCategory() {
//     return this.Accessory.Categories.SWITCH;
//   }

//   getServices(_: any, accessoryName: string) {
//     const switchService = new this.Service.Switch(accessoryName);

//     return [switchService];
//   }

//   parserAccessories(jsonObj: any) {
//     var that = this;
//     var deviceSid = jsonObj["sid"];
//     var uuid = that.getAccessoryUUID(deviceSid);
//     var accessory = that.platform.AccessoryUtil.getByUUID(uuid);
//     if (accessory) {
//       var service = accessory.getService(that.Service.Switch)!;
//       var onCharacteristic = service.getCharacteristic(that.Characteristic.On);
//       // var value = that.getOnCharacteristicValue(jsonObj, null);
//       // if(null != value) {
//       // onCharacteristic.updateValue(value);
//       // }

//       // if(that.platform.ConfigUtil.getAccessorySyncValue(deviceSid, that.accessoryType)) {
//       // if (onCharacteristic.listeners(CharacteristicEventTypes.GET).length == 0) {
//       // onCharacteristic.on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
//       // var command = '{"cmd":"read", "sid":"' + deviceSid + '"}';
//       // that.platform.sendReadCommand(deviceSid, command).then(result => {
//       // var value = that.getOnCharacteristicValue(result, null);
//       // if(null != value) {
//       // callback(null, value);
//       // } else {
//       // callback(new Error('get value fail: ' + result));
//       // }
//       // }).catch((err: Error) => {
//       // that.platform.log.error(err);
//       // callback(err);
//       // });
//       // });
//       // }
//       // }

//       if (
//         onCharacteristic.listeners(CharacteristicEventTypes.SET).length == 0
//       ) {
//         onCharacteristic.on(
//           CharacteristicEventTypes.SET,
//           (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
//             clearTimeout(that.joinPermissionTimeout[deviceSid]);
//             var command =
//               '{"cmd":"write","model":"gateway","sid":"' +
//               deviceSid +
//               '","data":"{\\"join_permission\\":\\"' +
//               (value ? "yes" : "no") +
//               '\\", \\"key\\": \\"${key}\\"}"}';
//             // @ts-ignore
//             if (
//               that.platform.ConfigUtil.getAccessoryIgnoreWriteResult(
//                 deviceSid,
//                 that.accessoryType
//               )
//             ) {
//               // @ts-ignore
//               that.platform.sendWriteCommandWithoutFeedback(deviceSid, command);
//               that.callback2HB(deviceSid, onCharacteristic, callback, null);
//               if (value) {
//                 that.joinPermissionTimeout[deviceSid] = setTimeout(() => {
//                   onCharacteristic.updateValue(false);
//                 }, 30 * 1000);
//               }
//             } else {
//               that.platform
//                 // @ts-ignore
//                 .sendWriteCommand(deviceSid, command)
//                 .then((result: any) => {
//                   that.callback2HB(deviceSid, onCharacteristic, callback, null);
//                   if (value) {
//                     that.joinPermissionTimeout[deviceSid] = setTimeout(() => {
//                       onCharacteristic.updateValue(false);
//                     }, 30 * 1000);
//                   }
//                 })
//                 .catch((err: Error) => {
//                   that.platform.log.error(err);
//                   that.callback2HB(deviceSid, onCharacteristic, callback, err);
//                 });
//             }
//           }
//         );
//       }
//     }
//   }

//   // getOnCharacteristicValue(jsonObj, defaultValue) {
//   // var value = this.getValueFrJsonObjData(jsonObj, 'channel_0');
//   // if(value === 'on') {
//   // return true;
//   // } else if(value === 'off') {
//   // return false;
//   // } else {
//   // return defaultValue;
//   // }
//   // }
// }
