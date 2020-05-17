import { AccessoryPlugin, GatewayAccessory } from "./types";
import {
  Categories,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  Characteristic,
  Service,
} from "homebridge";
import {
  AqaraDeviceHeartbeatParsedMessage,
  AqaraReportParsedMessage,
  AqaraReadAckParsedMessage,
} from "../aqara_service/types";

const Accessory: AccessoryPlugin = {
  name: "Programmable Switch",
  category: Categories.PROGRAMMABLE_SWITCH,
  information: {
    manufacturer: "Aqara",
    model: "Programmable Switch",
  },
};

interface SwitchData {
  status?: "long_click_release" | "long_click_press" | "double_click" | "click";
  no_motion?: string;
  voltage?: number;
}

const BATTERY_REQUEST_INTERVAL = 60000 * 60;

const LOW_BATTERY_VOLTAGE = 2800;
class ProgrammableSwitch extends GatewayAccessory {
  private status: { voltage: number } = { voltage: 0 };
  private programmableSwitch: Service | undefined;

  init() {
    this.client.on("report", this.handleMessage);
    this.client.on("heartbeat", this.handleMessage);
    this.updateBatteryStatus();
    const interval = setInterval(
      () => this.updateBatteryStatus(),
      BATTERY_REQUEST_INTERVAL
    );
    this.homebridge.on("shutdown", () => {
      clearInterval(interval);
    });
  }

  private updateBatteryStatus = async () => {
    const message = await this.read<SwitchData>();
    this.handleMessage(message);
  };

  handleMessage = (
    message:
      | AqaraDeviceHeartbeatParsedMessage<SwitchData>
      | AqaraReportParsedMessage<SwitchData>
      | AqaraReadAckParsedMessage<SwitchData>
  ) => {
    const { data, sid } = message;
    if (sid !== this.config.serialId) {
      return;
    }
    this.updateStatus(typeof data === "string" ? JSON.parse(data) : data);
  };

  private updateStatus = (aqaraStatus: SwitchData) => {
    const { status, voltage } = aqaraStatus;
    switch (status) {
      case "click":
        this.programmableSwitch?.updateCharacteristic(
          Characteristic.ProgrammableSwitchEvent,
          Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS
        );
        break;
      case "double_click":
        this.programmableSwitch?.updateCharacteristic(
          Characteristic.ProgrammableSwitchEvent,
          Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS
        );
        break;
      case "long_click_press":
        this.programmableSwitch?.updateCharacteristic(
          Characteristic.ProgrammableSwitchEvent,
          Characteristic.ProgrammableSwitchEvent.LONG_PRESS
        );
        break;
    }
    if (voltage) {
      this.status.voltage = voltage;
    }
    this.logger.debug(
      "programmable swich triggered: %s, voltage: %s",
      status,
      this.status.voltage
    );
    this.programmableSwitch?.updateCharacteristic(
      Characteristic.StatusLowBattery,
      this.status.voltage < LOW_BATTERY_VOLTAGE
        ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
        : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
    );
  };

  private readonly getStatusLowBattery = (
    callback: CharacteristicGetCallback
  ) => {
    callback(
      null,
      this.status.voltage < LOW_BATTERY_VOLTAGE
        ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
        : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
    );
  };

  getAccessory() {
    const { Service, Characteristic } = this.homebridge.hap;
    const accessory = this.createAccessory(Accessory);
    this.programmableSwitch = accessory.addService(
      Service.StatelessProgrammableSwitch
    );
    this.programmableSwitch.addOptionalCharacteristic(
      Characteristic.StatusLowBattery
    );
    this.programmableSwitch
      .getCharacteristic(Characteristic.StatusLowBattery)
      .on(CharacteristicEventTypes.GET, this.getStatusLowBattery);

    return accessory;
  }
}

export default ProgrammableSwitch;
