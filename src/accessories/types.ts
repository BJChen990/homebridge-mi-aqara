import { Categories, PlatformAccessory, API, Logger } from "homebridge";
import { MiIOClient } from "simple-miio";
import { AqaraNetworkClient } from "../aqara_service/aqara_client";
import { AqaraWriteAckParsedMessage } from "../aqara_service/types";

export interface AccessoryPlugin {
  category: Categories;
  name: string;
  information: {
    manufacturer: string;
    model: string;
  };
}

export interface PluginConfig {
  gateway: GatewayInfo;
  model: string;
  serialId: string;
}

export interface GatewayInfo {
  serialId: string;
  address: string;
  port: number;
  aqaraProtocolPassword?: string;
  miioToken?: string;
  token?: string;
}

export interface ReportMessage<T> {
  cmd: "report";
  model: string;
  sid: string;
  short_id: number;
  data: T;
}
export interface HeartbeatMessage<T> {
  cmd: "heartbeat";
  model: string;
  sid: string;
  short_id: number;
  data: T;
}

export class GatewayAccessory {
  constructor(
    protected readonly logger: Logger,
    protected readonly config: PluginConfig,
    protected readonly homebridge: API,
    protected readonly client: AqaraNetworkClient,
    protected readonly miioClient?: MiIOClient
  ) {}

  protected read<ResponseData>() {
    const { gateway, serialId } = this.config;
    return this.client.read<ResponseData>(
      { serialId: serialId },
      gateway.port,
      gateway.address
    );
  }

  protected write<Request, ResponseData>(
    data: Request
  ): Promise<AqaraWriteAckParsedMessage<ResponseData>> {
    const {
      aqaraProtocolPassword: password,
      token,
      port,
      address: ip,
      serialId: sid,
    } = this.config.gateway;
    if (!token || !password) {
      throw new Error("either password of token is not defined");
    }
    return this.client.write<Request, ResponseData>(
      {
        password,
        aqaraProtocolToken: token,
        subId: this.config.serialId,
        data,
      },
      port,
      ip
    );
  }

  init(): void {
    throw new Error("not implemented");
  }

  protected createAccessory(plugin: AccessoryPlugin) {
    const { name, category, information } = plugin;
    const { hap, platformAccessory } = this.homebridge;
    const uuid = hap.uuid.generate(this.config.serialId);
    const accessory = new platformAccessory(name, uuid, category);
    const {
      Service: { AccessoryInformation },
      Characteristic,
    } = hap;
    (
      accessory.getService(AccessoryInformation) ||
      accessory.addService(AccessoryInformation)
    )
      .setCharacteristic(Characteristic.Manufacturer, information.manufacturer)
      .setCharacteristic(Characteristic.Model, information.model)
      .setCharacteristic(Characteristic.SerialNumber, uuid);
    return accessory;
  }

  getAccessory(): PlatformAccessory {
    throw new Error("not implemented");
  }
}
