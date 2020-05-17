import { AccessoryPlugin, GatewayAccessory } from "./types";
import {
  Categories,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  Characteristic,
  Service,
  CharacteristicSetCallback,
  CharacteristicValue,
} from "homebridge";
import {
  AqaraDeviceHeartbeatParsedMessage,
  AqaraReadAckParsedMessage,
  AqaraReportParsedMessage,
} from "../aqara_service/types";

const Accessory: AccessoryPlugin = {
  name: "Outlet",
  category: Categories.OUTLET,
  information: {
    manufacturer: "Aqara",
    model: "Outlet",
  },
};

interface OutletData {
  voltage?: number;
  status: "on" | "off";
  inuse?: "0" | "1";
  power_consumed?: string;
  load_power?: string;
}

const IN_USE_REQUEST_INTERVAL = 10000;

class Outlet extends GatewayAccessory {
  private status: {
    on: boolean;
    inUse: boolean;
  } = { on: false, inUse: false };
  private outlet: Service | undefined;

  init() {
    this.client.on("report", this.handleMessage);
    this.client.on("heartbeat", this.handleMessage);
    this.outletStatus();
    const interval = setInterval(
      () => this.outletStatus(),
      IN_USE_REQUEST_INTERVAL
    );
    this.homebridge.on("shutdown", () => {
      clearInterval(interval);
    });
  }

  private outletStatus = async () => {
    const message = await this.read<OutletData>();
    this.handleMessage(message);
  };

  private readonly handleMessage = (
    message:
      | AqaraReportParsedMessage<OutletData>
      | AqaraDeviceHeartbeatParsedMessage<OutletData>
      | AqaraReadAckParsedMessage<OutletData>
  ) => {
    const { data, sid } = message;
    if (sid !== this.config.serialId) {
      return;
    }
    this.updateStatus(typeof data === "string" ? JSON.parse(data) : data);
  };

  private readonly updateStatus = (aqaraStatus: OutletData) => {
    const { status, inuse } = aqaraStatus;
    if (status) {
      this.status.on = status === "on";
    }
    if (inuse) {
      this.status.inUse = inuse === "1";
    }
    this.logger.debug(
      "outlet on %s, in use: %s",
      this.status.on,
      this.status.inUse
    );
    this.outlet?.updateCharacteristic(Characteristic.On, this.status.on);
    this.outlet?.updateCharacteristic(
      Characteristic.OutletInUse,
      this.status.inUse
    );
  };

  private readonly getOn = (callback: CharacteristicGetCallback) => {
    callback(null, this.status.on);
  };

  private readonly setOn = async (
    value: CharacteristicValue,
    callback: CharacteristicSetCallback
  ) => {
    try {
      const newStatus = value ? "on" : "off";
      this.updateStatus({ status: newStatus });
      await this.write({ status: value ? "on" : "off" });
      callback(null);
    } catch (err) {
      callback(err);
    }
  };

  private readonly getOutletInUse = (callback: CharacteristicGetCallback) => {
    callback(
      null,
      this.status.inUse
        ? Characteristic.InUse.IN_USE
        : Characteristic.InUse.NOT_IN_USE
    );
  };

  getAccessory() {
    const { Service, Characteristic } = this.homebridge.hap;
    const accessory = this.createAccessory(Accessory);
    this.outlet = accessory.addService(Service.Outlet);
    this.outlet
      .getCharacteristic(Characteristic.On)
      .on(CharacteristicEventTypes.GET, this.getOn)
      .on(CharacteristicEventTypes.SET, this.setOn);
    this.outlet
      .getCharacteristic(Characteristic.OutletInUse)
      .on(CharacteristicEventTypes.GET, this.getOutletInUse);

    return accessory;
  }
}

export default Outlet;
