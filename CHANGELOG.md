# Changelog

## v4.1.0 2022-04-04

- Node >= 12
- Amqplib 0.8.0
- Typescript 4.6.3
- nyc and tslint removed from the project

## v4.0.0 2019-12-02

- Support channel with confirmation mode.
- Methods `publish` and `sendToChannel` for standard mode resolve to `unknown`
  type and `Replies.Empty` for confirmation mode.

## v3.15.3 2019-10-10

- Updated dependencies.
- Uses `mocha-steps` for testing.
