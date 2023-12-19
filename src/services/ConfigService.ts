import type { ConfigJson } from "../models/ConfigJson";
import configJson from "config";

export const ConfigService = {
  getConfig: (): ConfigJson => ({
    welcomeMessage: configJson.welcomeMessage ?? "Hello World!",
  }),
};
