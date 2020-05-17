import { AccessoryPlugin, GatewayAccessory } from "./types";
import {
  AqaraReportParsedMessage,
  AqaraDeviceHeartbeatParsedMessage,
  AqaraReadAckParsedMessage,
} from "../aqara_service/types";
import {
  Service,
  Categories,
  CharacteristicGetCallback,
  CharacteristicEventTypes,
} from "homebridge";

const Accessory: AccessoryPlugin = {
  name: "Contact Sensor",
  category: Categories.SENSOR,
  information: {
    manufacturer: "Aqara",
    model: "Contact Sensor",
  },
};

interface ContactData {
  status?: "close" | "open";
  no_motion?: string;
  voltage?: number;
}

const BATTERY_REQUEST_INTERVAL = 60000 * 60;

const LOW_BATTERY_VOLTAGE = 2800;
class ContactSensor extends GatewayAccessory {
  private status: {
    status: "close" | "open";
    voltage: number;
  } = { voltage: 0, status: "close" };
  private contactSensor: Service | undefined;

  init() {
    this.client.on("report", this.handleMessage);
    this.client.on("heartbeat", this.handleMessage);
    const interval = setInterval(
      () => this.updateBatteryStatus(),
      BATTERY_REQUEST_INTERVAL
    );
    this.updateBatteryStatus();
    this.homebridge.on("shutdown", () => {
      clearInterval(interval);
    });
  }

  private updateBatteryStatus = async () => {
    const message = await this.read<ContactData>();
    this.handleMessage(message);
  };

  handleMessage = (
    message:
      | AqaraReportParsedMessage<ContactData>
      | AqaraDeviceHeartbeatParsedMessage<ContactData>
      | AqaraReadAckParsedMessage<ContactData>
  ) => {
    const { data, sid } = message;
    if (sid !== this.config.serialId) {
      return;
    }
    this.updateStatus(
      typeof data === "string" ? (JSON.parse(data) as ContactData) : data
    );
  };

  private updateStatus = (aqaraStatus: ContactData) => {
    const { status, voltage } = aqaraStatus;
    if (status) {
      this.status.status = status;
    }
    if (voltage) {
      this.status.voltage = voltage;
    }
    this.logger.debug(
      "contact sensor state: %s, voltage: %s",
      this.status.status,
      this.status.voltage
    );
    const { Characteristic } = this.homebridge.hap;
    this.contactSensor?.updateCharacteristic(
      Characteristic.ContactSensorState,
      this.status.status === "open"
        ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
        : Characteristic.ContactSensorState.CONTACT_DETECTED
    );
    this.contactSensor?.updateCharacteristic(
      Characteristic.StatusLowBattery,
      this.status.voltage < LOW_BATTERY_VOLTAGE
        ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
        : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
    );
  };

  private readonly getContactSensorState = (
    callback: CharacteristicGetCallback
  ) => {
    const { Characteristic } = this.homebridge.hap;

    callback(
      null,
      this.status.status === "open"
        ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
        : Characteristic.ContactSensorState.CONTACT_DETECTED
    );
  };

  private readonly getStatusLowBattery = (
    callback: CharacteristicGetCallback
  ) => {
    const { Characteristic } = this.homebridge.hap;
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
    this.contactSensor = accessory.addService(Service.ContactSensor);
    this.contactSensor
      .getCharacteristic(Characteristic.ContactSensorState)
      .on(CharacteristicEventTypes.GET, this.getContactSensorState);
    this.contactSensor
      .getCharacteristic(Characteristic.StatusLowBattery)
      .on(CharacteristicEventTypes.GET, this.getStatusLowBattery);

    return accessory;
  }
}

export default ContactSensor;
