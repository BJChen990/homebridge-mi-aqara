import { API, Accessory, Service, HAP, Characteristic, Categories } from 'homebridge'; 
type Platform = HAP;
type AccessoryType = any;

declare module "./AccessoryParser" {
  class AccessoryParser {
    platform: Platform;
    accessoryType: AccessoryType;

    Accessory: HAP["Accessory"];
    PlatformAccessory: API["platformAccessory"];
    Characteristic: HAP["Characteristic"];
    Service: HAP["Service"];
    UUIDGen: HAP["uuid"];

    getAccessoryUUID(deviceSid: string, accessoryType?: AccessoryType): string;

    getAccessoryCategory(deviceSid: string): Categories;

    getAccessoryInformation(deviceSid: string): any;

    getServices(jsonObj: any, accessoryName: string): Service[];

    getCreateAccessories(jsonObj: any): Accessory | null;

    parserAccessories(jsonObj: any): any;

    getValueFrJsonObjData(jsonObj: any, valueKey: string): any | null;
    getValueFrJsonObjData1(jsonObj: any, valueKey: string): any | null;
    getValueFrJsonObjData2(jsonObj: any, valueKey: string): any | null;
    getLowBatteryByVoltage(voltage: number): 0 | 1;
    getBatteryLevelByVoltage(voltage: number): number;
    getStatusLowBatteryCharacteristicValue(
      jsonObj: any,
      defaultValue: 0 | 1
    ): 0 | 1;
    getBatteryLevelCharacteristicValue(
      jsonObj: any,
      defaultValue: number
    ): number;

    parserBatteryService(accessory: Accessory, jsonObj: any): void;

    callback2HB(
      deviceSid: string,
      characteristic: Characteristic,
      callback: (...args: any[]) => any,
      err: Error
    ): void;
  }
  // @ts-ignore
  export = AccessoryParser;
}
