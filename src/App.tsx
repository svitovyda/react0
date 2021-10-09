import * as React from "react";
import { TestComponent } from "./TestComponent";
import Image from "./assets/gears2.svg";

export const App: React.FC<{}> = () => {
  return (
    <>
      <Image width="80" height="80" color="#ffffff" />
      <TestComponent text="Hello World!" />
    </>
  );
};

App.displayName = "App";
