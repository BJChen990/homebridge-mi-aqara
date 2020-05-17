import { createCipheriv } from "crypto";
import { EventEmitter } from "events";
import { AqaraNetwork } from "./aqara_network";
import {
  AqaraRawResponseMessage,
  AqaraGetIdListAckRawMessage,
  AqaraGetIdListAckParsedMessage,
  AqaraReadAckRawMessage,
  AqaraReadAckParsedMessage,
  AqaraWriteAckParsedMessage,
  AqaraWriteAckRawMessage,
  AqaraWriteMessage,
  AqaraParsedResponseMessage,
} from "./types";
import { RemoteInfo } from "dgram";

const IV = Buffer.from([
  0x17,
  0x99,
  0x6d,
  0x09,
  0x3d,
  0x28,
  0xdd,
  0xb3,
  0xba,
  0x69,
  0x5a,
  0x2e,
  0x6f,
  0x58,
  0x56,
  0x2e,
]);

export interface ReadRequest {
  serialId: string;
}

export interface WriteRequest<T> {
  aqaraProtocolToken: string;
  password: string;
  subId: string;
  data: T;
}

export class AqaraNetworkClient extends EventEmitter {
  constructor(
    private readonly client: AqaraNetwork,
    private readonly timeout = 3000
  ) {
    super();
    this.client.on("message", (rawMessage, remoteInfo) => {
      const message =
        rawMessage.cmd === "iam"
          ? rawMessage
          : { ...rawMessage, data: JSON.parse(rawMessage.data) };
      this.emit(message.cmd, message, remoteInfo);
      this.emit("message", message, remoteInfo);
    });
  }

  on<T extends AqaraParsedResponseMessage>(
    event: T["cmd"],
    callback: (message: T, remoteInfo: RemoteInfo) => void
  ): this;
  on(event: string, callback: (...args: any[]) => void): this {
    return super.on(event, callback);
  }

  off<T extends AqaraParsedResponseMessage>(
    event: T["cmd"],
    callback: (message: T, remoteInfo: RemoteInfo) => void
  ): this;
  off(event: string, callback: (...args: any[]) => void): this {
    return super.off(event, callback);
  }

  whoIs() {
    return this.client.broadcast({ cmd: "whois" });
  }

  async getIdList(
    port: number,
    address: string
  ): Promise<AqaraGetIdListAckParsedMessage> {
    return new Promise<AqaraGetIdListAckParsedMessage>((resolve, reject) => {
      const handler = (
        message: AqaraGetIdListAckParsedMessage,
        remoteInfo: RemoteInfo
      ) => {
        if (remoteInfo.address !== address || remoteInfo.port !== port) {
          return;
        }
        this.off("get_id_list_ack", handler);
        resolve(message);
      };
      setTimeout(() => {
        this.off("get_id_list_ack", handler);
        reject(new Error("timeout when getting ID list."));
      }, this.timeout);
      this.on("get_id_list_ack", handler);
      this.client.send({ cmd: "get_id_list" }, port, address);
    });
  }

  read<R>(req: ReadRequest, port: number, address: string) {
    return new Promise<AqaraReadAckParsedMessage<R>>((resolve, reject) => {
      const handler = (message: AqaraReadAckParsedMessage<R>) => {
        if (message.cmd !== "read_ack" || message.sid !== req.serialId) {
          return;
        }
        this.off("read_ack", handler);
        resolve(message);
      };
      setTimeout(() => {
        this.off("read_ack", handler);
        reject(new Error("timeout when getting ID list."));
      }, this.timeout);
      this.on("read_ack", handler);
      this.client.send({ cmd: "read", sid: req.serialId }, port, address);
    });
  }

  write<Request, Response>(
    req: WriteRequest<Request>,
    port: number,
    address: string
  ) {
    return new Promise<AqaraWriteAckParsedMessage<Response>>(
      (resolve, reject) => {
        const handler = (message: AqaraWriteAckParsedMessage<Response>) => {
          if (message.sid !== req.subId) {
            return;
          }
          this.off("write_ack", handler);
          resolve(message);
        };
        setTimeout(() => {
          this.off("write_ack", handler);
          reject(new Error("timeout when getting ID list."));
        }, this.timeout);
        this.on("write_ack", handler);

        const cipher = createCipheriv("aes-128-cbc", req.password, IV);
        var key = cipher.update(req.aqaraProtocolToken, "ascii", "hex");
        cipher.final("hex"); // Useless data, don't know why yet.

        const message: AqaraWriteMessage<Request> = {
          cmd: "write",
          sid: req.subId,
          data: { key, ...req.data },
        };
        this.client.send(message, port, address);
      }
    );
  }
}
