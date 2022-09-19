import MessageLike from "./message-like";
import { User } from "./misskey";
import ICommand from "./command";

export default interface IModule {
  name: string;
  priority: number;
  commands?: Array<ICommand>;
  install: () => void;
  onMention?: (msg: MessageLike) => boolean;
  onNote?: (note: any) => void;
  onFollowed?: (user: User) => void;
  onInterrupted?: () => void;
  onCommand?: (msg: MessageLike, cmd: string[]) => Promise<boolean>;
  info?: () => string;
}
