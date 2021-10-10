import * as React from "react";
import { TestComponent } from "./TestComponent";
import Image2 from "./assets/gears2.svg";
import Image3 from "./assets/gears3.svg";

export const App: React.FC<{}> = () => {
  return (
    <>
      <Image3 width="80" height="80" fill="#ffffff" />
      <TestComponent text="Hello World!" />
      <Image2 width="80" height="80" fill="#ffffff" />
    </>
  );
};

App.displayName = "App";
