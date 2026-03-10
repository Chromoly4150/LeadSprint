# Architecture Direction

## Chosen direction

LeadSprint should start as a **modular monolith**.

## Why

A modular monolith fits the current stage of the product because it allows:
- faster iteration
- simpler deployment
- easier local development
- less operational overhead
- clearer end-to-end ownership while the domain is still evolving

At this stage, the main complexity is product/workflow complexity, not internet-scale infrastructure.

## Architectural intent

Use a single deployable application, but structure it internally as clear modules/bounded areas such as:
- organizations / users / permissions
- leads / contacts / companies
- inbound intake
- messaging / conversations
- automation / bot engagement
- reporting / exports
- integrations

## Guiding rule

Optimize for:
- clear module boundaries
- shared database with disciplined schemas
- internal service boundaries in code
- the option to extract components later only if scale or team shape requires it

## Near-term implication

Do not prematurely split into microservices.

The first architectural goal is to make one reliable product that handles:
- inbound lead intake
- rapid response
- human handoff
- team-based access control

That is a better fit for a modular monolith than for an early distributed system.
