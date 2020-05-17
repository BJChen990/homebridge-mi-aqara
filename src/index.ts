import { API, Logger, PlatformAccessory, PlatformConfig } from "homebridge";
import { MODLE_TO_PLUGIN_LOOKUP } from "./accessories/accessory_table";
import { notNull } from "./utilities";

import { DynamicPlatformPlugin } from "homebridge/lib/api";

import { AqaraNetworkClient } from "./aqara_service/aqara_client";
import { GatewayAccessory } from "./accessories/types";
import { MiIOClient, MiIONetwork } from "simple-miio";
import { AqaraNetwork } from "./aqara_service/aqara_network";
import {
  AqaraIAmMessage,
  AqaraGatewayHeartbeatParsedMessage,
} from "./aqara_service/types";
import { Preconditions } from "./utils/preconditions";

const protocolClient = new AqaraNetwork({
  multicastAddress: "224.0.0.50",
  multicastPort: 4321,
  serverPort: 9898,
});

export default function (homebridge: API) {
  homebridge.registerPlatform(
    "homebridge-mi-aqara",
    "MiAqaraPlatform",
    MiAqaraPlatform
  );
}

interface GatewayConfig extends PlatformConfig {
  gateways: {
    [serialId: string]: {
      aqaraProtocolPassword?: string;
      miioToken?: string;
    };
  };
}

const miIONetworking = new MiIONetwork();

interface GWT {
  serialId: string;
  port: number;
  address: string;
  token: string;
}

interface DIF {
  serialId: string;
  model: string;
  gatewayId: string;
}

class GatewayTree {
  private readonly gatewayMap = new Map<string, GWT>();
  private readonly deviceMap = new Map<string, DIF>();

  upsertGateway(info: GWT) {
    this.gatewayMap.set(info.serialId, info);
    return info;
  }

  getGateway(serialId: string) {
    return this.gatewayMap.get(serialId);
  }

  upsertDevice(info: DIF) {
    this.deviceMap.set(info.serialId, info);
    return info;
  }
}

type PluginModule = {
  default: typeof GatewayAccessory;
};

class MiAqaraPlatform implements DynamicPlatformPlugin {
  private readonly aqaraClient: AqaraNetworkClient;
  private readonly cachedAccessories: PlatformAccessory[] = [];
  private platformConfig: GatewayConfig;
  private readonly gatewayTree: GatewayTree = new GatewayTree();
  private readonly devices: {
    [uuid: string]: { gateway: string; accessory?: PlatformAccessory };
  } = {};

  constructor(
    private readonly logger: Logger,
    config: PlatformConfig,
    private readonly homebridge: API
  ) {
    this.platformConfig = config as GatewayConfig;
    this.aqaraClient = new AqaraNetworkClient(protocolClient);
    this.homebridge.on("didFinishLaunching", () => {
      this.homebridge.unregisterPlatformAccessories(
        "homebridge-mi-aqara",
        "MiAqaraPlatform",
        this.cachedAccessories
      );
      this.discoverAccessoryGraph();
    });
  }

  async discoverAccessoryGraph() {
    this.aqaraClient.on(
      "heartbeat",
      (message: AqaraGatewayHeartbeatParsedMessage<any>, remoteInfo) => {
        if (message.model !== "gateway") {
          return;
        }
        this.gatewayTree.upsertGateway({
          serialId: message.sid,
          address: remoteInfo.address,
          port: remoteInfo.port,
          token: message.token,
        });
      }
    );
    this.aqaraClient.on("iam", async (message: AqaraIAmMessage) => {
      const plugins = await this.updateGatewayDevices(message);
      this.homebridge.registerPlatformAccessories(
        "homebridge-mi-aqara",
        "MiAqaraPlatform",
        plugins.map(plugin => plugin.getAccessory())
      );
    });
    this.aqaraClient.whoIs();
  }

  private loadDevice = async (serialId: string, gatewayId: string) => {
    const { port, address } = Preconditions.checkExists(
      this.gatewayTree.getGateway(gatewayId)
    );
    const { model } = await this.aqaraClient.read({ serialId }, port, address);
    return this.gatewayTree.upsertDevice({ serialId, model, gatewayId });
  };

  private updateGatewayDevices = async (message: AqaraIAmMessage) => {
    const { sid: serialId, ip } = message;
    const port = parseInt(message.port, 10);
    const { token, data } = await this.aqaraClient.getIdList(port, ip);
    this.gatewayTree.upsertGateway({
      serialId,
      port,
      address: ip,
      token: token,
    });
    const plugins = await Promise.all(
      [...data, serialId].map(deviceId =>
        this.loadDevice(deviceId, serialId).then(deviceInfo =>
          this.createAccessory(deviceInfo)
        )
      )
    );
    return plugins.filter(notNull);
  };

  private async createAccessory(
    deviceInfo: DIF
  ): Promise<GatewayAccessory | undefined> {
    const path = MODLE_TO_PLUGIN_LOOKUP[deviceInfo.model];
    if (!path) {
      return;
    }
    const gateway = Preconditions.checkExists(
      this.gatewayTree.getGateway(deviceInfo.gatewayId)
    );
    const gatewayConfig = this.platformConfig.gateways[deviceInfo.gatewayId];
    const module: PluginModule = await import(path);
    const accessory = new module.default(
      this.logger,
      {
        gateway: {
          ...gateway,
          ...gatewayConfig,
        },
        model: deviceInfo.model,
        serialId: deviceInfo.serialId,
      },
      this.homebridge,
      this.aqaraClient,
      deviceInfo.model === "gateway"
        ? new MiIOClient(
            miIONetworking,
            Preconditions.checkExists(gatewayConfig.miioToken),
            gateway.address
          )
        : undefined
    );
    accessory.init();
    return accessory;
  }

  getDiffs(accessoryInfoList: { accessory: PlatformAccessory }[]) {
    const accessoryMap = accessoryInfoList
      .map<[string, PlatformAccessory]>(({ accessory }) => [
        accessory.UUID,
        accessory,
      ])
      .reduce<{ [uuid: string]: PlatformAccessory }>(
        (accu, [key, accessory]) => {
          accu[key] = accessory;
          return accu;
        },
        {}
      );
    const newAccessorySet = new Set(Object.keys(accessoryMap));
    const oldAccessorySet = new Set(Object.keys(this.devices));
    const toAdd = [];
    const toUpdate = [];
    for (const newUUID of newAccessorySet.keys()) {
      if (oldAccessorySet.has(newUUID)) {
        toUpdate.push(newUUID);
        oldAccessorySet.delete(newUUID);
        continue;
      }
      toAdd.push(newUUID);
    }
    const toRemove = Array.from(oldAccessorySet);
    return { toAdd, toRemove, toUpdate };
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.cachedAccessories.push(accessory);
  }
}
