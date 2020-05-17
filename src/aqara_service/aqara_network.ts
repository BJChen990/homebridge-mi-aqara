import { EventEmitter } from "events";
import { Socket, createSocket, RemoteInfo } from "dgram";
import { AqaraRawResponseMessage, AqaraRequestMessage } from "./types";

export class AqaraNetwork extends EventEmitter {
  private clientPromise: Promise<Socket> | undefined;

  constructor(
    private readonly options: {
      multicastAddress: string;
      multicastPort: number;
      serverPort?: number;
    }
  ) {
    super();
  }

  on(
    event: "message",
    callback: (message: AqaraRawResponseMessage, info: RemoteInfo) => void
  ): this;
  on(event: string, callback: (...args: any[]) => void) {
    return super.on(event, callback);
  }

  private getClient() {
    if (this.clientPromise) {
      return this.clientPromise;
    }

    this.clientPromise = new Promise((resolve, reject) => {
      const client = createSocket({ type: "udp4", reuseAddr: true });
      client.on("error", err => {
        client.close();
        reject(err);
      });

      client.on("listening", () => {
        client.addMembership(this.options.multicastAddress);
        resolve(client);
      });
      client.on("message", (buffer, remoteInfo) => {
        const message = JSON.parse(
          buffer.toString()
        ) as AqaraRawResponseMessage;
        this.emit("message", message, remoteInfo);
      });

      client.bind(this.options.serverPort);
    });
    return this.clientPromise;
  }

  async broadcast<Request>(
    message: AqaraRequestMessage<Request>
  ): Promise<void> {
    const { multicastAddress, multicastPort } = this.options;
    return await this.send(message, multicastPort, multicastAddress);
  }

  async send<Request>(
    message: AqaraRequestMessage<Request>,
    port: number,
    address: string
  ): Promise<void> {
    const client = await this.getClient();
    const data = JSON.stringify(message);
    return new Promise((resolve, reject) => {
      client.send(data, port, address, err => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    });
  }
}
