import { AccessoryPlugin, GatewayAccessory } from "./types";
import {
  Categories,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  Characteristic,
  Service,
} from "homebridge";
import {
  AqaraReportParsedMessage,
  AqaraDeviceHeartbeatParsedMessage,
  AqaraReadAckParsedMessage,
} from "../aqara_service/types";

const Accessory: AccessoryPlugin = {
  name: "Motion Sensor",
  category: Categories.SENSOR,
  information: {
    manufacturer: "Aqara",
    model: "Motion Sensor",
  },
};

interface MotionData {
  status?: "motion";
  no_motion?: string;
  voltage?: number;
}

const BATTERY_REQUEST_INTERVAL = 60000 * 60;

const LOW_BATTERY_VOLTAGE = 2800;
class MotionSensor extends GatewayAccessory {
  private status: {
    motionDetected: boolean;
    voltage: number;
  } = { motionDetected: false, voltage: 0 };
  private motionSensor: Service | undefined;

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
    const message = await this.read<MotionData>();
    this.handleMessage(message);
  };

  handleMessage = (
    message:
      | AqaraReportParsedMessage<MotionData>
      | AqaraDeviceHeartbeatParsedMessage<MotionData>
      | AqaraReadAckParsedMessage<MotionData>
  ) => {
    const { data, sid } = message;
    if (sid !== this.config.serialId) {
      return;
    }
    this.updateStatus(typeof data === "string" ? JSON.parse(data) : data);
  };

  private updateStatus = (aqaraStatus: MotionData) => {
    const { status, no_motion, voltage } = aqaraStatus;
    if (status && status === "motion") {
      this.status.motionDetected = true;
    } else if (no_motion) {
      this.status.motionDetected = false;
    }
    if (voltage) {
      this.status.voltage = voltage;
    }
    this.logger.debug(
      "motion sensor motion detected: %s, voltage: %s",
      this.status.motionDetected,
      this.status.voltage
    );
    this.motionSensor?.updateCharacteristic(
      Characteristic.MotionDetected,
      this.status.motionDetected
    );
    this.motionSensor?.updateCharacteristic(
      Characteristic.StatusLowBattery,
      this.status.voltage < LOW_BATTERY_VOLTAGE
        ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
        : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
    );
  };

  private readonly getMotionDetected = (
    callback: CharacteristicGetCallback
  ) => {
    callback(null, this.status.motionDetected);
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
    this.motionSensor = accessory.addService(Service.MotionSensor);
    this.motionSensor
      .getCharacteristic(Characteristic.MotionDetected)
      .on(CharacteristicEventTypes.GET, this.getMotionDetected);
    this.motionSensor
      .getCharacteristic(Characteristic.StatusLowBattery)
      .on(CharacteristicEventTypes.GET, this.getStatusLowBattery);

    return accessory;
  }
}

export default MotionSensor;
