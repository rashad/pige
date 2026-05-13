import type { Config } from "../config/schema.js";
import type { Locale, T } from "../i18n.js";

export type Context = {
  config: Config;
  now: Date;
  fresh: boolean;
  locale: Locale;
  t: T;
};
