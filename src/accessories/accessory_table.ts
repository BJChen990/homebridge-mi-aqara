import { join } from "path";

export const MODLE_TO_PLUGIN_LOOKUP: { [key: string]: string } = {
  gateway: join(__dirname, "gateway_accessory"),
  "gateway.v3": join(__dirname, "gateway_accessory"),
  motion: join(__dirname, "motion_sensor_accessory"),
  magnet: join(__dirname, "contact_sensor_accessory"),
  sensor_ht: join(__dirname, "humidity_temperature_sensor_accessory"),
  switch: join(__dirname, "switch_accessory"),
  plug: join(__dirname, "outlet_accessory"),
};
