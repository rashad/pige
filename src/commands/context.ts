import type { Config } from "../config/schema.js";

export type Context = {
  config: Config;
  now: Date;
  fresh: boolean;
};
