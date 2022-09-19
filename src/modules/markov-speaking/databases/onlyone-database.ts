import { IDatabase } from "../database";
import * as moment from "moment";
import * as fs from "fs";
import config from "../../../config";
import Ai from "../../../ai";
import { api } from "../../../misskey";
const MarkovJa = require("markov-ja");

export default class OnlyOneDatabase implements IDatabase {
  public readonly markov: any;
  private unsavedPostCount: number = 0;

  constructor(markov: any) {
    this.markov = markov;
  }

  load() {
    try {
      this.markov.loadDatabase(fs.readFileSync(config.database.path), "utf-8");
    } catch (e) {
      this.markov.loadDatabase("{}");
    }
  }
  async save() {
    fs.writeFileSync(
      config.database.path,
      this.markov.exportDatabase(),
      "utf-8"
    );
    if (config.database.maxSize != 0) {
      const size = fs.statSync(config.database.path).size;
      if (size >= config.database.maxSize) {
        console.log(
          `database is too big. max = ${config.database.maxSize} <= size = ${size}.`
        );
        console.log("renaming the database file.");
        let res = await api("notes/create", {
          text: `【Information】\n\`\`\`\nデータベースが所定の大きさ(${config.database.maxSize}bytes)以上になったので、データベースが初期化されました。\nmax = ${config.database.maxSize} <= size = ${size}\n\`\`\``,
          visibility: config.visibility,
        });
        console.log(await res.json());
        fs.renameSync(
          config.database.path,
          `${config.database.path}-${moment().unix()}.json`
        );
        // this.markov.loadDatabase("{}")
        let oldTriplets: { [key: string]: number } = JSON.parse(
          this.markov.exportDatabase()
        );
        let newTriplets: { [key: string]: number } = {};
        for (const key of Object.keys(oldTriplets)) {
          let value = oldTriplets[key];
          let newValue = Math.floor(value * config.database.attenuationRate);
          if (newValue > 0) newTriplets[key] = newValue;
        }
        console.debug(JSON.stringify(newTriplets));
        this.markov.loadDatabase(JSON.stringify(newTriplets));
      }
    }
  }
  updateSave() {
    this.unsavedPostCount++;
    if (this.unsavedPostCount >= config.database.saveFrequency) {
      this.save();
      this.unsavedPostCount = 0;
    }
  }
  reset() {
    fs.writeFileSync(
      config.database.path,
      this.markov.exportDatabase(),
      "utf-8"
    );
    fs.renameSync(
      config.database.path,
      `${config.database.path}-${moment().unix()}.json`
    );
    this.markov.loadDatabase("{}");
  }
  size() {
    return fs.statSync(config.database.path).size;
  }
  onInterrupted() {
    this.save();
  }
}
