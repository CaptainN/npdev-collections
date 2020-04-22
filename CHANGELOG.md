# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1]
- Increment required versions to the latest.

## [0.2.0]
- Change `createListHook` to `createConnector`. The method still returns a react hook, but it also does other things like setting up server methods. It can now set up a single document data query. For these reasons, a more general name is appropriate.
- Add a `single` configuration property, to create a connector for a single document.
- Always call `validate` before `run` on server and client.
- No need to run through `useTracker` in server rendering.
- Switched to official `react-meteor-data` hook implementation.
- No longer export `useTracker` - users must migrate to import from `meteor:react-meteor-data`.

## [0.1.3]
- Fix error with importing useTracker correctly after making a local copy.

## [0.1.2]
- Include a copy of `useTracker` until the official package is released. This will be removed at some point, please don't rely on it.

## [0.1.1]
- **Breaking change**: Changed the format of the return data from an object with data, and loading props named after the connector name or nameProp value, to a tuple. Much simpler, and more flexible, but a breaking change from 0.1.0.

## [0.1.0]
- First version!
