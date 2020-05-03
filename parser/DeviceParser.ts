import { HAP, Accessory } from "homebridge";
import AccessoryParser from "./AccessoryParser";

type AccessoryParserInfo = {
    [key: string]: new (platform: HAP, key: string) => AccessoryParser;
}

abstract class DeviceParser {
  accessoriesParsers: { [key: string]: AccessoryParser } = {};

  constructor(private readonly platform: HAP) {
    this.initAccessoriesParser();
  }

  getAccessoriesUUID(deviceSid: string) {
    return Object.entries(this.accessoriesParsers)
        .reduce<{ [key: string]: string }>((result, [key, parser]) => {
            result[key] = parser.getAccessoryUUID(deviceSid);
            return result;
        }, {})
  }

  abstract getAccessoriesParserInfo(): AccessoryParserInfo;

  initAccessoriesParser() {
    Object.entries(this.getAccessoriesParserInfo()).forEach(
      ([key, constructor]) => {
        this.accessoriesParsers[key] = new constructor(this.platform, key);
      }
    );
  }

  getCreateAccessories(jsonObj: any): Accessory[] {
    return Object.values(this.accessoriesParsers)
        .map(parser => parser.getCreateAccessories(jsonObj))
        .filter((accessory: Accessory | null): accessory is Accessory => !!accessory);
  }

  parserAccessories(jsonObj: any) {
    Object.values(this.accessoriesParsers)
        .forEach(parser => parser.parserAccessories(jsonObj));
  }
}

module.exports = DeviceParser;