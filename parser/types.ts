import { HAP } from "homebridge";
import AccessoryUtil from '../lib/AccessoryUtil';
import LogUtil from "../lib/LogUtil";
import ConfigUtil from "../lib/ConfigUtil";

export type Platform = HAP & {
  AccessoryUtil: AccessoryUtil,
  ConfigUtil: ConfigUtil,
  log: LogUtil,
}