import { Accessory } from "homebridge";

export default class AccessoryUtil {
  accessories: { [uuid: string]: Accessory } = {};

  getByUUID(uuid: string) {
    return uuid in this.accessories ? this.accessories[uuid] : null;
  }

  add(accessory: Accessory) {
    this.accessories[accessory.UUID] = accessory;
    return accessory;
  }

  remove(uuid: string) {
    delete this.accessories[uuid];
  }

  getAll() {
    return this.accessories;
  }
}

module.exports = AccessoryUtil;