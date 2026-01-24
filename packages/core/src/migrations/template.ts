import Handlebars from "handlebars";
import type { MigrationRunnerOptions } from "./types.js";

export const renderTemplate = (
  content: string,
  ctx: MigrationRunnerOptions["templateVars"] = {},
): string => {
  const template = Handlebars.compile(content);

  return template(ctx);
};
