import IModule from "../../module";
import MessageLike from "../../message-like";
import { User, generateUserId, isOp, isBlocked, api } from "../../misskey";
import { IDatabase } from "./database";
import createDatabase from "./databases";
import config from "../../config";
import * as moment from "moment";
import WordFilter from "./word-filter";
const MarkovJa = require("markov-ja");

export default class MarkovSpeakingModule implements IModule {
  public readonly priority = 1;
  public readonly name = "markovSpeaking";
  public readonly commands = [
    {
      name: "markov reset",
      desc: "Explode the DB of NLP related data",
    },
    {
      name: "markov delete",
      desc: "Remove chains containing specified morphemes",
    },
  ];
  private markov: any;
  private database!: IDatabase;
  private filter!: WordFilter;

  private get sentenceLength(): number {
    function getRandomInt(max) {
      return Math.floor(Math.random() * Math.floor(max));
    }
    if (config.sentenceLengthRange) {
      let l = config.sentenceLengthRange.start;
      let r = config.sentenceLengthRange.end;
      return getRandomInt(r - l + 1) + l;
    } else return 1;
  }

  public install() {
    this.markov = new MarkovJa();
    this.database = createDatabase(config.database.type, this.markov);
    this.database.load();
    this.filter = new WordFilter();
    this.filter.init();

    if (config.intervalPost) {
      let duration = moment
        .duration(
          config.intervalPostDuration.value,
          config.intervalPostDuration.unit
        )
        .asMilliseconds();
      if (duration == 0) {
        console.error(
          "Bad duration setting. intervalPost feature is disabled."
        );
      }
      setInterval(async () => {
        let text = "";
        text += this.markov.generate(this.sentenceLength).join("\n");
        let res = await api("notes/create", {
          text: text,
          visibility: config.visibility,
          localOnly: true,
        });
        const json = (await res.json()) as { error?: unknown }; // Force convert to { error?: unknown }
        if (json.error) {
          console.error("An error occured while creating the interval post");
          console.error(`content: ${text}`);
          console.error(json.error);
        } else {
          console.log("Successfully posted on setInterval");
        }
      }, duration);
    }
  }

  public learn(sender: User, message: string) {
    // if "allowLearn" is specified as "false"...
    // (backward compatibility)
    if (config.markovSpeaking.allowLearn == false) return;
    if (!isBlocked(sender) && message) {
      this.markov.learn(
        message.replace(/@[A-Za-z0-9_]+(?:@[A-Za-z0-9\.\-]+[A-Za-z0-9])?/g, "")
      );
    }
  }

  public onNote(note: any) {
    this.database.updateSave();
    let bad = this.filter.isBad(note.text);
    if (
      !bad &&
      !(!config.markovSpeaking.allowLearnCW && note.cw) &&
      !(
        !config.markovSpeaking.allowLearnVisFollowers &&
        note.visibility === "followers"
      )
    )
      this.learn(note.user, note.text);
    console.log(
      `${isBlocked(note.user) ? "><" : ""}${bad ? "B* " : ""}|${
        note.user.name
      }(${generateUserId(note.user)}): ${note.text}`
    );
  }
  public async onCommand(msg: MessageLike, cmd: string[]): Promise<boolean> {
    if (cmd[0] == "markov") {
      switch (cmd[1]) {
        case "reset":
          if (isOp(msg.user)) {
            this.database.reset();
            msg.reply("👍");
          } else {
            msg.reply("👎(You don't have a permission)");
          }
          break;
        case "delete":
          if (isOp(msg.user)) {
            this.markov.removeTriplets(cmd.slice(2).join(""));
            msg.reply(`👍\n\`${cmd.slice(2)}\``);
          } else {
            msg.reply("👎(You don't have a permission)");
          }
          break;
        default:
          msg.reply(
            "markov: /markov <reset>\nOnly op-ed users can run this command."
          );
          break;
      }
      return true;
    } else return false;
  }
  public onMention(msg: MessageLike): boolean {
    if (msg.text) this.learn(msg.user, msg.text);
    if (msg.isMessage)
      console.log(
        `${isBlocked(msg.user) ? "><" : ""}*${msg.user.name}(@${generateUserId(
          msg.user
        )}): ${msg.text}`
      );
    let speech: string;
    try {
      speech = this.markov.generate(this.sentenceLength).join("\n");
    } catch (e) {
      speech = "...";
    }
    if (speech.trim() == "") speech = "...";
    try {
      msg.reply(speech);
    } catch (e) {
      console.error("ERROR! Couldn't reply!");
      console.error(e);
      return false;
    }
    return true;
  }
  public info(): string {
    let res: string = `Database: ${
      config.database.type
    }, ${this.database.size()} / ${config.database.maxSize} (${
      (this.database.size() / config.database.maxSize) * 100
    }%)\nFilters: ${config.markovSpeaking.wordFilterFiles},${
      config.markovSpeaking.wordFilterURL
    }`;
    return res;
  }

  public onInterrupted() {
    this.database.onInterrupted();
  }
}
