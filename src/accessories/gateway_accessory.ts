import {
  AccessoryPlugin,
  GatewayAccessory,
  ReportMessage,
  HeartbeatMessage,
} from "./types";
import {
  Categories,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  Characteristic,
  Service,
  CharacteristicValue,
  CharacteristicSetCallback,
} from "homebridge";
import { rgb, hsl } from "color-convert";
import { RGB } from "color-convert/conversions";

const Accessory: AccessoryPlugin = {
  name: "Gateway",
  category: Categories.LIGHTBULB,
  information: {
    manufacturer: "Aqara",
    model: "Gateway",
  },
};

interface GatewayData {
  rgb?: number;
  illumination?: number;
}

function deserializeRgb(rawValue: number): { rgb: RGB; brightness: number } {
  return {
    brightness: (rawValue & 0xff000000) >> 24,
    rgb: [
      (rawValue & 0xff0000) >> 16,
      (rawValue & 0x00ff00) >> 8,
      rawValue & 0x0000ff,
    ],
  };
}

function serializeRgb([r, g, b]: RGB, brightness: number): number {
  return (brightness << 24) | (r << 16) | (g << 8) | b;
}

type SecurityState = "on" | "off";

class Gateway extends GatewayAccessory {
  private status: {
    illumination: number;
    rgb: RGB;
    brightness: number;
    securityState: SecurityState;
  } = { illumination: 0, rgb: [0, 0, 0], brightness: 0, securityState: "off" };
  private interval: NodeJS.Timeout | undefined;
  private lightSensor: Service | undefined;
  private ligthbulb: Service | undefined;
  private securitySystem: Service | undefined;

  init() {
    this.client.on("report", this.handleMessage);
    this.client.on("heartbeat", this.handleMessage);
    const interval = setInterval(async () => {
      const {
        result: [state],
      } = await this.miioClient!.send<[], [SecurityState]>("get_arming", []);
      if (this.status.securityState === state) {
        return;
      }
      this.updateStatus(undefined, { securityState: state });
    }, 3000);
    this.homebridge.on("shutdown", () => {
      clearInterval(interval);
    });
    this.readCurrentStatus();
  }

  handleMessage = (
    message: ReportMessage<GatewayData> | HeartbeatMessage<GatewayData>
  ) => {
    const { cmd, data, sid } = message;
    if (sid !== this.config.serialId) {
      return;
    }
    this.updateStatus(data);
    if (cmd === "report") {
      if (this.interval) {
        clearInterval(this.interval);
      }
      let countdown = 10;
      this.interval = setInterval(async () => {
        if (countdown-- === 0) {
          return clearInterval(this.interval as NodeJS.Timeout);
        }
        this.readCurrentStatus();
      }, 2000);
    }
  };

  readCurrentStatus = async () => {
    const message = await this.read<GatewayData>();
    this.updateStatus(message.data);
  };

  private updateStatus = (
    aqaraStatus: GatewayData = {},
    miioStatus: { securityState?: SecurityState } = {}
  ) => {
    const { illumination, rgb: rgbValue } = aqaraStatus;
    const lightbulbInfo = rgbValue ? deserializeRgb(rgbValue) : undefined;
    this.status = {
      illumination: illumination
        ? illumination - 279
        : this.status.illumination,
      rgb: lightbulbInfo?.rgb ?? this.status.rgb,
      brightness: lightbulbInfo?.brightness ?? this.status.brightness,
      securityState: miioStatus.securityState ?? this.status.securityState,
    };
    this.logger.debug(
      "security: %s, illumination %s, brightness: %s, r: %s, g: %s, b: %s",
      this.status.securityState,
      this.status.illumination,
      this.status.brightness,
      this.status.rgb[0],
      this.status.rgb[1],
      this.status.rgb[2]
    );
    const hslValue = rgb.hsl(this.status.rgb);
    this.lightSensor?.updateCharacteristic(
      Characteristic.CurrentAmbientLightLevel,
      this.status.illumination
    );
    this.ligthbulb
      ?.updateCharacteristic(Characteristic.On, this.status.brightness !== 0)
      .updateCharacteristic(Characteristic.Brightness, this.status.brightness)
      .updateCharacteristic(Characteristic.Hue, hslValue[0])
      .updateCharacteristic(Characteristic.Saturation, hslValue[1]);
  };

  private readonly getCurrentAmbientLightLevel = (
    callback: CharacteristicGetCallback
  ) => {
    callback(null, this.status.illumination);
  };

  private readonly getOn = (callback: CharacteristicGetCallback) => {
    callback(null, this.status.brightness !== 0);
  };

  private readonly getSaturation = (callback: CharacteristicGetCallback) => {
    callback(null, rgb.hsl(this.status.rgb)[1]);
  };

  private readonly getHue = (callback: CharacteristicGetCallback) => {
    callback(null, rgb.hsl(this.status.rgb)[0]);
  };

  private readonly getBrightness = (callback: CharacteristicGetCallback) => {
    callback(null, this.status.brightness);
  };

  private readonly getSecuritySystemCurrentState = (
    callback: CharacteristicGetCallback
  ) => {
    // TODO(Benji): Add alarm triggered event
    callback(
      null,
      this.status.securityState === "on"
        ? Characteristic.SecuritySystemCurrentState.AWAY_ARM
        : Characteristic.SecuritySystemCurrentState.DISARMED
    );
  };

  private readonly getSecuritySystemTargetState = (
    callback: CharacteristicGetCallback
  ) => {
    callback(
      null,
      this.status.securityState === "on"
        ? Characteristic.SecuritySystemTargetState.AWAY_ARM
        : Characteristic.SecuritySystemTargetState.DISARM
    );
  };

  private readonly setOn = async (
    value: CharacteristicValue,
    callback: CharacteristicSetCallback
  ) => {
    try {
      const { rgb, brightness } = this.status;
      if ((value && brightness !== 0) || (!value && brightness === 0)) {
        return callback(null);
      }
      const newBrightness = value ? brightness ?? 100 : 0;
      const newStatus = { rgb: serializeRgb(rgb, newBrightness) };
      this.updateStatus(newStatus);
      await this.write<GatewayData, GatewayData>(newStatus);
      callback(null);
    } catch (err) {
      callback(err);
    }
  };

  private readonly setBrightness = async (
    value: CharacteristicValue,
    callback: CharacteristicSetCallback
  ) => {
    try {
      if (value === this.status.brightness) {
        return callback(null);
      }
      const newStatus = { rgb: serializeRgb(this.status.rgb, value as number) };
      this.updateStatus(newStatus);
      await this.write<GatewayData, GatewayData>(newStatus);
      callback(null);
    } catch (err) {
      callback(err);
    }
  };

  private readonly setSaturation = async (
    value: CharacteristicValue,
    callback: CharacteristicSetCallback
  ) => {
    try {
      const { rgb: rgbValue, brightness } = this.status;
      const hslValue = rgb.hsl(rgbValue);
      hslValue[1] = value as number;
      const newRgb = hsl.rgb(hslValue);
      if (newRgb.every((color, index) => color === rgbValue[index])) {
        return callback(null);
      }
      const newStatus = { rgb: serializeRgb(newRgb, brightness) };
      this.updateStatus(newStatus);
      await this.write<GatewayData, GatewayData>(newStatus);
      callback(null);
    } catch (err) {
      callback(err);
    }
  };

  private readonly setHue = async (
    value: CharacteristicValue,
    callback: CharacteristicSetCallback
  ) => {
    try {
      const { rgb: rgbValue, brightness } = this.status;
      const hslValue = rgb.hsl(rgbValue);
      hslValue[0] = value as number;
      const newRgb = hsl.rgb(hslValue);
      this.logger.debug("old: %s, new: %s", rgbValue, newRgb);
      if (newRgb.every((color, index) => color === rgbValue[index])) {
        this.logger.debug("target state is already satisfied, skip");
        return callback(null);
      }
      const newStatus = { rgb: serializeRgb(newRgb, brightness) };
      this.updateStatus(newStatus);
      await this.write<GatewayData, GatewayData>(newStatus);
      callback(null);
    } catch (err) {
      this.logger.error(err);
      callback(err);
    }
  };

  private readonly setSecuritySystemTargetState = async (
    value: CharacteristicValue,
    callback: CharacteristicSetCallback
  ) => {
    try {
      let newState: SecurityState;
      switch (value) {
        case Characteristic.SecuritySystemTargetState.AWAY_ARM:
          newState = "on";
          break;
        case Characteristic.SecuritySystemTargetState.DISARM:
          newState = "off";
          break;
        default:
          throw new Error("Invalid target state: " + value);
      }
      await this.miioClient!.simpleSend("set_arming", [newState]);
      this.updateStatus(undefined, { securityState: newState });
      callback(null);
    } catch (err) {
      callback(err);
    }
  };

  getAccessory() {
    const { Service, Characteristic } = this.homebridge.hap;
    const accessory = this.createAccessory(Accessory);
    this.lightSensor = accessory.addService(Service.LightSensor);
    this.lightSensor
      .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
      .on(CharacteristicEventTypes.GET, this.getCurrentAmbientLightLevel);
    this.ligthbulb = accessory.addService(Service.Lightbulb);
    this.ligthbulb
      .getCharacteristic(Characteristic.On)
      .on(CharacteristicEventTypes.GET, this.getOn)
      .on(CharacteristicEventTypes.SET, this.setOn);
    this.ligthbulb
      .getCharacteristic(Characteristic.Brightness)
      .on(CharacteristicEventTypes.GET, this.getBrightness)
      .on(CharacteristicEventTypes.SET, this.setBrightness);
    this.ligthbulb
      .getCharacteristic(Characteristic.Saturation)
      .on(CharacteristicEventTypes.GET, this.getSaturation)
      .on(CharacteristicEventTypes.SET, this.setSaturation);
    this.ligthbulb
      .getCharacteristic(Characteristic.Hue)
      .on(CharacteristicEventTypes.GET, this.getHue)
      .on(CharacteristicEventTypes.SET, this.setHue);
    this.securitySystem = accessory.addService(Service.SecuritySystem);
    this.securitySystem
      .getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .on(CharacteristicEventTypes.GET, this.getSecuritySystemCurrentState);
    this.securitySystem
      .getCharacteristic(Characteristic.SecuritySystemTargetState)
      .setProps({
        validValues: [
          Characteristic.SecuritySystemTargetState.AWAY_ARM,
          Characteristic.SecuritySystemTargetState.DISARM,
        ],
      })
      .on(CharacteristicEventTypes.GET, this.getSecuritySystemTargetState)
      .on(CharacteristicEventTypes.SET, this.setSecuritySystemTargetState);
    return accessory;
  }
}

export default Gateway;
