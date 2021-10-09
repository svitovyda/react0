import React from "react";

export interface TestComponentProps {
  text: string;
}

export const TestComponent: React.FC<TestComponentProps> = (props: TestComponentProps) => {
  return <div>{props.text}</div>;
};

TestComponent.displayName = "TestComponent";
