# react0

A plane template of a React/Typescript project

A simple `App` react root component, one `TestComponent` that is styled and uses `props`, static assets
that just have to be copied as is, SVGs, that are available in code as a react component with the proper `props` type
Code is formatted by `prettier` and verified by `ESLint` before committing. Project has unit testing with react components
testing and code coverage.

## Requires
- `node v20.10.0` (works on 18 too)
- `yarn v1.22.10`

optional - `http-server` npm package (I used `13.0.2`)

## Uses
- `react` with `emotion` styling
- `webpack` module bundler with `babel` for `Typescript` compilation
- `yarn` package manager
- `LeftHook`/`Prettier`/`ESLint` code/formatting checking
- `jest` unit testing

## How to use
- clone
- run `yarn` in the root

`yarn start` to run in dev mode

`yarn build` to get the publish version in the `output` folder.
Optional: `npx http-server ./output` and navigate to `http://127.0.0.1:8080` to check how it works.

`yarn test` to run unit tests

`yarn test:full` to get the code tests coverage report


To debug tests in VS, see https://code.visualstudio.com/docs/editor/debugging#_launch-configurations

_Note:_ hawing `yarn.lock` in the repository helps team to make sure everyone uses absolutely the same packages versions
