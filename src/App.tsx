import * as React from "react";
import { TestComponent } from "./TestComponent";

export const App: React.FC<{}> = () => {
  return <TestComponent text="Hello World!" />;
};

App.displayName = "App";
