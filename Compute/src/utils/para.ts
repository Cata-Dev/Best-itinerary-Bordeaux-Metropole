// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Messages {}

type MessageCode = keyof Messages;
type MessageData<C extends MessageCode> = Messages[C];

export interface Message<C extends MessageCode> {
  code: C;
  data: MessageData<C>;
}

export function makeMessage<C extends MessageCode>(code: C, data: MessageData<C>): Message<C> {
  return { code, data };
}

type DistributedMessage<C extends MessageCode> = C extends unknown ? Message<C> : never;

export function isMessage(message: unknown): message is DistributedMessage<MessageCode> {
  return (
    typeof message === "object" &&
    message !== null &&
    "code" in message &&
    typeof message.code === "string" &&
    "data" in message
  );
}
