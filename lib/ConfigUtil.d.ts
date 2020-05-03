export default class ConfigUtil {
  isConfigGateway(gatewaySid: string): boolean

  isHostGateway(gatewaySid: string): boolean;

  getHosts(): { [sid: string]: { ip: string, port: string } };

  getMQTTConfig(): null;

  getManagePort(): string | null;
  getManagePassword(): string | null

  getGatewayPasswordByGatewaySid(gatewaySid: string): string | null;
  getAccessoryConfig(deviceSid: string): any

  getAccessoryAttribute<T>(deviceSid: string, accessoryType: string, attributeName: string, defaultValue: T): T;
  getAccessoryName(deviceSid: string, accessoryType: string): string;
  getAccessoryDisable(deviceSid: string, accessoryType: string): boolean;

  getAccessoryServiceType(deviceSid: string, accessoryType: string): null;

  getAccessorySyncValue(deviceSid: string, accessoryType: string): boolean;

  getAccessoryNoResponse(deviceSid: string, accessoryType: string): boolean;

  getAccessoryIgnoreWriteResult(deviceSid: string, accessoryType: string): boolean;
}
