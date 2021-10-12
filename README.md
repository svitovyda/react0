# react0

A plane template of a React/Typescript project

A simple `App` react root component, one `TestComponent` that is styled and uses `props`, static assets 
that just have to be copied as is, SVGs, that are available in code as a react component with the proper `props` type
Code is formatted by `prettier` and verified by `ESLint` before committing. Project has unit testing with react components 
testing and code coverage.

## Requires
`node v12.22.1`

`yarn v1.22.10`

`typescript v4.0.3`


## Uses
- `react` with `emotion` styling
- `webpack` module bundler with `ts-loader` for `Typescript` compillation
- `yarn` package manager
- `Husky`/`Prettier`/`ESLint` code/formatting checking
- `jest` unit testing

## How to use
`yarn start` to run in dev mode

`yarn build` to get the publish version in the `output` folder

`yarn test` to run unit tests

`yarn test:full` to get the code tests coverage report


To debug tests in VS, see https://code.visualstudio.com/docs/editor/debugging#_launch-configurations 
