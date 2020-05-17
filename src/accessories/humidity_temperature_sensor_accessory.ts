import { AccessoryPlugin, GatewayAccessory } from "./types";
import {
  Categories,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  Characteristic,
  Service,
} from "homebridge";
import {
  AqaraReadAckParsedMessage,
  AqaraReportParsedMessage,
  AqaraDeviceHeartbeatParsedMessage,
} from "../aqara_service/types";

const Accessory: AccessoryPlugin = {
  name: "Temperature and Humidity Sensor",
  category: Categories.SENSOR,
  information: {
    manufacturer: "Aqara",
    model: "Temperature and Humidity Sensor",
  },
};

interface HumidityTemperatureData {
  temperature: string;
  humidity: string;
  voltage?: number;
}

const TEMPERATURE_REQUEST_INTERVAL = 10000 * 60;

const LOW_BATTERY_VOLTAGE = 2800;
class MotionSensor extends GatewayAccessory {
  private status: {
    humidity: number;
    temperature: number;
    voltage: number;
  } = { humidity: 0, temperature: 0, voltage: 0 };
  private humiditySensor: Service | undefined;
  private temperatureSensor: Service | undefined;

  init() {
    this.client.on("report", this.handleMessage);
    this.client.on("heartbeat", this.handleMessage);
    this.updateBatteryStatus();
    const interval = setInterval(
      () => this.updateBatteryStatus(),
      TEMPERATURE_REQUEST_INTERVAL
    );
    this.homebridge.on("shutdown", () => {
      clearInterval(interval);
    });
  }

  private updateBatteryStatus = async () => {
    const message = await this.read<HumidityTemperatureData>();
    this.handleMessage(message);
  };

  handleMessage = (
    message:
      | AqaraReportParsedMessage<HumidityTemperatureData>
      | AqaraDeviceHeartbeatParsedMessage<HumidityTemperatureData>
      | AqaraReadAckParsedMessage<HumidityTemperatureData>
  ) => {
    const { data, sid } = message;
    if (sid !== this.getConfig().serialId) {
      return;
    }
    this.updateStatus(data);
  };

  private updateStatus = (aqaraStatus: HumidityTemperatureData) => {
    const { humidity, temperature, voltage } = aqaraStatus;
    if (humidity) {
      this.status.humidity = Math.round(parseInt(humidity, 10) * 0.1) * 0.1;
    }
    if (temperature) {
      this.status.temperature =
        Math.round(parseInt(temperature, 10) * 0.1) * 0.1;
    }
    if (voltage) {
      this.status.voltage = voltage;
    }
    this.logger.debug(
      "humidity temperature sensor: temperature %s, humidity: %s, voltage: %s",
      this.status.temperature,
      this.status.humidity,
      this.status.voltage
    );
    const { Characteristic } = this.homebridge.hap;

    this.temperatureSensor?.updateCharacteristic(
      Characteristic.CurrentTemperature,
      this.status.temperature
    );
    this.humiditySensor?.updateCharacteristic(
      Characteristic.CurrentRelativeHumidity,
      this.status.humidity
    );
    this.humiditySensor?.updateCharacteristic(
      Characteristic.StatusLowBattery,
      this.status.voltage < LOW_BATTERY_VOLTAGE
        ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
        : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
    );
    this.temperatureSensor?.updateCharacteristic(
      Characteristic.StatusLowBattery,
      this.status.voltage < LOW_BATTERY_VOLTAGE
        ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
        : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
    );
  };

  private readonly getCurrentRelativeHumidity = (
    callback: CharacteristicGetCallback
  ) => {
    callback(null, this.status.humidity);
  };

  private readonly getCurrentTemperature = (
    callback: CharacteristicGetCallback
  ) => {
    callback(null, this.status.temperature);
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
    this.humiditySensor = accessory.addService(Service.HumiditySensor);
    this.humiditySensor
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .on(CharacteristicEventTypes.GET, this.getCurrentRelativeHumidity);
    this.humiditySensor
      .getCharacteristic(Characteristic.StatusLowBattery)
      .on(CharacteristicEventTypes.GET, this.getStatusLowBattery);

    this.temperatureSensor = accessory.addService(Service.TemperatureSensor);
    this.temperatureSensor
      .getCharacteristic(Characteristic.CurrentTemperature)
      .on(CharacteristicEventTypes.GET, this.getCurrentTemperature);
    this.temperatureSensor
      .getCharacteristic(Characteristic.StatusLowBattery)
      .on(CharacteristicEventTypes.GET, this.getStatusLowBattery);
    return accessory;
  }
}

export default MotionSensor;
