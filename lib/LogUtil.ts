import { Logger } from "homebridge";

export default class LogUtil {
  constructor(private readonly flag: string, private readonly log: Logger) {}

  debug(str: string) {
    this.log.debug(this.flag ? "[" + this.flag + "]" : "" + "[DEBUG]" + str);
  }

  info(str: string) {
    this.log.info(this.flag ? "[" + this.flag + "]" : "" + "[INFO]" + str);
  }

  warn(str: string) {
    this.log.warn(this.flag ? "[" + this.flag + "]" : "" + "[WARN]" + str);
  }

  error(str: string | Error) {
    this.log.error(this.flag ? "[" + this.flag + "]" : "" + "[ERROR]" + str);
    if (str instanceof Error) {
      this.log.debug(
        this.flag ? "[" + this.flag + "]" : "" + "[ERROR]" + str.stack
      );
    }
  }

  objKey2Str(obj: any) {
    var keys = "";
    try {
      for (var key in obj) {
        keys += key + ", ";
      }
      keys = keys.substring(0, keys.lastIndexOf(","));
    } catch (e) {}

    return keys;
  }
}

module.exports = LogUtil;