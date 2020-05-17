type ShortId = string | number;

type Raw<T> = T & { data: string };
type Parsed<T, D> = T & { data: D };

export interface AqaraWhoIsMessage {
  cmd: "whois";
}

export interface AqaraGetIdListMessage {
  cmd: "get_id_list";
}

export interface AqaraReadMessage {
  cmd: "read";
  sid: string;
}

export interface AqaraWriteMessage<T> {
  cmd: "write";
  sid: string;
  data: T & { key: string };
}

export type AqaraRequestMessage<T> =
  | AqaraWhoIsMessage
  | AqaraGetIdListMessage
  | AqaraReadMessage
  | AqaraWriteMessage<T>;

export interface AqaraIAmMessage {
  cmd: "iam";
  port: string;
  sid: string;
  model: string;
  proto_version: string;
  ip: string;
}

export interface AqaraGetIdListAckBaseMessage {
  cmd: "get_id_list_ack";
  sid: string;
  token: string;
}

export type AqaraGetIdListAckRawMessage = Raw<AqaraGetIdListAckBaseMessage>;
export type AqaraGetIdListAckParsedMessage = Parsed<
  AqaraGetIdListAckBaseMessage,
  string[]
>;

interface AqaraReadAckBaseMessage {
  cmd: "read_ack";
  model: string;
  sid: string;
  token: string;
}

export type AqaraReadAckRawMessage = Raw<AqaraReadAckBaseMessage>;
export type AqaraReadAckParsedMessage<T> = Parsed<AqaraReadAckBaseMessage, T>;

type AqaraDeviceHeartbeatBaseMessage = {
  cmd: "heartbeat";
  model: string;
  sid: string;
  short_id: ShortId;
};

type AqaraGatewayHeartbeatBaseMessage = Omit<
  AqaraDeviceHeartbeatBaseMessage,
  "model"
> & {
  model: "gateway";
  token: string;
};

export type AqaraHeartbeatRawMessage =
  | Raw<AqaraDeviceHeartbeatBaseMessage>
  | Raw<AqaraGatewayHeartbeatBaseMessage>;
export type AqaraGatewayHeartbeatParsedMessage<T> = Parsed<
  AqaraGatewayHeartbeatBaseMessage,
  T
>;
export type AqaraDeviceHeartbeatParsedMessage<T> = Parsed<
  AqaraDeviceHeartbeatBaseMessage,
  T
>;
interface AqaraReportBaseMessage {
  cmd: "report";
  model: string;
  sid: string;
  short_id: ShortId;
}

export type AqaraReportRawMessage = Raw<AqaraReportBaseMessage>;
export type AqaraReportParsedMessage<T> = Parsed<AqaraReportBaseMessage, T>;

interface AqaraWriteBaseMessage {
  cmd: "write_ack";
  model: string;
  sid: string;
  short_id: ShortId;
}

export type AqaraWriteAckRawMessage = Raw<AqaraWriteBaseMessage>;
export type AqaraWriteAckParsedMessage<T> = Parsed<AqaraWriteBaseMessage, T>;

export type AqaraParsedResponseMessage<T = {}> =
  | AqaraReportParsedMessage<T>
  | AqaraGatewayHeartbeatParsedMessage<T>
  | AqaraDeviceHeartbeatParsedMessage<T>
  | AqaraReadAckParsedMessage<T>
  | AqaraWriteAckParsedMessage<T>
  | AqaraGetIdListAckParsedMessage
  | AqaraIAmMessage;
export type AqaraRawResponseMessage =
  | AqaraReportRawMessage
  | AqaraHeartbeatRawMessage
  | AqaraReadAckRawMessage
  | AqaraGetIdListAckRawMessage
  | AqaraWriteAckRawMessage
  | AqaraIAmMessage;
