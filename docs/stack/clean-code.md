# SOLID and Clean Code

Read this file before writing any code in observatory. Every change is held to
it; a reviewer rejects code that breaks it the same as code that fails to build.
It adds to [angular.md](angular.md) and [typescript.md](typescript.md) and does
not restate them.

## SOLID

- **Single responsibility.** A class, component, service or function has one
  reason to change. A component presents; a service owns logic, state or a
  side effect. When a description of it needs "and", split it.
- **Open/closed.** Add behaviour by adding a new implementation, not by growing
  a `switch` or an `if` chain in existing code. The core's 2D and 3D renderers
  are the model: both implement one `CoreRenderer` interface, and choosing one
  never edits the other.
- **Liskov substitution.** Any implementation of an interface can stand in for
  any other without the caller knowing. No implementation throws "not
  supported" for a method its interface promises.
- **Interface segregation.** Interfaces are small and named for what the caller
  needs (`DocumentReader`, `DocumentWriter`), not one wide interface every
  caller half-uses.
- **Dependency inversion.** Components and services depend on abstractions,
  provided through Angular's injector with an `InjectionToken` or an abstract
  class, never on a concrete data source, renderer or browser API. Tests swap
  the implementation through the same token.

## Clean Code

- **Names say intent.** `staleAfterHours`, not `n` or `data2`. A boolean reads
  as a question (`isStale`, `hasRuns`). No abbreviations the reader must decode.
- **Small functions that do one thing**, at one level of abstraction. Around 20
  lines is a signal to look again; a function that needs a comment to explain
  its sections wants to be several functions.
- **No magic numbers or strings.** Name each one as a constant beside the code
  that uses it, or in a shared constants file when more than one place does.
- **Few parameters.** More than three is a sign the values belong in one typed
  object.
- **No flag arguments.** A boolean that picks between two behaviours is two
  functions.
- **Command–query separation.** A function either changes state or returns a
  value, not both.
- **No dead code.** No commented-out code, unused exports, or unused
  parameters; git keeps the history.
- **Fail loudly at the edge, trust inside.** Validate outside input once, at
  the adapter that receives it; code behind it works with typed, valid values.
- **Files stay small.** A file past about 300 lines is a sign it holds more
  than one responsibility. The pages being migrated from pr-starmap were one
  file of thousands of lines; that is the thing this project exists to undo.

## Tests

- New logic in a service or a pure function comes with a unit test. Presenting
  components are tested where they carry behaviour, not for markup alone.
