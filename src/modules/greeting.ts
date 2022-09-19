import IModule from "../module";
import MessageLike from "../message-like";

export default class GreetingModule implements IModule {
  public readonly priority = 2;
  public readonly name = "greeting";

  public install() {}

  public onMention(msg: MessageLike) {
    if (!msg.text) return false;
    let m = msg.text.match(/(おはよう|こんにちは|こんばんは|おやすみ)/);
    if (m) {
      msg.reply(`${m[1]}〜!`);
      return true;
    } else return false;
  }
}
