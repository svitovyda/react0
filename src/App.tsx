import { TestComponent } from "./TestComponent";
import Image2 from "./assets/gears2.svg";
import Image3 from "./assets/gears3.svg";
import { ConfigService } from "./services/ConfigService";
import * as React from "react";

const config = ConfigService.getConfig();

export const App: React.FC<{}> = () => {
  return (
    <>
      <Image3 width="80" height="80" fill="#ffffff" />
      <TestComponent text={config.welcomeMessage} />
      <Image2 width="80" height="80" fill="#ffffff" />
    </>
  );
};
